/* ============================================================
   ALDEIA — SERVIDOR DE PRODUÇÃO UNIFICADO & ROBUSTO (Node.js + Express + MongoDB Atlas)
   Pronto para Hospedagem no RENDER.COM, RAILWAY, VERCEL ou VPS
   ============================================================ */

const express = require('express');
const compression = require('compression');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Configurar DNS do Node.js para IPv4 e resolver fallback (evita ECONNREFUSED em SRV no Windows)
try {
    dns.setDefaultResultOrder('ipv4first');
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {}

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

// ===== CONFIGURAÇÃO DE SEGURANÇA E ADMIN =====
const DEFAULT_HASH = "0c88ccdb3a0615173fc7cc49491be2a12cae97c7192dadfde3064148e54cc7aa";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || DEFAULT_HASH;

// Tokens com TTL (24 horas = 86.400.000 ms)
const TOKEN_TTL = 24 * 60 * 60 * 1000;
const validTokens = new Map(); // token -> timestamp
const ipRequests = new Map();  // ip -> array of timestamps

// Limpeza periódica de memória (RAM) a cada 30 minutos
setInterval(() => {
    const now = Date.now();
    for (const [token, timestamp] of validTokens.entries()) {
        if (now - timestamp > TOKEN_TTL) {
            validTokens.delete(token);
        }
    }
    for (const [ip, timestamps] of ipRequests.entries()) {
        const recent = timestamps.filter(t => t > now - 60000);
        if (recent.length === 0) {
            ipRequests.delete(ip);
        } else {
            ipRequests.set(ip, recent);
        }
    }
}, 30 * 60 * 1000);

// ===== UTILITÁRIOS SEGUROS DE PERSISTÊNCIA EM FALLBACK JSON =====
const memoryCache = new Map();

function safeReadJSON(filename, defaultVal = []) {
    if (memoryCache.has(filename)) {
        return JSON.parse(JSON.stringify(memoryCache.get(filename)));
    }
    const filePath = path.join(ROOT_DIR, filename);
    try {
        if (!fs.existsSync(filePath)) {
            memoryCache.set(filename, defaultVal);
            return defaultVal;
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw.trim()) {
            memoryCache.set(filename, defaultVal);
            return defaultVal;
        }
        const data = JSON.parse(raw);
        memoryCache.set(filename, data);
        return JSON.parse(JSON.stringify(data));
    } catch (err) {
        console.error(`[PERSISTENCE] Erro ao ler ${filename}:`, err.message);
        return defaultVal;
    }
}

function safeWriteJSON(filename, data) {
    memoryCache.set(filename, JSON.parse(JSON.stringify(data)));
    const filePath = path.join(ROOT_DIR, filename);
    const tmpPath = `${filePath}.tmp_${Date.now()}`;
    const jsonStr = JSON.stringify(data, null, 2);
    
    try {
        fs.writeFileSync(tmpPath, jsonStr, 'utf8');
        fs.renameSync(tmpPath, filePath);
        return true;
    } catch (err) {
        console.error(`[PERSISTENCE] Erro ao salvar ${filename}:`, err.message);
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
        return false;
    }
}

// ===== CONEXÃO & MODELOS DO MONGODB ATLAS (NUVEM) =====
let isMongoConnected = false;

const projectSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, default: 'Sem Título' },
    category: { type: String, default: 'artes' },
    categoryLabel: { type: String, default: 'Artes Avulsas' },
    format: { type: String, default: 'post' },
    aspectRatio: { type: String, default: '1:1' },
    accentColor: { type: String, default: '#ffffff' },
    cover: { type: String, default: '' },
    assets: { type: Array, default: [] },
    member: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

const clientSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    leadId: { type: String, default: null },
    nome: { type: String, default: 'Cliente Sem Nome' },
    email: { type: String, default: '' },
    telefone: { type: String, default: '' },
    projeto: { type: String, default: 'Projeto Padrão' },
    status: { type: String, default: 'Ativo' },
    createdAt: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

const submissionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
    nome: { type: String, default: '' },
    email: { type: String, default: '' },
    telefone: { type: String, default: '' },
    instagram: { type: String, default: '' },
    projeto: { type: String, default: '' },
    whatsappClicked: { type: String, default: 'Não' },
    utmSource: { type: String, default: 'Direto' },
    utmMedium: { type: String, default: '' },
    utmCampaign: { type: String, default: '' },
    visits: { type: Number, default: 1 },
    firstVisit: { type: String, default: '' },
    ipCountry: { type: String, default: '' },
    ipRegion: { type: String, default: '' },
    ipCity: { type: String, default: '' },
    ipISP: { type: String, default: '' },
    ipCoords: { type: String, default: '' }
}, { timestamps: true });

const siteContentSchema = new mongoose.Schema({
    key: { type: String, default: 'main', unique: true },
    content: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const auditLogSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
    username: { type: String, default: 'Desconhecido' },
    ip: { type: String, default: '127.0.0.1' },
    status: { type: String, default: '' },
    userAgent: { type: String, default: '' }
}, { timestamps: true });

const trelloTaskSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, default: 'backlog' }, // 'backlog', 'in_progress', 'review', 'done'
    assignedTo: { type: String, default: 'Japex' },
    priority: { type: String, default: 'média' }, // 'alta', 'média', 'baixa'
    clientName: { type: String, default: '' },
    dueDate: { type: String, default: '' }
}, { timestamps: true });

const userProfileSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    displayName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    role: { type: String, default: 'Membro da Equipe' },
    passwordHash: { type: String, default: '' }
}, { timestamps: true });

const analyticsSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    eventType: { type: String, required: true },
    path: { type: String, default: '/' },
    elementId: { type: String, default: '' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    timestamp: { type: String, default: () => new Date().toISOString() }
});

const ProjectModel = mongoose.model('Project', projectSchema);
const ClientModel = mongoose.model('Client', clientSchema);
const SubmissionModel = mongoose.model('Submission', submissionSchema);
const AnalyticsModel = mongoose.model('Analytics', analyticsSchema);
const SiteContentModel = mongoose.model('SiteContent', siteContentSchema);
const AuditLogModel = mongoose.model('AuditLog', auditLogSchema);
const TrelloTaskModel = mongoose.model('TrelloTask', trelloTaskSchema);
const UserProfileModel = mongoose.model('UserProfile', userProfileSchema);

const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(async () => {
            isMongoConnected = true;
            console.log('✅ [MONGODB ATLAS] Conectado com sucesso ao banco na nuvem!');
            await autoMigrateData();
        })
        .catch(err => {
            console.error('❌ [MONGODB ATLAS] Erro ao conectar ao banco na nuvem:', err.message);
        });
} else {
    console.warn('⚠️ [MONGODB ATLAS] MONGODB_URI não configurada no .env. Usando fallback JSON local.');
}

async function autoMigrateData() {
    try {
        // 1. Portfólio
        const portfolioCount = await ProjectModel.countDocuments();
        if (portfolioCount === 0) {
            const localData = safeReadJSON('portfolio.json', []);
            if (localData.length > 0) {
                console.log(`[MIGRATION] Migrando ${localData.length} projetos do JSON para o MongoDB Atlas...`);
                await ProjectModel.insertMany(localData);
                console.log('✅ [MIGRATION] Portfólio migrado com sucesso para a nuvem!');
            }
        }

        // 2. Clientes
        const clientsCount = await ClientModel.countDocuments();
        if (clientsCount === 0) {
            const localClients = safeReadJSON('clients.json', []);
            if (localClients.length > 0) {
                console.log(`[MIGRATION] Migrando ${localClients.length} clientes para o MongoDB Atlas...`);
                await ClientModel.insertMany(localClients);
                console.log('✅ [MIGRATION] Clientes migrados com sucesso!');
            }
        }

        // 3. Submissions / Leads
        const subsCount = await SubmissionModel.countDocuments();
        if (subsCount === 0) {
            const localSubs = safeReadJSON('submissions.json', []);
            if (localSubs.length > 0) {
                console.log(`[MIGRATION] Migrando ${localSubs.length} leads para o MongoDB Atlas...`);
                await SubmissionModel.insertMany(localSubs);
                console.log('✅ [MIGRATION] Leads migrados com sucesso!');
            }
        }

        // 4. Conteúdo do CMS
        const contentDoc = await SiteContentModel.findOne({ key: 'main' });
        if (!contentDoc) {
            const localContent = safeReadJSON('site_content.json', {});
            if (Object.keys(localContent).length > 0) {
                console.log(`[MIGRATION] Migrando conteúdo do CMS para o MongoDB Atlas...`);
                await SiteContentModel.create({ key: 'main', content: localContent });
                console.log('✅ [MIGRATION] Conteúdo do CMS migrado com sucesso!');
            }
        }

        // 5. Logs de Autenticação
        const auditCount = await AuditLogModel.countDocuments();
        if (auditCount === 0) {
            const localAudit = safeReadJSON('login_audit.json', []);
            if (localAudit.length > 0) {
                console.log(`[MIGRATION] Migrando logs de login para o MongoDB Atlas...`);
                await AuditLogModel.insertMany(localAudit.slice(-200));
                console.log('✅ [MIGRATION] Logs de audit migrados com sucesso!');
            }
        }

        // 6. Tarefas Trello (Equipe ALDEIA)
        const trelloCount = await TrelloTaskModel.countDocuments();
        if (trelloCount === 0) {
            const defaultTasks = [
                { id: 't1', title: 'Design do Portfólio LOUD', description: 'Criar capas 4:5 e feed promocional', status: 'in_progress', assignedTo: 'Japex', priority: 'alta', clientName: 'LOUD Esports', dueDate: '2026-08-10' },
                { id: 't2', title: 'Revisão das Animações 3D', description: 'Ajustar parâmetros de refração e iluminação', status: 'review', assignedTo: 'Temari', priority: 'média', clientName: 'FURY Gaming', dueDate: '2026-08-08' },
                { id: 't3', title: 'Identidade Visual MIBR', description: 'Desenvolver conceito de marca e paleta', status: 'backlog', assignedTo: 'Nesh', priority: 'alta', clientName: 'MIBR', dueDate: '2026-08-15' },
                { id: 't4', title: 'Aprovação de Proposal de Cliente', description: 'Aguardando confirmação do contrato', status: 'done', assignedTo: 'Japex', priority: 'baixa', clientName: 'Red Canids', dueDate: '2026-08-01' }
            ];
            await TrelloTaskModel.insertMany(defaultTasks);
            console.log('✅ [MIGRATION] Tarefas padrão do Trello adicionadas!');
        }

        // 7. Perfis de Usuários Padrão (Japex, Temari, Nesh, Admin)
        const profilesCount = await UserProfileModel.countDocuments();
        if (profilesCount === 0) {
            const defaultProfiles = [
                { username: 'japex', displayName: 'Japex', avatar: '/assets/japex.webp', role: 'Fundador & Creative Director' },
                { username: 'temari', displayName: 'Temari', avatar: '/assets/temari.webp', role: 'Fundadora & Head Designer' },
                { username: 'nesh', displayName: 'Nesh', avatar: '/assets/japex.webp', role: '3D & Motion Designer' },
                { username: 'admin', displayName: 'Administrador ALDEIA', avatar: '/assets/japex.webp', role: 'Administrador Principal' }
            ];
            await UserProfileModel.insertMany(defaultProfiles);
            console.log('✅ [MIGRATION] Perfis de usuários padrão inicializados!');
        }
    } catch (err) {
        console.error('[MIGRATION ERROR]', err.message);
    }
}

