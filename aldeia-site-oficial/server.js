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
const { z } = require('zod');
const DOMPurify = require('isomorphic-dompurify');
const bcrypt = require('bcryptjs');
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
const DEFAULT_ADMIN_USERNAME = 'japex';
const DEFAULT_ADMIN_PASSWORD = 'japex123';
const LEGACY_DEFAULT_ADMIN_PASSWORD = '123japex';
const USER_PROFILES_FILE = 'user_profiles.json';
const ADMIN_PASSWORD_HASH = (process.env.ADMIN_PASSWORD_HASH_OVERRIDE || process.env.ADMIN_PASSWORD_HASH || '').trim();
const HAS_VALID_ADMIN_HASH = /^\$2[aby]\$\d{2}\$/.test(ADMIN_PASSWORD_HASH) || /^[a-f0-9]{64}$/.test(ADMIN_PASSWORD_HASH);
const BOOTSTRAP_SESSION_SECRET = crypto.createHash('sha256').update('aldeia-japex-session-v1').digest('hex');
const SESSION_SIGNING_SECRET = process.env.SESSION_SIGNING_SECRET || (HAS_VALID_ADMIN_HASH ? ADMIN_PASSWORD_HASH : BOOTSTRAP_SESSION_SECRET);
const VIEW_FINGERPRINT_SECRET = process.env.VIEW_FINGERPRINT_SECRET || SESSION_SIGNING_SECRET;
if (!HAS_VALID_ADMIN_HASH) {
    console.warn('[AUTH] ADMIN_PASSWORD_HASH ausente no ambiente — login usa user_profiles.json + credencial bootstrap (japex).');
}

// Tokens com TTL (24 horas = 86.400.000 ms)
const TOKEN_TTL = 24 * 60 * 60 * 1000;
const validTokens = new Map(); // token -> timestamp
const ipRequests = new Map();  // ip -> array of timestamps
const pendingJsonWrites = new Map();

// Limpeza periódica de memória (RAM) a cada 30 minutos
const memoryCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [token, tokenData] of validTokens.entries()) {
        if (!tokenData || now - tokenData.timestamp > TOKEN_TTL) {
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
memoryCleanupTimer.unref?.();

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

    const previousWrite = pendingJsonWrites.get(filename) || Promise.resolve();
    const writeOperation = previousWrite.catch(() => {}).then(async () => {
        try {
            await fs.promises.writeFile(tmpPath, jsonStr, 'utf8');
            await fs.promises.rename(tmpPath, filePath);
        } catch (err) {
            console.error(`[PERSISTENCE] Erro ao salvar ${filename}:`, err.message);
            try { await fs.promises.unlink(tmpPath); } catch (_) {}
            throw err;
        }
    });

    pendingJsonWrites.set(filename, writeOperation);
    writeOperation.catch(() => {});
    return true;
}

// ===== CONEXÃO & MODELOS DO MONGODB ATLAS (NUVEM) =====
let isMongoConnected = false;

const projectSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, default: 'Sem Título' },
    category: { type: String, default: 'artes', index: true },
    categoryLabel: { type: String, default: 'Artes Avulsas' },
    format: { type: String, default: 'post' },
    aspectRatio: { type: String, default: '1:1' },
    accentColor: { type: String, default: '#ffffff' },
    cover: { type: String, default: '' },
    assets: { type: Array, default: [] },
    member: { type: mongoose.Schema.Types.Mixed, default: null },
    views: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

const clientSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    leadId: { type: String, default: null },
    nome: { type: String, default: 'Cliente Sem Nome' },
    email: { type: String, default: '', index: true },
    telefone: { type: String, default: '' },
    projeto: { type: String, default: 'Projeto Padrão' },
    status: { type: String, default: 'Ativo' },
    createdAt: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

const submissionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    timestamp: { type: String, default: () => new Date().toISOString(), index: true },
    nome: { type: String, default: '' },
    email: { type: String, default: '', index: true },
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
    ipCoords: { type: String, default: '' },
    locationConsent: { type: Boolean, default: false },
    locationCoords: { type: String, default: '' }
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
    status: { type: String, default: 'backlog', index: true }, // 'backlog', 'in_progress', 'review', 'done'
    assignedTo: { type: String, default: 'Japex', index: true },
    priority: { type: String, default: 'média' }, // 'alta', 'média', 'baixa'
    clientName: { type: String, default: '' },
    dueDate: { type: String, default: '' }
}, { timestamps: true });

const userProfileSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    displayName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'operator'], default: 'operator', index: true },
    passwordHash: { type: String, default: '' },
    active: { type: Boolean, default: true, index: true },
    isRoot: { type: Boolean, default: false }
}, { timestamps: true });

const analyticsSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    eventType: { type: String, required: true },
    path: { type: String, default: '/' },
    elementId: { type: String, default: '' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    timestamp: { type: String, default: () => new Date().toISOString(), index: true }
});

const projectViewWindowSchema = new mongoose.Schema({
    projectId: { type: String, required: true, index: true },
    visitorHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, { timestamps: true });
projectViewWindowSchema.index({ projectId: 1, visitorHash: 1 }, { unique: true });

const projectViewEventSchema = new mongoose.Schema({
    projectId: { type: String, required: true, index: true },
    visitorHash: { type: String, required: true },
    viewedAt: { type: Date, required: true, default: Date.now, index: true }
});
projectViewEventSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const adminSettingsSchema = new mongoose.Schema({
    key: { type: String, default: 'main', unique: true },
    externalAnalytics: { type: Boolean, default: true },
    updatedBy: { type: String, default: 'Admin' }
}, { timestamps: true });

const ProjectModel = mongoose.model('Project', projectSchema);
const ClientModel = mongoose.model('Client', clientSchema);
const SubmissionModel = mongoose.model('Submission', submissionSchema);
const AnalyticsModel = mongoose.model('Analytics', analyticsSchema);
const SiteContentModel = mongoose.model('SiteContent', siteContentSchema);
const AuditLogModel = mongoose.model('AuditLog', auditLogSchema);
const TrelloTaskModel = mongoose.model('TrelloTask', trelloTaskSchema);
const UserProfileModel = mongoose.model('UserProfile', userProfileSchema);
const ProjectViewWindowModel = mongoose.model('ProjectViewWindow', projectViewWindowSchema);
const ProjectViewEventModel = mongoose.model('ProjectViewEvent', projectViewEventSchema);
const AdminSettingsModel = mongoose.model('AdminSettings', adminSettingsSchema);

// ===== ZERO-TRUST INPUT NORMALIZATION =====
const SAFE_RICH_TEXT = { ALLOWED_TAGS: ['strong', 'em', 'br', 'ul', 'ol', 'li', 'p', 'span'], ALLOWED_ATTR: [] };
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const SAFE_HEX_COLOR = /^#[A-Fa-f0-9]{6}$/;

function sanitizePlainText(value) {
    return DOMPurify.sanitize(String(value ?? ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

function sanitizeRichText(value) {
    return DOMPurify.sanitize(String(value ?? ''), SAFE_RICH_TEXT).trim();
}

function scrubNoSql(value, depth = 0) {
    if (depth > 12 || value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(item => scrubNoSql(item, depth + 1));
    if (typeof value !== 'object') return value;

    return Object.entries(value).reduce((safeValue, [key, nestedValue]) => {
        if (!key.startsWith('$') && !key.includes('.') && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
            safeValue[key] = scrubNoSql(nestedValue, depth + 1);
        }
        return safeValue;
    }, {});
}

function sanitizeCmsContent(value, depth = 0) {
    if (depth > 12 || value === null || value === undefined) return value;
    if (typeof value === 'string') return sanitizeRichText(value);
    if (Array.isArray(value)) return value.map(item => sanitizeCmsContent(item, depth + 1));
    if (typeof value !== 'object') return value;

    return Object.entries(scrubNoSql(value, depth)).reduce((safeValue, [key, nestedValue]) => {
        safeValue[key] = sanitizeCmsContent(nestedValue, depth + 1);
        return safeValue;
    }, {});
}

function isSafeMediaUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    const trimmed = value.trim();
    if (trimmed.startsWith('assets/') || trimmed.startsWith('/assets/')) return true;
    try {
        const url = new URL(trimmed);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch (_) {
        return false;
    }
}

const plainText = (maxLength = 500) => z.string().trim().max(maxLength).transform(sanitizePlainText);
const requiredText = (maxLength = 500) => z.string().trim().min(1).max(maxLength).transform(sanitizePlainText);
const safeMediaUrl = z.string().trim().max(2048).refine(isSafeMediaUrl, 'URL de mídia inválida');
const idParamsSchema = z.object({ id: z.string().trim().regex(SAFE_ID) }).strict();
const loginSchema = z.object({
    username: plainText(80).optional().default('Admin'),
    password: z.string().min(1).max(256)
}).strict();
const projectAssetSchema = z.object({
    type: z.enum(['image', 'video']).optional(),
    src: safeMediaUrl,
    title: plainText(160).optional()
}).strip();
const projectPayloadSchema = z.object({
    title: requiredText(160),
    category: z.enum(['artes', 'identidade', 'social', 'videos']),
    categoryLabel: requiredText(100),
    format: z.enum(['auto', 'post', 'portrait', 'story', 'video']),
    aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']).optional(),
    accentColor: z.string().regex(SAFE_HEX_COLOR).optional(),
    cover: safeMediaUrl,
    assets: z.array(projectAssetSchema).max(40).optional().default([]),
    member: z.object({
        name: plainText(100).optional().default(''),
        role: plainText(120).optional().default(''),
        photo: safeMediaUrl.optional().or(z.literal(''))
    }).strip().nullable().optional()
}).strip();
const clientPayloadSchema = z.object({
    id: z.string().trim().regex(SAFE_ID).optional(),
    leadId: z.string().trim().regex(SAFE_ID).nullable().optional(),
    nome: requiredText(160),
    email: z.string().trim().email().max(254),
    telefone: plainText(40).optional().default(''),
    projeto: plainText(2000).optional().default(''),
    status: plainText(80).optional().default('Ativo')
}).strip();
const clientUpdateSchema = clientPayloadSchema.partial().refine(value => Object.keys(value).length > 0, 'Nenhum campo válido para atualizar');
const trelloPayloadSchema = z.object({
    title: requiredText(180),
    description: plainText(2000).optional().default(''),
    status: z.enum(['backlog', 'in_progress', 'review', 'done']).optional().default('backlog'),
    assignedTo: plainText(100).optional().default('Japex'),
    priority: z.enum(['alta', 'média', 'baixa']).optional().default('média'),
    clientName: plainText(160).optional().default(''),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(''))
}).strip();
const trelloUpdateSchema = trelloPayloadSchema.partial().refine(value => Object.keys(value).length > 0, 'Nenhum campo válido para atualizar');
const profilePayloadSchema = z.object({
    displayName: requiredText(120).optional(),
    avatar: safeMediaUrl.optional()
}).strip().refine(value => Object.keys(value).length > 0, 'Nenhum campo válido para atualizar');
const passwordChangeSchema = z.object({
    currentPassword: z.string().min(1).max(72),
    newPassword: z.string()
        .min(8)
        .max(72),
    confirmPassword: z.string().min(1).max(72)
}).strict().refine(value => value.newPassword === value.confirmPassword, 'As senhas nao coincidem');
const ADMIN_ROLES = ['admin', 'operator'];
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,39}$/;
const initialPasswordSchema = z.string()
    .min(8)
    .max(72);
const createAdminUserSchema = z.object({
    displayName: requiredText(120),
    username: z.string().trim().toLowerCase().regex(USERNAME_PATTERN),
    initialPassword: initialPasswordSchema,
    role: z.enum(ADMIN_ROLES)
}).strict();
const updateAdminUserRoleSchema = z.object({ role: z.enum(ADMIN_ROLES) }).strict();
const adminUsernameParamsSchema = z.object({ username: z.string().trim().toLowerCase().regex(USERNAME_PATTERN) }).strict();
const adminSettingsPayloadSchema = z.object({
    externalAnalytics: z.boolean()
}).strict();
const maintenanceActionSchema = z.object({
    action: z.enum(['clear_api_cache', 'sync_cloudinary', 'optimize_indexes', 'clear_telemetry']),
    confirmation: plainText(40).optional().default('')
}).strict();
const adminPurgeSchema = z.object({
    confirmation: z.literal('Aldeia'),
    scopes: z.array(z.enum(['analytics', 'audit', 'submissions', 'clients', 'tasks', 'views'])).min(1).max(6)
}).strict();
const leadPayloadSchema = z.object({
    nome: requiredText(160),
    email: z.string().trim().email().max(254),
    telefone: plainText(40).optional().default(''),
    instagram: plainText(100).optional().default(''),
    projeto: plainText(4000).optional().default(''),
    utmSource: plainText(120).optional().default('Direto'),
    utmMedium: plainText(120).optional().default(''),
    utmCampaign: plainText(180).optional().default(''),
    visits: z.coerce.number().int().min(1).max(100000).optional().default(1),
    firstVisit: plainText(100).optional().default(''),
    locationConsent: z.boolean().optional().default(false),
    location: z.object({
        latitude: z.coerce.number().min(-90).max(90),
        longitude: z.coerce.number().min(-180).max(180)
    }).optional()
}).strip();
const cmsContentSchema = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,99}$/), z.unknown())
    .transform(sanitizeCmsContent);
