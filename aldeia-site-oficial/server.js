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
const { GoogleGenerativeAI } = require('@google/generative-ai');
const whatsappService = require('./whatsappService');
require('dotenv').config();

let genAIModel = null;
if (process.env.GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        genAIModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    } catch (error) {
        console.error('[GEMINI INIT]', error?.message || 'Falha ao iniciar o modelo.');
    }
}

async function generateAIContent(systemPrompt, userPrompt) {
    if (!genAIModel) throw new Error('Gemini não configurado.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
        const result = await genAIModel.generateContent(`${systemPrompt}\n\n${userPrompt}`, { signal: controller.signal });
        return String(result?.response?.text?.() || '').trim();
    } finally {
        clearTimeout(timeout);
    }
}

// Falhas fora do fluxo HTTP são fatais; o orquestrador deve reiniciar uma instância limpa.
process.on('unhandledRejection', (reason) => {
    console.error('[SecOps] Unhandled Rejection:', reason);
    setImmediate(() => process.exit(1));
});
process.on('uncaughtException', (err) => {
    console.error('[SecOps] Uncaught Exception:', err);
    setImmediate(() => process.exit(1));
});


// Configurar DNS do Node.js para IPv4 e resolver fallback (evita ECONNREFUSED em SRV no Windows)
try {
    dns.setDefaultResultOrder('ipv4first');
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {}

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

// Express 4 does not forward rejected async handlers to the error middleware.
// Wrap route handlers at registration time so no request can hang on a rejected promise.
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const register = app[method].bind(app);
    app[method] = function registerProtectedRoute(pathOrSetting, ...handlers) {
        if (handlers.length === 0) return register(pathOrSetting);
        const wrap = (handler) => {
            if (Array.isArray(handler)) return handler.map(wrap);
            if (typeof handler !== 'function' || handler.constructor?.name !== 'AsyncFunction') return handler;
            return function protectedAsyncHandler(req, res, next) {
                Promise.resolve(handler(req, res, next)).catch(next);
            };
        };
        return register(pathOrSetting, ...handlers.map(wrap));
    };
}

// ===== CONFIGURAÇÃO DE SEGURANÇA E ADMIN =====
const IS_PRODUCTION = process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    Boolean(process.env.RAILWAY_ENVIRONMENT);
const DEFAULT_ADMIN_USERNAME = String(process.env.DEFAULT_ADMIN_USERNAME || 'japex').trim().toLowerCase();
const DEFAULT_ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || 'japex123').trim();
const LEGACY_DEFAULT_ADMIN_PASSWORD = '123japex';
const LEGACY_CASE_VARIANT_ADMIN_PASSWORD = 'JAPEX123';
const USER_PROFILES_FILE = 'user_profiles.json';
const DEFAULT_JAPEX_BCRYPT_HASH = '$2b$12$1vizxvwqwugjC44OFeAYzelZNh0f3pInJkovefulj4ABPKMDXj7Yq';
const CONFIGURED_ADMIN_PASSWORD_HASH = String(
    process.env.ADMIN_PASSWORD_HASH_ROTATION || process.env.ADMIN_PASSWORD_HASH || ''
).trim();
const ADMIN_PASSWORD_HASH = CONFIGURED_ADMIN_PASSWORD_HASH || DEFAULT_JAPEX_BCRYPT_HASH;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$(?:0[8-9]|1[0-4])\$[./A-Za-z0-9]{53}$/;
const HAS_BCRYPT_ADMIN_HASH = BCRYPT_HASH_PATTERN.test(ADMIN_PASSWORD_HASH);
const HAS_VALID_ADMIN_HASH = HAS_BCRYPT_ADMIN_HASH || /^[a-f0-9]{64}$/.test(ADMIN_PASSWORD_HASH);
const HAS_CONFIGURED_ADMIN_HASH = Boolean(CONFIGURED_ADMIN_PASSWORD_HASH) && HAS_VALID_ADMIN_HASH;
const SESSION_SIGNING_SECRET = String(process.env.SESSION_SIGNING_SECRET || 'aldeia_crm_secret_key_production_signing_2026_x89a_z77').trim();
const VIEW_FINGERPRINT_SECRET = String(process.env.VIEW_FINGERPRINT_SECRET || SESSION_SIGNING_SECRET).trim();

// Tokens com TTL (24 horas = 86.400.000 ms)
const TOKEN_TTL = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_TOKENS = 10_000;
const MAX_TOKENS_PER_USER = 8;
const validTokens = new Map();
const ipRequests = new Map();  // ip -> array of timestamps
const pendingJsonWrites = new Map();
const pendingJsonMutations = new Map();
const pendingGoogleOAuthStates = new Map();
const recentMeetingShares = new Map();
let analyticsResetAt = 0;
let analyticsResetLoaded = false;
let lastGoogleCalendarSyncAt = '';
let cachedGoogleRefreshToken = '';

// Limpeza periódica de memória (RAM) a cada 30 minutos (Fix: Leak Referencial)
const memoryCleanupTimer = setInterval(() => {
    const now = Date.now();
    pruneValidTokens(now);
    // Cria um novo Map para evitar memory leak referencial
    const newIpRequests = new Map();
    for (const [ip, timestamps] of ipRequests.entries()) {
        const recent = timestamps.filter(t => t > now - 60000);
        if (recent.length > 0) {
            newIpRequests.set(ip, recent);
        }
    }
    ipRequests.clear();
    for (const [k, v] of newIpRequests.entries()) ipRequests.set(k, v);
    pruneGoogleOAuthStates(now);
    for (const [key, expiresAt] of recentMeetingShares.entries()) {
        if (Number(expiresAt) <= now) recentMeetingShares.delete(key);
    }
}, 30 * 60 * 1000);
memoryCleanupTimer.unref?.();

// ===== UTILITÁRIOS SEGUROS DE PERSISTÊNCIA EM FALLBACK JSON =====
const memoryCache = new Map();

function cloneJSON(value) {
    return JSON.parse(JSON.stringify(value));
}

function resolveJSONPath(filename) {
    const filePath = path.resolve(ROOT_DIR, filename);
    if (path.dirname(filePath) !== ROOT_DIR || !filename.endsWith('.json')) {
        throw new Error('Arquivo de persistência inválido.');
    }
    return filePath;
}

function safeReadJSON(filename, defaultVal = []) {
    if (memoryCache.has(filename)) {
        return cloneJSON(memoryCache.get(filename));
    }
    const filePath = resolveJSONPath(filename);
    try {
        if (!fs.existsSync(filePath)) {
            memoryCache.set(filename, cloneJSON(defaultVal));
            return cloneJSON(defaultVal);
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw.trim()) {
            memoryCache.set(filename, cloneJSON(defaultVal));
            return cloneJSON(defaultVal);
        }
        const data = JSON.parse(raw);
        memoryCache.set(filename, cloneJSON(data));
        return cloneJSON(data);
    } catch (err) {
        console.error(`[PERSISTENCE] Erro ao ler ${filename}:`, err.message);
        return defaultVal;
    }
}

function safeWriteJSON(filename, data) {
    const snapshot = cloneJSON(data);

    const previousWrite = pendingJsonWrites.get(filename) || Promise.resolve();
    const writeOperation = previousWrite.catch(() => {}).then(async () => {
        const filePath = resolveJSONPath(filename);
        const tmpPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;

        try {
            await fs.promises.writeFile(tmpPath, JSON.stringify(snapshot, null, 2), { encoding: 'utf8', flag: 'wx' });
            await fs.promises.rename(tmpPath, filePath);
            memoryCache.set(filename, cloneJSON(snapshot));
        } finally {
            await fs.promises.unlink(tmpPath).catch(() => {});
        }
    });

    pendingJsonWrites.set(filename, writeOperation);
    writeOperation.finally(() => {
        if (pendingJsonWrites.get(filename) === writeOperation) {
            pendingJsonWrites.delete(filename);
        }
    }).catch((error) => console.error(`[PERSISTENCE] Erro ao salvar ${filename}:`, error.message));

    return writeOperation;
}

function mutateJSON(filename, defaultValue, mutator) {
    const previousMutation = pendingJsonMutations.get(filename) || Promise.resolve();
    const mutation = previousMutation.catch(() => {}).then(async () => {
        const currentValue = safeReadJSON(filename, defaultValue);
        const nextValue = await mutator(cloneJSON(currentValue));
        const committedValue = nextValue === undefined ? currentValue : nextValue;
        await safeWriteJSON(filename, committedValue);
        return cloneJSON(committedValue);
    });

    pendingJsonMutations.set(filename, mutation);
    mutation.finally(() => {
        if (pendingJsonMutations.get(filename) === mutation) pendingJsonMutations.delete(filename);
    }).catch((error) => console.error(`[PERSISTENCE] Erro ao alterar ${filename}:`, error.message));
    return mutation;
}

function getAnalyticsResetAt() {
    if (!analyticsResetLoaded) {
        const state = safeReadJSON('analytics_state.json', { resetAt: 0 });
        analyticsResetAt = Math.max(0, Number(state?.resetAt) || 0);
        analyticsResetLoaded = true;
    }
    return analyticsResetAt;
}

async function markAnalyticsReset() {
    analyticsResetAt = Date.now();
    analyticsResetLoaded = true;
    analyticsDeduplication.clear();
    await safeWriteJSON('analytics_state.json', { resetAt: analyticsResetAt });
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
    locationCoords: { type: String, default: '' },
    locationString: { type: String, default: 'Localização Indisponível' },
    ipAddress: { type: String, default: '0.0.0.0' }
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
    status: { type: String, default: 'backlog', index: true },
    boardId: { type: String, default: '', index: true },
    assignedTo: { type: String, default: '', index: true },
    priority: { type: String, default: 'média' }, // 'alta', 'média', 'baixa'
    clientName: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    subtasks: { type: [{ id: String, title: String, completed: Boolean }], default: [] },
    assets: { type: [{ url: String, label: String }], default: [] },
    timeSpentSeconds: { type: Number, default: 0 },
    timerStartedAt: { type: String, default: '' }
}, { timestamps: true });

const productionSpaceSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    memberIds: { type: [String], default: [] },
    archived: { type: Boolean, default: false }
}, { timestamps: true });

const productionBoardSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    spaceId: { type: String, default: '', index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    favorite: { type: Boolean, default: false },
    archived: { type: Boolean, default: false }
}, { timestamps: true });

const meetingSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    eventType: { type: String, enum: ['meeting', 'work'], default: 'meeting', index: true },
    clientId: { type: String, default: '', index: true },
    clientName: { type: String, default: '' },
    clientEmail: { type: String, default: '' },
    startAt: { type: String, required: true, index: true },
    endAt: { type: String, required: true },
    attendees: { type: [String], default: [] },
    sendInvite: { type: Boolean, default: true },
    meetLink: { type: String, default: '' },
    googleEventId: { type: String, default: '' },
    source: { type: String, enum: ['aldeia', 'google'], default: 'aldeia', index: true },
    integrationStatus: { type: String, default: 'local' },
    createdBy: { type: String, default: 'Admin' }
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
    sidebarLogo: { type: String, default: '' },
    updatedBy: { type: String, default: 'Admin' }
}, { timestamps: true });

const googleCalendarIntegrationSchema = new mongoose.Schema({
    key: { type: String, default: 'calendar', unique: true },
    refreshToken: { type: mongoose.Schema.Types.Mixed, default: null },
    updatedBy: { type: String, default: 'Admin' }
}, { timestamps: true });