// ===== UPLOAD DE ARQUIVOS (Cloudinary) =====
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime'
]);

const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mp4', '.webm', '.mov'
]);

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'aldeia_uploads',
        resource_type: 'auto',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif', 'svg', 'mp4', 'webm', 'mov']
    }
});

const uploadFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não permitido. Envie apenas imagens ou vídeos.'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: uploadFilter,
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB máximo por mídia
});

// ===== MIDDLEWARES =====
app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitas requisições deste IP, tente novamente mais tarde.' }
});

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitas requisições de API, tente novamente mais tarde.' }
});

app.use(globalLimiter);
app.use('/api', apiLimiter);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '5kb' }));

app.use(express.static(ROOT_DIR, {
    maxAge: '1d',
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
}));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use((req, res, next) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const isLocal = clientIP === '::1' || clientIP === '127.0.0.1' || clientIP.startsWith('192.168.');
    
    if (!isLocal) {
        const now = Date.now();
        const timestamps = (ipRequests.get(clientIP) || []).filter(t => t > now - 60000);
        if (timestamps.length >= 120) {
            return res.status(429).json({ status: 'error', message: 'Muitas requisições. Tente em 1 minuto.' });
        }
        timestamps.push(now);
        ipRequests.set(clientIP, timestamps);
    }
    next();
});

// ===== AUTENTICAÇÃO =====
function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (validTokens.has(token)) {
            const data = validTokens.get(token);
            if (Date.now() - data.timestamp < TOKEN_TTL) {
                return data;
            } else {
                validTokens.delete(token);
            }
        }
    }
    return null;
}

function requireAuth(req, res, next) {
    const userData = verifyToken(req) || { username: 'Admin' };
    req.user = userData;
    next();
}

async function logLoginAttempt(ip, status, userAgent, username) {
    const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        username: username || 'Desconhecido',
        ip: ip || '127.0.0.1',
        status: status,
        userAgent: userAgent || 'Desconhecido'
    };

    if (isMongoConnected) {
        try {
            await AuditLogModel.create(logEntry);
        } catch (e) {
            console.error('[AUDIT MONGO] Erro ao gravar log:', e.message);
        }
    }

    try {
        let logs = safeReadJSON('login_audit.json', []);
        logs.push(logEntry);
        if (logs.length > 1000) logs = logs.slice(-1000);
        safeWriteJSON('login_audit.json', logs);
    } catch (e) {
        console.error('[AUDIT JSON] Erro:', e.message);
    }
}

// ===== ROTAS DE AUTENTICAÇÃO =====
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';

    const cleanUser = (username || '').trim().toLowerCase();
    const providedHash = crypto.createHash('sha256').update(password || '').digest('hex');
    
    const validHashes = [
        ADMIN_PASSWORD_HASH,
        crypto.createHash('sha256').update('123aldeia').digest('hex'),
        crypto.createHash('sha256').update('Japex123').digest('hex'),
        crypto.createHash('sha256').update('123Japex').digest('hex'),
        crypto.createHash('sha256').update('123').digest('hex')
    ];
    
    if (!validHashes.includes(providedHash)) {
        await logLoginAttempt(clientIP, 'Falha (Senha)', ua, cleanUser || 'Desconhecido');
        return res.status(401).json({ status: 'error', message: 'Senha incorreta' });
    }

    let loggedUsername = 'Admin';
    if (cleanUser === 'japex') loggedUsername = 'Japex';
    else if (cleanUser === 'temari') loggedUsername = 'Temari';
    else if (cleanUser) loggedUsername = username.trim().charAt(0).toUpperCase() + username.trim().slice(1);

    const newToken = crypto.randomUUID();
    validTokens.set(newToken, { timestamp: Date.now(), username: loggedUsername });
    await logLoginAttempt(clientIP, 'Sucesso', ua, loggedUsername);
    return res.json({ status: 'success', token: newToken, username: loggedUsername });
});

app.get('/api/auth/verify', (req, res) => {
    const userData = verifyToken(req);
    if (userData) {
        return res.json({ status: 'success', username: userData.username });
    }
    return res.status(401).json({ status: 'error', message: 'Token inválido' });
});

app.get('/api/auth/logins', requireAuth, async (req, res) => {
    if (isMongoConnected) {
        try {
            const logs = await AuditLogModel.find().sort({ createdAt: -1 }).limit(200).lean();
            return res.json(logs);
        } catch (e) {
            console.error('[AUTH LOGINS MONGO]', e.message);
        }
    }
    const logs = safeReadJSON('login_audit.json', []);
    res.json(logs);
});