const analyticsPayloadSchema = z.object({
    events: z.array(z.object({
        sessionId: z.string().trim().regex(SAFE_ID).max(100),
        eventType: plainText(80),
        path: plainText(500).optional().default('/'),
        elementId: plainText(200).optional().default(''),
        x: z.coerce.number().min(0).max(100).optional().default(0),
        y: z.coerce.number().min(0).max(100).optional().default(0),
        timestamp: z.string().datetime({ offset: true }).optional()
    }).strip()).min(1).max(50)
}).strip();
const telemetryPayloadSchema = z.object({
    session_id: z.string().trim().regex(SAFE_ID).max(100),
    event_type: z.enum(['conversion', 'abandonment']),
    converted: z.boolean().optional().default(false),
    dwell_time: z.coerce.number().min(0).max(3600),
    page_url: plainText(500).optional().default('/')
}).strip();

function validate(schema, source = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(scrubNoSql(req[source] || {}));
        if (!result.success) {
            return res.status(400).json({ status: 'error', message: 'Dados inválidos.' });
        }
        req[`validated${source[0].toUpperCase()}${source.slice(1)}`] = result.data;
        next();
    };
}

function sanitizeProjectResponse(project) {
    const safeProject = scrubNoSql(project || {});
    const safeAssets = Array.isArray(safeProject.assets)
        ? safeProject.assets
            .filter(asset => asset && isSafeMediaUrl(asset.src))
            .slice(0, 40)
            .map(asset => ({
                type: asset.type === 'video' ? 'video' : 'image',
                src: asset.src.trim(),
                title: sanitizePlainText(asset.title || '')
            }))
        : [];
    const safeMember = safeProject.member && typeof safeProject.member === 'object'
        ? {
            name: sanitizePlainText(safeProject.member.name || ''),
            role: sanitizePlainText(safeProject.member.role || ''),
            photo: isSafeMediaUrl(safeProject.member.photo) ? safeProject.member.photo.trim() : ''
        }
        : null;

    return {
        id: SAFE_ID.test(String(safeProject.id || '')) ? String(safeProject.id) : crypto.randomUUID(),
        title: sanitizePlainText(safeProject.title || 'Sem título'),
        category: ['artes', 'identidade', 'social', 'videos'].includes(safeProject.category) ? safeProject.category : 'artes',
        categoryLabel: sanitizePlainText(safeProject.categoryLabel || 'Artes Avulsas'),
        format: ['auto', 'post', 'portrait', 'story', 'video'].includes(safeProject.format) ? safeProject.format : 'post',
        aspectRatio: ['1:1', '4:5', '9:16', '16:9'].includes(safeProject.aspectRatio) ? safeProject.aspectRatio : '1:1',
        accentColor: SAFE_HEX_COLOR.test(safeProject.accentColor || '') ? safeProject.accentColor : '#ffffff',
        cover: isSafeMediaUrl(safeProject.cover) ? safeProject.cover.trim() : '',
        assets: safeAssets,
        member: safeMember,
        views: Number.isFinite(Number(safeProject.views)) ? Math.max(0, Number(safeProject.views)) : 0
    };
}

function sanitizeLeadResponse(lead) {
    const value = scrubNoSql(lead || {});
    return {
        id: SAFE_ID.test(String(value.id || '')) ? String(value.id) : '',
        timestamp: sanitizePlainText(value.timestamp || ''),
        nome: sanitizePlainText(value.nome || ''),
        email: sanitizePlainText(value.email || ''),
        telefone: sanitizePlainText(value.telefone || ''),
        instagram: sanitizePlainText(value.instagram || ''),
        projeto: sanitizePlainText(value.projeto || ''),
        whatsappClicked: sanitizePlainText(value.whatsappClicked || ''),
        utmSource: sanitizePlainText(value.utmSource || ''),
        utmMedium: sanitizePlainText(value.utmMedium || ''),
        utmCampaign: sanitizePlainText(value.utmCampaign || ''),
        visits: Number.isFinite(value.visits) ? value.visits : 0,
        firstVisit: sanitizePlainText(value.firstVisit || ''),
        ipCountry: sanitizePlainText(value.ipCountry || ''),
        ipRegion: sanitizePlainText(value.ipRegion || ''),
        ipCity: sanitizePlainText(value.ipCity || ''),
        ipISP: sanitizePlainText(value.ipISP || ''),
        ipCoords: sanitizePlainText(value.ipCoords || ''),
        locationConsent: value.locationConsent === true,
        locationCoords: sanitizePlainText(value.locationCoords || '')
    };
}

function sanitizeClientResponse(client) {
    const value = scrubNoSql(client || {});
    return {
        id: SAFE_ID.test(String(value.id || '')) ? String(value.id) : '',
        leadId: SAFE_ID.test(String(value.leadId || '')) ? String(value.leadId) : null,
        nome: sanitizePlainText(value.nome || ''),
        email: sanitizePlainText(value.email || ''),
        telefone: sanitizePlainText(value.telefone || ''),
        projeto: sanitizePlainText(value.projeto || ''),
        status: sanitizePlainText(value.status || ''),
        createdAt: sanitizePlainText(value.createdAt || '')
    };
}

