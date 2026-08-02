/* ============================================
   ALDEIA — TELEMETRY SERVER (Express + SQLite3)
   Protocolo Zero-Defect | AES-256-CBC | Anti-Bot
   ============================================ */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// ===== ENCRYPTION CONFIG =====
const ENV_PATH = path.join(__dirname, '.env.telemetry');
let ENCRYPTION_KEY; // 32 bytes for AES-256
let HMAC_SECRET;    // For payload integrity

function loadOrCreateSecrets() {
    if (fs.existsSync(ENV_PATH)) {
        const envContent = fs.readFileSync(ENV_PATH, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
            const [key, val] = line.split('=');
            if (key === 'ENCRYPTION_KEY') ENCRYPTION_KEY = val;
            if (key === 'HMAC_SECRET') HMAC_SECRET = val;
        }
    }
    if (!ENCRYPTION_KEY || !HMAC_SECRET) {
        ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
        HMAC_SECRET = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(ENV_PATH, `ENCRYPTION_KEY=${ENCRYPTION_KEY}\nHMAC_SECRET=${HMAC_SECRET}\n`);
        console.log('[SECURITY] Chaves AES-256 e HMAC geradas e salvas em .env.telemetry');
    }
}
loadOrCreateSecrets();

// ===== DATABASE INIT =====
const DB_PATH = path.join(__dirname, 'telemetry.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('[DB] Erro ao abrir telemetry.db:', err.message);
        process.exit(1);
    }
    console.log('[DB] Conectado a telemetry.db');
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS telemetry_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT NOT NULL,
            event_type  TEXT NOT NULL CHECK(event_type IN ('conversion', 'abandonment')),
            converted   INTEGER DEFAULT 0 CHECK(converted IN (0, 1)),
            dwell_time  REAL NOT NULL,
            ip_hash     TEXT,
            user_agent  TEXT,
            page_url    TEXT DEFAULT '/',
            created_at  DATETIME DEFAULT (datetime('now','localtime'))
        )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_event_type ON telemetry_events(event_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON telemetry_events(created_at)`);
    console.log('[DB] Schema telemetry_events inicializado.');
});

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '10kb' }));
app.use(express.text({ type: 'text/plain', limit: '10kb' }));

// CORS — dynamically allow localhost, 127.0.0.1, or local network origins
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.'))) {
        res.header('Access-Control-Allow-Origin', origin);
    } else {
        res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Telemetry-HMAC, X-Telemetry-Encrypted');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ===== RATE LIMITING =====
const ipRateMap = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
    const now = Date.now();
    if (!ipRateMap.has(ip)) {
        ipRateMap.set(ip, []);
    }
    const timestamps = ipRateMap.get(ip).filter(t => t > now - RATE_WINDOW);
    ipRateMap.set(ip, timestamps);
    if (timestamps.length >= RATE_LIMIT) return false;
    timestamps.push(now);
    return true;
}

// Clean up rate map every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRateMap.entries()) {
        const valid = timestamps.filter(t => t > now - RATE_WINDOW);
        if (valid.length === 0) ipRateMap.delete(ip);
        else ipRateMap.set(ip, valid);
    }
}, 300000);

// ===== SECURITY: Anti-Bot =====
const BLOCKED_UA_PATTERNS = [
    /bot/i, /spider/i, /crawl/i, /scrape/i, /headless/i,
    /phantom/i, /selenium/i, /puppeteer/i, /playwright/i
];

function isBot(userAgent) {
    if (!userAgent) return true;
    return BLOCKED_UA_PATTERNS.some(pattern => pattern.test(userAgent));
}

// ===== CRYPTO HELPERS =====
function hashIP(ip) {
    return crypto.createHash('sha256').update(ip + HMAC_SECRET).digest('hex').substring(0, 16);
}

function decryptPayload(encryptedData) {
    try {
        const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (e) {
        return null;
    }
}

function verifyHMAC(payload, receivedHmac) {
    const expected = crypto.createHmac('sha256', HMAC_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedHmac));
}

// ===== SANITIZE =====
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>"'&]/g, '').substring(0, 500);
}

// ===== ROUTES =====

// --- POST /api/telemetry ---
app.post('/api/telemetry', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || '0.0.0.0';

    // Rate limit
    if (!checkRateLimit(clientIP)) {
        return res.status(429).json({ error: 'Rate limit excedido.' });
    }

    // Anti-bot
    const ua = req.headers['user-agent'] || '';
    if (isBot(ua)) {
        return res.status(403).json({ error: 'Acesso bloqueado.' });
    }

    let payload;
    const isEncrypted = req.headers['x-telemetry-encrypted'] === 'true';

    if (isEncrypted) {
        payload = decryptPayload(req.body);
        if (!payload) {
            return res.status(400).json({ error: 'Falha na descriptografia.' });
        }
    } else {
        // Unencrypted fallback — validate HMAC
        const hmac = req.headers['x-telemetry-hmac'];
        payload = req.body;

        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch (e) {
                return res.status(400).json({ error: 'JSON inválido.' });
            }
        }

        if (hmac) {
            try {
                if (!verifyHMAC(payload, hmac)) {
                    return res.status(403).json({ error: 'HMAC inválido — possível spoofing.' });
                }
            } catch (e) {
                return res.status(403).json({ error: 'HMAC verification failed.' });
            }
        }
    }

    // Validate required fields
    const { session_id, event_type, converted, dwell_time, page_url } = payload;

    if (!session_id || !event_type || dwell_time === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: session_id, event_type, dwell_time.' });
    }

    if (!['conversion', 'abandonment'].includes(event_type)) {
        return res.status(400).json({ error: 'event_type deve ser "conversion" ou "abandonment".' });
    }

    if (dwell_time < 0 || dwell_time > 3600) {
        return res.status(400).json({ error: 'dwell_time fora do intervalo válido (0-3600s).' });
    }

    // Insert into database
    const stmt = db.prepare(`
        INSERT INTO telemetry_events (session_id, event_type, converted, dwell_time, ip_hash, user_agent, page_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        sanitize(session_id),
        event_type,
        converted ? 1 : 0,
        parseFloat(dwell_time),
        hashIP(clientIP),
        sanitize(ua).substring(0, 300),
        sanitize(page_url || '/'),
        function (err) {
            if (err) {
                console.error('[DB] Insert error:', err.message);
                return res.status(500).json({ error: 'Erro interno ao registrar telemetria.' });
            }
            res.json({ status: 'ok', id: this.lastID });
        }
    );
    stmt.finalize();
});