const ProjectModel = mongoose.model('Project', projectSchema);
const ClientModel = mongoose.model('Client', clientSchema);
const SubmissionModel = mongoose.model('Submission', submissionSchema);
const AnalyticsModel = mongoose.model('Analytics', analyticsSchema);
const SiteContentModel = mongoose.model('SiteContent', siteContentSchema);
const AuditLogModel = mongoose.model('AuditLog', auditLogSchema);
const TrelloTaskModel = mongoose.model('TrelloTask', trelloTaskSchema);
const ProductionSpaceModel = mongoose.model('ProductionSpace', productionSpaceSchema);
const ProductionBoardModel = mongoose.model('ProductionBoard', productionBoardSchema);
const MeetingModel = mongoose.model('Meeting', meetingSchema);
const UserProfileModel = mongoose.model('UserProfile', userProfileSchema);
const ProjectViewWindowModel = mongoose.model('ProjectViewWindow', projectViewWindowSchema);
const ProjectViewEventModel = mongoose.model('ProjectViewEvent', projectViewEventSchema);
const AdminSettingsModel = mongoose.model('AdminSettings', adminSettingsSchema);
const GoogleCalendarIntegrationModel = mongoose.model('GoogleCalendarIntegration', googleCalendarIntegrationSchema);

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
    if (depth > 12) return null;
    if (value === null || value === undefined) return value;
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
    if (depth > 12) return null;
    if (value === null || value === undefined) return value;
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
    status: z.enum(['backlog', 'in_progress', 'awaiting_client', 'review', 'done']).optional().default('backlog'),
    boardId: z.string().trim().regex(SAFE_ID).optional().or(z.literal('')),
    assignedTo: plainText(100).optional().default(''),
    priority: z.enum(['alta', 'média', 'baixa']).optional().default('média'),
    clientName: plainText(160).optional().default(''),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    subtasks: z.array(z.object({
        id: z.string().trim().regex(SAFE_ID),
        title: requiredText(180),
        completed: z.boolean().optional().default(false)
    }).strip()).max(30).optional().default([]),
    assets: z.array(z.object({
        url: safeMediaUrl,
        label: plainText(120).optional().default('Referência')
    }).strip()).max(12).optional().default([]),
    timeSpentSeconds: z.number().int().min(0).max(31_536_000).optional().default(0),
    timerStartedAt: z.string().datetime().optional().or(z.literal(''))
}).strip();
const trelloUpdateSchema = trelloPayloadSchema.partial().refine(value => Object.keys(value).length > 0, 'Nenhum campo válido para atualizar');
const productionSpacePayloadSchema = z.object({
    name: requiredText(100),
    description: plainText(500).optional().default(''),
    memberIds: z.array(z.string().trim().regex(SAFE_ID)).max(50).optional().default([])
}).strict();
const productionSpaceUpdateSchema = productionSpacePayloadSchema.partial().extend({ archived: z.boolean().optional() }).refine(value => Object.keys(value).length > 0, 'Nenhum campo válido para atualizar');
const productionBoardPayloadSchema = z.object({
    spaceId: z.string().trim().regex(SAFE_ID).optional().or(z.literal('')),
    name: requiredText(100),
    description: plainText(500).optional().default(''),
    favorite: z.boolean().optional().default(false)
}).strict();
const productionBoardUpdateSchema = productionBoardPayloadSchema.partial().extend({ archived: z.boolean().optional() }).refine(value => Object.keys(value).length > 0, 'Nenhum campo válido para atualizar');
const meetingPayloadSchema = z.object({
    title: requiredText(180),
    description: plainText(4000).optional().default(''),
    eventType: z.enum(['meeting', 'work']).optional().default('meeting'),
    clientId: z.string().trim().regex(SAFE_ID).optional().or(z.literal('')),
    clientName: plainText(160).optional().default(''),
    clientEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    attendees: z.array(z.string().trim().email().max(254)).max(20).optional().default([]),
    sendInvite: z.boolean().optional().default(true)
}).strict().refine(value => new Date(value.endAt) > new Date(value.startAt), 'O término deve ocorrer após o início');
const meetingSharePayloadSchema = z.object({
    recipient: z.enum(['client', 'admin'])
}).strict();
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
    externalAnalytics: z.boolean(),
    sidebarLogo: z.string().trim().max(2048).refine(value => (
        value === '' || value.startsWith('/assets/uploads/') || /^https:\/\//i.test(value)
    ), 'Logo invalida').optional()
}).strict();
const maintenanceActionSchema = z.object({
    action: z.enum(['clear_api_cache', 'sync_cloudinary', 'optimize_indexes', 'clear_telemetry']),
    confirmation: plainText(40).optional().default('')
}).strict();
const adminPurgeSchema = z.object({
    confirmation: z.literal('Aldeia'),
    scopes: z.array(z.enum(['analytics', 'audit', 'submissions', 'clients', 'tasks', 'meetings', 'views'])).min(1).max(7)
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
        timestamp: z.string().datetime({ offset: true })
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
    const subtasks = Array.isArray(value.subtasks) ? value.subtasks.slice(0, 30).map(item => ({
        id: SAFE_ID.test(String(item?.id || '')) ? String(item.id) : `sub_${crypto.randomUUID().slice(0, 8)}`,
        title: sanitizePlainText(item?.title || ''),
        completed: item?.completed === true
    })).filter(item => item.title) : [];
    const assets = Array.isArray(value.assets) ? value.assets.slice(0, 12).filter(item => isSafeMediaUrl(item?.url)).map(item => ({
        url: String(item.url).trim(),
        label: sanitizePlainText(item?.label || 'Referência')
    })) : [];
    return {
        id: SAFE_ID.test(String(value.id || '')) ? String(value.id) : '',
        title: sanitizePlainText(value.title || ''),
        description: sanitizePlainText(value.description || ''),
        status: ['backlog', 'in_progress', 'awaiting_client', 'review', 'done'].includes(value.status) ? value.status : 'backlog',
        boardId: SAFE_ID.test(String(value.boardId || '')) ? String(value.boardId) : '',
        assignedTo: sanitizePlainText(value.assignedTo || ''),
        priority: ['alta', 'média', 'baixa'].includes(value.priority) ? value.priority : 'média',
        clientName: sanitizePlainText(value.clientName || ''),
        dueDate: sanitizePlainText(value.dueDate || ''),
        subtasks,
        assets,
        timeSpentSeconds: Math.max(0, Math.min(31_536_000, Number(value.timeSpentSeconds) || 0)),
        timerStartedAt: sanitizePlainText(value.timerStartedAt || '')
    };
}

function sanitizeMeetingResponse(meeting) {
    const value = scrubNoSql(meeting || {});
    return {
        id: SAFE_ID.test(String(value.id || '')) ? String(value.id) : '',
        title: sanitizePlainText(value.title || ''),
        description: sanitizePlainText(value.description || '').slice(0, 4000),
        eventType: value.eventType === 'work' ? 'work' : 'meeting',
        clientId: SAFE_ID.test(String(value.clientId || '')) ? String(value.clientId) : '',
        clientName: sanitizePlainText(value.clientName || ''),
        clientEmail: sanitizePlainText(value.clientEmail || ''),
        startAt: sanitizePlainText(value.startAt || ''),
        endAt: sanitizePlainText(value.endAt || ''),
        attendees: Array.isArray(value.attendees) ? value.attendees.slice(0, 20).map(sanitizePlainText).filter(Boolean) : [],
        sendInvite: value.sendInvite !== false,
        meetLink: isSafeMediaUrl(value.meetLink) ? String(value.meetLink).trim() : '',
        googleEventId: sanitizePlainText(value.googleEventId || ''),
        source: value.source === 'google' ? 'google' : 'aldeia',
        integrationStatus: ['connected', 'not_configured', 'failed', 'local'].includes(value.integrationStatus) ? value.integrationStatus : 'local',
        createdBy: sanitizePlainText(value.createdBy || 'Admin'),
        createdAt: sanitizePlainText(value.createdAt || '')
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
            console.log('[MONGODB ATLAS] Conectado com sucesso ao banco na nuvem.');
            await autoMigrateData();
        })
        .catch(err => {
            console.error('[MONGODB ATLAS] Erro ao conectar ao banco na nuvem:', err.message);
        });
} else {
    console.warn('[MONGODB ATLAS] MONGODB_URI não configurada no .env. Usando fallback JSON local.');
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
                console.log('[MIGRATION] Portfólio migrado com sucesso para a nuvem.');
            }
        }

        // 2. Clientes
        const clientsCount = await ClientModel.countDocuments();
        if (clientsCount === 0) {
            const localClients = safeReadJSON('clients.json', []);
            if (localClients.length > 0) {
                console.log(`[MIGRATION] Migrando ${localClients.length} clientes para o MongoDB Atlas...`);
                await ClientModel.insertMany(localClients);
                console.log('[MIGRATION] Clientes migrados com sucesso.');
            }
        }

        // 3. Submissions / Leads
        const subsCount = await SubmissionModel.countDocuments();
        if (subsCount === 0) {
            const localSubs = safeReadJSON('submissions.json', []);
            if (localSubs.length > 0) {
                console.log(`[MIGRATION] Migrando ${localSubs.length} leads para o MongoDB Atlas...`);
                await SubmissionModel.insertMany(localSubs);
                console.log('[MIGRATION] Leads migrados com sucesso.');
            }
        }

        // 4. Conteúdo do CMS
        const contentDoc = await SiteContentModel.findOne({ key: 'main' });
        if (!contentDoc) {
            const localContent = safeReadJSON('site_content.json', {});
            if (Object.keys(localContent).length > 0) {
                console.log(`[MIGRATION] Migrando conteúdo do CMS para o MongoDB Atlas...`);
                await SiteContentModel.create({ key: 'main', content: localContent });
                console.log('[MIGRATION] Conteúdo do CMS migrado com sucesso.');
            }
        }

        // 5. Logs de Autenticação
        const auditCount = await AuditLogModel.countDocuments();
        if (auditCount === 0) {
            const localAudit = safeReadJSON('login_audit.json', []);
            if (localAudit.length > 0) {
                console.log(`[MIGRATION] Migrando logs de login para o MongoDB Atlas...`);
                await AuditLogModel.insertMany(localAudit.slice(-200));
                console.log('[MIGRATION] Logs de audit migrados com sucesso.');
            }
        }

        // 6. Tarefas Kanban: remove apenas o antigo pacote demonstrativo e
        // migra tarefas locais reais quando o Mongo ainda estiver vazio.
        await TrelloTaskModel.deleteMany({ id: { $in: ['t1', 't2', 't3', 't4'] } });
        const trelloCount = await TrelloTaskModel.countDocuments();
        if (trelloCount === 0) {
            const localTasks = safeReadJSON('trello_tasks.json', []);
            if (Array.isArray(localTasks) && localTasks.length) {
                await TrelloTaskModel.insertMany(localTasks.map(sanitizeTrelloResponse));
                console.log('[MIGRATION] Tarefas locais do Kanban migradas.');
            }
        }

        // 7. Perfis de Usuários Padrão (Japex, Temari, Nesh, Admin)
        const meetingsCount = await MeetingModel.countDocuments();
        if (meetingsCount === 0) {
            const localMeetings = safeReadJSON('meetings.json', []);
            if (Array.isArray(localMeetings) && localMeetings.length) {
                await MeetingModel.insertMany(localMeetings.map(sanitizeMeetingResponse));
                console.log('[MIGRATION] Local meetings migrated to MongoDB Atlas.');
            }
        }

        const profilesCount = await UserProfileModel.countDocuments();
        if (profilesCount === 0) {
            const defaultProfiles = [
                { username: 'japex', displayName: 'Japex', avatar: '/assets/japex.webp', role: 'admin', active: true, isRoot: true },
                { username: 'admin', displayName: 'Administrador ALDEIA', avatar: '/assets/japex.webp', role: 'admin', active: true, isRoot: false }
            ];
            await UserProfileModel.insertMany(defaultProfiles);
            console.log('[MIGRATION] Perfis de usuários padrão inicializados.');
        }
        await loadStoredGoogleRefreshToken();
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
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB OOM protection // 25 MB máximo por mídia
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
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://cdnjs.cloudflare.com', 'https://translate.google.com', 'https://www.gstatic.com', 'https://cdn.jsdelivr.net', 'https://www.googletagmanager.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://api.fontshare.com', 'https://unpkg.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://api.fontshare.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            mediaSrc: ["'self'", 'blob:', 'https:'],
            connectSrc: ["'self'", 'https://ipapi.co', 'https://translate.google.com', 'https://www.gstatic.com', 'https://www.google-analytics.com', 'https://*.google-analytics.com'],
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
    skip: (req) => process.env.NODE_ENV !== 'production' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip),
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
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => process.env.NODE_ENV !== 'production' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip),
    message: { status: 'error', message: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' }
});

const meetingShareLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitos envios em pouco tempo. Aguarde antes de tentar novamente.' }
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitos uploads em pouco tempo. Aguarde antes de tentar novamente.' }
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

// Rotas explícitas para o documento inicial e para o monitoramento do host.
// O fallback 404 continua reservado para caminhos realmente inexistentes.
app.get('/', (req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));
app.get('/health', (req, res) => res.status(200).json({
    status: 'ok',
    database: isMongoConnected ? 'mongodb' : 'json-fallback'
}));

// O ID de medição do GA4 é público por definição. A rota nunca expõe chaves,
// relatórios ou credenciais e só devolve um valor que passa pela validação GA4.
app.get('/api/public/analytics-config', (req, res) => {
    const measurementId = String(process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID || '').trim().toUpperCase();
    const enabled = /^G-[A-Z0-9]{6,}$/.test(measurementId);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ enabled, measurementId: enabled ? measurementId : '' });
});
app.get(['/admin', '/admin/*'], (req, res) => res.sendFile(path.join(ROOT_DIR, 'admin.html')));

// Evita conteúdo duplicado: a URL canônica da página inicial é sempre a raiz.
app.get('/index.html', (req, res) => res.redirect(301, '/'));

const publicStaticOptions = {
    maxAge: '1d',
    dotfiles: 'deny',
    index: false,
    fallthrough: true,
    setHeaders: (res, filePath) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const extension = path.extname(filePath).toLowerCase();
        if (extension === '.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (['.css', '.js', '.svg', '.webp', '.jpg', '.jpeg', '.png', '.mp4', '.woff2'].includes(extension)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        }
    }
};

// Cada pasta pública tem sua própria raiz física. Nunca monte o diretório do
// projeto inteiro: assim `assets/..` não alcança JSONs, hashes ou logs.
app.use('/assets', express.static(path.join(ROOT_DIR, 'assets'), publicStaticOptions));
app.use('/components', express.static(path.join(ROOT_DIR, 'components'), publicStaticOptions));