function sanitizeTrelloResponse(task) {
    const value = scrubNoSql(task || {});
    return {
        id: SAFE_ID.test(String(value.id || '')) ? String(value.id) : '',
        title: sanitizePlainText(value.title || ''),
        description: sanitizePlainText(value.description || ''),
        status: ['backlog', 'in_progress', 'review', 'done'].includes(value.status) ? value.status : 'backlog',
        assignedTo: sanitizePlainText(value.assignedTo || ''),
        priority: ['alta', 'média', 'baixa'].includes(value.priority) ? value.priority : 'média',
        clientName: sanitizePlainText(value.clientName || ''),
        dueDate: sanitizePlainText(value.dueDate || '')
    };
}

function sanitizeAuditResponse(log) {
    const value = scrubNoSql(log || {});
    return {
        id: SAFE_ID.test(String(value.id || '')) ? String(value.id) : '',
        timestamp: sanitizePlainText(value.timestamp || ''),
        username: sanitizePlainText(value.username || ''),
        ip: sanitizePlainText(value.ip || ''),
        status: sanitizePlainText(value.status || ''),
        userAgent: sanitizePlainText(value.userAgent || '')
    };
}

function normalizeAccountRole(role, username = '') {
    if (role === 'admin' || role === 'operator') return role;
    return ['japex', 'admin'].includes(String(username).toLowerCase()) ? 'admin' : 'operator';
}

function isSupportedPasswordHash(value) {
    return /^\$2[aby]\$/.test(value || '') || /^[a-f0-9]{64}$/i.test(value || '');
}

function sanitizeProfileResponse(profile, fallbackUsername = 'Admin') {
    const value = scrubNoSql(profile || {});
    const username = sanitizePlainText(value.username || fallbackUsername);
    return {
        id: sanitizePlainText(value._id || value.id || username.toLowerCase()),
        username,
        displayName: sanitizePlainText(value.displayName || value.username || fallbackUsername),
        avatar: isSafeMediaUrl(value.avatar) ? value.avatar.trim() : '/assets/japex.webp',
        role: normalizeAccountRole(value.role, username),
        active: value.active !== false,
        isRoot: value.isRoot === true || username.toLowerCase() === 'japex',
        createdAt: value.createdAt ? new Date(value.createdAt).toISOString() : ''
    };
}

const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 15000,
        maxPoolSize: 10,
        minPoolSize: 0
    })
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

mongoose.connection.on('disconnected', () => {
    isMongoConnected = false;
    console.warn('[MONGODB ATLAS] Conexão indisponível. Operando com fallback JSON local.');
});
mongoose.connection.on('error', () => {
    isMongoConnected = false;
});

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
                { username: 'japex', displayName: 'Japex', avatar: '/assets/japex.webp', role: 'admin', active: true, isRoot: true },
                { username: 'admin', displayName: 'Administrador ALDEIA', avatar: '/assets/japex.webp', role: 'admin', active: true, isRoot: false }
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

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
]);

const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov'
]);
const MIME_EXTENSIONS = {
    'image/jpeg': new Set(['.jpg', '.jpeg']),
    'image/png': new Set(['.png']),
    'image/webp': new Set(['.webp']),
    'image/gif': new Set(['.gif']),
    'video/mp4': new Set(['.mp4']),
    'video/webm': new Set(['.webm']),
    'video/quicktime': new Set(['.mov'])
};

const uploadFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext) && MIME_EXTENSIONS[file.mimetype]?.has(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não permitido. Envie apenas imagens ou vídeos.'));
    }
};

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: uploadFilter,
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB máximo por mídia
});

// ===== MIDDLEWARES =====
app.set('trust proxy', 1);

const renderExternalHostname = String(process.env.RENDER_EXTERNAL_HOSTNAME || '').trim();
const defaultOrigins = [
    'https://aldeiadesign.com.br',
    'https://www.aldeiadesign.com.br',
    'https://aldeia-agencia-oficial.onrender.com'
];
if (renderExternalHostname) defaultOrigins.push(`https://${renderExternalHostname}`);
if (process.env.NODE_ENV !== 'production') {
    defaultOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001');
}
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || defaultOrigins.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean));
const localDevelopmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://cdnjs.cloudflare.com', 'https://translate.google.com', 'https://www.gstatic.com', 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://api.fontshare.com', 'https://unpkg.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://api.fontshare.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            mediaSrc: ["'self'", 'blob:', 'https:'],
            connectSrc: ["'self'", 'https://ipapi.co', 'https://translate.google.com', 'https://www.gstatic.com'],
            frameSrc: ["'self'", 'https://translate.google.com'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'", 'https://wa.me'],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip),
    message: { status: 'error', message: 'Muitas requisições deste IP, tente novamente mais tarde.' }
});

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitas requisições de API, tente novamente mais tarde.' }
});

app.use(globalLimiter);
app.use('/api', apiLimiter);

const analyticsEventLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitos eventos em pouco tempo. Tente novamente em instantes.' }
});

const projectViewLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitas visualizações em pouco tempo.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitas tentativas. Tente novamente mais tarde.' }
});