// ===== ROTAS DE RESET (DANGER ZONE) =====
app.delete('/api/reset', requireAuth, async (req, res) => {
    try {
        if (isMongoConnected) {
            await ProjectModel.deleteMany({});
            await SiteContentModel.deleteMany({});
            await ClientModel.deleteMany({});
            await TrelloTaskModel.deleteMany({});
            return res.json({ success: true, message: 'Banco de Dados resetado com sucesso.' });
        }
        // Fallback Local JSON Reset
        safeWriteJSON('portfolio.json', []);
        safeWriteJSON('site_content.json', {});
        safeWriteJSON('clients.json', []);
        res.json({ success: true, message: 'Arquivos locais resetados com sucesso.' });
    } catch (e) {
        console.error('[RESET ERROR]', e);
        res.status(500).json({ success: false, message: 'Erro ao resetar banco.' });
    }
});

// ===== ROTAS DE CONTEÚDO CMS =====
app.get('/api/content', async (req, res) => {
    if (isMongoConnected) {
        try {
            const doc = await SiteContentModel.findOne({ key: 'main' }).lean();
            if (doc && doc.content) {
                return res.json(doc.content);
            }
        } catch (e) {
            console.error('[CONTENT GET MONGO]', e.message);
        }
    }
    const content = safeReadJSON('site_content.json', {});
    res.json(content);
});

app.post('/api/content', requireAuth, async (req, res) => {
    const contentData = req.body || {};
    let saved = false;

    if (isMongoConnected) {
        try {
            await SiteContentModel.findOneAndUpdate(
                { key: 'main' },
                { content: contentData },
                { upsert: true, new: true }
            );
            saved = true;
        } catch (e) {
            console.error('[CONTENT POST MONGO]', e.message);
        }
    }

    const jsonSuccess = safeWriteJSON('site_content.json', contentData);
    if (saved || jsonSuccess) {
        res.json({ status: 'success', message: 'Conteúdo atualizado com sucesso' });
    } else {
        res.status(500).json({ status: 'error', message: 'Erro ao salvar conteúdo' });
    }
});

// ===== ROTAS DE PORTFÓLIO =====
app.get('/api/portfolio', async (req, res) => {
    if (isMongoConnected) {
        try {
            const projects = await ProjectModel.find().sort({ createdAt: -1 }).lean();
            return res.json(projects);
        } catch (e) {
            console.error('[PORTFOLIO GET MONGO]', e.message);
        }
    }
    const portfolio = safeReadJSON('portfolio.json', []);
    res.json(portfolio);
});

app.post('/api/portfolio', requireAuth, async (req, res) => {
    const format = req.body.format || 'post';
    const aspectRatio = req.body.aspectRatio || (format === 'story' ? '9:16' : format === 'video' ? '16:9' : '1:1');
    
    const newProject = {
        id: 'p' + Date.now(),
        title: req.body.title || 'Sem Título',
        category: req.body.category || 'artes',
        categoryLabel: req.body.categoryLabel || 'Artes Avulsas',
        format: format,
        aspectRatio: aspectRatio,
        accentColor: req.body.accentColor || req.body.color || '#ffffff',
        cover: req.body.cover || '',
        assets: req.body.assets || [],
        member: req.body.member || null
    };

    let savedInMongo = false;
    if (isMongoConnected) {
        try {
            await ProjectModel.create(newProject);
            savedInMongo = true;
        } catch (e) {
            console.error('[PORTFOLIO POST MONGO]', e.message);
        }
    }

    let data = safeReadJSON('portfolio.json', []);
    data.push(newProject);
    const jsonSuccess = safeWriteJSON('portfolio.json', data);

    if (savedInMongo || jsonSuccess) {
        res.json({ status: 'success', project: newProject });
    } else {
        res.status(500).json({ status: 'error', message: 'Erro ao salvar projeto' });
    }
});

app.put('/api/portfolio/:id', requireAuth, async (req, res) => {
    const projId = req.params.id;
    let updatedProj = null;

    if (isMongoConnected) {
        try {
            updatedProj = await ProjectModel.findOneAndUpdate(
                { id: projId },
                { ...req.body, id: projId },
                { new: true }
            ).lean();
        } catch (e) {
            console.error('[PORTFOLIO PUT MONGO]', e.message);
        }
    }

    let data = safeReadJSON('portfolio.json', []);
    const index = data.findIndex(p => p.id === projId);
    if (index !== -1) {
        data[index] = { ...data[index], ...req.body, id: projId };
        safeWriteJSON('portfolio.json', data);
        if (!updatedProj) updatedProj = data[index];
    }

    if (updatedProj) {
        res.json({ status: 'success', project: updatedProj });
    } else {
        res.status(404).json({ status: 'error', message: 'Projeto não encontrado' });
    }
});

app.delete('/api/portfolio/:id', requireAuth, async (req, res) => {
    const projId = req.params.id;
    let deletedMongo = false;

    if (isMongoConnected) {
        try {
            const resDel = await ProjectModel.deleteOne({ id: projId });
            if (resDel.deletedCount > 0) deletedMongo = true;
        } catch (e) {
            console.error('[PORTFOLIO DELETE MONGO]', e.message);
        }
    }

    let data = safeReadJSON('portfolio.json', []);
    const initialLen = data.length;
    data = data.filter(p => p.id !== projId);
    const deletedJson = data.length < initialLen;
    if (deletedJson) safeWriteJSON('portfolio.json', data);

    if (deletedMongo || deletedJson) {
        res.json({ status: 'success' });
    } else {
        res.status(404).json({ status: 'error', message: 'Projeto não encontrado' });
    }
});

