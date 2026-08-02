/* ============================================================
   ALDEIA — SERVIDOR DE PRODUÇÃO UNIFICADO (Node.js + Express)
   Pronto para Hospedagem no RENDER.COM, RAILWAY ou VPS
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

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

// ===== CONFIGURAÇÃO DE SEGURANÇA E ADMIN =====
// Hash SHA-256 da senha '123aldeia'
const ADMIN_PASSWORD_HASH = "0c88ccdb3a0615173fc7cc49491be2a12cae97c7192dadfde3064148e54cc7aa";
const validTokens = new Map();
const ipRequests = new Map(); // Rate limiting

// ===== UPLOAD DE ARQUIVOS (Multer) =====
const uploadDir = path.join(ROOT_DIR, 'assets', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        const uniqueName = `upload_${crypto.randomUUID()}${ext}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ===== MIDDLEWARES =====
// Segurança
app.use(helmet({
    contentSecurityPolicy: false, // desativado para permitir assets e scripts do próprio site
    crossOriginEmbedderPolicy: false
}));

// Proteção contra DDoS e Força Bruta
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // Limita cada IP a 1000 requisições por janela
    message: 'Muitas requisições deste IP, tente novamente mais tarde.'
});
const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 100, // Limita requisições à API
    message: 'Muitas tentativas de API, tente novamente mais tarde.'
});

app.use(globalLimiter);
app.use('/api', apiLimiter);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '2kb' }));

// ===== SERVIR ARQUIVOS ESTÁTICOS =====
app.use(express.static(ROOT_DIR, {
    maxAge: '1d',
    setHeaders: (res, path) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

// Headers de segurança para rotas de API
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Rate limiting (max 100 requisições/min por IP)
app.use((req, res, next) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const isLocal = clientIP === '::1' || clientIP === '127.0.0.1' || clientIP.startsWith('192.168.');
    
    if (!isLocal) {
        const now = Date.now();
        const timestamps = (ipRequests.get(clientIP) || []).filter(t => t > now - 60000);
        if (timestamps.length >= 100) {
            return res.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
        }
        timestamps.push(now);
        ipRequests.set(clientIP, timestamps);
    }
    next();
});

// Helper de Verificação de Token
function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        return validTokens.has(token);
    }
    return false;
}

function requireAuth(req, res, next) {
    if (!verifyToken(req)) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    next();
}

// Helper para salvar registros de login
function logLoginAttempt(ip, status, userAgent) {
    try {
        const loginFile = path.join(ROOT_DIR, 'login_audit.json');
        let logs = [];
        if (fs.existsSync(loginFile)) {
            const content = fs.readFileSync(loginFile, 'utf8');
            if (content.trim()) logs = JSON.parse(content);
        }
        logs.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            ip: ip || '127.0.0.1',
            status: status,
            userAgent: userAgent || 'Desconhecido'
        });
        if (logs.length > 1000) logs = logs.slice(-1000);
        fs.writeFileSync(loginFile, JSON.stringify(logs, null, 2), 'utf8');
    } catch (e) {
        console.error('[AUDIT] Erro ao gravar log de login:', e.message);
    }
}

// ===== ROTAS DE AUTENTICAÇÃO =====

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    const { passwordHash } = req.body || {};
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';

    if (passwordHash === ADMIN_PASSWORD_HASH) {
        const newToken = crypto.randomUUID();
        validTokens.set(newToken, Date.now());
        logLoginAttempt(clientIP, 'Sucesso', ua);
        return res.json({ status: 'success', token: newToken });
    } else {
        logLoginAttempt(clientIP, 'Senha Incorreta', ua);
        return res.status(401).json({ status: 'error', message: 'Senha incorreta' });
    }
});

// GET /api/auth/verify
app.get('/api/auth/verify', (req, res) => {
    if (verifyToken(req)) {
        return res.json({ status: 'success' });
    }
    return res.status(401).json({ status: 'error', message: 'Token inválido' });
});

// GET /api/auth/logins (Protegido)
app.get('/api/auth/logins', requireAuth, (req, res) => {
    const loginFile = path.join(ROOT_DIR, 'login_audit.json');
    if (fs.existsSync(loginFile)) {
        const content = fs.readFileSync(loginFile, 'utf8');
        return res.type('application/json').send(content || '[]');
    }
    res.json([]);
});

// ===== ROTAS DE CONTEÚDO (CMS) =====

// GET /api/content
app.get('/api/content', (req, res) => {
    const contentFile = path.join(ROOT_DIR, 'site_content.json');
    if (fs.existsSync(contentFile)) {
        const content = fs.readFileSync(contentFile, 'utf8');
        return res.type('application/json').send(content || '{}');
    }
    res.json({});
});

// POST /api/content (Protegido)
app.post('/api/content', requireAuth, (req, res) => {
    const contentFile = path.join(ROOT_DIR, 'site_content.json');
    fs.writeFileSync(contentFile, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ status: 'success', message: 'Conteúdo atualizado com sucesso' });
});

// ===== ROTAS DE PORTFÓLIO =====
app.get('/api/portfolio', (req, res) => {
    const file = path.join(ROOT_DIR, 'portfolio.json');
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        return res.type('application/json').send(content || '[]');
    }
    // Retorna MOCK se arquivo não existir (fallback temporário)
    res.json([]);
});

app.post('/api/portfolio', requireAuth, (req, res) => {
    const file = path.join(ROOT_DIR, 'portfolio.json');
    let data = [];
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.trim()) data = JSON.parse(content);
    }
    const newProject = {
        id: 'p' + Date.now(),
        title: req.body.title || 'Sem Título',
        category: req.body.category || 'artes',
        categoryLabel: req.body.categoryLabel || 'Artes Avulsas',
        cover: req.body.cover || '',
        assets: req.body.assets || []
    };
    data.push(newProject);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    res.json({ status: 'success', project: newProject });
});

app.delete('/api/portfolio/:id', requireAuth, (req, res) => {
    const file = path.join(ROOT_DIR, 'portfolio.json');
    if (!fs.existsSync(file)) return res.json({ status: 'error' });
    let data = JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
    data = data.filter(p => p.id !== req.params.id);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    res.json({ status: 'success' });
});

// POST /api/upload (Protegido)
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const relativeUrl = `assets/uploads/${req.file.filename}`;
    res.json({ url: relativeUrl });
});

// ===== ROTAS DE CADASTRO / LEADS =====

// POST /api/cadastro
app.post('/api/cadastro', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const submissionsFile = path.join(ROOT_DIR, 'submissions.json');
    
    let submissions = [];
    if (fs.existsSync(submissionsFile)) {
        const content = fs.readFileSync(submissionsFile, 'utf8');
        if (content.trim()) submissions = JSON.parse(content);
    }

    const newSubmission = {
        ...req.body,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        whatsappClicked: "Não",
        ipCountry: "Brasil",
        ipRegion: "Rio de Janeiro",
        ipCity: "Rio de Janeiro",
        ipISP: "ALDEIA Cloud Server",
        ipCoords: "-22.9068, -43.1729"
    };

    submissions.push(newSubmission);
    fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2), 'utf8');

    res.json({ status: 'success', message: 'Cadastro recebido com sucesso', id: newSubmission.id });
});

// POST /api/cadastro/click-link
app.post('/api/cadastro/click-link', (req, res) => {
    const { id } = req.body || {};
    const submissionsFile = path.join(ROOT_DIR, 'submissions.json');
    
    if (fs.existsSync(submissionsFile)) {
        const content = fs.readFileSync(submissionsFile, 'utf8');
        let submissions = JSON.parse(content || '[]');
        let updated = false;

        submissions = submissions.map(sub => {
            if (sub.id === id) {
                updated = true;
                return { ...sub, whatsappClicked: "Sim" };
            }
            return sub;
        });

        if (updated) {
            fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2), 'utf8');
            return res.json({ status: 'success', message: 'WA click registrado' });
        }
    }
    res.status(404).json({ status: 'error', message: 'Submission not found' });
});

// GET /api/submissions (Protegido)
app.get('/api/submissions', requireAuth, (req, res) => {
    const submissionsFile = path.join(ROOT_DIR, 'submissions.json');
    if (fs.existsSync(submissionsFile)) {
        const content = fs.readFileSync(submissionsFile, 'utf8');
        return res.type('application/json').send(content || '[]');
    }
    res.json([]);
});

// ===== DUMP SQL =====
app.get('/api/admin/export/sql', requireAuth, (req, res) => {
    let sql = `-- ALDEIA DATABASE DUMP (SQL EXPORT)\n`;
    sql += `-- Data: ${new Date().toISOString()}\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS submissions (\n`;
    sql += `    id VARCHAR(50) PRIMARY KEY,\n`;
    sql += `    timestamp DATETIME,\n`;
    sql += `    nome VARCHAR(255),\n`;
    sql += `    email VARCHAR(255),\n`;
    sql += `    telefone VARCHAR(100),\n`;
    sql += `    projeto TEXT,\n`;
    sql += `    whatsapp_clicked VARCHAR(10)\n`;
    sql += `);\n\n`;

    const submissionsFile = path.join(ROOT_DIR, 'submissions.json');
    if (fs.existsSync(submissionsFile)) {
        const subs = JSON.parse(fs.readFileSync(submissionsFile, 'utf8') || '[]');
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
    }

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=aldeia_database_dump.sql');
    res.send(sql);
});

// GET /api/security/stats (Protegido)
app.get('/api/security/stats', requireAuth, (req, res) => {
    const statsList = [];
    const now = Date.now();
    for (const [ip, timestamps] of ipRequests.entries()) {
        const valid = timestamps.filter(t => t > now - 60000);
        statsList.push({
            ip: ip,
            requests: valid.length,
            isBlocked: valid.length >= 100
        });
    }
    res.json({ totalIPs: ipRequests.size, ips: statsList });
});

// ===== TELEMETRIA =====
app.post('/api/telemetry', (req, res) => {
    res.json({ status: 'ok' });
});
app.get('/api/telemetry/stats', (req, res) => {
    res.json({ total: { total: 0 }, conversions: { total: 0 }, abandonments: { total: 0 } });
});
app.get('/api/telemetry/events', (req, res) => {
    res.json([]);
});

// ===== SERVIR ARQUIVOS ESTÁTICOS =====
app.use(express.static(ROOT_DIR));

app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

// ===== INICIAR SERVIDORE =====
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  ALDEIA Servidor Oficial (Node.js + Express)`);
    console.log(`  Porta: ${PORT}`);
    console.log(`  Ambiente: Pronto para Render / Railway / Localhost`);
    console.log(`======================================================\n`);
});