app.use(compression());
app.use(cors({
    origin(origin, callback) {
        const isLocalDevelopment = process.env.NODE_ENV !== 'production' && localDevelopmentOrigin.test(origin || '');
        if (!origin || allowedOrigins.has(origin) || isLocalDevelopment) return callback(null, true);
        return callback(new Error('Origem não permitida.'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '5kb' }));

const publicRootFiles = new Set([
    '/index.html', '/portfolio.html', '/projeto.html', '/admin.html',
    '/style.css', '/app.js', '/portfolio.js', '/projeto.js', '/logo.svg',
    '/robots.txt', '/sitemap.xml'
]);
const publicDirectoryPrefixes = ['/assets/', '/components/'];
app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/api/')) return next();
    const requestedPath = decodeURIComponent(req.path);
    const isAllowedStatic = publicRootFiles.has(requestedPath)
        || publicDirectoryPrefixes.some(prefix => requestedPath.startsWith(prefix));
    const isGoogleVerificationFile = /^\/google[a-z0-9_-]+\.html$/i.test(requestedPath);
    if (isAllowedStatic || isGoogleVerificationFile || requestedPath === '/' || requestedPath === '/admin') return next();
    if (path.extname(requestedPath)) return res.status(404).json({ status: 'error', message: 'Arquivo não encontrado.' });
    next();
});

// Evita conteúdo duplicado: a URL canônica da página inicial é sempre a raiz.
app.get('/index.html', (req, res) => res.redirect(301, '/'));

app.use(express.static(ROOT_DIR, {
    maxAge: '1d',
    dotfiles: 'deny',
    index: false,
    setHeaders: (res, filePath) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const extension = path.extname(filePath).toLowerCase();
        if (extension === '.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (['.css', '.js', '.svg', '.webp', '.jpg', '.jpeg', '.png', '.mp4', '.woff2'].includes(extension)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        }
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
function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encodeJwtPart(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signJwtParts(headerPart, payloadPart) {
    return crypto.createHmac('sha256', SESSION_SIGNING_SECRET).update(`${headerPart}.${payloadPart}`).digest('base64url');
}

function createAdminToken(account) {
    if (!SESSION_SIGNING_SECRET) return null;
    const safeAccount = sanitizeProfileResponse(account, account?.username || 'Admin');
    const nowSeconds = Math.floor(Date.now() / 1000);
    const headerPart = encodeJwtPart({ alg: 'HS256', typ: 'JWT' });
    const payloadPart = encodeJwtPart({
        sub: safeAccount.username,
        id: safeAccount.id,
        role: safeAccount.role,
        iat: nowSeconds,
        exp: nowSeconds + Math.floor(TOKEN_TTL / 1000),
        jti: crypto.randomUUID()
    });
    const token = `${headerPart}.${payloadPart}.${signJwtParts(headerPart, payloadPart)}`;
    validTokens.set(token, { timestamp: Date.now(), username: safeAccount.username, displayName: safeAccount.displayName, id: safeAccount.id, role: safeAccount.role });
    return token;
}

function invalidateUserSessions(username) {
    const normalized = String(username || '').toLowerCase();
    for (const [token, tokenData] of validTokens.entries()) {
        if (String(tokenData?.username || '').toLowerCase() === normalized) validTokens.delete(token);
    }
}

async function bootstrapUserProfiles() {
    let profiles = safeReadJSON(USER_PROFILES_FILE, null);
    const invalidProfiles = !profiles || typeof profiles !== 'object' || Array.isArray(profiles);
    if (invalidProfiles) profiles = {};

    const japexProfile = profiles[DEFAULT_ADMIN_USERNAME];
    const isEmpty = Object.keys(profiles).length === 0;
    const missingJapex = !japexProfile;
    const storedJapexHash = String(japexProfile?.passwordHash || '').trim();
    const weakCredential = japexProfile && !isSupportedPasswordHash(storedJapexHash);
    let usesLegacyBootstrapCredential = storedJapexHash === LEGACY_DEFAULT_ADMIN_PASSWORD;
    if (!usesLegacyBootstrapCredential && /^\$2[aby]\$/.test(storedJapexHash)) {
        try {
            usesLegacyBootstrapCredential = await bcrypt.compare(LEGACY_DEFAULT_ADMIN_PASSWORD, storedJapexHash);
        } catch (_) {
            usesLegacyBootstrapCredential = false;
        }
    }
    if (!usesLegacyBootstrapCredential && /^[a-f0-9]{64}$/i.test(storedJapexHash)) {
        usesLegacyBootstrapCredential = crypto.createHash('sha256').update(LEGACY_DEFAULT_ADMIN_PASSWORD).digest('hex') === storedJapexHash.toLowerCase();
    }

    if (isEmpty || missingJapex || weakCredential || usesLegacyBootstrapCredential) {
        profiles[DEFAULT_ADMIN_USERNAME] = {
            username: 'Japex',
            role: 'admin',
            displayName: japexProfile?.displayName || 'Marco',
            avatar: isSafeMediaUrl(japexProfile?.avatar) ? japexProfile.avatar.trim() : '/assets/japex.webp',
            passwordHash: HAS_VALID_ADMIN_HASH ? ADMIN_PASSWORD_HASH : await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12),
            active: true,
            isRoot: true
        };
        safeWriteJSON(USER_PROFILES_FILE, profiles);
        console.log('[AUTH] user_profiles.json garantido com administrador padrão (japex).');
    }
}

function readLocalUserProfiles() {
    return safeReadJSON(USER_PROFILES_FILE, {});
}

async function getUserAccount(username) {
    const safeUsername = sanitizePlainText(username || 'Admin');
    const lookupKey = String(safeUsername).toLowerCase();

    const profiles = readLocalUserProfiles();
    const localProfile = profiles[lookupKey];
    if (localProfile && localProfile.active !== false) {
        const normalized = sanitizeProfileResponse(localProfile, safeUsername);
        return { ...normalized, passwordHash: localProfile.passwordHash || '' };
    }

    if (isMongoConnected) {
        try {
            const profile = await UserProfileModel.findOne({ username: new RegExp(`^${escapeRegExp(safeUsername)}$`, 'i') })
                .lean();
            if (profile && profile.active !== false) {
                const normalized = sanitizeProfileResponse(profile, safeUsername);
                return { ...normalized, passwordHash: profile.passwordHash || '' };
            }
        } catch (error) {
            console.error('[AUTH CREDENTIAL MONGO]', error.message);
        }
    }

    if (lookupKey === DEFAULT_ADMIN_USERNAME) {
        return {
            id: DEFAULT_ADMIN_USERNAME,
            username: 'Japex',
            displayName: 'Japex',
            role: 'admin',
            active: true,
            isRoot: true,
            passwordHash: ''
        };
    }
    if (lookupKey === 'admin') {
        return {
            id: 'admin',
            username: 'admin',
            displayName: 'Administrador ALDEIA',
            role: 'admin',
            active: true,
            isRoot: false,
            passwordHash: HAS_VALID_ADMIN_HASH ? ADMIN_PASSWORD_HASH : ''
        };
    }
    return null;
}

async function verifyAccountPassword(password, account) {
    let storedHash = String(account.passwordHash || '').trim();
    const isRootAdmin = account.isRoot || String(account.username).toLowerCase() === DEFAULT_ADMIN_USERNAME;

    if (isRootAdmin && HAS_VALID_ADMIN_HASH) storedHash = ADMIN_PASSWORD_HASH;
    if (!storedHash && isRootAdmin) {
        if (HAS_VALID_ADMIN_HASH) storedHash = ADMIN_PASSWORD_HASH;
        else return password === DEFAULT_ADMIN_PASSWORD;
    }
    if (!storedHash) return false;

    if (/^\$2[aby]\$/.test(storedHash)) {
        return bcrypt.compare(password, storedHash);
    }
    if (/^[a-f0-9]{64}$/i.test(storedHash)) {
        const providedHash = crypto.createHash('sha256').update(password || '').digest('hex');
        try {
            return crypto.timingSafeEqual(Buffer.from(providedHash, 'hex'), Buffer.from(storedHash, 'hex'));
        } catch (_) {
            return false;
        }
    }

    const provided = Buffer.from(String(password || ''));
    const expected = Buffer.from(storedHash);
    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(provided, expected);
}

async function authenticateUser(username, password) {
    const account = await getUserAccount(username);
    if (!account || account.active === false) return null;
    const valid = await verifyAccountPassword(password, account);
    return valid ? account : null;
}

function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const parts = token.split('.');
        if (parts.length !== 3 || !SESSION_SIGNING_SECRET || !validTokens.has(token)) return null;
        const expected = signJwtParts(parts[0], parts[1]);
        const suppliedBuffer = Buffer.from(parts[2]);
        const expectedBuffer = Buffer.from(expected);
        if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
        try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            const data = validTokens.get(token);
            if (payload.exp > Math.floor(Date.now() / 1000) && Date.now() - data.timestamp < TOKEN_TTL &&
                payload.sub === data.username && payload.id === data.id && payload.role === data.role) {
                return data;
            }
        } catch (_) {}
        validTokens.delete(token);
    }
    return null;
}

function requireAuth(req, res, next) {
    const userData = verifyToken(req);
    if (!userData) {
        return res.status(401).json({ status: 'error', message: 'Autenticação necessária.' });
    }
    req.user = userData;
    next();
}

function requireRole(allowedRoles) {
    const allowed = new Set(Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]);
    return (req, res, next) => {
        if (!req.user || !allowed.has(req.user.role)) {
            return res.status(403).json({ status: 'error', message: 'Forbidden - Acesso negado.' });
        }
        next();
    };
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
app.post('/api/auth/login', loginLimiter, validate(loginSchema), async (req, res) => {
    const { username, password } = req.validatedBody;
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';

    const cleanUser = String(username || DEFAULT_ADMIN_USERNAME).trim().toLowerCase();
    const profiles = readLocalUserProfiles();
    let account = null;

    const localProfile = profiles[cleanUser];
    if (localProfile && localProfile.active !== false) {
        const candidate = {
            ...sanitizeProfileResponse(localProfile, localProfile.username || cleanUser),
            passwordHash: localProfile.passwordHash || ''
        };
        if (await verifyAccountPassword(password, candidate)) account = candidate;
    }

    if (!account) account = await authenticateUser(cleanUser, password);

    if (!account) {
        await logLoginAttempt(clientIP, 'Falha (Senha)', ua, cleanUser || 'Desconhecido');
        return res.status(401).json({ status: 'error', message: 'Credenciais inválidas.' });
    }

    const loggedUsername = account.username;
    const newToken = createAdminToken(account);
    if (!newToken) {
        await logLoginAttempt(clientIP, 'Falha (Token)', ua, loggedUsername);
        return res.status(503).json({ status: 'error', message: 'Autenticação indisponível.' });
    }
    await logLoginAttempt(clientIP, 'Sucesso', ua, loggedUsername);
    return res.status(200).json({
        status: 'success',
        token: newToken,
        user: sanitizeProfileResponse(account, loggedUsername),
        username: loggedUsername,
        role: account.role
    });
});

app.get('/api/auth/verify', (req, res) => {
    const userData = verifyToken(req);
    if (userData) {
        return res.json({ status: 'success', user: userData, username: userData.username, role: userData.role });
    }
    return res.status(401).json({ status: 'error', message: 'Token inválido' });
});

async function listActiveAdminUsers() {
    const merged = new Map();
    if (isMongoConnected) {
        try {
            const mongoUsers = await UserProfileModel.find({ active: { $ne: false } }).sort({ createdAt: 1 }).lean();
            mongoUsers.forEach(user => {
                const safe = sanitizeProfileResponse(user, user.username);
                if (isSupportedPasswordHash(user.passwordHash) || safe.isRoot || safe.username.toLowerCase() === 'admin') {
                    merged.set(safe.username.toLowerCase(), safe);
                }
            });
        } catch (error) { console.error('[ADMIN USERS LIST MONGO]', error.message); }
    }
    const localUsers = safeReadJSON('user_profiles.json', {});
    Object.values(localUsers).forEach(user => {
        const safe = sanitizeProfileResponse(user, user?.username || 'Admin');
        if (safe.active && (isSupportedPasswordHash(user?.passwordHash) || safe.isRoot || safe.username.toLowerCase() === 'admin')) {
            merged.set(safe.username.toLowerCase(), safe);
        }
    });
    if (!merged.has('japex')) {
        merged.set('japex', sanitizeProfileResponse({ username: 'Japex', displayName: 'Japex', role: 'admin', active: true, isRoot: true }, 'Japex'));
    }
    return [...merged.values()];
}

app.get('/api/admin/users', requireAuth, requireRole(['admin']), async (req, res) => {
    return res.json(await listActiveAdminUsers());
});

app.post('/api/admin/users', requireAuth, requireRole(['admin']), validate(createAdminUserSchema), async (req, res) => {
    const { displayName, username, initialPassword, role } = req.validatedBody;
    const existing = await getUserAccount(username);
    if (existing) return res.status(409).json({ status: 'error', message: 'Este login já está em uso.' });
    try {
        const passwordHash = await bcrypt.hash(initialPassword, 12);
        const createdAt = new Date().toISOString();
        const userRecord = { username, displayName, role, passwordHash, active: true, isRoot: false, createdAt };
        let mongoSaved = false;
        if (isMongoConnected) {
            await UserProfileModel.create(userRecord);
            mongoSaved = true;
        }
        const profiles = safeReadJSON('user_profiles.json', {});
        profiles[username] = userRecord;
        const localSaved = safeWriteJSON('user_profiles.json', profiles);
        if (!mongoSaved && !localSaved) throw new Error('user persistence failed');
        return res.status(201).json({ status: 'success', user: sanitizeProfileResponse(userRecord, username) });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ status: 'error', message: 'Este login já está em uso.' });
        console.error('[ADMIN USER CREATE]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível criar o usuário.' });
    }
});