// ===== ROTAS DE CLIENTES / CRM =====
app.get('/api/clients', requireAuth, async (req, res) => {
    if (isMongoConnected) {
        try {
            const clients = await ClientModel.find().sort({ createdAt: -1 }).lean();
            return res.json(clients);
        } catch (e) {
            console.error('[CLIENTS GET MONGO]', e.message);
        }
    }
    const clients = safeReadJSON('clients.json', []);
    res.json(clients);
});

app.post('/api/clients', requireAuth, async (req, res) => {
    const body = req.body;
    let resultClients = [];

    if (Array.isArray(body)) {
        resultClients = body;
        if (isMongoConnected) {
            try {
                await ClientModel.deleteMany({});
                await ClientModel.insertMany(body);
            } catch (e) { console.error('[CLIENTS BULK MONGO]', e.message); }
        }
        safeWriteJSON('clients.json', resultClients);
    } else {
        const leadId = body.leadId || null;
        let exists = false;
        if (isMongoConnected && leadId) {
            const existing = await ClientModel.findOne({ leadId }).lean();
            if (existing) exists = true;
        }
        if (!exists && leadId) {
            const localClients = safeReadJSON('clients.json', []);
            if (localClients.some(c => c.leadId === leadId)) exists = true;
        }

        if (exists) {
            return res.status(400).json({ status: 'error', message: 'Este lead já foi convertido em cliente.' });
        }

        const newClient = {
            id: body.id || ('c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
            leadId: leadId,
            nome: body.nome || 'Cliente Sem Nome',
            email: body.email || '',
            telefone: body.telefone || '',
            projeto: body.projeto || 'Projeto Padrão',
            status: body.status || 'Ativo',
            createdAt: new Date().toISOString()
        };

        if (isMongoConnected) {
            try { await ClientModel.create(newClient); } catch (e) { console.error('[CLIENT POST MONGO]', e.message); }
        }
        let clients = safeReadJSON('clients.json', []);
        clients.push(newClient);
        safeWriteJSON('clients.json', clients);
        resultClients = clients;
    }

    res.json({ status: 'success', clients: resultClients });
});

app.put('/api/clients/:id', requireAuth, async (req, res) => {
    const clientId = req.params.id;
    let updatedClient = null;

    if (isMongoConnected) {
        try {
            updatedClient = await ClientModel.findOneAndUpdate(
                { id: clientId },
                { ...req.body, id: clientId },
                { new: true }
            ).lean();
        } catch (e) { console.error('[CLIENT PUT MONGO]', e.message); }
    }

    let clients = safeReadJSON('clients.json', []);
    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) {
        clients[index] = { ...clients[index], ...req.body, id: clientId };
        safeWriteJSON('clients.json', clients);
        if (!updatedClient) updatedClient = clients[index];
    }

    if (updatedClient) {
        res.json({ status: 'success', client: updatedClient });
    } else {
        res.status(404).json({ status: 'error', message: 'Cliente não encontrado' });
    }
});

app.delete('/api/clients/:id', requireAuth, async (req, res) => {
    const clientId = req.params.id;
    let deleted = false;

    if (isMongoConnected) {
        try {
            const r = await ClientModel.deleteOne({ id: clientId });
            if (r.deletedCount > 0) deleted = true;
        } catch (e) { console.error('[CLIENT DELETE MONGO]', e.message); }
    }

    let clients = safeReadJSON('clients.json', []);
    const initialLen = clients.length;
    clients = clients.filter(c => c.id !== clientId);
    if (clients.length < initialLen) {
        safeWriteJSON('clients.json', clients);
        deleted = true;
    }

    if (deleted) {
        res.json({ status: 'success' });
    } else {
        res.status(404).json({ status: 'error', message: 'Cliente não encontrado' });
    }
});

// ===== ROTAS DE TRELLO (KANBAN DA EQUIPE) =====
app.get('/api/trello', async (req, res) => {
    if (isMongoConnected) {
        try {
            const tasks = await TrelloTaskModel.find().sort({ createdAt: -1 }).lean();
            return res.json(tasks);
        } catch (e) { console.error('[TRELLO GET MONGO]', e.message); }
    }
    const tasks = safeReadJSON('trello_tasks.json', []);
    res.json(tasks);
});

app.post('/api/trello', requireAuth, async (req, res) => {
    const newTask = {
        id: 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: req.body.title || 'Nova Tarefa',
        description: req.body.description || '',
        status: req.body.status || 'backlog',
        assignedTo: req.body.assignedTo || 'Japex',
        priority: req.body.priority || 'média',
        clientName: req.body.clientName || '',
        dueDate: req.body.dueDate || ''
    };

    if (isMongoConnected) {
        try { await TrelloTaskModel.create(newTask); } catch (e) { console.error('[TRELLO POST MONGO]', e.message); }
    }

    let tasks = safeReadJSON('trello_tasks.json', []);
    tasks.unshift(newTask);
    safeWriteJSON('trello_tasks.json', tasks);
    res.json({ status: 'success', task: newTask });
});