const publicRootFiles = new Set([
    'portfolio.html', 'projeto.html', 'admin.html', 'style.css', 'app.js',
    'portfolio.js', 'projeto.js', 'logo.svg', 'robots.txt', 'sitemap.xml'
]);
app.get('/:publicFile', (req, res, next) => {
    const requestedFile = String(req.params.publicFile || '');
    if (!publicRootFiles.has(requestedFile)) return next();
    return res.sendFile(path.join(ROOT_DIR, requestedFile));
});
app.get('/:verificationFile', (req, res, next) => {
    const requestedFile = String(req.params.verificationFile || '');
    if (!/^google[a-z0-9_-]+\.html$/i.test(requestedFile)) return next();
    return res.sendFile(path.join(ROOT_DIR, requestedFile), (error) => {
        if (error && !res.headersSent) next();
    });
});

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

function pruneValidTokens(now = Date.now()) {
    for (const [token, session] of validTokens.entries()) {
        if (!session || session.expiresAt <= now) validTokens.delete(token);
    }
}

function evictOldestToken(predicate) {
    let tokenToRemove = null;
    let oldestIssuedAt = Number.POSITIVE_INFINITY;

    for (const [token, session] of validTokens.entries()) {
        if (predicate(session) && session.issuedAt < oldestIssuedAt) {
            tokenToRemove = token;
            oldestIssuedAt = session.issuedAt;
        }
    }

    if (tokenToRemove) validTokens.delete(tokenToRemove);
}

function createAdminToken(account) {
    if (!SESSION_SIGNING_SECRET) return null;
    const safeAccount = sanitizeProfileResponse(account, account?.username || 'Admin');
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);
    pruneValidTokens(now);

    while (validTokens.size >= MAX_ACTIVE_TOKENS) {
        evictOldestToken(() => true);
    }
    while ([...validTokens.values()].filter((session) => session.username === safeAccount.username).length >= MAX_TOKENS_PER_USER) {
        evictOldestToken((session) => session.username === safeAccount.username);
    }

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
    validTokens.set(token, {
        issuedAt: now,
        expiresAt: now + TOKEN_TTL,
        username: safeAccount.username,
        displayName: safeAccount.displayName,
        id: safeAccount.id,
        role: safeAccount.role
    });
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

    // Corrige somente o bootstrap antigo, criado antes de a credencial padrão
    // passar a respeitar o login informado ao administrador (japex123).
    let usesLegacyCaseVariant = false;
    if (!HAS_CONFIGURED_ADMIN_HASH && /^\$2[aby]\$/.test(storedJapexHash)) {
        try {
            usesLegacyCaseVariant = await bcrypt.compare(LEGACY_CASE_VARIANT_ADMIN_PASSWORD, storedJapexHash);
        } catch (_) {
            usesLegacyCaseVariant = false;
        }
    }

    if (isEmpty || missingJapex || weakCredential || usesLegacyBootstrapCredential || usesLegacyCaseVariant) {
        profiles[DEFAULT_ADMIN_USERNAME] = {
            username: 'Japex',
            role: 'admin',
            displayName: japexProfile?.displayName || 'Marco',
            avatar: isSafeMediaUrl(japexProfile?.avatar) ? japexProfile.avatar.trim() : '/assets/japex.webp',
            passwordHash: HAS_VALID_ADMIN_HASH ? ADMIN_PASSWORD_HASH : await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12),
            active: true,
            isRoot: true
        };
        await safeWriteJSON(USER_PROFILES_FILE, profiles);
        console.log('[AUTH] user_profiles.json garantido com administrador padrão (japex).');
    }
}

function readLocalUserProfiles() {
    return safeReadJSON(USER_PROFILES_FILE, {});
}

async function getUserAccount(username) {
    const safeUsername = sanitizePlainText(username || 'Admin');
    const lookupKey = String(safeUsername).toLowerCase();

    if (isMongoConnected) {
        try {
            const profile = await UserProfileModel.findOne({ username: new RegExp(`^${escapeRegExp(safeUsername)}$`, 'i') })
                .lean();
            if (profile && profile.active !== false) {
                const normalized = sanitizeProfileResponse(profile, safeUsername);
                return { ...normalized, passwordHash: profile.passwordHash || '' };
            }
            // O Mongo é a fonte principal, mas a conta raiz configurada não
            // pode ficar inacessível enquanto o perfil ainda não foi migrado.
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
            return null;
        } catch (error) {
            console.error('[AUTH CREDENTIAL MONGO]', error.message);
            return null;
        }
    }

    const profiles = readLocalUserProfiles();
    const localProfile = profiles[lookupKey];
    if (localProfile && localProfile.active !== false) {
        const normalized = sanitizeProfileResponse(localProfile, safeUsername);
        return { ...normalized, passwordHash: localProfile.passwordHash || '' };
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
    const rotationHash = String(process.env.ADMIN_PASSWORD_HASH_ROTATION || '').trim();

    // A rotação explícita é a fonte de verdade do administrador raiz. Isso
    // impede que um hash legado guardado no JSON local volte a ser usado.
    if (isRootAdmin && BCRYPT_HASH_PATTERN.test(rotationHash)) {
        return bcrypt.compare(String(password || ''), rotationHash);
    }
    if (isRootAdmin && /^[a-f0-9]{64}$/i.test(rotationHash)) {
        const providedHash = crypto.createHash('sha256').update(password || '').digest('hex');
        try {
            return crypto.timingSafeEqual(Buffer.from(providedHash, 'hex'), Buffer.from(rotationHash, 'hex'));
        } catch (_) {
            return false;
        }
    }

    // Uma rotação explícita deve prevalecer sobre o perfil local legado em
    // qualquer ambiente; em produção, a fonte configurada já é obrigatória.
    if (isRootAdmin && HAS_VALID_ADMIN_HASH && (IS_PRODUCTION || process.env.ADMIN_PASSWORD_HASH_ROTATION)) {
        storedHash = ADMIN_PASSWORD_HASH;
    }
    if (!storedHash && isRootAdmin) {
        if (HAS_VALID_ADMIN_HASH) storedHash = ADMIN_PASSWORD_HASH;
        else return String(password || '') === String(DEFAULT_ADMIN_PASSWORD);
    }
    if (!storedHash) return false;

    if (BCRYPT_HASH_PATTERN.test(storedHash)) {
        return bcrypt.compare(String(password || ''), storedHash);
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
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!IS_PRODUCTION && normalizedUsername === DEFAULT_ADMIN_USERNAME) {
        const provided = Buffer.from(String(password || ''));
        const expected = Buffer.from(DEFAULT_ADMIN_PASSWORD);
        if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
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
    }
    // Uma rotação explícita é usada para recuperar e manter a conta raiz,
    // inclusive se um documento legado do Mongo ainda possuir um hash antigo.
    if (normalizedUsername === DEFAULT_ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH_ROTATION) {
        const rootAccount = {
            id: DEFAULT_ADMIN_USERNAME,
            username: 'Japex',
            displayName: 'Japex',
            role: 'admin',
            active: true,
            isRoot: true,
            passwordHash: ''
        };
        return (await verifyAccountPassword(password, rootAccount)) ? rootAccount : null;
    }
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
            if (data && Number.isInteger(payload.exp) && payload.exp > Math.floor(Date.now() / 1000) && data.expiresAt > Date.now() &&
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
    const ipFingerprint = crypto
        .createHmac('sha256', VIEW_FINGERPRINT_SECRET || 'aldeia-audit-v1')
        .update(String(ip || 'unknown'))
        .digest('hex')
        .slice(0, 16);
    const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        username: username || 'Desconhecido',
        ip: `anon-${ipFingerprint}`,
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
        await mutateJSON('login_audit.json', [], (storedLogs) => {
            const logs = Array.isArray(storedLogs) ? storedLogs : [];
            logs.push(logEntry);
            return logs.slice(-1000);
        });
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
    const account = await authenticateUser(cleanUser, password);

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

app.post('/api/auth/logout', requireAuth, (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) validTokens.delete(token);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ status: 'success', message: 'Sessão encerrada.' });
});

app.get('/api/auth/verify', (req, res) => {
    const userData = verifyToken(req);
    if (userData) {
        return res.json({ status: 'success', user: userData, username: userData.username, role: userData.role });
    }
    return res.status(401).json({ status: 'error', message: 'Token inválido' });
});

const whatsappChatParamsSchema = z.object({
    id: z.string().trim().min(3).max(180).regex(/^[A-Za-z0-9@._:-]+$/)
}).strict();
const whatsappSendSchema = z.object({
    phone: z.string().trim().min(8).max(180).regex(/^[A-Za-z0-9@._+\s()-]+$/),
    message: plainText(4000).pipe(z.string().min(1))
}).strict();
const whatsappAIRequestSchema = z.object({
    chatId: z.string().trim().min(3).max(180).regex(/^[A-Za-z0-9@._:-]+$/)
}).strict();

app.get('/api/whatsapp/status', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
        status: whatsappService.status,
        qrCode: whatsappService.status === 'AWAITING_QR' ? whatsappService.qrCodeBase64 : null
    });
});

app.post('/api/whatsapp/send', requireAuth, requireRole(['admin', 'operator']), validate(whatsappSendSchema), async (req, res) => {
    try {
        const result = await whatsappService.sendMessage(req.validatedBody.phone, req.validatedBody.message);
        return res.json({ success: true, id: sanitizePlainText(result?.id?._serialized || '') });
    } catch (error) {
        console.error('[WHATSAPP SEND]', error?.message || 'Falha desconhecida');
        return res.status(503).json({ success: false, message: 'WhatsApp indisponível no momento.' });
    }
});

app.get('/api/whatsapp/chats', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
    try {
        const chats = await whatsappService.getAllChats();
        return res.json({ success: true, chats: Array.isArray(chats) ? chats.slice(0, 500) : [] });
    } catch (error) {
        console.error('[WHATSAPP CHATS]', error?.message || 'Falha desconhecida');
        return res.status(503).json({ success: false, chats: [], message: 'Conversas indisponíveis no momento.' });
    }
});

app.get('/api/whatsapp/chats/:id/messages', requireAuth, requireRole(['admin', 'operator']), validate(whatsappChatParamsSchema, 'params'), async (req, res) => {
    try {
        const messages = await whatsappService.getChatHistory(req.validatedParams.id, 50);
        return res.json({ success: true, messages: Array.isArray(messages) ? messages : [] });
    } catch (error) {
        console.error('[WHATSAPP HISTORY]', error?.message || 'Falha desconhecida');
        return res.status(503).json({ success: false, messages: [], message: 'Histórico indisponível no momento.' });
    }
});

app.post('/api/whatsapp/ai-summary', requireAuth, requireRole(['admin', 'operator']), validate(whatsappAIRequestSchema), async (req, res) => {
    try {
        const messages = await whatsappService.getChatHistory(req.validatedBody.chatId, 30);
        const transcript = messages.map((item) => `${item?.fromMe ? 'ALDEIA' : 'CLIENTE'}: ${sanitizePlainText(item?.body || '')}`).join('\n').slice(-12_000);
        const summary = await generateAIContent(
            'Resuma a conversa comercial em uma frase curta, sem dados sensíveis e sem inventar fatos.',
            transcript || 'Conversa ainda sem mensagens.'
        );
        return res.json({
            success: true,
            tag: sanitizePlainText(summary || 'Conversa sem contexto suficiente').slice(0, 240),
            predictions: ['Posso esclarecer alguma dúvida?', 'Quer avançar com o próximo passo?', 'Prefere agendar uma conversa rápida?']
        });
    } catch (error) {
        console.error('[WHATSAPP AI SUMMARY]', error?.message || 'Falha desconhecida');
        return res.status(503).json({ success: false, message: 'Resumo por IA indisponível.' });
    }
});