app.patch('/api/admin/users/:username/role', requireAuth, requireRole(['admin']), validate(adminUsernameParamsSchema, 'params'), validate(updateAdminUserRoleSchema), async (req, res) => {
    const username = req.validatedParams.username;
    const nextRole = req.validatedBody.role;
    if (username === String(req.user.username).toLowerCase() && nextRole !== 'admin') {
        return res.status(400).json({ status: 'error', message: 'Você não pode remover o próprio acesso administrativo.' });
    }
    const account = await getUserAccount(username);
    if (!account) return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
    if (account.isRoot && nextRole !== 'admin') return res.status(400).json({ status: 'error', message: 'O administrador raiz não pode ser rebaixado.' });
    try {
        if (isMongoConnected) await UserProfileModel.updateOne({ username: new RegExp(`^${escapeRegExp(username)}$`, 'i') }, { $set: { role: nextRole } });
        const profiles = safeReadJSON('user_profiles.json', {});
        const key = Object.keys(profiles).find(item => item.toLowerCase() === username) || username;
        profiles[key] = { ...(profiles[key] || account), username: account.username, role: nextRole };
        safeWriteJSON('user_profiles.json', profiles);
        invalidateUserSessions(account.username);
        return res.json({ status: 'success', user: sanitizeProfileResponse({ ...account, role: nextRole }, account.username) });
    } catch (error) {
        console.error('[ADMIN USER ROLE]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível alterar o cargo.' });
    }
});

app.delete('/api/admin/users/:username', requireAuth, requireRole(['admin']), validate(adminUsernameParamsSchema, 'params'), async (req, res) => {
    const username = req.validatedParams.username;
    if (username === String(req.user.username).toLowerCase()) return res.status(400).json({ status: 'error', message: 'Você não pode revogar o próprio acesso.' });
    const account = await getUserAccount(username);
    if (!account) return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
    if (account.isRoot) return res.status(400).json({ status: 'error', message: 'O administrador raiz não pode ser excluído.' });
    try {
        if (isMongoConnected) await UserProfileModel.deleteOne({ username: new RegExp(`^${escapeRegExp(username)}$`, 'i') });
        const profiles = safeReadJSON('user_profiles.json', {});
        const key = Object.keys(profiles).find(item => item.toLowerCase() === username);
        if (key) delete profiles[key];
        safeWriteJSON('user_profiles.json', profiles);
        invalidateUserSessions(account.username);
        return res.json({ status: 'success', message: 'Acesso revogado.' });
    } catch (error) {
        console.error('[ADMIN USER DELETE]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível revogar o acesso.' });
    }
});

app.get('/api/auth/logins', requireAuth, requireRole(['admin']), async (req, res) => {
    if (isMongoConnected) {
        try {
            const logs = await AuditLogModel.find().sort({ createdAt: -1 }).limit(200).lean();
            return res.json(logs.map(sanitizeAuditResponse));
        } catch (e) {
            console.error('[AUTH LOGINS MONGO]', e.message);
        }
    }
    const logs = safeReadJSON('login_audit.json', []);
    res.json(logs.map(sanitizeAuditResponse));
});

// ===== ROTAS DE RESET (DANGER ZONE) =====
app.delete('/api/reset', requireAuth, requireRole(['admin']), validate(z.object({ confirmation: z.literal('Aldeia') }).strict()), async (req, res) => {
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
                return res.json(sanitizeCmsContent(doc.content));
            }
        } catch (e) {
            console.error('[CONTENT GET MONGO]', e.message);
        }
    }
    const content = safeReadJSON('site_content.json', {});
    res.json(sanitizeCmsContent(content));
});

app.post('/api/content', requireAuth, requireRole(['admin']), validate(cmsContentSchema), async (req, res) => {
    const contentData = req.validatedBody;
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
function createVisitorFingerprint(req) {
    const ip = sanitizePlainText(req.ip || req.socket?.remoteAddress || 'unknown');
    const userAgent = sanitizePlainText(req.get('user-agent') || 'unknown');
    return crypto.createHmac('sha256', VIEW_FINGERPRINT_SECRET || 'aldeia-view-window-v1')
        .update(`${ip}|${userAgent}`)
        .digest('hex');
}

function recordLocalProjectView(projectId, visitorHash, viewedAt, persistEvent = true) {
    const nowMs = viewedAt.getTime();
    const windows = safeReadJSON('project_view_windows.json', {});
    const windowKey = `${projectId}:${visitorHash}`;
    if (Number(windows[windowKey] || 0) > nowMs) return false;

    const expiresAt = nowMs + 24 * 60 * 60 * 1000;
    Object.keys(windows).forEach(key => {
        if (Number(windows[key] || 0) <= nowMs) delete windows[key];
    });
    windows[windowKey] = expiresAt;
    safeWriteJSON('project_view_windows.json', windows);

    if (persistEvent) {
        const cutoff = nowMs - 90 * 24 * 60 * 60 * 1000;
        const events = safeReadJSON('project_view_events.json', [])
            .filter(event => Number.isFinite(new Date(event.viewedAt).getTime()) && new Date(event.viewedAt).getTime() >= cutoff)
            .slice(-9999);
        events.push({ projectId, visitorHash, viewedAt: viewedAt.toISOString() });
        safeWriteJSON('project_view_events.json', events);

        const projects = safeReadJSON('portfolio.json', []);
        const projectIndex = projects.findIndex(project => project.id === projectId);
        if (projectIndex >= 0) {
            projects[projectIndex].views = Math.max(0, Number(projects[projectIndex].views || 0)) + 1;
            safeWriteJSON('portfolio.json', projects);
        }
    }
    return true;
}

async function recordUniqueProjectView(projectId, req) {
    const visitorHash = createVisitorFingerprint(req);
    const viewedAt = new Date();
    let acceptedByMongo = false;
    let mongoUnavailable = !isMongoConnected;

    if (isMongoConnected) {
        try {
            const expiresAt = new Date(viewedAt.getTime() + 24 * 60 * 60 * 1000);
            await ProjectViewWindowModel.findOneAndUpdate(
                {
                    projectId,
                    visitorHash,
                    $or: [{ expiresAt: { $lte: viewedAt } }, { expiresAt: { $exists: false } }]
                },
                { $set: { expiresAt } },
                { upsert: true, new: true }
            );
            acceptedByMongo = true;
        } catch (error) {
            if (error?.code !== 11000) {
                mongoUnavailable = true;
                console.error('[PROJECT VIEW WINDOW]', error.message);
            }
        }
    }

    const acceptedLocally = recordLocalProjectView(projectId, visitorHash, viewedAt, mongoUnavailable || acceptedByMongo);
    const accepted = mongoUnavailable ? acceptedLocally : acceptedByMongo;
    if (!accepted) return false;

    if (isMongoConnected && acceptedByMongo) {
        try {
            await Promise.all([
                ProjectViewEventModel.create({ projectId, visitorHash, viewedAt }),
                ProjectModel.updateOne({ id: projectId }, { $inc: { views: 1 } })
            ]);
        } catch (error) {
            console.error('[PROJECT VIEW EVENT]', error.message);
        }
    }
    return true;
}

app.get('/api/portfolio', async (req, res) => {
    if (isMongoConnected) {
        try {
            const projects = await ProjectModel.find().sort({ createdAt: -1 }).lean();
            return res.json(projects.map(sanitizeProjectResponse));
        } catch (e) {
            console.error('[PORTFOLIO GET MONGO]', e.message);
        }
    }
    const portfolio = safeReadJSON('portfolio.json', []);
    res.json(portfolio.map(sanitizeProjectResponse));
});

app.get('/api/projects/:id', projectViewLimiter, validate(idParamsSchema, 'params'), async (req, res) => {
    const projectId = req.validatedParams.id;
    let project = null;
    if (isMongoConnected) {
        try { project = await ProjectModel.findOne({ id: projectId }).lean(); }
        catch (error) { console.error('[PROJECT DETAIL MONGO]', error.message); }
    }
    if (!project) project = safeReadJSON('portfolio.json', []).find(item => item.id === projectId) || null;
    if (!project) return res.status(404).json({ status: 'error', message: 'Projeto nao encontrado.' });

    await recordUniqueProjectView(projectId, req);
    if (isMongoConnected) {
        try { project = await ProjectModel.findOne({ id: projectId }).lean() || project; } catch (_) {}
    } else {
        project = safeReadJSON('portfolio.json', []).find(item => item.id === projectId) || project;
    }
    return res.json(sanitizeProjectResponse(project));
});

app.post('/api/portfolio', requireAuth, validate(projectPayloadSchema), async (req, res) => {
    const payload = req.validatedBody;
    req.body = payload;
    const format = payload.format || 'post';
    const aspectRatio = payload.aspectRatio || (format === 'story' ? '9:16' : format === 'video' ? '16:9' : '1:1');
    
    const newProject = {
        id: 'p' + Date.now(),
        title: req.body.title || 'Sem Título',
        category: req.body.category || 'artes',
        categoryLabel: req.body.categoryLabel || 'Artes Avulsas',
        format: format,
        aspectRatio: aspectRatio,
        accentColor: payload.accentColor || '#ffffff',
        cover: payload.cover,
        assets: payload.assets,
        member: payload.member || null
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
        res.json({ status: 'success', project: sanitizeProjectResponse(newProject) });
    } else {
        res.status(500).json({ status: 'error', message: 'Erro ao salvar projeto' });
    }
});

app.put('/api/portfolio/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), validate(projectPayloadSchema), async (req, res) => {
    const projId = req.validatedParams.id;
    const payload = req.validatedBody;
    let updatedProj = null;

    if (isMongoConnected) {
        try {
            updatedProj = await ProjectModel.findOneAndUpdate(
                { id: projId },
                { ...payload, id: projId },
                { new: true }
            ).lean();
        } catch (e) {
            console.error('[PORTFOLIO PUT MONGO]', e.message);
        }
    }

    let data = safeReadJSON('portfolio.json', []);
    const index = data.findIndex(p => p.id === projId);
    if (index !== -1) {
        data[index] = { ...data[index], ...payload, id: projId };
        safeWriteJSON('portfolio.json', data);
        if (!updatedProj) updatedProj = data[index];
    }

    if (updatedProj) {
        res.json({ status: 'success', project: sanitizeProjectResponse(updatedProj) });
    } else {
        res.status(404).json({ status: 'error', message: 'Projeto não encontrado' });
    }
});

app.delete('/api/portfolio/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), async (req, res) => {
    const projId = req.validatedParams.id;
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
app.get('/api/clients', requireAuth, requireRole(['admin']), async (req, res) => {
    if (isMongoConnected) {
        try {
            const clients = await ClientModel.find().sort({ createdAt: -1 }).lean();
            return res.json(clients.map(sanitizeClientResponse));
        } catch (e) {
            console.error('[CLIENTS GET MONGO]', e.message);
        }
    }
    const clients = safeReadJSON('clients.json', []);
    res.json(clients.map(sanitizeClientResponse));
});

app.post('/api/clients', requireAuth, requireRole(['admin']), validate(clientPayloadSchema), async (req, res) => {
    const body = req.validatedBody;
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
        if (leadId) {
            if (isMongoConnected) {
                try { await SubmissionModel.deleteOne({ id: leadId }); }
                catch (error) { console.error('[CLIENT CONVERSION LEAD DELETE]', error.message); }
            }
            const submissions = safeReadJSON('submissions.json', []).filter((submission) => submission.id !== leadId);
            safeWriteJSON('submissions.json', submissions);
        }
        resultClients = clients;
    }

    res.json({ status: 'success', clients: resultClients.map(sanitizeClientResponse) });
});

app.put('/api/clients/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), validate(clientUpdateSchema), async (req, res) => {
    const clientId = req.validatedParams.id;
    const payload = req.validatedBody;
    let updatedClient = null;

    if (isMongoConnected) {
        try {
            updatedClient = await ClientModel.findOneAndUpdate(
                { id: clientId },
                { ...payload, id: clientId },
                { new: true }
            ).lean();
        } catch (e) { console.error('[CLIENT PUT MONGO]', e.message); }
    }

    let clients = safeReadJSON('clients.json', []);
    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) {
        clients[index] = { ...clients[index], ...payload, id: clientId };
        safeWriteJSON('clients.json', clients);
        if (!updatedClient) updatedClient = clients[index];
    }

    if (updatedClient) {
        res.json({ status: 'success', client: sanitizeClientResponse(updatedClient) });
    } else {
        res.status(404).json({ status: 'error', message: 'Cliente não encontrado' });
    }
});