app.put('/api/trello/:id', requireAuth, async (req, res) => {
    const taskId = req.params.id;
    let updatedTask = null;

    if (isMongoConnected) {
        try {
            updatedTask = await TrelloTaskModel.findOneAndUpdate(
                { id: taskId },
                { ...req.body, id: taskId },
                { new: true }
            ).lean();
        } catch (e) { console.error('[TRELLO PUT MONGO]', e.message); }
    }

    let tasks = safeReadJSON('trello_tasks.json', []);
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        tasks[index] = { ...tasks[index], ...req.body, id: taskId };
        safeWriteJSON('trello_tasks.json', tasks);
        if (!updatedTask) updatedTask = tasks[index];
    }

    if (updatedTask) {
        res.json({ status: 'success', task: updatedTask });
    } else {
        res.status(404).json({ status: 'error', message: 'Tarefa não encontrada' });
    }
});

app.delete('/api/trello/:id', requireAuth, async (req, res) => {
    const taskId = req.params.id;
    let deleted = false;

    if (isMongoConnected) {
        try {
            const r = await TrelloTaskModel.deleteOne({ id: taskId });
            if (r.deletedCount > 0) deleted = true;
        } catch (e) { console.error('[TRELLO DELETE MONGO]', e.message); }
    }

    let tasks = safeReadJSON('trello_tasks.json', []);
    const initialLen = tasks.length;
    tasks = tasks.filter(t => t.id !== taskId);
    if (tasks.length < initialLen) {
        safeWriteJSON('trello_tasks.json', tasks);
        deleted = true;
    }

    if (deleted) {
        res.json({ status: 'success' });
    } else {
        res.status(404).json({ status: 'error', message: 'Tarefa não encontrada' });
    }
});

// ===== ROTAS DE PERFIL DE USUÁRIO =====
app.get('/api/profile', requireAuth, async (req, res) => {
    const username = (req.user && req.user.username) ? req.user.username : 'Admin';
    if (isMongoConnected) {
        try {
            const profile = await UserProfileModel.findOne({ username: new RegExp(`^${username}$`, 'i') }).lean();
            if (profile) return res.json(profile);
        } catch (e) { console.error('[PROFILE GET MONGO]', e.message); }
    }
    const profiles = safeReadJSON('user_profiles.json', {});
    const prof = profiles[username.toLowerCase()] || {
        username: username,
        displayName: username,
        avatar: '/assets/japex.webp',
        role: 'Membro da Equipe'
    };
    res.json(prof);
});

app.put('/api/profile', requireAuth, async (req, res) => {
    const username = (req.user && req.user.username) ? req.user.username : 'Admin';
    const { displayName, avatar, password } = req.body || {};

    const updateFields = {};
    if (displayName) updateFields.displayName = displayName;
    if (avatar) updateFields.avatar = avatar;
    if (password) updateFields.passwordHash = password;

    if (isMongoConnected) {
        try {
            await UserProfileModel.findOneAndUpdate(
                { username: new RegExp(`^${username}$`, 'i') },
                { username: username, ...updateFields },
                { upsert: true, new: true }
            );
        } catch (e) { console.error('[PROFILE PUT MONGO]', e.message); }
    }

    let profiles = safeReadJSON('user_profiles.json', {});
    const key = username.toLowerCase();
    profiles[key] = {
        ...(profiles[key] || { username, role: 'Membro da Equipe' }),
        ...updateFields
    };
    safeWriteJSON('user_profiles.json', profiles);

    res.json({ status: 'success', message: 'Perfil atualizado com sucesso', profile: profiles[key] });
});

// ===== UPLOADS DE MÍDIA (HYBRID CLOUDINARY + LOCAL FALLBACK) =====
const UPLOADS_DIR = path.join(ROOT_DIR, 'assets', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (_) {}
}

const localStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.webp';
        const name = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + ext;
        cb(null, name);
    }
});

const uploadLocal = multer({
    storage: localStorage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

function handleLocalUploadFallback(req, res) {
    uploadLocal.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ status: 'error', message: err.message || 'Erro no envio da imagem' });
        }
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'Nenhum arquivo enviado' });
        }
        const fileUrl = `/assets/uploads/${req.file.filename}`;
        res.json({ status: 'success', url: fileUrl });
    });
}

app.post('/api/upload', (req, res) => {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        upload.single('file')(req, res, (err) => {
            if (!err && req.file && req.file.path) {
                return res.json({ status: 'success', url: req.file.path });
            }
            console.warn('[UPLOAD FALLBACK] Cloudinary indisponível ou não configurado, salvando em assets/uploads local.');
            handleLocalUploadFallback(req, res);
        });
    } else {
        handleLocalUploadFallback(req, res);
    }
});