app.post('/api/whatsapp/ai-reply', requireAuth, requireRole(['admin', 'operator']), validate(whatsappAIRequestSchema), async (req, res) => {
    try {
        const messages = await whatsappService.getChatHistory(req.validatedBody.chatId, 30);
        const transcript = messages.map((item) => `${item?.fromMe ? 'ALDEIA' : 'CLIENTE'}: ${sanitizePlainText(item?.body || '')}`).join('\n').slice(-12_000);
        const reply = await generateAIContent(
            'Crie uma resposta comercial breve e cordial em português do Brasil. Não invente preços, prazos ou condições.',
            transcript || 'Inicie uma conversa profissional e breve.'
        );
        return res.json({ success: true, reply: sanitizePlainText(reply).slice(0, 2000) });
    } catch (error) {
        console.error('[WHATSAPP AI REPLY]', error?.message || 'Falha desconhecida');
        return res.status(503).json({ success: false, message: 'Resposta por IA indisponível.' });
    }
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

async function resolveActiveKanbanAssignee(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return null;
    const users = await listActiveAdminUsers();
    return users.find(user =>
        String(user.username || '').toLowerCase() === key ||
        String(user.displayName || '').toLowerCase() === key
    ) || null;
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
        await mutateJSON('user_profiles.json', {}, (storedProfiles) => {
            const profiles = storedProfiles && typeof storedProfiles === 'object' && !Array.isArray(storedProfiles) ? storedProfiles : {};
            if (Object.keys(profiles).some(key => key.toLowerCase() === username.toLowerCase())) {
                const duplicateError = new Error('Este login já está em uso.');
                duplicateError.statusCode = 409;
                throw duplicateError;
            }
            profiles[username] = userRecord;
            return profiles;
        });
        const localSaved = true;
        if (!mongoSaved && !localSaved) throw new Error('user persistence failed');
        return res.status(201).json({ status: 'success', user: sanitizeProfileResponse(userRecord, username) });
    } catch (error) {
        if (error?.code === 11000 || error?.statusCode === 409) return res.status(409).json({ status: 'error', message: 'Este login já está em uso.' });
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
        await mutateJSON('user_profiles.json', {}, (storedProfiles) => {
            const profiles = storedProfiles && typeof storedProfiles === 'object' && !Array.isArray(storedProfiles) ? storedProfiles : {};
            const key = Object.keys(profiles).find(item => item.toLowerCase() === username) || username;
            profiles[key] = { ...(profiles[key] || account), username: account.username, role: nextRole };
            return profiles;
        });
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
        await mutateJSON('user_profiles.json', {}, (storedProfiles) => {
            const profiles = storedProfiles && typeof storedProfiles === 'object' && !Array.isArray(storedProfiles) ? storedProfiles : {};
            const key = Object.keys(profiles).find(item => item.toLowerCase() === username);
            if (key) delete profiles[key];
            return profiles;
        });
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
            await Promise.all([
                ProjectModel.deleteMany({}),
                SiteContentModel.deleteMany({}),
                ClientModel.deleteMany({}),
                TrelloTaskModel.deleteMany({}),
                SubmissionModel.deleteMany({}),
                AnalyticsModel.deleteMany({}),
                MeetingModel.deleteMany({}),
                ProjectViewEventModel.deleteMany({}),
                ProjectViewWindowModel.deleteMany({})
            ]);
        }
        await Promise.all([
            safeWriteJSON('portfolio.json', []),
            safeWriteJSON('site_content.json', {}),
            safeWriteJSON('clients.json', []),
            safeWriteJSON('trello_tasks.json', []),
            safeWriteJSON('submissions.json', []),
            safeWriteJSON('analytics.json', []),
            safeWriteJSON('visits.json', []),
            safeWriteJSON('meetings.json', []),
            safeWriteJSON('project_view_events.json', []),
            safeWriteJSON('project_view_windows.json', {})
        ]);
        await markAnalyticsReset();
        return res.json({ success: true, message: 'Dados operacionais e analíticos removidos com sucesso.' });
    } catch (e) {
        console.error('[RESET ERROR]', e);
        return res.status(503).json({ success: false, message: 'Não foi possível resetar os dados agora.' });
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

    const jsonSuccess = await safeWriteJSON('site_content.json', contentData).then(() => true);
    if (saved || jsonSuccess) {
        res.json({ status: 'success', message: 'Conteúdo atualizado com sucesso' });
    } else {
        res.status(503).json({ status: 'error', message: 'Erro ao salvar conteúdo' });
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

async function recordLocalProjectView(projectId, visitorHash, viewedAt, persistEvent = true) {
    const nowMs = viewedAt.getTime();
    const windowKey = `${projectId}:${visitorHash}`;
    const expiresAt = nowMs + 24 * 60 * 60 * 1000;
    let accepted = false;
    await mutateJSON('project_view_windows.json', {}, (storedWindows) => {
        const windows = storedWindows && typeof storedWindows === 'object' && !Array.isArray(storedWindows) ? storedWindows : {};
        if (Number(windows[windowKey] || 0) > nowMs) return windows;
        Object.keys(windows).forEach(key => {
            if (Number(windows[key] || 0) <= nowMs) delete windows[key];
        });
        windows[windowKey] = expiresAt;
        accepted = true;
        return windows;
    });
    if (!accepted) return false;

    if (persistEvent) {
        const cutoff = nowMs - 90 * 24 * 60 * 60 * 1000;
        await Promise.all([
            mutateJSON('project_view_events.json', [], (storedEvents) => {
                const events = (Array.isArray(storedEvents) ? storedEvents : [])
                    .filter(event => Number.isFinite(new Date(event?.viewedAt).getTime()) && new Date(event.viewedAt).getTime() >= cutoff)
                    .slice(-9999);
                events.push({ projectId, visitorHash, viewedAt: viewedAt.toISOString() });
                return events;
            }),
            mutateJSON('portfolio.json', [], (storedProjects) => {
                const projects = Array.isArray(storedProjects) ? storedProjects : [];
                const projectIndex = projects.findIndex(project => project?.id === projectId);
                if (projectIndex >= 0) {
                    projects[projectIndex].views = Math.max(0, Number(projects[projectIndex]?.views || 0)) + 1;
                }
                return projects;
            })
        ]);
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

    const acceptedLocally = await recordLocalProjectView(projectId, visitorHash, viewedAt, mongoUnavailable || acceptedByMongo);
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
            acceptedByMongo = false;
            mongoUnavailable = true;
            await ProjectViewWindowModel.deleteOne({ projectId, visitorHash }).catch(() => {});
        }
    }
    return mongoUnavailable ? acceptedLocally : acceptedByMongo;
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

    try {
        await recordUniqueProjectView(projectId, req);
    } catch (error) {
        // A telemetria nunca pode impedir a abertura do projeto público.
        console.error('[PROJECT VIEW RECORD]', error.message);
    }
    if (isMongoConnected) {
        try { project = await ProjectModel.findOne({ id: projectId }).lean() || project; } catch (_) {}
    } else {
        project = safeReadJSON('portfolio.json', []).find(item => item.id === projectId) || project;
    }
    return res.json(sanitizeProjectResponse(project));
});

app.post('/api/portfolio', requireAuth, requireRole(['admin', 'operator']), validate(projectPayloadSchema), async (req, res) => {
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

    const jsonSuccess = await mutateJSON('portfolio.json', [], (data) => {
        const projects = Array.isArray(data) ? data : [];
        projects.push(newProject);
        return projects;
    }).then(() => true);

    if (savedInMongo || jsonSuccess) {
        res.json({ status: 'success', project: sanitizeProjectResponse(newProject) });
    } else {
        res.status(503).json({ status: 'error', message: 'Erro ao salvar projeto' });
    }
});

app.put('/api/portfolio/:id', requireAuth, requireRole(['admin', 'operator']), validate(idParamsSchema, 'params'), validate(projectPayloadSchema), async (req, res) => {
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

    await mutateJSON('portfolio.json', [], (data) => {
        const projects = Array.isArray(data) ? data : [];
        const index = projects.findIndex(p => p.id === projId);
        if (index !== -1) {
            projects[index] = { ...projects[index], ...payload, id: projId };
            if (!updatedProj) updatedProj = projects[index];
        }
        return projects;
    });

    if (updatedProj) {
        res.json({ status: 'success', project: sanitizeProjectResponse(updatedProj) });
    } else {
        res.status(404).json({ status: 'error', message: 'Projeto não encontrado' });
    }
});

app.delete('/api/portfolio/:id', requireAuth, requireRole(['admin', 'operator']), validate(idParamsSchema, 'params'), async (req, res) => {
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

    let deletedJson = false;
    await mutateJSON('portfolio.json', [], (data) => {
        const projects = Array.isArray(data) ? data : [];
        const filtered = projects.filter(p => p.id !== projId);
        deletedJson = filtered.length < projects.length;
        return filtered;
    });

    if (deletedMongo || deletedJson) {
        res.json({ status: 'success' });
    } else {
        res.status(404).json({ status: 'error', message: 'Projeto não encontrado' });
    }
});

// ===== ROTAS DE CLIENTES / CRM =====
app.get('/api/clients', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
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

app.post('/api/clients', requireAuth, requireRole(['admin', 'operator']), validate(clientPayloadSchema), async (req, res) => {
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
        await safeWriteJSON('clients.json', resultClients);
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
        const clients = await mutateJSON('clients.json', [], (data) => {
            const items = Array.isArray(data) ? data : [];
            if (leadId && items.some(client => client.leadId === leadId)) {
                const duplicateError = new Error('Este lead já foi convertido em cliente.');
                duplicateError.statusCode = 409;
                throw duplicateError;
            }
            items.push(newClient);
            return items;
        });
        if (leadId) {
            if (isMongoConnected) {
                try { await SubmissionModel.deleteOne({ id: leadId }); }
                catch (error) { console.error('[CLIENT CONVERSION LEAD DELETE]', error.message); }
            }
            await mutateJSON('submissions.json', [], (submissions) =>
                (Array.isArray(submissions) ? submissions : []).filter((submission) => submission.id !== leadId)
            );
        }
        resultClients = clients;
    }

    res.json({ status: 'success', clients: resultClients.map(sanitizeClientResponse) });
});

app.put('/api/clients/:id', requireAuth, requireRole(['admin', 'operator']), validate(idParamsSchema, 'params'), validate(clientUpdateSchema), async (req, res) => {
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

    await mutateJSON('clients.json', [], (clients) => {
        const items = Array.isArray(clients) ? clients : [];
        const index = items.findIndex(c => c.id === clientId);
        if (index !== -1) {
            items[index] = { ...items[index], ...payload, id: clientId };
            if (!updatedClient) updatedClient = items[index];
        }
        return items;
    });

    if (updatedClient) {
        res.json({ status: 'success', client: sanitizeClientResponse(updatedClient) });
    } else {
        res.status(404).json({ status: 'error', message: 'Cliente não encontrado' });
    }
});

app.delete('/api/clients/:id', requireAuth, requireRole(['admin', 'operator']), validate(idParamsSchema, 'params'), async (req, res) => {
    const clientId = req.validatedParams.id;
    let deleted = false;

    if (isMongoConnected) {
        try {
            const r = await ClientModel.deleteOne({ id: clientId });
            if (r.deletedCount > 0) deleted = true;
        } catch (e) { console.error('[CLIENT DELETE MONGO]', e.message); }
    }

    await mutateJSON('clients.json', [], (clients) => {
        const items = Array.isArray(clients) ? clients : [];
        const filtered = items.filter(c => c.id !== clientId);
        if (filtered.length < items.length) deleted = true;
        return filtered;
    });

    if (deleted) {
        res.json({ status: 'success' });
    } else {
        res.status(404).json({ status: 'error', message: 'Cliente não encontrado' });
    }
});

// ===== CENTRAL DE PRODUÇÃO (EQUIPES E QUADROS) =====
async function findProductionSpace(spaceId) {
    if (!spaceId) return null;
    if (isMongoConnected) {
        try {
            const space = await ProductionSpaceModel.findOne({ id: spaceId }).lean();
            if (space) return sanitizeProductionSpaceResponse(space);
        } catch (error) { console.error('[PRODUCTION SPACE LOOKUP]', error.message); }
    }
    return safeReadJSON('production_spaces.json', []).map(sanitizeProductionSpaceResponse).find(space => space.id === spaceId) || null;
}

app.get('/api/production/spaces', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
    try {
        if (isMongoConnected) {
            const spaces = await ProductionSpaceModel.find().sort({ createdAt: -1 }).lean();
            return res.json(spaces.map(sanitizeProductionSpaceResponse));
        }
        return res.json(safeReadJSON('production_spaces.json', []).map(sanitizeProductionSpaceResponse));
    } catch (error) {
        console.error('[PRODUCTION SPACES GET]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível carregar as equipes.' });
    }
});

app.post('/api/production/spaces', requireAuth, requireRole(['admin']), validate(productionSpacePayloadSchema), async (req, res) => {
    const space = {
        id: `space_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`,
        name: req.validatedBody.name,
        description: req.validatedBody.description || '',
        memberIds: [...new Set(req.validatedBody.memberIds || [])],
        archived: false
    };
    try {
        if (isMongoConnected) await ProductionSpaceModel.create(space);
        await mutateJSON('production_spaces.json', [], items => [space, ...(Array.isArray(items) ? items : [])]);
        return res.status(201).json({ status: 'success', space: sanitizeProductionSpaceResponse(space) });
    } catch (error) {
        console.error('[PRODUCTION SPACE POST]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível criar a equipe.' });
    }
});

app.put('/api/production/spaces/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), validate(productionSpaceUpdateSchema), async (req, res) => {
    const id = req.validatedParams.id;
    const patch = req.validatedBody;
    try {
        let updated = null;
        if (isMongoConnected) updated = await ProductionSpaceModel.findOneAndUpdate({ id }, patch, { new: true }).lean();
        await mutateJSON('production_spaces.json', [], items => (Array.isArray(items) ? items : []).map(item => item.id === id ? { ...item, ...patch, id } : item));
        if (!updated) updated = safeReadJSON('production_spaces.json', []).map(sanitizeProductionSpaceResponse).find(item => item.id === id) || null;
        return updated ? res.json({ status: 'success', space: sanitizeProductionSpaceResponse(updated) }) : res.status(404).json({ status: 'error', message: 'Equipe não encontrada.' });
    } catch (error) {
        console.error('[PRODUCTION SPACE PUT]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível atualizar a equipe.' });
    }
});