app.delete('/api/clients/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), async (req, res) => {
    const clientId = req.validatedParams.id;
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
app.get('/api/trello', requireAuth, requireRole(['admin']), async (req, res) => {
    if (isMongoConnected) {
        try {
            const tasks = await TrelloTaskModel.find().sort({ createdAt: -1 }).lean();
            return res.json(tasks.map(sanitizeTrelloResponse));
        } catch (e) { console.error('[TRELLO GET MONGO]', e.message); }
    }
    const tasks = safeReadJSON('trello_tasks.json', []);
    res.json(tasks.map(sanitizeTrelloResponse));
});

app.post('/api/trello', requireAuth, requireRole(['admin']), validate(trelloPayloadSchema), async (req, res) => {
    req.body = req.validatedBody;
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
    res.json({ status: 'success', task: sanitizeTrelloResponse(newTask) });
});

app.put('/api/trello/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), validate(trelloUpdateSchema), async (req, res) => {
    const taskId = req.validatedParams.id;
    const payload = req.validatedBody;
    let updatedTask = null;

    if (isMongoConnected) {
        try {
            updatedTask = await TrelloTaskModel.findOneAndUpdate(
                { id: taskId },
                { ...payload, id: taskId },
                { new: true }
            ).lean();
        } catch (e) { console.error('[TRELLO PUT MONGO]', e.message); }
    }

    let tasks = safeReadJSON('trello_tasks.json', []);
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        tasks[index] = { ...tasks[index], ...payload, id: taskId };
        safeWriteJSON('trello_tasks.json', tasks);
        if (!updatedTask) updatedTask = tasks[index];
    }

    if (updatedTask) {
        res.json({ status: 'success', task: sanitizeTrelloResponse(updatedTask) });
    } else {
        res.status(404).json({ status: 'error', message: 'Tarefa não encontrada' });
    }
});

app.delete('/api/trello/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), async (req, res) => {
    const taskId = req.validatedParams.id;
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
            const profile = await UserProfileModel.findOne({ username: new RegExp(`^${escapeRegExp(username)}$`, 'i') }).lean();
            if (profile) return res.json(sanitizeProfileResponse(profile, username));
        } catch (e) { console.error('[PROFILE GET MONGO]', e.message); }
    }
    const profiles = safeReadJSON('user_profiles.json', {});
    const prof = profiles[username.toLowerCase()] || {
        username: username,
        displayName: username,
        avatar: '/assets/japex.webp',
        role: normalizeAccountRole('', username)
    };
    res.json(sanitizeProfileResponse(prof, username));
});

app.put('/api/profile', requireAuth, validate(profilePayloadSchema), async (req, res) => {
    const username = (req.user && req.user.username) ? req.user.username : 'Admin';
    const { displayName, avatar } = req.validatedBody;

    const updateFields = {};
    if (displayName) updateFields.displayName = displayName;
    if (avatar) updateFields.avatar = avatar;

    if (isMongoConnected) {
        try {
            await UserProfileModel.findOneAndUpdate(
                { username: new RegExp(`^${escapeRegExp(username)}$`, 'i') },
                { username: username, ...updateFields },
                { upsert: true, new: true }
            );
        } catch (e) { console.error('[PROFILE PUT MONGO]', e.message); }
    }

    let profiles = safeReadJSON('user_profiles.json', {});
    const key = username.toLowerCase();
    profiles[key] = {
        ...(profiles[key] || { username, role: normalizeAccountRole('', username) }),
        ...updateFields
    };
    safeWriteJSON('user_profiles.json', profiles);

    res.json({ status: 'success', message: 'Perfil atualizado com sucesso', profile: sanitizeProfileResponse(profiles[key], username) });
});