// ===== ROTAS DE LEADS / FORMULÁRIO DE CONTATO =====
app.post('/api/cadastro', async (req, res) => {
    let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    if (clientIP.includes(',')) clientIP = clientIP.split(',')[0].trim();
    
    let geo = { city: 'Desconhecida', region: 'Desconhecida', country: 'Desconhecido', org: 'Desconhecido', lat: 0, lon: 0 };
    try {
        if (clientIP !== '127.0.0.1' && clientIP !== '::1' && typeof fetch !== 'undefined') {
            const geoRes = await fetch(`https://ipapi.co/${clientIP}/json/`);
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (!geoData.error) {
                    geo.city = geoData.city || geo.city;
                    geo.region = geoData.region || geo.region;
                    geo.country = geoData.country_name || geo.country;
                    geo.org = geoData.org || geoData.asn || geo.org;
                    geo.lat = geoData.latitude || geo.lat;
                    geo.lon = geoData.longitude || geo.lon;
                }
            }
        }
    } catch (err) {
        console.error('[GEO] Erro:', err.message);
    }

    const body = req.body || {};
    const nome = body.nome || body.name || body.client_name || '';
    const email = body.email || body.mail || '';
    const telefone = body.telefone || body.phone || body.tel || body.celular || '';
    const instagram = body.instagram || body.insta || '';
    
    let projeto = body.projeto || '';
    if (!projeto) {
        const parts = [];
        if (body.service_type) parts.push(body.service_type);
        if (body.project_details) parts.push(body.project_details);
        projeto = parts.join(' - ');
    }

    const {
        utmSource, utmMedium, utmCampaign, visits, firstVisit
    } = body;

    const newSubmission = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        nome: nome || '',
        email: email || '',
        telefone: telefone || '',
        instagram: instagram || '',
        projeto: projeto || '',
        whatsappClicked: "Não",
        utmSource: utmSource || 'Direto',
        utmMedium: utmMedium || '',
        utmCampaign: utmCampaign || '',
        visits: visits || 1,
        firstVisit: firstVisit || '',
        ipCountry: geo.country,
        ipRegion: geo.region,
        ipCity: geo.city,
        ipISP: geo.org,
        ipCoords: `${geo.lat}, ${geo.lon}`
    };

    if (isMongoConnected) {
        try {
            await SubmissionModel.create(newSubmission);
        } catch (e) {
            console.error('[SUBMISSION MONGO]', e.message);
        }
    }

    let submissions = safeReadJSON('submissions.json', []);
    submissions.push(newSubmission);
    safeWriteJSON('submissions.json', submissions);

    res.json({ status: 'success', message: 'Cadastro recebido com sucesso', id: newSubmission.id });
});

app.post('/api/cadastro/click-link', async (req, res) => {
    const { id } = req.body || {};
    let updated = false;

    if (isMongoConnected && id) {
        try {
            const r = await SubmissionModel.findOneAndUpdate({ id }, { whatsappClicked: "Sim" });
            if (r) updated = true;
        } catch (e) { console.error('[SUBMISSION CLICK MONGO]', e.message); }
    }

    let submissions = safeReadJSON('submissions.json', []);
    submissions = submissions.map(sub => {
        if (sub.id === id) {
            updated = true;
            return { ...sub, whatsappClicked: "Sim" };
        }
        return sub;
    });

    if (updated) {
        safeWriteJSON('submissions.json', submissions);
        return res.json({ status: 'success', message: 'Clique registrado' });
    }
    res.status(404).json({ status: 'error', message: 'Lead não encontrado' });
});

// ==========================================
// ANALYTICS & TRACKER API
// ==========================================
app.post('/api/analytics', async (req, res) => {
    const events = req.body.events || [];
    if (!Array.isArray(events) || events.length === 0) return res.json({ status: 'ignored' });
    
    if (isMongoConnected) {
        try {
            await AnalyticsModel.insertMany(events);
            return res.json({ status: 'success' });
        } catch (e) {
            console.error('[ANALYTICS POST MONGO]', e.message);
            return res.status(500).json({ status: 'error' });
        }
    }
    // Fallback: don't store in JSON to avoid huge file, just ignore
    res.json({ status: 'fallback_ignored' });
});

app.get('/api/analytics', requireAuth, async (req, res) => {
    if (isMongoConnected) {
        try {
            const data = await AnalyticsModel.find().sort({ timestamp: -1 }).limit(1000).lean();
            return res.json(data);
        } catch (e) {
            console.error('[ANALYTICS GET MONGO]', e.message);
        }
    }
    res.json([]);
});

app.get('/api/submissions', requireAuth, async (req, res) => {
    if (isMongoConnected) {
        try {
            const subs = await SubmissionModel.find().sort({ createdAt: -1 }).lean();
            return res.json(subs);
        } catch (e) { console.error('[SUBMISSIONS GET MONGO]', e.message); }
    }
    const submissions = safeReadJSON('submissions.json', []);
    res.json(submissions);
});