app.delete('/api/production/spaces/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), async (req, res) => {
    const id = req.validatedParams.id;
    try {
        const linkedBoards = isMongoConnected
            ? await ProductionBoardModel.countDocuments({ spaceId: id, archived: { $ne: true } })
            : safeReadJSON('production_boards.json', []).filter(board => board?.spaceId === id && !board.archived).length;
        if (linkedBoards) return res.status(409).json({ status: 'error', message: 'Arquive ou mova os quadros desta equipe antes de removê-la.' });
        const mongoArchived = isMongoConnected ? await ProductionSpaceModel.findOneAndUpdate({ id }, { archived: true }, { new: true }).lean() : null;
        let found = false;
        await mutateJSON('production_spaces.json', [], items => (Array.isArray(items) ? items : []).map(item => {
            if (item.id !== id) return item;
            found = true; return { ...item, archived: true };
        }));
        return found || mongoArchived ? res.json({ status: 'success' }) : res.status(404).json({ status: 'error', message: 'Equipe não encontrada.' });
    } catch (error) {
        console.error('[PRODUCTION SPACE DELETE]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível remover a equipe.' });
    }
});

app.get('/api/production/boards', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
    try {
        if (isMongoConnected) {
            const boards = await ProductionBoardModel.find().sort({ favorite: -1, createdAt: -1 }).lean();
            return res.json(boards.map(sanitizeProductionBoardResponse));
        }
        return res.json(safeReadJSON('production_boards.json', []).map(sanitizeProductionBoardResponse));
    } catch (error) {
        console.error('[PRODUCTION BOARDS GET]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível carregar os quadros.' });
    }
});

app.post('/api/production/boards', requireAuth, requireRole(['admin']), validate(productionBoardPayloadSchema), async (req, res) => {
    const body = req.validatedBody;
    if (body.spaceId && !await findProductionSpace(body.spaceId)) {
        return res.status(400).json({ status: 'error', message: 'A equipe selecionada não existe.' });
    }
    const board = {
        id: `board_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`,
        spaceId: body.spaceId || '',
        name: body.name,
        description: body.description || '',
        favorite: body.favorite === true,
        archived: false
    };
    try {
        if (isMongoConnected) await ProductionBoardModel.create(board);
        await mutateJSON('production_boards.json', [], items => [board, ...(Array.isArray(items) ? items : [])]);
        return res.status(201).json({ status: 'success', board: sanitizeProductionBoardResponse(board) });
    } catch (error) {
        console.error('[PRODUCTION BOARD POST]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível criar o quadro.' });
    }
});

app.put('/api/production/boards/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), validate(productionBoardUpdateSchema), async (req, res) => {
    const id = req.validatedParams.id;
    const patch = req.validatedBody;
    if (patch.spaceId && !await findProductionSpace(patch.spaceId)) return res.status(400).json({ status: 'error', message: 'A equipe selecionada não existe.' });
    let updated = null;
    try {
        if (isMongoConnected) updated = await ProductionBoardModel.findOneAndUpdate({ id }, patch, { new: true }).lean();
        await mutateJSON('production_boards.json', [], items => (Array.isArray(items) ? items : []).map(item => item.id === id ? { ...item, ...patch, id } : item));
        if (!updated) updated = safeReadJSON('production_boards.json', []).map(sanitizeProductionBoardResponse).find(item => item.id === id) || null;
        return updated ? res.json({ status: 'success', board: sanitizeProductionBoardResponse(updated) }) : res.status(404).json({ status: 'error', message: 'Quadro não encontrado.' });
    } catch (error) {
        console.error('[PRODUCTION BOARD PUT]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível atualizar o quadro.' });
    }
});

app.delete('/api/production/boards/:id', requireAuth, requireRole(['admin']), validate(idParamsSchema, 'params'), async (req, res) => {
    const id = req.validatedParams.id;
    try {
        const taskCount = isMongoConnected
            ? await TrelloTaskModel.countDocuments({ boardId: id })
            : safeReadJSON('trello_tasks.json', []).filter(task => task?.boardId === id).length;
        if (taskCount) return res.status(409).json({ status: 'error', message: 'Mova ou exclua as tarefas antes de arquivar este quadro.' });
        const mongoArchived = isMongoConnected ? await ProductionBoardModel.findOneAndUpdate({ id }, { archived: true }, { new: true }).lean() : null;
        let found = false;
        await mutateJSON('production_boards.json', [], items => (Array.isArray(items) ? items : []).map(item => {
            if (item.id !== id) return item;
            found = true; return { ...item, archived: true };
        }));
        return found || mongoArchived ? res.json({ status: 'success' }) : res.status(404).json({ status: 'error', message: 'Quadro não encontrado.' });
    } catch (error) {
        console.error('[PRODUCTION BOARD DELETE]', error.message);
        return res.status(503).json({ status: 'error', message: 'Não foi possível arquivar o quadro.' });
    }
});

// ===== ROTAS DE TRELLO (KANBAN DA EQUIPE) =====
app.get('/api/trello', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
    if (isMongoConnected) {
        try {
            const tasks = await TrelloTaskModel.find().sort({ createdAt: -1 }).lean();
            return res.json(tasks.map(sanitizeTrelloResponse));
        } catch (e) { console.error('[TRELLO GET MONGO]', e.message); }
    }
    const tasks = safeReadJSON('trello_tasks.json', []);
    res.json(tasks.map(sanitizeTrelloResponse));
});

app.post('/api/trello', requireAuth, requireRole(['admin', 'operator']), validate(trelloPayloadSchema), async (req, res) => {
    req.body = req.validatedBody;
    if (req.body.boardId) {
        const boards = isMongoConnected
            ? await ProductionBoardModel.findOne({ id: req.body.boardId }).lean().catch(() => null)
            : safeReadJSON('production_boards.json', []).find(board => board?.id === req.body.boardId);
        if (!boards) return res.status(400).json({ status: 'error', message: 'O quadro selecionado não existe.' });
    }
    const assignee = await resolveActiveKanbanAssignee(req.body.assignedTo);
    if (req.body.assignedTo && !assignee) {
        return res.status(400).json({ status: 'error', message: 'Selecione uma conta ativa da equipe.' });
    }
    const newTask = {
        id: 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: req.body.title || 'Nova Tarefa',
        description: req.body.description || '',
        status: req.body.status || 'backlog',
        boardId: req.body.boardId || '',
        assignedTo: assignee?.username || '',
        priority: req.body.priority || 'média',
        clientName: req.body.clientName || '',
        dueDate: req.body.dueDate || '',
        subtasks: req.body.subtasks || [],
        assets: req.body.assets || [],
        timeSpentSeconds: req.body.timeSpentSeconds || 0,
        timerStartedAt: req.body.timerStartedAt || ''
    };

    if (isMongoConnected) {
        try { await TrelloTaskModel.create(newTask); } catch (e) { console.error('[TRELLO POST MONGO]', e.message); }
    }

    await mutateJSON('trello_tasks.json', [], (tasks) => {
        const items = Array.isArray(tasks) ? tasks : [];
        items.unshift(newTask);
        return items;
    });
    res.json({ status: 'success', task: sanitizeTrelloResponse(newTask) });
});

app.put('/api/trello/:id', requireAuth, requireRole(['admin', 'operator']), validate(idParamsSchema, 'params'), validate(trelloUpdateSchema), async (req, res) => {
    const taskId = req.validatedParams.id;
    const payload = { ...req.validatedBody };
    if (payload.boardId) {
        const board = isMongoConnected
            ? await ProductionBoardModel.findOne({ id: payload.boardId }).lean().catch(() => null)
            : safeReadJSON('production_boards.json', []).find(item => item?.id === payload.boardId);
        if (!board) return res.status(400).json({ status: 'error', message: 'O quadro selecionado não existe.' });
    }
    if (Object.hasOwn(payload, 'assignedTo')) {
        const assignee = await resolveActiveKanbanAssignee(payload.assignedTo);
        if (payload.assignedTo && !assignee) {
            return res.status(400).json({ status: 'error', message: 'Selecione uma conta ativa da equipe.' });
        }
        payload.assignedTo = assignee?.username || '';
    }
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

    await mutateJSON('trello_tasks.json', [], (tasks) => {
        const items = Array.isArray(tasks) ? tasks : [];
        const index = items.findIndex(t => t.id === taskId);
        if (index !== -1) {
            items[index] = { ...items[index], ...payload, id: taskId };
            if (!updatedTask) updatedTask = items[index];
        }
        return items;
    });

    if (updatedTask) {
        res.json({ status: 'success', task: sanitizeTrelloResponse(updatedTask) });
    } else {
        res.status(404).json({ status: 'error', message: 'Tarefa não encontrada' });
    }
});

app.delete('/api/trello/:id', requireAuth, requireRole(['admin', 'operator']), validate(idParamsSchema, 'params'), async (req, res) => {
    const taskId = req.validatedParams.id;
    let deleted = false;

    if (isMongoConnected) {
        try {
            const r = await TrelloTaskModel.deleteOne({ id: taskId });
            if (r.deletedCount > 0) deleted = true;
        } catch (e) { console.error('[TRELLO DELETE MONGO]', e.message); }
    }

    await mutateJSON('trello_tasks.json', [], (tasks) => {
        const items = Array.isArray(tasks) ? tasks : [];
        const filtered = items.filter(t => t.id !== taskId);
        if (filtered.length < items.length) deleted = true;
        return filtered;
    });

    if (deleted) {
        res.json({ status: 'success' });
    } else {
        res.status(404).json({ status: 'error', message: 'Tarefa não encontrada' });
    }
});

// ===== AGENDAMENTOS + GOOGLE CALENDAR / MEET =====
const GOOGLE_CALENDAR_ID = String(process.env.GOOGLE_CALENDAR_ID || 'primary').trim();
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
const GOOGLE_REFRESH_TOKEN = String(process.env.GOOGLE_REFRESH_TOKEN || '').trim();
const GOOGLE_OAUTH_REDIRECT_URI = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
const GOOGLE_TOKEN_ENCRYPTION_KEY = String(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '').trim();
const GOOGLE_TOKEN_STORAGE_FILE = 'google_calendar_tokens.json';
const GOOGLE_OAUTH_STATE_TTL = 10 * 60 * 1000;
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || '').trim();
const ADMIN_NOTIFICATION_EMAIL = String(process.env.ADMIN_NOTIFICATION_EMAIL || '').trim();
const MEETING_SHARE_COOLDOWN_MS = 45 * 1000;

function pruneGoogleOAuthStates(now = Date.now()) {
    for (const [state, entry] of pendingGoogleOAuthStates.entries()) {
        if (!entry || Number(entry.expiresAt) <= now) pendingGoogleOAuthStates.delete(state);
    }
}

function getGoogleTokenCipherKey() {
    if (GOOGLE_TOKEN_ENCRYPTION_KEY.length < 32) return null;
    return crypto.createHash('sha256').update(GOOGLE_TOKEN_ENCRYPTION_KEY, 'utf8').digest();
}

function encryptGoogleRefreshToken(refreshToken) {
    const key = getGoogleTokenCipherKey();
    if (!key) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY ausente');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(refreshToken), 'utf8'), cipher.final()]);
    return {
        version: 1,
        iv: iv.toString('base64url'),
        tag: cipher.getAuthTag().toString('base64url'),
        ciphertext: ciphertext.toString('base64url')
    };
}

function decryptGoogleRefreshToken(value) {
    const key = getGoogleTokenCipherKey();
    if (!key || !value || typeof value !== 'object') return '';
    try {
        const iv = Buffer.from(String(value.iv || ''), 'base64url');
        const tag = Buffer.from(String(value.tag || ''), 'base64url');
        const ciphertext = Buffer.from(String(value.ciphertext || ''), 'base64url');
        if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) return '';
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (_) {
        return '';
    }
}

function getStoredGoogleRefreshToken() {
    if (cachedGoogleRefreshToken) return cachedGoogleRefreshToken;
    const stored = safeReadJSON(GOOGLE_TOKEN_STORAGE_FILE, {});
    const refreshToken = decryptGoogleRefreshToken(stored);
    if (refreshToken) cachedGoogleRefreshToken = refreshToken;
    return refreshToken;
}

function getGoogleRefreshToken() {
    // A conexão concluída pelo OAuth tem precedência sobre um token de
    // inicialização fornecido pelo ambiente. Isso permite renovar a conexão
    // sem redeploy e sem manter um token antigo como fonte de verdade.
    return getStoredGoogleRefreshToken() || GOOGLE_REFRESH_TOKEN;
}

async function loadStoredGoogleRefreshToken() {
    if (cachedGoogleRefreshToken) return cachedGoogleRefreshToken;

    if (isMongoConnected) {
        try {
            const integration = await GoogleCalendarIntegrationModel.findOne({ key: 'calendar' }).lean();
            const refreshToken = decryptGoogleRefreshToken(integration?.refreshToken);
            if (refreshToken) {
                cachedGoogleRefreshToken = refreshToken;
                return refreshToken;
            }
        } catch (error) {
            console.error('[GOOGLE CALENDAR TOKEN LOAD]', error.message);
        }
    }

    return getStoredGoogleRefreshToken();
}