// ===== UPLOADS DE MÍDIA (HYBRID CLOUDINARY + LOCAL FALLBACK) =====
app.put('/api/profile/password', requireAuth, validate(passwordChangeSchema), async (req, res) => {
    try {
        const username = req.user?.username || 'Admin';
        const { currentPassword, newPassword } = req.validatedBody;
        const account = await authenticateUser(username, currentPassword);
        if (!account) {
            return res.status(401).json({ status: 'error', message: 'Senha atual incorreta.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        if (isMongoConnected) {
            await UserProfileModel.findOneAndUpdate(
                { username: new RegExp(`^${escapeRegExp(username)}$`, 'i') },
                { $set: { username, passwordHash } },
                { upsert: true, new: true }
            );
        }

        const profiles = safeReadJSON('user_profiles.json', {});
        const key = username.toLowerCase();
        profiles[key] = { ...(profiles[key] || { username, role: normalizeAccountRole('', username) }), passwordHash };
        if (!safeWriteJSON('user_profiles.json', profiles)) throw new Error('profile persistence failed');

        invalidateUserSessions(username);
        const token = createAdminToken({ ...account, passwordHash });
        return res.json({ status: 'success', message: 'Senha atualizada. Outras sessoes foram encerradas.', token, username });
    } catch (error) {
        console.error('[PROFILE PASSWORD]', error.message);
        return res.status(503).json({ status: 'error', message: 'Nao foi possivel atualizar a credencial.' });
    }
});

const UPLOADS_DIR = path.join(ROOT_DIR, 'assets', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (_) {}
}

async function saveLocalUpload(file) {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `media_${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
    await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
    return `/assets/uploads/${filename}`;
}

function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder: 'aldeia_uploads',
            resource_type: 'auto',
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov']
        }, (error, result) => error ? reject(error) : resolve(result));
        stream.end(file.buffer);
    });
}

app.post('/api/upload', requireAuth, (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ status: 'error', message: 'Arquivo inválido ou maior que o limite permitido.' });
        }
        if (!req.file?.buffer) {
            return res.status(400).json({ status: 'error', message: 'Nenhum arquivo enviado.' });
        }

        try {
            const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
            const url = isCloudinaryConfigured
                ? (await uploadToCloudinary(req.file)).secure_url
                : await saveLocalUpload(req.file);
            return res.json({ status: 'success', url });
        } catch (uploadError) {
            console.error('[UPLOAD]', uploadError?.message || 'Falha desconhecida');
            try {
                const url = await saveLocalUpload(req.file);
                return res.json({ status: 'success', url, storage: 'local' });
            } catch (localError) {
                console.error('[UPLOAD FALLBACK]', localError?.message || 'Falha desconhecida');
                return res.status(503).json({ status: 'error', message: 'Não foi possível concluir o upload. Tente novamente.' });
            }
        }
    });
});

// ===== ROTAS DE LEADS / FORMULÁRIO DE CONTATO =====
app.post('/api/cadastro', async (req, res) => {
    const body = scrubNoSql(req.body || {});
    let projeto = body.projeto || '';
    if (!projeto) {
        const parts = [];
        if (body.service_type) parts.push(body.service_type);
        if (body.project_details) parts.push(body.project_details);
        projeto = parts.join(' - ');
    }
    const leadResult = leadPayloadSchema.safeParse({
        nome: body.nome || body.name || body.client_name || '',
        email: body.email || body.mail || '',
        telefone: body.telefone || body.phone || body.tel || body.celular || '',
        instagram: body.instagram || body.insta || '',
        projeto,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
        visits: body.visits,
        firstVisit: body.firstVisit,
        locationConsent: body.locationConsent,
        location: body.location
    });
    if (!leadResult.success) {
        return res.status(400).json({ status: 'error', message: 'Dados de contato inválidos.' });
    }
    const { nome, email, telefone, instagram, projeto: projetoSeguro, utmSource, utmMedium, utmCampaign, visits, firstVisit, locationConsent, location } = leadResult.data;
    const locationCoords = locationConsent && location
        ? `${Number(location.latitude).toFixed(2)}, ${Number(location.longitude).toFixed(2)}`
        : '';

    const newSubmission = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        nome: nome || '',
        email: email || '',
        telefone: telefone || '',
        instagram: instagram || '',
        projeto: projetoSeguro,
        whatsappClicked: "Não",
        utmSource: utmSource || 'Direto',
        utmMedium: utmMedium || '',
        utmCampaign: utmCampaign || '',
        visits: visits || 1,
        firstVisit: firstVisit || '',
        ipCountry: '',
        ipRegion: '',
        ipCity: '',
        ipISP: '',
        ipCoords: '',
        locationConsent,
        locationCoords
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

app.post('/api/cadastro/click-link', validate(z.object({ id: z.string().trim().regex(SAFE_ID) }).strict()), async (req, res) => {
    const { id } = req.validatedBody;
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
function parseAnalyticsBeacon(req, res, next) {
    if (typeof req.body !== 'string') return next();
    try {
        req.body = JSON.parse(req.body);
        return next();
    } catch {
        return res.status(400).json({ status: 'error', message: 'Eventos inválidos.' });
    }
}

const analyticsDeduplication = new Map();
function pruneAnalyticsDeduplication(now = Date.now()) {
    const cutoff = now - 5000;
    for (const [key, createdAt] of analyticsDeduplication) {
        if (createdAt < cutoff) analyticsDeduplication.delete(key);
    }
}
function removeDuplicateAnalyticsEvents(req, res, next) {
    const now = Date.now();
    pruneAnalyticsDeduplication(now);

    const accepted = req.validatedBody.events.filter((event) => {
        const key = `${event.sessionId}|${event.eventType}|${event.path}|${event.elementId}`;
        if (analyticsDeduplication.has(key)) return false;
        analyticsDeduplication.set(key, now);
        return true;
    });

    if (accepted.length === 0) return res.status(202).json({ status: 'duplicate_ignored' });
    req.validatedBody.events = accepted;
    return next();
}

async function persistAnalyticsEvents(events) {
    const normalizedEvents = events.map((event) => ({ ...event, timestamp: new Date().toISOString() }));
    if (isMongoConnected) {
        await AnalyticsModel.insertMany(normalizedEvents);
        return { storage: 'mongo', events: normalizedEvents };
    }
    const storedEvents = safeReadJSON('analytics.json', []);
    safeWriteJSON('analytics.json', [...normalizedEvents, ...storedEvents].slice(0, 1000));
    return { storage: 'local', events: normalizedEvents };
}

async function readAnalyticsEvents() {
    if (isMongoConnected) {
        try {
            return await AnalyticsModel.find().sort({ timestamp: -1 }).limit(1000).lean();
        } catch (error) {
            console.error('[ANALYTICS GET MONGO]', error.message);
        }
    }
    return safeReadJSON('analytics.json', []).slice(0, 1000);
}

app.post('/api/analytics', analyticsEventLimiter, parseAnalyticsBeacon, validate(analyticsPayloadSchema), removeDuplicateAnalyticsEvents, async (req, res) => {
    try {
        const result = await persistAnalyticsEvents(req.validatedBody.events);
        return res.json({ status: 'success', storage: result.storage, accepted: result.events.length });
    } catch (error) {
        console.error('[ANALYTICS POST]', error.message);
        return res.status(500).json({ status: 'error' });
    }
    // Fallback local: mantém um histórico limitado para o Analytics continuar útil sem MongoDB.
});

app.get('/api/analytics', requireAuth, requireRole(['admin']), async (req, res) => {
    return res.json(await readAnalyticsEvents());
});

app.get('/api/analytics/dashboard', requireAuth, requireRole(['admin']), async (req, res) => {
    const events = await readAnalyticsEvents();
    const pageviews = events.filter((event) => event?.eventType === 'pageview').length;
    const clicks = events.filter((event) => event?.eventType === 'click').length;
    const sessions = new Set(events.map((event) => event?.sessionId).filter(Boolean)).size;
    return res.json({
        metrics: { totalEvents: events.length, pageviews, clicks, sessions },
        events: events.slice(0, 100)
    });
});

app.post('/api/telemetry', analyticsEventLimiter, parseAnalyticsBeacon, validate(telemetryPayloadSchema), async (req, res) => {
    const telemetry = req.validatedBody;
    const event = {
        sessionId: telemetry.session_id,
        eventType: telemetry.event_type,
        path: telemetry.page_url,
        elementId: telemetry.converted ? 'converted' : 'abandoned',
        x: 0,
        y: 0
    };
    pruneAnalyticsDeduplication();
    const key = `${event.sessionId}|${event.eventType}|${event.path}|${event.elementId}`;
    if (analyticsDeduplication.has(key)) return res.status(202).json({ status: 'duplicate_ignored' });
    analyticsDeduplication.set(key, Date.now());
    try {
        const result = await persistAnalyticsEvents([event]);
        return res.json({ status: 'success', storage: result.storage });
    } catch (error) {
        console.error('[TELEMETRY POST]', error.message);
        return res.status(500).json({ status: 'error' });
    }
});

function serializeLeadsForRole(leads, role) {
    return leads.map((lead) => {
        const safeLead = sanitizeLeadResponse(lead);
        if (role !== 'admin') {
            safeLead.locationConsent = false;
            safeLead.locationCoords = '';
        }
        return safeLead;
    });
}

app.get('/api/submissions', requireAuth, async (req, res) => {
    if (isMongoConnected) {
        try {
            const subs = await SubmissionModel.find().sort({ createdAt: -1 }).lean();
            return res.json(serializeLeadsForRole(subs, req.user.role));
        } catch (e) { console.error('[SUBMISSIONS GET MONGO]', e.message); }
    }
    const submissions = safeReadJSON('submissions.json', []);
    res.json(serializeLeadsForRole(submissions, req.user.role));
});

// ===== EXPORTAÇÕES (SQL & CSV) =====
function buildSevenDaySeries(events) {
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000);
        return date.toISOString().slice(0, 10);
    });
    const counts = new Map(days.map(day => [day, 0]));
    events.forEach(event => {
        const eventDate = new Date(event?.viewedAt);
        if (!Number.isFinite(eventDate.getTime())) return;
        const day = eventDate.toISOString().slice(0, 10);
        if (counts.has(day)) counts.set(day, counts.get(day) + 1);
    });
    return days.map(day => ({ date: day, count: counts.get(day) || 0 }));
}

app.get('/api/admin/project-views/metrics', requireAuth, async (req, res) => {
    const now = Date.now();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    let projects = [];
    let events = [];
    if (isMongoConnected) {
        try {
            [projects, events] = await Promise.all([
                ProjectModel.find().select({ id: 1, title: 1, cover: 1, category: 1, views: 1 }).lean(),
                ProjectViewEventModel.find({ viewedAt: { $gte: ninetyDaysAgo } }).select({ projectId: 1, visitorHash: 1, viewedAt: 1 }).lean()
            ]);
        } catch (error) {
            console.error('[ADMIN VIEW METRICS]', error.message);
        }
    }
    if (projects.length === 0) projects = safeReadJSON('portfolio.json', []);
    if (events.length === 0) events = safeReadJSON('project_view_events.json', []);

    const last24Hours = now - 24 * 60 * 60 * 1000;
    const unique24h = new Set(events
        .filter(event => new Date(event.viewedAt).getTime() >= last24Hours)
        .map(event => `${event.projectId}:${event.visitorHash}`)).size;
    const topProjects = projects
        .map(sanitizeProjectResponse)
        .sort((left, right) => right.views - left.views)
        .slice(0, 6)
        .map(project => ({ id: project.id, title: project.title, cover: project.cover, category: project.category, views: project.views }));

    return res.json({
        unique24h,
        totalViews: projects.reduce((total, project) => total + Math.max(0, Number(project.views || 0)), 0),
        series7d: buildSevenDaySeries(events).map(point => ({ date: point.date, value: point.count })),
        topProjects
    });
});

async function readAdminSettings() {
    if (isMongoConnected) {
        try {
            const settings = await AdminSettingsModel.findOne({ key: 'main' }).lean();
            if (settings) return { externalAnalytics: settings.externalAnalytics !== false };
        } catch (error) { console.error('[ADMIN SETTINGS GET]', error.message); }
    }
    const settings = safeReadJSON('admin_settings.json', { externalAnalytics: true });
    return { externalAnalytics: settings.externalAnalytics !== false };
}

app.get('/api/admin/settings', requireAuth, requireRole(['admin']), async (req, res) => {
    return res.json(await readAdminSettings());
});

app.put('/api/admin/settings', requireAuth, requireRole(['admin']), validate(adminSettingsPayloadSchema), async (req, res) => {
    const settings = { externalAnalytics: req.validatedBody.externalAnalytics };
    if (isMongoConnected) {
        try {
            await AdminSettingsModel.findOneAndUpdate(
                { key: 'main' },
                { $set: { ...settings, updatedBy: req.user.username } },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('[ADMIN SETTINGS PUT]', error.message);
            return res.status(503).json({ status: 'error', message: 'Configuracoes indisponiveis.' });
        }
    }
    safeWriteJSON('admin_settings.json', settings);
    return res.json({ status: 'success', settings });
});

app.post('/api/admin/maintenance', requireAuth, requireRole(['admin']), validate(maintenanceActionSchema), async (req, res) => {
    const { action, confirmation } = req.validatedBody;
    if (action === 'clear_telemetry' && confirmation !== 'Aldeia') {
        return res.status(400).json({ status: 'error', message: 'Confirmacao obrigatoria.' });
    }

    try {
        if (action === 'clear_api_cache') {
            memoryCache.clear();
            return res.json({ status: 'success', message: 'Cache da API limpo.' });
        }
        if (action === 'sync_cloudinary') {
            const configured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
            if (!configured) return res.status(503).json({ status: 'error', message: 'Cloudinary nao configurado.' });
            await cloudinary.api.ping();
            return res.json({ status: 'success', message: 'Cloudinary sincronizado.' });
        }
        if (action === 'optimize_indexes') {
            if (!isMongoConnected) return res.status(503).json({ status: 'error', message: 'MongoDB indisponivel.' });
            await Promise.all([
                ProjectModel, ClientModel, SubmissionModel, AnalyticsModel, SiteContentModel,
                AuditLogModel, TrelloTaskModel, UserProfileModel, ProjectViewWindowModel,
                ProjectViewEventModel, AdminSettingsModel
            ].map(model => model.createIndexes()));
            return res.json({ status: 'success', message: 'Indices do MongoDB verificados.' });
        }
        if (action === 'clear_telemetry') {
            if (isMongoConnected) await Promise.all([AnalyticsModel.deleteMany({}), ProjectViewEventModel.deleteMany({}), ProjectViewWindowModel.deleteMany({})]);
            safeWriteJSON('visits.json', []);
            safeWriteJSON('project_view_events.json', []);
            safeWriteJSON('project_view_windows.json', {});
            return res.json({ status: 'success', message: 'Logs de telemetria limpos.' });
        }
        return res.status(400).json({ status: 'error', message: 'Acao invalida.' });
    } catch (error) {
        console.error('[ADMIN MAINTENANCE]', error.message);
        return res.status(503).json({ status: 'error', message: 'Operacao administrativa indisponivel.' });
    }
});

app.delete('/api/admin/data', requireAuth, requireRole(['admin']), validate(adminPurgeSchema), async (req, res) => {
    const scopes = new Set(req.validatedBody.scopes);
    const mongoActions = [];
    if (scopes.has('analytics')) mongoActions.push(AnalyticsModel.deleteMany({}));
    if (scopes.has('audit')) mongoActions.push(AuditLogModel.deleteMany({}));
    if (scopes.has('submissions')) mongoActions.push(SubmissionModel.deleteMany({}));
    if (scopes.has('clients')) mongoActions.push(ClientModel.deleteMany({}));
    if (scopes.has('tasks')) mongoActions.push(TrelloTaskModel.deleteMany({}));
    if (scopes.has('views')) mongoActions.push(ProjectViewEventModel.deleteMany({}), ProjectViewWindowModel.deleteMany({}));
    try {
        if (isMongoConnected) await Promise.all(mongoActions);
        if (scopes.has('analytics')) safeWriteJSON('visits.json', []);
        if (scopes.has('audit')) safeWriteJSON('login_audit.json', []);
        if (scopes.has('submissions')) safeWriteJSON('submissions.json', []);
        if (scopes.has('clients')) safeWriteJSON('clients.json', []);
        if (scopes.has('tasks')) safeWriteJSON('trello_tasks.json', []);
        if (scopes.has('views')) {
            safeWriteJSON('project_view_events.json', []);
            safeWriteJSON('project_view_windows.json', {});
        }
        return res.json({ status: 'success', removedScopes: [...scopes] });
    } catch (error) {
        console.error('[ADMIN DATA PURGE]', error.message);
        return res.status(503).json({ status: 'error', message: 'Nao foi possivel excluir os dados.' });
    }
});

app.get('/api/admin/export/backup', requireAuth, requireRole(['admin']), async (req, res) => {
    const profiles = safeReadJSON('user_profiles.json', {});
    const safeProfiles = Object.fromEntries(Object.entries(profiles).map(([key, profile]) => [key, sanitizeProfileResponse(profile, key)]));
    const backup = {
        generatedAt: new Date().toISOString(),
        content: sanitizeCmsContent(safeReadJSON('site_content.json', {})),
        portfolio: safeReadJSON('portfolio.json', []).map(sanitizeProjectResponse),
        submissions: safeReadJSON('submissions.json', []).map(sanitizeLeadResponse),
        clients: safeReadJSON('clients.json', []).map(sanitizeClientResponse),
        tasks: safeReadJSON('trello_tasks.json', []).map(sanitizeTrelloResponse),
        profiles: safeProfiles,
        settings: await readAdminSettings()
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=aldeia-backup-${new Date().toISOString().slice(0, 10)}.json`);
    return res.send(JSON.stringify(backup, null, 2));
});

