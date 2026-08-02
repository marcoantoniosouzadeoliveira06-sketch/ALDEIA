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

const app = express();
const PORT = process.env.PORT || 3000;
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
function safeReadJSON(filename, defaultVal = []) {
    const filePath = path.join(ROOT_DIR, filename);
    try {
        if (!fs.existsSync(filePath)) return defaultVal;
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw.trim()) return defaultVal;
        return JSON.parse(raw);
    } catch (err) {
        console.error(`[PERSISTENCE] Erro ao ler ${filename}:`, err.message);
        return defaultVal;
    }
}

function safeWriteJSON(filename, data) {
    const filePath = path.join(ROOT_DIR, filename);
    const tmpPath = `${filePath}.tmp_${Date.now()}`;
    try {
        const jsonStr = JSON.stringify(data, null, 2);
        fs.writeFileSync(tmpPath, jsonStr, 'utf8');
        fs.renameSync(tmpPath, filePath);
        return true;
    } catch (err) {
        console.error(`[PERSISTENCE] Erro ao salvar ${filename}:`, err.message);
        if (fs.existsSync(tmpPath)) {
            try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
        return false;
    }
}

// ===== UPLOAD DE ARQUIVOS SEGURO (Multer) =====
const uploadDir = path.join(ROOT_DIR, 'assets', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Tipos permitidos (Imagens e Vídeos)
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime'
]);

const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mp4', '.webm', '.mov'
]);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.png';
        const uniqueName = `upload_${crypto.randomUUID()}${ext}`;
        cb(null, uniqueName);
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

// ===== AUTENTICAÇÃO =====
function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (validTokens.has(token)) {
            const timestamp = validTokens.get(token);
            if (Date.now() - timestamp < TOKEN_TTL) {
                return true;
            } else {
                validTokens.delete(token); // Token expirado
            }
        }
    }
    return false;
}

function requireAuth(req, res, next) {
    if (!verifyToken(req)) {
        return res.status(401).json({ status: 'error', message: 'Não autorizado. Token inválido ou expirado.' });
    }
    next();
}

function logLoginAttempt(ip, status, userAgent) {
    try {
        let logs = safeReadJSON('login_audit.json', []);
        logs.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
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

app.get('/api/auth/verify', (req, res) => {
    if (verifyToken(req)) {
        return res.json({ status: 'success' });
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
    const newProject = {
        id: 'p' + Date.now(),
        title: req.body.title || 'Sem Título',
        category: req.body.category || 'artes',
        categoryLabel: req.body.categoryLabel || 'Artes Avulsas',
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

// ===== UPLOAD =====

app.post('/api/upload', requireAuth, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ status: 'error', message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'Nenhum arquivo enviado' });
        }
        const relativeUrl = `assets/uploads/${req.file.filename}`;
        res.json({ status: 'success', url: relativeUrl });
    });
});

// ===== ROTAS DE LEADS / SUBMISSIONS =====

app.post('/api/cadastro', (req, res) => {
    let submissions = safeReadJSON('submissions.json', []);
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

// ===== TELEMETRIA E ANALYTICS =====

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
        if (events.length > 5000) events = events.slice(-5000);
        safeWriteJSON('telemetry_log.json', events);
    }
    res.json({ status: 'ok' });
});

app.get('/api/telemetry/stats', (req, res) => {
    const events = safeReadJSON('telemetry_log.json', []);
    const totalEvents = events.length;
    const conversions = events.filter(e => e.eventType === 'conversion' || e.event === 'conversion').length;
    const abandonments = events.filter(e => e.eventType === 'abandonment' || e.event === 'form_abandonment').length;
    
    res.json({
        total: { total: totalEvents },
        conversions: { total: conversions },
        abandonments: { total: abandonments }
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

// ===== INICIAR SERVIDOR =====
const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  ALDEIA Servidor Backend Unificado (Node.js + Express)`);
    console.log(`  Porta: ${PORT}`);
    console.log(`  Segurança: Rate Limiter + Anti-DDoS + Token TTL`);
    console.log(`  Persistência: Utilitários de I/O Atômico em JSON`);
    console.log(`======================================================\n`);
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