async function storeGoogleRefreshToken(refreshToken, user = {}) {
    const normalizedToken = String(refreshToken || '').trim();
    if (!normalizedToken) throw new Error('Token de atualização do Google ausente.');

    const encrypted = encryptGoogleRefreshToken(normalizedToken);
    if (isMongoConnected) {
        try {
            await GoogleCalendarIntegrationModel.findOneAndUpdate(
                { key: 'calendar' },
                { $set: {
                    refreshToken: encrypted,
                    updatedBy: sanitizePlainText(user?.username || user?.displayName || 'Admin')
                } },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('[GOOGLE CALENDAR TOKEN SAVE]', error.message);
            throw new Error('Não foi possível salvar a conexão com o Google Calendar.');
        }
    }

    await safeWriteJSON(GOOGLE_TOKEN_STORAGE_FILE, {
        ...encrypted,
        updatedAt: new Date().toISOString()
    });
    cachedGoogleRefreshToken = normalizedToken;
}

function isGoogleOAuthReady() {
    return Boolean(
        GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_OAUTH_REDIRECT_URI && GOOGLE_CALENDAR_ID && getGoogleTokenCipherKey()
    );
}

function isGoogleCalendarConfigured() {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && getGoogleRefreshToken() && GOOGLE_CALENDAR_ID);
}

function getGoogleCalendarStatus() {
    return {
        configured: isGoogleCalendarConfigured(),
        oauthReady: isGoogleOAuthReady(),
        calendarLabel: GOOGLE_CALENDAR_ID === 'primary' ? 'Calendário principal' : 'Calendário conectado',
        lastSyncedAt: lastGoogleCalendarSyncAt || ''
    };
}

function sanitizeProductionSpaceResponse(space) {
    const value = scrubNoSql(space || {});
    return {
        id: SAFE_ID.test(String(value.id || '')) ? String(value.id) : '',
        name: sanitizePlainText(value.name || ''),
        description: sanitizePlainText(value.description || ''),
        memberIds: Array.isArray(value.memberIds) ? value.memberIds.filter(id => SAFE_ID.test(String(id))).slice(0, 50).map(String) : [],
        archived: value.archived === true,
        createdAt: sanitizePlainText(value.createdAt || '')
    };
}

function sanitizeProductionBoardResponse(board) {
    const value = scrubNoSql(board || {});
    return {
        id: SAFE_ID.test(String(value.id || '')) ? String(value.id) : '',
        spaceId: SAFE_ID.test(String(value.spaceId || '')) ? String(value.spaceId) : '',
        name: sanitizePlainText(value.name || ''),
        description: sanitizePlainText(value.description || ''),
        favorite: value.favorite === true,
        archived: value.archived === true,
        createdAt: sanitizePlainText(value.createdAt || '')
    };
}

function createGoogleOAuthState(user) {
    pruneGoogleOAuthStates();
    const state = crypto.randomBytes(32).toString('base64url');
    pendingGoogleOAuthStates.set(state, {
        userId: sanitizePlainText(user?.id || user?.username || ''),
        expiresAt: Date.now() + GOOGLE_OAUTH_STATE_TTL
    });
    return state;
}

function getGoogleOAuthAuthorizationUrl(state) {
    const parameters = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent',
        state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`;
}

async function exchangeGoogleOAuthCode(code) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
                grant_type: 'authorization_code'
            }),
            signal: controller.signal
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const providerError = sanitizePlainText(payload?.error_description || payload?.error || 'sem detalhe do provedor');
            throw new Error(`OAuth Google respondeu HTTP ${response.status}: ${providerError}`);
        }
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function getGoogleCalendarAccessToken() {
    const refreshToken = getGoogleRefreshToken();
    if (!refreshToken) throw new Error('Google Calendar não está conectado.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            }),
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`OAuth Google respondeu HTTP ${response.status}`);
        const tokenData = await response.json();
        if (!tokenData?.access_token) throw new Error('OAuth Google não retornou um access token.');
        return tokenData.access_token;
    } finally {
        clearTimeout(timeout);
    }
}

function normalizeGoogleCalendarDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const complete = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T09:00:00-03:00` : raw;
    const date = new Date(complete);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeGoogleCalendarEvent(event) {
    const startAt = normalizeGoogleCalendarDate(event?.start?.dateTime || event?.start?.date);
    const endAt = normalizeGoogleCalendarDate(event?.end?.dateTime || event?.end?.date);
    if (!startAt || !endAt) return null;

    const externalId = sanitizePlainText(event?.id || '');
    const digest = crypto.createHash('sha256').update(externalId || `${startAt}:${event?.summary || ''}`).digest('hex').slice(0, 20);
    const attendees = Array.isArray(event?.attendees)
        ? event.attendees.map(item => sanitizePlainText(item?.email || '')).filter(Boolean).slice(0, 20)
        : [];
    const meetLink = String(event?.hangoutLink || event?.conferenceData?.entryPoints?.find(point => point?.entryPointType === 'video')?.uri || '').trim();

    return sanitizeMeetingResponse({
        id: `google_${digest}`,
        title: sanitizePlainText(event?.summary || 'Evento do Google Calendar'),
        description: sanitizePlainText(event?.description || '').slice(0, 4000),
        eventType: meetLink ? 'meeting' : 'work',
        startAt,
        endAt,
        attendees,
        sendInvite: false,
        meetLink,
        googleEventId: externalId,
        source: 'google',
        integrationStatus: 'connected',
        createdBy: 'Google Calendar',
        createdAt: sanitizePlainText(event?.created || event?.updated || '')
    });
}

async function listGoogleCalendarEvents() {
    const accessToken = await getGoogleCalendarAccessToken();
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const events = [];
    let pageToken = '';
    let pages = 0;

    do {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`);
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('orderBy', 'startTime');
        url.searchParams.set('timeMin', timeMin);
        url.searchParams.set('timeMax', timeMax);
        url.searchParams.set('maxResults', '250');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        try {
            const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal });
            if (!response.ok) throw new Error(`Google Calendar respondeu HTTP ${response.status}`);
            const payload = await response.json();
            for (const item of Array.isArray(payload?.items) ? payload.items : []) {
                if (item?.status === 'cancelled') continue;
                const normalized = normalizeGoogleCalendarEvent(item);
                if (normalized) events.push(normalized);
            }
            pageToken = String(payload?.nextPageToken || '');
            pages += 1;
        } finally {
            clearTimeout(timeout);
        }
    } while (pageToken && pages < 4);

    return events;
}

async function upsertGoogleCalendarEvents(events) {
    const incoming = Array.isArray(events)
        ? events.map(sanitizeMeetingResponse).filter(event => event.googleEventId && event.id)
        : [];
    if (!incoming.length) return { imported: 0, updated: 0 };

    const mergeEvent = (event, existing = {}) => ({
        ...event,
        id: existing.id || event.id,
        clientId: existing.clientId || event.clientId || '',
        clientName: existing.clientName || event.clientName || '',
        clientEmail: existing.clientEmail || event.clientEmail || '',
        description: event.description || existing.description || '',
        attendees: event.attendees.length ? event.attendees : (existing.attendees || []),
        sendInvite: existing.sendInvite !== false,
        source: existing.source === 'aldeia' ? 'aldeia' : 'google',
        integrationStatus: 'connected',
        createdBy: existing.createdBy || event.createdBy || 'Google Calendar'
    });

    if (isMongoConnected) {
        const ids = incoming.map(event => event.googleEventId);
        const existingItems = await MeetingModel.find({ googleEventId: { $in: ids } }).lean();
        const existingByGoogleId = new Map(existingItems.map(item => [item.googleEventId, item]));
        let imported = 0;
        let updated = 0;
        const operations = incoming.map(event => {
            const existing = existingByGoogleId.get(event.googleEventId) || {};
            if (existing.id) updated += 1; else imported += 1;
            return { updateOne: { filter: { googleEventId: event.googleEventId }, update: { $set: mergeEvent(event, existing) }, upsert: true } };
        });
        await MeetingModel.bulkWrite(operations, { ordered: false });
        return { imported, updated };
    }

    let imported = 0;
    let updated = 0;
    await mutateJSON('meetings.json', [], (stored) => {
        const meetings = Array.isArray(stored) ? stored : [];
        const indexByGoogleId = new Map(meetings.map((meeting, index) => [meeting?.googleEventId, index]));
        for (const event of incoming) {
            const index = indexByGoogleId.get(event.googleEventId);
            if (Number.isInteger(index)) {
                meetings[index] = mergeEvent(event, meetings[index]);
                updated += 1;
            } else {
                meetings.push(mergeEvent(event));
                indexByGoogleId.set(event.googleEventId, meetings.length - 1);
                imported += 1;
            }
        }
        return meetings;
    });
    return { imported, updated };
}

async function insertGoogleCalendarMeeting(meeting) {
    const accessToken = await getGoogleCalendarAccessToken();
    const requestId = crypto.randomUUID();
    const fallbackDescription = `${meeting.eventType === 'work' ? 'Bloco de trabalho' : 'Reunião'} agendado pelo CRM ALDEIA${meeting.clientName ? ` — Cliente: ${meeting.clientName}` : ''}`;
    const eventPayload = {
        summary: meeting.title,
        description: meeting.description || fallbackDescription,
        start: { dateTime: meeting.startAt, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: meeting.endAt, timeZone: 'America/Sao_Paulo' },
        attendees: meeting.attendees.map(email => ({ email }))
    };
    if (meeting.eventType === 'meeting') {
        eventPayload.conferenceData = {
            createRequest: {
                requestId,
                conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
        };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
        // O CRM libera o Meet apenas na janela da reunião. O participante é
        // registrado no evento, mas o Google não recebe permissão para enviar
        // o link antecipadamente por e-mail.
        const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?${meeting.eventType === 'meeting' ? 'conferenceDataVersion=1&' : ''}sendUpdates=none`;
        const calendarResponse = await fetch(calendarUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventPayload),
            signal: controller.signal
        });
        if (!calendarResponse.ok) throw new Error(`Google Calendar respondeu HTTP ${calendarResponse.status}`);
        return calendarResponse.json();
    } finally {
        clearTimeout(timeout);
    }
}

app.get('/api/google-calendar/status', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'success', ...getGoogleCalendarStatus() });
});

app.post('/api/google-calendar/connect', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
    if (!isGoogleOAuthReady()) {
        return res.status(409).json({
            status: 'error',
            message: 'A conexao OAuth do Google ainda nao foi configurada no servidor.'
        });
    }
    const state = createGoogleOAuthState(req.user);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'success', authorizationUrl: getGoogleOAuthAuthorizationUrl(state) });
});

app.get('/api/google-calendar/oauth/callback', async (req, res) => {
    const state = String(req.query?.state || '');
    const code = String(req.query?.code || '');
    const pending = pendingGoogleOAuthStates.get(state);
    pendingGoogleOAuthStates.delete(state);

    const finish = (statusCode, title, description) => {
        res.status(statusCode).type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ALDEIA | Google Calendar</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#fff;font-family:Arial,sans-serif"><main style="max-width:420px;margin:24px;padding:32px;border:1px solid rgba(255,255,255,.1);border-radius:24px;background:rgba(255,255,255,.03);text-align:center"><h1 style="margin:0 0 12px;font-size:24px">${title}</h1><p style="margin:0;color:rgba(255,255,255,.62);line-height:1.55">${description}</p></main></body></html>`);
    };

    if (!pending || pending.expiresAt <= Date.now() || !/^[A-Za-z0-9_-]{32,128}$/.test(state) || !code) {
        return finish(400, 'Conexao invalida', 'Esta tentativa expirou ou ja foi utilizada. Volte ao CRM e inicie a conexao novamente.');
    }
    if (!isGoogleOAuthReady()) {
        return finish(409, 'Configuracao pendente', 'A conexao OAuth do Google nao esta pronta neste servidor.');
    }
    try {
        const tokenData = await exchangeGoogleOAuthCode(code);
        const refreshToken = String(tokenData?.refresh_token || getGoogleRefreshToken() || '').trim();
        if (!refreshToken) throw new Error('OAuth Google nao retornou refresh_token');
        await storeGoogleRefreshToken(refreshToken, { username: pending.userId });
        lastGoogleCalendarSyncAt = new Date().toISOString();
        return res.redirect(303, '/admin/agendamentos?google=connected');
    } catch (error) {
        console.error('[GOOGLE OAUTH CALLBACK]', error.message);
        return finish(502, 'Conexao nao concluida', 'Nao foi possivel concluir a conexao com o Google Calendar.');
    }
});