app.get('/api/admin/export/sql', requireAuth, requireRole(['admin']), async (req, res) => {
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

app.get('/api/admin/export/csv', requireAuth, requireRole(['admin']), async (req, res) => {
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
        today: todayCount,
        week: weekCount,
        total: totalCount
    });
});

app.get('/api/security/stats', requireAuth, requireRole(['admin']), (req, res) => {
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

app.get(['/admin/dashboard', '/admin/orcamentos', '/admin/portfolio', '/admin/configuracoes', '/admin/seguranca', '/admin/editor'], (req, res) => {
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
    console.error('[SERVER ERROR]', err?.message || 'Erro desconhecido');
    if (res.headersSent) return next(err);
    const status = err instanceof multer.MulterError || err?.message === 'Origem não permitida.' ? 400 : 500;
    res.status(status).json({ status: 'error', message: status === 400 ? 'Requisição inválida.' : 'Erro interno no servidor.' });
});

// ===== INICIAR SERVIDOR =====
let server;
bootstrapUserProfiles()
    .catch(err => console.error('[AUTH] Falha no bootstrap de user_profiles.json:', err.message))
    .finally(() => {
        server = app.listen(PORT, () => {
            console.log(`\n======================================================`);
            console.log(`  ALDEIA Servidor Backend Unificado (Node.js + Express)`);
            console.log(`  Porta: ${PORT}`);
            console.log(`  Banco de Dados: MongoDB Atlas (Nuvem) + Fallback JSON`);
            console.log(`  Uploads: Cloudinary`);
            console.log(`======================================================\n`);
        });
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