// --- GET /api/telemetry/stats ---
app.get('/api/telemetry/stats', (req, res) => {
    const queries = {
        total: `SELECT COUNT(*) as total FROM telemetry_events`,
        conversions: `SELECT COUNT(*) as total FROM telemetry_events WHERE converted = 1`,
        abandonments: `SELECT COUNT(*) as total FROM telemetry_events WHERE converted = 0`,
        avg_conversion_time: `SELECT AVG(dwell_time) as avg_time FROM telemetry_events WHERE converted = 1`,
        avg_abandon_time: `SELECT AVG(dwell_time) as avg_time FROM telemetry_events WHERE converted = 0`,
        daily_volume: `
            SELECT date(created_at) as day, 
                   COUNT(*) as total,
                   SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as conversions,
                   SUM(CASE WHEN converted = 0 THEN 1 ELSE 0 END) as abandonments
            FROM telemetry_events 
            WHERE created_at >= datetime('now', '-7 days', 'localtime')
            GROUP BY date(created_at)
            ORDER BY day ASC
        `
    };

    const result = {};
    let pending = Object.keys(queries).length;

    for (const [key, sql] of Object.entries(queries)) {
        if (key === 'daily_volume') {
            db.all(sql, [], (err, rows) => {
                result[key] = err ? [] : rows;
                if (--pending === 0) res.json(result);
            });
        } else {
            db.get(sql, [], (err, row) => {
                result[key] = err ? null : row;
                if (--pending === 0) res.json(result);
            });
        }
    }
});

// --- GET /api/telemetry/events ---
app.get('/api/telemetry/events', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    db.all(
        `SELECT id, session_id, event_type, converted, dwell_time, page_url, created_at 
         FROM telemetry_events 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// --- GET /api/telemetry/encryption-key ---
app.get('/api/telemetry/encryption-key', (req, res) => {
    res.json({ key: ENCRYPTION_KEY });
});

// ===== START =====
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  ALDEIA Telemetry Server`);
    console.log(`  Porta: ${PORT}`);
    console.log(`  DB: telemetry.db`);
    console.log(`  Criptografia: AES-256-CBC`);
    console.log(`  Anti-Bot: Ativo`);
    console.log(`======================================================\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[SERVER] Encerrando servidor de telemetria...');
    db.close(() => {
        console.log('[DB] Conexão fechada.');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    db.close(() => process.exit(0));
});