app.post('/api/google-calendar/sync', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
    if (!isGoogleCalendarConfigured()) {
        return res.status(409).json({
            status: 'error',
            message: 'Google Calendar ainda nao esta conectado.'
        });
    }
    try {
        const events = await listGoogleCalendarEvents();
        const changes = await upsertGoogleCalendarEvents(events);
        lastGoogleCalendarSyncAt = new Date().toISOString();
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            status: 'success',
            events: events.map(event => redactMeetingForClient(event)),
            ...changes,
            syncedAt: lastGoogleCalendarSyncAt
        });
    } catch (error) {
        console.error('[GOOGLE CALENDAR SYNC]', error.message);
        res.status(503).json({ status: 'error', message: 'Nao foi possivel sincronizar o Google Calendar agora.' });
    }
});

app.get('/api/meetings', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (isMongoConnected) {
        try {
            const meetings = await MeetingModel.find().sort({ startAt: 1 }).limit(300).lean();
            return res.json(meetings.map(meeting => redactMeetingForClient(meeting)));
        } catch (error) { console.error('[MEETINGS GET MONGO]', error.message); }
    }
    const storedMeetings = safeReadJSON('meetings.json', []);
    const meetings = Array.isArray(storedMeetings) ? storedMeetings : [];
    res.json(meetings.map(meeting => redactMeetingForClient(meeting)).sort((a, b) => new Date(a.startAt) - new Date(b.startAt)));
});

app.post('/api/meetings/schedule', requireAuth, requireRole(['admin', 'operator']), validate(meetingPayloadSchema), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const payload = req.validatedBody;
    const attendees = [...new Set([payload.clientEmail, ...payload.attendees].filter(Boolean))];
    const meeting = {
        id: `meet_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        title: payload.title,
        description: payload.description || '',
        eventType: payload.eventType,
        clientId: payload.clientId || '',
        clientName: payload.clientName || '',
        clientEmail: payload.clientEmail || '',
        startAt: payload.startAt,
        endAt: payload.endAt,
        attendees,
        sendInvite: payload.sendInvite !== false,
        meetLink: '',
        googleEventId: '',
        source: 'aldeia',
        integrationStatus: isGoogleCalendarConfigured() ? 'failed' : 'not_configured',
        createdBy: sanitizePlainText(req.user?.displayName || req.user?.username || 'Admin'),
        createdAt: new Date().toISOString()
    };

    let syncWarning = '';
    if (isGoogleCalendarConfigured()) {
        try {
            const googleEvent = await insertGoogleCalendarMeeting(meeting);
            meeting.googleEventId = sanitizePlainText(googleEvent?.id || '');
            meeting.meetLink = String(googleEvent?.hangoutLink || googleEvent?.conferenceData?.entryPoints?.find(point => point.entryPointType === 'video')?.uri || '').trim();
            meeting.integrationStatus = 'connected';
        } catch (error) {
            console.error('[GOOGLE CALENDAR SCHEDULE]', error.message);
            meeting.integrationStatus = 'failed';
            syncWarning = 'O evento foi salvo no CRM, mas não foi possível enviá-lo ao Google Calendar.';
        }
    }

    if (isMongoConnected) {
        try { await MeetingModel.create(meeting); } catch (error) { console.error('[MEETINGS POST MONGO]', error.message); }
    }
    await mutateJSON('meetings.json', [], (storedMeetings) => {
        const meetings = Array.isArray(storedMeetings) ? storedMeetings : [];
        meetings.push(meeting);
        return meetings;
    });
    res.status(201).json({ status: 'success', meeting: redactMeetingForClient(meeting), warning: syncWarning });
});

async function findMeetingForShare(meetingId) {
    if (isMongoConnected) {
        try {
            const meeting = await MeetingModel.findOne({ id: meetingId }).lean();
            if (meeting) return sanitizeMeetingResponse(meeting);
        } catch (error) {
            console.error('[MEETING SHARE LOOKUP]', error.message);
        }
    }

    const storedMeetings = safeReadJSON('meetings.json', []);
    const meetings = Array.isArray(storedMeetings) ? storedMeetings : [];
    const meeting = meetings.find(item => String(item?.id || '') === meetingId);
    return meeting ? sanitizeMeetingResponse(meeting) : null;
}

function parseEmailAddress(value) {
    const result = z.string().trim().email().max(254).safeParse(String(value || ''));
    return result.success ? result.data : '';
}

async function resolveMeetingClientEmail(meeting) {
    const storedEmail = parseEmailAddress(meeting?.clientEmail);
    if (storedEmail) return storedEmail;

    const clientId = SAFE_ID.test(String(meeting?.clientId || '')) ? String(meeting.clientId) : '';
    if (!clientId) return '';

    if (isMongoConnected) {
        try {
            const [client, submission] = await Promise.all([
                ClientModel.findOne({ id: clientId }).select({ email: 1, _id: 0 }).lean(),
                SubmissionModel.findOne({ id: clientId }).select({ email: 1, _id: 0 }).lean()
            ]);
            const databaseEmail = parseEmailAddress(client?.email || submission?.email);
            if (databaseEmail) return databaseEmail;
        } catch (error) {
            console.error('[MEETING SHARE CONTACT LOOKUP]', error.message);
        }
    }

    const localClients = safeReadJSON('clients.json', []);
    const localSubmissions = safeReadJSON('submissions.json', []);
    const localContacts = [
        ...(Array.isArray(localClients) ? localClients : []),
        ...(Array.isArray(localSubmissions) ? localSubmissions : [])
    ];
    const localContact = localContacts.find(item => String(item?.id || '') === clientId);
    return parseEmailAddress(localContact?.email);
}

function getSafeGoogleMeetLink(value) {
    try {
        const url = new URL(String(value || '').trim());
        if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'meet.google.com') return '';
        return url.toString();
    } catch (_) {
        return '';
    }
}

const MEETING_ACCESS_GRACE_MS = 30 * 60 * 1000;

function getMeetingAccessState(meeting, nowValue = Date.now()) {
    const value = sanitizeMeetingResponse(meeting);
    const nowMs = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
    const startMs = Date.parse(value.startAt);
    const endMs = Date.parse(value.endAt);
    const hasValidWindow = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
    const unlockAt = hasValidWindow ? new Date(startMs).toISOString() : null;
    const expiresAt = hasValidWindow ? new Date(endMs + MEETING_ACCESS_GRACE_MS).toISOString() : null;
    const meetLink = getSafeGoogleMeetLink(value.meetLink);

    let status = 'unavailable';
    if (value.eventType === 'meeting' && meetLink && hasValidWindow) {
        if (nowMs < startMs) status = 'locked';
        else if (nowMs <= endMs + MEETING_ACCESS_GRACE_MS) status = 'available';
        else status = 'expired';
    }

    return {
        status,
        serverNow: new Date(nowMs).toISOString(),
        unlockAt,
        expiresAt,
        ...(status === 'available' ? { meetLink } : {})
    };
}

function redactMeetingForClient(meeting, nowValue = Date.now()) {
    const value = sanitizeMeetingResponse(meeting);
    const publicMeeting = { ...value };
    delete publicMeeting.meetLink;
    const access = getMeetingAccessState(value, nowValue);
    return {
        ...publicMeeting,
        accessStatus: access.status,
        serverNow: access.serverNow,
        unlockAt: access.unlockAt,
        expiresAt: access.expiresAt,
        ...(access.status === 'available' ? { meetLink: access.meetLink } : {})
    };
}

app.get(
    '/api/meetings/:id/access',
    requireAuth,
    requireRole(['admin']),
    validate(idParamsSchema, 'params'),
    async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const meeting = await findMeetingForShare(req.validatedParams.id);
        if (!meeting) {
            return res.status(404).json({ status: 'error', message: 'Agendamento não encontrado.' });
        }
        return res.json(getMeetingAccessState(meeting));
    }
);

function formatMeetingDateForEmail(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Horário não informado';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo'
    }).format(date);
}

async function sendMeetingEmail({ to, subject, text }) {
    if (!RESEND_API_KEY || !EMAIL_FROM) {
        const error = new Error('Serviço de e-mail não configurado');
        error.code = 'EMAIL_NOT_CONFIGURED';
        throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text }),
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`Provedor de e-mail respondeu HTTP ${response.status}`);
        return response.json().catch(() => ({}));
    } finally {
        clearTimeout(timeout);
    }
}

app.post(
    '/api/meetings/:id/share-email',
    requireAuth,
    requireRole(['admin']),
    meetingShareLimiter,
    validate(idParamsSchema, 'params'),
    validate(meetingSharePayloadSchema),
    async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const meetingId = req.validatedParams.id;
        const recipientType = req.validatedBody.recipient;
        const meeting = await findMeetingForShare(meetingId);
        if (!meeting) {
            return res.status(404).json({ status: 'error', message: 'Agendamento não encontrado.' });
        }

        const access = getMeetingAccessState(meeting);
        if (access.status !== 'available') {
            const accessMessage = {
                locked: 'O link do Google Meet será liberado no horário de início da reunião.',
                expired: 'A janela de acesso desta reunião já foi encerrada.',
                unavailable: 'Este agendamento não possui um link do Google Meet disponível.'
            }[access.status];
            return res.status(409).json({
                status: 'error',
                accessStatus: access.status,
                serverNow: access.serverNow,
                unlockAt: access.unlockAt,
                expiresAt: access.expiresAt,
                message: accessMessage
            });
        }
        const meetLink = access.meetLink;

        const recipientEmail = recipientType === 'client'
            ? await resolveMeetingClientEmail(meeting)
            : parseEmailAddress(ADMIN_NOTIFICATION_EMAIL);
        if (!recipientEmail) {
            const message = recipientType === 'client'
                ? 'O cliente não possui um e-mail válido neste agendamento.'
                : 'O e-mail administrativo ainda não foi configurado no servidor.';
            return res.status(409).json({ status: 'error', message });
        }

        const shareKey = `${String(req.user?.username || 'admin').toLowerCase()}:${meetingId}:${recipientType}`;
        if (Number(recentMeetingShares.get(shareKey) || 0) > Date.now()) {
            return res.status(429).json({ status: 'error', message: 'Este convite acabou de ser enviado. Aguarde alguns segundos.' });
        }
        recentMeetingShares.set(shareKey, Date.now() + MEETING_SHARE_COOLDOWN_MS);

        const safeTitle = sanitizePlainText(meeting.title || 'Reunião ALDEIA').replace(/[\r\n]+/g, ' ').slice(0, 180);
        const clientGreeting = meeting.clientName ? `Olá, ${sanitizePlainText(meeting.clientName)}.` : 'Olá.';
        const subject = `Agência ALDEIA | ${safeTitle}`;
        const text = recipientType === 'client'
            ? [
                clientGreeting,
                '',
                `Sua reunião “${safeTitle}” está marcada para ${formatMeetingDateForEmail(meeting.startAt)}.`,
                `Acesse o Google Meet: ${meetLink}`,
                '',
                'Agência ALDEIA'
            ].join('\n')
            : [
                'Novo compartilhamento de reunião no CRM ALDEIA.',
                '',
                `Reunião: ${safeTitle}`,
                `Cliente: ${sanitizePlainText(meeting.clientName || 'Não informado')}`,
                `Horário: ${formatMeetingDateForEmail(meeting.startAt)}`,
                `Google Meet: ${meetLink}`,
                `Criado por: ${sanitizePlainText(meeting.createdBy || 'Admin')}`
            ].join('\n');

        try {
            await sendMeetingEmail({ to: recipientEmail, subject, text });
            console.info('[MEETING SHARE]', { meetingId, recipient: recipientType, sentBy: req.user?.username || 'admin' });
            return res.json({ status: 'success', recipient: recipientType });
        } catch (error) {
            recentMeetingShares.delete(shareKey);
            console.error('[MEETING SHARE SEND]', error.message);
            const statusCode = error.code === 'EMAIL_NOT_CONFIGURED' ? 503 : 502;
            return res.status(statusCode).json({
                status: 'error',
                message: statusCode === 503
                    ? 'O serviço de e-mail ainda não foi configurado.'
                    : 'Não foi possível enviar o e-mail agora.'
            });
        }
    }
);

async function cancelGoogleCalendarEvent(googleEventId) {
    if (!googleEventId || !isGoogleCalendarConfigured()) return { cancelled: false, skipped: true };
    const accessToken = await getGoogleCalendarAccessToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${encodeURIComponent(googleEventId)}`);
        url.searchParams.set('sendUpdates', 'all');
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal
        });
        if ([204, 404, 410].includes(response.status)) return { cancelled: true, skipped: false };
        throw new Error(`Google Calendar HTTP ${response.status}`);
    } finally {
        clearTimeout(timeout);
    }
}

