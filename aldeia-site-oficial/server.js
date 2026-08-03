/* ============================================================
   ALDEIA — SERVIDOR DE PRODUÇÃO UNIFICADO & ROBUSTO (Node.js + Express)
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
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT_DIR = __dirname;

// ===== CONFIGURAÇÃO DE SEGURANÇA E ADMIN =====
// Hash SHA-256 da senha padronizada '123aldeia' ou vinda de ENV
const DEFAULT_HASH = "0c88ccdb3a0615173fc7cc49491be2a12cae97c7192dadfde3064148e54cc7aa";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || DEFAULT_HASH;

// Tokens com TTL (24 horas = 86.400.000 ms)
const TOKEN_TTL = 24 * 60 * 60 * 1000;
const validTokens = new Map(); // token -> timestamp
const ipRequests = new Map();  // ip -> array of timestamps

// Limpeza periódica de memória (RAM) a cada 30 minutos
setInterval(() => {
    const now = Date.now();
    // Limpar tokens expirados
    for (const [token, timestamp] of validTokens.entries()) {
        if (now - timestamp > TOKEN_TTL) {
            validTokens.delete(token);
        }
    }
    // Limpar requisições antigas de IP
    for (const [ip, timestamps] of ipRequests.entries()) {
        const recent = timestamps.filter(t => t > now - 60000);
        if (recent.length === 0) {
            ipRequests.delete(ip);
        } else {
            ipRequests.set(ip, recent);
        }
    }
}, 30 * 60 * 1000);

// ===== UTILITÁRIOS SEGUROS DE PERSISTÊNCIA (I/O ATÔMICO) =====
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

// ===== UPLOAD DE ARQUIVOS (Cloudinary) =====
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configuração do Cloudinary com credenciais do .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Tipos permitidos (Imagens e Vídeos)
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
        resource_type: 'auto', // Permite imagem e vídeo automaticamente
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

// Segurança com Helmet
app.use(helmet({
    contentSecurityPolicy: false, // Desativado para permitir fontes externas e CDNs
    crossOriginEmbedderPolicy: false
}));

// Proteção contra Força Bruta / DDoS (Rate Limiters)
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

// Static file headers
app.use(express.static(ROOT_DIR, {
    maxAge: '1d',
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
}));

// Security headers para API
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Custom Rate Limiting de IP
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

// ===== AUTENTICAÇÃO MULTIUSUÁRIO =====
// Usuários hardcoded conforme especificação (Japex, Temari)
const USERS = {
    'Japex': 'Japex123',
    'Temari': 'Temari123'
};

function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (validTokens.has(token)) {
            const data = validTokens.get(token);
            if (Date.now() - data.timestamp < TOKEN_TTL) {
                return data; // Retorna o payload { timestamp, username }
            } else {
                validTokens.delete(token); // Token expirado
            }
        }
    }
    return null;
}

function requireAuth(req, res, next) {
    const userData = verifyToken(req);
    if (!userData) {
        return res.status(401).json({ status: 'error', message: 'Não autorizado. Token inválido ou expirado.' });
    }
    req.user = userData;
    next();
}

function logLoginAttempt(ip, status, userAgent, username) {
    try {
        let logs = safeReadJSON('login_audit.json', []);
        logs.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            username: username || 'Desconhecido',
            ip: ip || '127.0.0.1',
            status: status,
            userAgent: userAgent || 'Desconhecido'
        });
        if (logs.length > 1000) logs = logs.slice(-1000);
        safeWriteJSON('login_audit.json', logs);
    } catch (e) {
        console.error('[AUDIT] Erro ao gravar log:', e.message);
    }
}

// ===== ROTAS DE AUTENTICAÇÃO =====

app.post('/api/auth/login', (req, res) => {
    // Agora aceitamos username e password (texto plano para o MVP, embora pudesse usar hash)
    const { username, password, passwordHash } = req.body || {};
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';

    // Legacy fallback for old admin.js format (if still used during transition)
    if (passwordHash === ADMIN_PASSWORD_HASH && !username) {
        const newToken = crypto.randomUUID();
        validTokens.set(newToken, { timestamp: Date.now(), username: 'Admin' });
        logLoginAttempt(clientIP, 'Sucesso', ua, 'Admin');
        return res.json({ status: 'success', token: newToken, username: 'Admin' });
    }

    // New multi-user logic
    if (username && USERS[username] && USERS[username] === password) {
        const newToken = crypto.randomUUID();
        validTokens.set(newToken, { timestamp: Date.now(), username: username });
        logLoginAttempt(clientIP, 'Sucesso', ua, username);
        return res.json({ status: 'success', token: newToken, username: username });
    } else {
        logLoginAttempt(clientIP, 'Senha Incorreta', ua, username || 'Desconhecido');
        return res.status(401).json({ status: 'error', message: 'Credenciais incorretas' });
    }
});

app.get('/api/auth/verify', (req, res) => {
    const userData = verifyToken(req);
    if (userData) {
        return res.json({ status: 'success', username: userData.username });
    }
    return res.status(401).json({ status: 'error', message: 'Token inválido' });
});

app.get('/api/auth/logins', requireAuth, (req, res) => {
    const logs = safeReadJSON('login_audit.json', []);
    res.json(logs);
});

// ===== ROTAS DE CONTEÚDO CMS =====

app.get('/api/content', (req, res) => {
    const content = safeReadJSON('site_content.json', {});
    res.json(content);
});

app.post('/api/content', requireAuth, (req, res) => {
    const success = safeWriteJSON('site_content.json', req.body || {});
    if (success) {
        res.json({ status: 'success', message: 'Conteúdo atualizado com sucesso' });
    } else {
        res.status(500).json({ status: 'error', message: 'Erro ao salvar conteúdo' });
    }
});

// ===== ROTAS DE PORTFÓLIO =====

app.get('/api/portfolio', (req, res) => {
    const portfolio = safeReadJSON('portfolio.json', []);
    res.json(portfolio);
});

app.post('/api/portfolio', requireAuth, (req, res) => {
    let data = safeReadJSON('portfolio.json', []);
    const format = req.body.format || 'post';
    const aspectRatio = req.body.aspectRatio || (format === 'story' ? '9:16' : format === 'video' ? '16:9' : '1:1');
    
    const newProject = {
        id: 'p' + Date.now(),
        title: req.body.title || 'Sem Título',
        category: req.body.category || 'artes',
        categoryLabel: req.body.categoryLabel || 'Artes Avulsas',
        format: format,
        aspectRatio: aspectRatio,
        accentColor: req.body.accentColor || req.body.color || '#a855f7',
        cover: req.body.cover || '',
        assets: req.body.assets || []
    };
    data.push(newProject);
    const success = safeWriteJSON('portfolio.json', data);
    if (success) {
        res.json({ status: 'success', project: newProject });
    } else {
        res.status(500).json({ status: 'error', message: 'Erro ao salvar projeto' });
    }
});

app.put('/api/portfolio/:id', requireAuth, (req, res) => {
    let data = safeReadJSON('portfolio.json', []);
    const index = data.findIndex(p => p.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ status: 'error', message: 'Projeto não encontrado' });
    }
    data[index] = {
        ...data[index],
        ...req.body,
        id: req.params.id // Preserva o ID original
    };
    safeWriteJSON('portfolio.json', data);
    res.json({ status: 'success', project: data[index] });
});

app.delete('/api/portfolio/:id', requireAuth, (req, res) => {
    let data = safeReadJSON('portfolio.json', []);
    const initialLen = data.length;
    data = data.filter(p => p.id !== req.params.id);
    if (data.length === initialLen) {
        return res.status(404).json({ status: 'error', message: 'Projeto não encontrado' });
    }
    safeWriteJSON('portfolio.json', data);
    res.json({ status: 'success' });
});

// ===== ROTAS DE CLIENTES / CRM =====

app.get('/api/clients', requireAuth, (req, res) => {
    const clients = safeReadJSON('clients.json', []);
    res.json(clients);
});

app.post('/api/clients', requireAuth, (req, res) => {
    let clients = safeReadJSON('clients.json', []);
    const body = req.body;
    
    if (Array.isArray(body)) {
        clients = body;
    } else {
        const leadId = body.leadId || null;
        if (leadId && clients.some(c => c.leadId === leadId)) {
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
        clients.push(newClient);
    }
    
    const success = safeWriteJSON('clients.json', clients);
    if (success) {
        res.json({ status: 'success', clients: clients });
    } else {
        res.status(500).json({ status: 'error', message: 'Erro ao salvar clientes' });
    }
});

app.put('/api/clients/:id', requireAuth, (req, res) => {
    let clients = safeReadJSON('clients.json', []);
    const index = clients.findIndex(c => c.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ status: 'error', message: 'Cliente não encontrado' });
    }
    clients[index] = {
        ...clients[index],
        ...req.body,
        id: req.params.id
    };
    safeWriteJSON('clients.json', clients);
    res.json({ status: 'success', client: clients[index] });
});

app.delete('/api/clients/:id', requireAuth, (req, res) => {
    let clients = safeReadJSON('clients.json', []);
    const initialLen = clients.length;
    clients = clients.filter(c => c.id !== req.params.id);
    if (clients.length === initialLen) {
        return res.status(404).json({ status: 'error', message: 'Cliente não encontrado' });
    }
    safeWriteJSON('clients.json', clients);
    res.json({ status: 'success' });
});

// ===== STREAMING DE VÍDEO COM SUPORTE A RANGE REQUESTS (HTTP 206 - SEEK SEM LAG) =====
app.get('/assets/uploads/:filename', (req, res, next) => {
    const filePath = path.join(ROOT_DIR, 'assets', 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return next();

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'video/mp4';
        if (ext === '.webm') mimeType = 'video/webm';
        if (ext === '.mov') mimeType = 'video/quicktime';
        if (ext === '.webp') mimeType = 'image/webp';

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': mimeType,
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        next();
    }
});

// ===== UPLOAD =====

app.post('/api/upload', requireAuth, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ status: 'error', message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'Nenhum arquivo enviado' });
        }
        // O Cloudinary envia a URL completa e segura no req.file.path
        const cloudUrl = req.file.path;
        res.json({ status: 'success', url: cloudUrl });
    });
});

// ===== ROTAS DE LEADS / SUBMISSIONS =====

app.post('/api/cadastro', async (req, res) => {
    let submissions = safeReadJSON('submissions.json', []);
    
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

    const {
        nome, email, telefone, instagram, projeto,
        utmSource, utmMedium, utmCampaign, visits, firstVisit
    } = req.body;

    const newSubmission = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        nome, email, telefone, instagram, projeto,
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

    submissions.push(newSubmission);
    safeWriteJSON('submissions.json', submissions);

    res.json({ status: 'success', message: 'Cadastro recebido com sucesso', id: newSubmission.id });
});

app.post('/api/cadastro/click-link', (req, res) => {
    const { id } = req.body || {};
    let submissions = safeReadJSON('submissions.json', []);
    let updated = false;

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

app.get('/api/submissions', requireAuth, (req, res) => {
    const submissions = safeReadJSON('submissions.json', []);
    res.json(submissions);
});

// ===== EXPORTAÇÕES (SQL & CSV) =====

app.get('/api/admin/export/sql', requireAuth, (req, res) => {
    let sql = `-- ALDEIA DATABASE DUMP (SQL EXPORT)\n`;
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

    const subs = safeReadJSON('submissions.json', []);
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

    const clients = safeReadJSON('clients.json', []);
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

app.get('/api/admin/export/csv', requireAuth, (req, res) => {
    const subs = safeReadJSON('submissions.json', []);
    let csv = `ID,Data,Nome,Email,Telefone,Projeto,WhatsApp Clicado\n`;
    subs.forEach(s => {
        const escapeCSV = (field) => `"${(field || '').toString().replace(/"/g, '""')}"`;
        csv += `${escapeCSV(s.id)},${escapeCSV(s.timestamp)},${escapeCSV(s.nome)},${escapeCSV(s.email)},${escapeCSV(s.telefone)},${escapeCSV(s.projeto)},${escapeCSV(s.whatsappClicked || 'Não')}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=aldeia_leads.csv');
    res.send(csv);
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

// ===== TELEMETRIA E ANALYTICS (NOVO CRM) =====

app.post('/api/telemetry', (req, res) => {
    let payload = req.body;
    if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (_) {}
    }
    if (payload) {
        let events = safeReadJSON('telemetry_log.json', []);
        events.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            ...payload
        });
        if (events.length > 5000) events = events.slice(-5000); // Manter últimos 5000
        safeWriteJSON('telemetry_log.json', events);
    }
    res.json({ status: 'ok' });
});

app.get('/api/analytics/dashboard', requireAuth, (req, res) => {
    const events = safeReadJSON('telemetry_log.json', []);
    const leads = safeReadJSON('submissions.json', []);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);

    let viewsToday = 0, viewsWeek = 0, viewsMonth = 0, viewsTotal = 0;
    const portfolioClicks = {};

    events.forEach(e => {
        const t = new Date(e.timestamp).getTime();
        const type = e.event_type || e.eventType;

        if (type === 'page_view') {
            viewsTotal++;
            if (t >= today) viewsToday++;
            if (t >= weekAgo) viewsWeek++;
            if (t >= monthAgo) viewsMonth++;
        }

        if (type === 'portfolio_click') {
            const item = e.portfolio_id || e.item || 'Desconhecido';
            portfolioClicks[item] = (portfolioClicks[item] || 0) + 1;
        }
    });

    const portfolioRank = Object.entries(portfolioClicks)
        .map(([name, clicks]) => ({ name, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5); // Top 5

    // Map de coordenadas conhecidas para fallbacks por cidade/região
    const CITY_COORDS_MAP = {
        'rio de janeiro': [-22.9068, -43.1729],
        'são paulo': [-23.5505, -46.6333],
        'sao paulo': [-23.5505, -46.6333],
        'brasília': [-15.7801, -47.9292],
        'brasilia': [-15.7801, -47.9292],
        'belo horizonte': [-19.9167, -43.9345],
        'curitiba': [-25.4284, -49.2733],
        'porto alegre': [-30.0346, -51.2177],
        'salvador': [-12.9777, -38.5016],
        'recife': [-8.0476, -34.8770],
        'fortaleza': [-3.7319, -38.5267],
        'florianópolis': [-27.5954, -48.5480],
        'goiânia': [-16.6869, -49.2648],
        'manaus': [-3.1190, -60.0217],
        'belém': [-1.4558, -48.4902],
        'vitória': [-20.3155, -40.3128],
        'campinas': [-22.9056, -47.0608],
        'niterói': [-22.8833, -43.1036],
        'lisboa': [38.7223, -9.1393],
        'miami': [25.7617, -80.1918],
        'nova york': [40.7128, -74.0060],
        'londres': [51.5074, -0.1278],
        'tóquio': [35.6762, 139.6503]
    };

    // Heatmap data via Leads & Telemetry (latitude, longitude, intensidade)
    const heatmapPoints = [];

    leads.forEach(l => {
        let lat = null, lon = null;
        if (l.ipCoords && l.ipCoords !== '0, 0' && l.ipCoords !== '0,0') {
            const parts = l.ipCoords.split(',');
            lat = parseFloat(parts[0]);
            lon = parseFloat(parts[1]);
        }
        if ((!lat || isNaN(lat)) && (l.ipCity || l.cidade || l.ipRegion || l.regiao)) {
            const cityName = (l.ipCity || l.cidade || l.ipRegion || l.regiao || '').toLowerCase().trim();
            if (CITY_COORDS_MAP[cityName]) {
                [lat, lon] = CITY_COORDS_MAP[cityName];
            }
        }
        if (lat !== null && !isNaN(lat) && lon !== null && !isNaN(lon)) {
            heatmapPoints.push([lat, lon, 0.9]); // Lead convertida tem intensidade alta (0.9)
        }
    });

    // Processar telemetria para pontos de acesso adicionais
    events.forEach(e => {
        if (e.ipCoords && e.ipCoords !== '0, 0' && e.ipCoords !== '0,0') {
            const parts = e.ipCoords.split(',');
            const lat = parseFloat(parts[0]);
            const lon = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lon)) {
                heatmapPoints.push([lat, lon, 0.4]); // Visita simples tem intensidade moderada (0.4)
            }
        }
    });

    res.json({
        leadsTotal: leads.length,
        visitors: {
            today: viewsToday,
            week: viewsWeek,
            month: viewsMonth,
            total: viewsTotal
        },
        portfolioRank,
        heatmap: heatmapPoints,
        chartData: {
            recent: events.slice(-100)
        }
    });
});

app.get('/api/telemetry/events', requireAuth, (req, res) => {
    const events = safeReadJSON('telemetry_log.json', []);
    res.json(events.slice(-200).reverse());
});

// ===== SERVIR PÁGINAS DA APLICAÇÃO =====

app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

// Middleware Global de Tratamento de Erros 404 & 500
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

// ===== ROTA DE PING / HEALTHCHECK (ANTI-HIBERNAÇÃO) =====
app.get('/ping', (req, res) => {
    res.status(200).json({ status: 'active', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ===== INICIAR SERVIDOR =====
const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  ALDEIA Servidor Backend Unificado (Node.js + Express)`);
    console.log(`  Porta: ${PORT}`);
    console.log(`  Segurança: Rate Limiter + Anti-DDoS + Token TTL`);
    console.log(`  Persistência: Utilitários de I/O Atômico em JSON`);
    console.log(`======================================================\n`);

    // Self-Ping Keep-Alive automático para Render (Impede Hibernação no Plano Grátis)
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    if (renderUrl) {
        const pingEndpoint = `${renderUrl.replace(/\/$/, '')}/ping`;
        const https = require('https');
        const http = require('http');
        const client = pingEndpoint.startsWith('https') ? https : http;

        setInterval(() => {
            client.get(pingEndpoint, (res) => {
                console.log(`[KEEP-ALIVE] Anti-hibernação ativo: ${pingEndpoint} (${res.statusCode})`);
            }).on('error', (err) => {
                console.warn(`[KEEP-ALIVE] Erro no ping: ${err.message}`);
            });
        }, 10 * 60 * 1000); // Executa a cada 10 minutos
    }
});

// Graceful Shutdown Handler
function shutdown() {
    console.log('\n[SERVER] Encerrando servidor com segurança...');
    server.close(() => {
        console.log('[SERVER] Servidor encerrado.');
        process.exit(0);
    });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