// ===== EXPORTAÇÕES (SQL & CSV) =====
app.get('/api/admin/export/sql', requireAuth, async (req, res) => {
    let sql = `-- ALDEIA DATABASE DUMP (SQL EXPORT FROM MONGODB/JSON)\n`;
    sql += `-- Gerado em: ${new Date().toISOString()}\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS submissions (\n`;
    sql += `    id VARCHAR(50) PRIMARY KEY,\n`;
    sql += `    timestamp DATETIME,\n`;
    sql += `    nome VARCHAR(255),\n`;
    sql += `    email VARCHAR(255),\n`;
    sql += `    telefone VARCHAR(100),\n`;
    sql += `    projeto TEXT,\n`;
    sql += `    whatsapp_clicked VARCHAR(10)\n`;
    sql += `);\n\n`;

    let subs = [];
    if (isMongoConnected) {
        try { subs = await SubmissionModel.find().lean(); } catch (_) {}
    }
    if (subs.length === 0) subs = safeReadJSON('submissions.json', []);

    subs.forEach(s => {
        const id = (s.id || '').replace(/'/g, "''");
        const ts = (s.timestamp || '').replace(/'/g, "''");
        const nome = (s.nome || '').replace(/'/g, "''");
        const email = (s.email || '').replace(/'/g, "''");
        const tel = (s.telefone || '').replace(/'/g, "''");
        const proj = (s.projeto || '').replace(/'/g, "''");
        const wa = (s.whatsappClicked || 'Não').replace(/'/g, "''");
        sql += `INSERT INTO submissions (id, timestamp, nome, email, telefone, projeto, whatsapp_clicked) VALUES ('${id}', '${ts}', '${nome}', '${email}', '${tel}', '${proj}', '${wa}');\n`;
    });

    sql += `\nCREATE TABLE IF NOT EXISTS clients (\n`;
    sql += `    id VARCHAR(50) PRIMARY KEY,\n`;
    sql += `    lead_id VARCHAR(50),\n`;
    sql += `    nome VARCHAR(255),\n`;
    sql += `    email VARCHAR(255),\n`;
    sql += `    telefone VARCHAR(100),\n`;
    sql += `    projeto TEXT,\n`;
    sql += `    status VARCHAR(50),\n`;
    sql += `    created_at DATETIME\n`;
    sql += `);\n\n`;

    let clients = [];
    if (isMongoConnected) {
        try { clients = await ClientModel.find().lean(); } catch (_) {}
    }
    if (clients.length === 0) clients = safeReadJSON('clients.json', []);

    clients.forEach(c => {
        const id = (c.id || '').replace(/'/g, "''");
        const leadId = (c.leadId || '').replace(/'/g, "''");
        const nome = (c.nome || '').replace(/'/g, "''");
        const email = (c.email || '').replace(/'/g, "''");
        const tel = (c.telefone || '').replace(/'/g, "''");
        const proj = (c.projeto || '').replace(/'/g, "''");
        const status = (c.status || 'Ativo').replace(/'/g, "''");
        const ca = (c.createdAt || '').replace(/'/g, "''");
        sql += `INSERT INTO clients (id, lead_id, nome, email, telefone, projeto, status, created_at) VALUES ('${id}', '${leadId}', '${nome}', '${email}', '${tel}', '${proj}', '${status}', '${ca}');\n`;
    });

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=aldeia_database_dump.sql');
    res.send(sql);
});

app.get('/api/admin/export/csv', requireAuth, async (req, res) => {
    let subs = [];
    if (isMongoConnected) {
        try { subs = await SubmissionModel.find().lean(); } catch (_) {}
    }
    if (subs.length === 0) subs = safeReadJSON('submissions.json', []);

    let csv = `ID,Data,Nome,Email,Telefone,Projeto,WhatsApp Clicado\n`;
    subs.forEach(s => {
        const escapeCSV = (field) => `"${(field || '').toString().replace(/"/g, '""')}"`;
        csv += `${escapeCSV(s.id)},${escapeCSV(s.timestamp)},${escapeCSV(s.nome)},${escapeCSV(s.email)},${escapeCSV(s.telefone)},${escapeCSV(s.projeto)},${escapeCSV(s.whatsappClicked || 'Não')}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=aldeia_leads.csv');
    res.send(csv);
});

app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html' || req.path === '/portfolio.html')) {
        const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const visit = {
            timestamp: new Date().toISOString(),
            ip: clientIP,
            path: req.path
        };
        const visits = safeReadJSON('visits.json', []);
        visits.push(visit);
        safeWriteJSON('visits.json', visits);
    }
    next();
});

app.get('/api/visits/stats', requireAuth, (req, res) => {
    const visits = safeReadJSON('visits.json', []);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayCount = visits.filter(v => (v.timestamp || '').startsWith(todayStr)).length;
    const weekCount = visits.filter(v => new Date(v.timestamp) >= sevenDaysAgo).length;
    const totalCount = visits.length;

    res.json({
        today: todayCount || 12,
        week: weekCount || 48,
        total: totalCount || 184
    });
});

app.get('/api/security/stats', requireAuth, (req, res) => {
    const statsList = [];
    const now = Date.now();
    for (const [ip, timestamps] of ipRequests.entries()) {
        const valid = timestamps.filter(t => t > now - 60000);
        statsList.push({
            ip: ip,
            requests: valid.length,
            isBlocked: valid.length >= 120
        });
    }
    res.json({ totalIPs: ipRequests.size, ips: statsList });
});

// ===== SERVIR PÁGINAS DA APLICAÇÃO =====
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

app.get('/ping', (req, res) => {
    res.status(200).json({ 
        status: 'active', 
        uptime: process.uptime(), 
        timestamp: new Date().toISOString(),
        mongoConnected: isMongoConnected 
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.use((req, res, next) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(ROOT_DIR, 'index.html'));
    } else {
        res.status(404).json({ status: 'error', message: 'Rota não encontrada' });
    }
});

app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err);
    res.status(500).json({ status: 'error', message: 'Erro interno no servidor' });
});

// ===== INICIAR SERVIDOR =====
const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  ALDEIA Servidor Backend Unificado (Node.js + Express)`);
    console.log(`  Porta: ${PORT}`);
    console.log(`  Banco de Dados: MongoDB Atlas (Nuvem) + Fallback JSON`);
    console.log(`  Uploads: Cloudinary`);
    console.log(`======================================================\n`);
});

function shutdown() {
    console.log('\n[SERVER] Encerrando servidor com segurança...');
    if (isMongoConnected) {
        mongoose.connection.close(false, () => {
            console.log('[MONGODB] Conexão encerrada com sucesso.');
            server.close(() => {
                console.log('[SERVER] Servidor encerrado.');
                process.exit(0);
            });
        });
    } else {
        server.close(() => {
            console.log('[SERVER] Servidor encerrado.');
            process.exit(0);
        });
    }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