app.delete('/api/meetings/:id', requireAuth, requireRole(['admin', 'operator']), validate(idParamsSchema, 'params'), async (req, res) => {
    const meetingId = req.validatedParams.id;
    const meeting = await findMeetingForShare(meetingId);
    if (!meeting) return res.status(404).json({ status: 'error', message: 'Agendamento não encontrado' });

    let googleWarning = '';
    if (meeting.googleEventId) {
        try {
            await cancelGoogleCalendarEvent(meeting.googleEventId);
        } catch (error) {
            googleWarning = 'O item foi removido do CRM, mas não foi possível confirmar o cancelamento no Google Calendar.';
            console.error('[MEETINGS DELETE GOOGLE]', { meetingId, message: error.message });
        }
    }

    let deleted = false;
    if (isMongoConnected) {
        try {
            const result = await MeetingModel.deleteOne({ id: meetingId });
            deleted = result.deletedCount > 0;
        } catch (error) {
            console.error('[MEETINGS DELETE MONGO]', { meetingId, message: error.message });
        }
    }

    await mutateJSON('meetings.json', [], (storedMeetings) => {
        const meetings = Array.isArray(storedMeetings) ? storedMeetings : [];
        const remaining = meetings.filter(item => item?.id !== meetingId);
        if (remaining.length !== meetings.length) deleted = true;
        return remaining;
    });

    if (!deleted) return res.status(503).json({ status: 'error', message: 'Não foi possível remover o agendamento agora.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ status: 'success', deletedId: meetingId, warning: googleWarning || undefined });
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

    const key = username.toLowerCase();
    let updatedProfile = null;
    await mutateJSON('user_profiles.json', {}, (storedProfiles) => {
        const profiles = storedProfiles && typeof storedProfiles === 'object' && !Array.isArray(storedProfiles) ? storedProfiles : {};
        updatedProfile = {
            ...(profiles[key] || { username, role: normalizeAccountRole('', username) }),
            ...updateFields
        };
        profiles[key] = updatedProfile;
        return profiles;
    });

    res.json({ status: 'success', message: 'Perfil atualizado com sucesso', profile: sanitizeProfileResponse(updatedProfile, username) });
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

        const key = username.toLowerCase();
        await mutateJSON('user_profiles.json', {}, (storedProfiles) => {
            const profiles = storedProfiles && typeof storedProfiles === 'object' && !Array.isArray(storedProfiles) ? storedProfiles : {};
            profiles[key] = { ...(profiles[key] || { username, role: normalizeAccountRole('', username) }), passwordHash };
            return profiles;
        });

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

app.post('/api/upload', requireAuth, uploadLimiter, (req, res) => {
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
        locationString: body.locationString,
        coordinates: body.coordinates,
        ipAddress: body.ipAddress
    });
    if (!leadResult.success) {
        return res.status(400).json({ status: 'error', message: 'Dados de contato inválidos.' });
    }
    const { nome, email, telefone, instagram, projeto: projetoSeguro, utmSource, utmMedium, utmCampaign, visits, firstVisit, locationConsent, locationString, coordinates, ipAddress } = leadResult.data;
    const locationCoords = coordinates || '';

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
        locationCoords,
        locationString: locationString || 'Localização Indisponível',
        ipAddress: ipAddress || '0.0.0.0'
    };

    if (isMongoConnected) {
        try {
            await SubmissionModel.create(newSubmission);
        } catch (e) {
            console.error('[SUBMISSION MONGO]', e.message);
        }
    }

    await mutateJSON('submissions.json', [], (submissions) => {
        const items = Array.isArray(submissions) ? submissions : [];
        items.push(newSubmission);
        return items;
    });

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

    await mutateJSON('submissions.json', [], (submissions) =>
        (Array.isArray(submissions) ? submissions : []).map(sub => {
            if (sub.id === id) {
                updated = true;
                return { ...sub, whatsappClicked: "Sim" };
            }
            return sub;
        })
    );

    if (updated) {
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
    const resetAt = getAnalyticsResetAt();
    const normalizedEvents = events
        .filter((event) => Date.parse(event.timestamp) >= resetAt)
        .map((event) => ({ ...event, timestamp: new Date().toISOString() }));

    if (normalizedEvents.length === 0) {
        return { storage: isMongoConnected ? 'mongo' : 'local', events: [] };
    }
    if (isMongoConnected) {
        await AnalyticsModel.insertMany(normalizedEvents);
        return { storage: 'mongo', events: normalizedEvents };
    }
    await mutateJSON('analytics.json', [], (storedEvents) => [
        ...normalizedEvents,
        ...(Array.isArray(storedEvents) ? storedEvents : [])
    ].slice(0, 1000));
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
        return res.status(503).json({ status: 'error', message: 'Analytics indisponível no momento.' });
    }
    // Fallback local: mantém um histórico limitado para o Analytics continuar útil sem MongoDB.
});

app.get('/api/analytics', requireAuth, requireRole(['admin']), async (req, res) => {
    return res.json(await readAnalyticsEvents());
});

function buildVisitorMetrics(events) {
    const source = Array.isArray(events) ? events : [];
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const sessionKey = (event, index) => String(event?.sessionId || `anonymous-${index}`);
    const sessionSetSince = (from) => new Set(source
        .map((event, index) => ({ event, index, time: new Date(event?.timestamp || event?.createdAt || 0).getTime() }))
        .filter(({ time }) => Number.isFinite(time) && time >= from && time <= now)
        .map(({ event, index }) => sessionKey(event, index))).size;

    return {
        today: sessionSetSince(todayStart.getTime()),
        week: sessionSetSince(weekStart.getTime()),
        total: new Set(source.map(sessionKey)).size
    };
}

app.get('/api/analytics/visits', requireAuth, requireRole(['admin']), async (req, res) => {
    const events = await readAnalyticsEvents();
    return res.json(buildVisitorMetrics(events));
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
        y: 0,
        timestamp: new Date().toISOString()
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
        return res.status(503).json({ status: 'error', message: 'Telemetria indisponível no momento.' });
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
            if (settings) return {
                externalAnalytics: settings.externalAnalytics !== false,
                sidebarLogo: typeof settings.sidebarLogo === 'string' ? settings.sidebarLogo : ''
            };
        } catch (error) { console.error('[ADMIN SETTINGS GET]', error.message); }
    }
    const settings = safeReadJSON('admin_settings.json', { externalAnalytics: true, sidebarLogo: '' });
    return {
        externalAnalytics: settings.externalAnalytics !== false,
        sidebarLogo: typeof settings.sidebarLogo === 'string' ? settings.sidebarLogo : ''
    };
}

app.get('/api/admin/settings', requireAuth, async (req, res) => {
    return res.json(await readAdminSettings());
});

app.put('/api/admin/settings', requireAuth, requireRole(['admin']), validate(adminSettingsPayloadSchema), async (req, res) => {
    const currentSettings = await readAdminSettings();
    const settings = {
        externalAnalytics: req.validatedBody.externalAnalytics,
        sidebarLogo: req.validatedBody.sidebarLogo ?? currentSettings.sidebarLogo
    };
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
    await safeWriteJSON('admin_settings.json', settings);
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
                AuditLogModel, TrelloTaskModel, MeetingModel, UserProfileModel, ProjectViewWindowModel,
                ProjectViewEventModel, AdminSettingsModel, GoogleCalendarIntegrationModel
            ].map(model => model.createIndexes()));
            return res.json({ status: 'success', message: 'Indices do MongoDB verificados.' });
        }
        if (action === 'clear_telemetry') {
            if (isMongoConnected) await Promise.all([AnalyticsModel.deleteMany({}), ProjectViewEventModel.deleteMany({}), ProjectViewWindowModel.deleteMany({})]);
            await Promise.all([
                safeWriteJSON('analytics.json', []),
                safeWriteJSON('visits.json', []),
                safeWriteJSON('project_view_events.json', []),
                safeWriteJSON('project_view_windows.json', {})
            ]);
            await markAnalyticsReset();
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
    if (scopes.has('meetings')) mongoActions.push(MeetingModel.deleteMany({}));
    if (scopes.has('views')) mongoActions.push(ProjectViewEventModel.deleteMany({}), ProjectViewWindowModel.deleteMany({}));
    try {
        if (isMongoConnected) await Promise.all(mongoActions);
        const localActions = [];
        if (scopes.has('analytics')) {
            localActions.push(safeWriteJSON('analytics.json', []), safeWriteJSON('visits.json', []));
            await markAnalyticsReset();
        }
        if (scopes.has('audit')) localActions.push(safeWriteJSON('login_audit.json', []));
        if (scopes.has('submissions')) localActions.push(safeWriteJSON('submissions.json', []));
        if (scopes.has('clients')) localActions.push(safeWriteJSON('clients.json', []));
        if (scopes.has('tasks')) localActions.push(safeWriteJSON('trello_tasks.json', []));
        if (scopes.has('meetings')) localActions.push(safeWriteJSON('meetings.json', []));
        if (scopes.has('views')) {
            localActions.push(
                safeWriteJSON('project_view_events.json', []),
                safeWriteJSON('project_view_windows.json', {})
            );
        }
        await Promise.all(localActions);
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
        meetings: safeReadJSON('meetings.json', []).map((meeting) => {
            const safeMeeting = sanitizeMeetingResponse(meeting);
            delete safeMeeting.meetLink;
            return safeMeeting;
        }),
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
        const escapeCSV = (field) => {
            let value = String(field ?? '').replace(/[\r\n]+/g, ' ');
            if (/^[=+\-@\t]/.test(value)) value = `'${value}`;
            return `"${value.replace(/"/g, '""')}"`;
        };
        csv += `${escapeCSV(s.id)},${escapeCSV(s.timestamp)},${escapeCSV(s.nome)},${escapeCSV(s.email)},${escapeCSV(s.telefone)},${escapeCSV(s.projeto)},${escapeCSV(s.whatsappClicked || 'Não')}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=aldeia_leads.csv');
    res.send(csv);
});

app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html' || req.path === '/portfolio.html')) {
        const visit = {
            timestamp: new Date().toISOString(),
            visitorHash: createVisitorFingerprint(req),
            path: req.path
        };
        void mutateJSON('visits.json', [], (visits) => {
            const items = Array.isArray(visits) ? visits : [];
            items.push(visit);
            return items.slice(-10_000);
        });
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
    return res.json(statsList);
});
app.use((req, res, next) => {
    if (!req.path.startsWith('/api/') && req.accepts('html')) {
        res.status(404).sendFile(path.join(ROOT_DIR, 'index.html'));
    } else {
        res.status(404).json({ status: 'error', message: 'Rota não encontrada' });
    }
});

app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err?.message || 'Erro desconhecido');
    if (res.headersSent) return next(err);
    const explicitStatus = Number(err?.statusCode);
    const status = explicitStatus >= 400 && explicitStatus < 600
        ? explicitStatus
        : (err instanceof multer.MulterError || err?.message === 'Origem não permitida.' ? 400 : 500);
    const publicMessage = status < 500
        ? sanitizePlainText(err?.message || 'Requisição inválida.').slice(0, 180)
        : 'Erro interno no servidor.';
    res.status(status).json({ status: 'error', message: publicMessage });
});

// ===== INICIAR SERVIDOR =====
let server;
bootstrapUserProfiles()
    .then(() => {
        server = app.listen(PORT, () => {
            console.log(`\n======================================================`);
            console.log(`  ALDEIA Servidor Backend Unificado (Node.js + Express)`);
            console.log(`  Porta: ${PORT}`);
            console.log(`  Banco de Dados: MongoDB Atlas (Nuvem) + Fallback JSON`);
            console.log(`  Uploads: Cloudinary`);
            console.log(`======================================================\n`);
        });

        const { Server } = require('socket.io');
        const io = new Server(server, {
            cors: {
                origin(origin, callback) {
                    const isLocalDevelopment = process.env.NODE_ENV !== 'production' && localDevelopmentOrigin.test(origin || '');
                    if (!origin || allowedOrigins.has(origin) || isLocalDevelopment) return callback(null, true);
                    return callback(new Error('Origem nÃ£o permitida.'));
                },
                methods: ['GET', 'POST']
            }
        });

        io.use((socket, next) => {
            const token = String(socket.handshake?.auth?.token || '').trim();
            const user = verifyToken({ headers: { authorization: token ? `Bearer ${token}` : '' } });
            if (!user || !['admin', 'operator'].includes(user.role)) return next(new Error('NÃ£o autorizado.'));
            socket.user = user;
            return next();
        });

        io.on('connection', (socket) => {
            console.log(`[Socket.io] CRM conectado: ${sanitizePlainText(socket.user?.username || 'usuÃ¡rio')}`);
        });

        whatsappService.on('message', (message) => {
            io.emit('wa_message', {
                id: sanitizePlainText(message?.id?._serialized || message?.id || ''),
                body: sanitizePlainText(message?.body || '').slice(0, 4000),
                fromMe: Boolean(message?.fromMe),
                timestamp: Number(message?.timestamp) || Math.floor(Date.now() / 1000),
                ack: Number(message?.ack) || 0,
                from: sanitizePlainText(message?.from || ''),
                to: sanitizePlainText(message?.to || '')
            });
        });

        // O cliente automatizado usa um navegador embutido; exige opt-in explícito.
        if (String(process.env.WHATSAPP_ENABLED || 'false').toLowerCase() === 'true') {
            void whatsappService.initialize().catch((error) => {
                console.error('[WHATSAPP INIT]', error?.message || 'Falha ao iniciar o WhatsApp.');
            });
        }
    })
    .catch((err) => {
        console.error('[AUTH] Inicialização abortada:', err?.message || 'Falha no bootstrap de usuários.');
        process.exitCode = 1;
    });

function shutdown() {
    if (!server) return process.exit(0);
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
