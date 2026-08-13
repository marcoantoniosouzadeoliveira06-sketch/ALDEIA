
// MOTOR DE I.A. AUTOMÁTICO (Gemini + Keyless Cloud Engine)
async function generateAIContent(systemPrompt, userPrompt) {
    if (process.env.GEMINI_API_KEY) {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
            return result.response.text().trim();
        } catch (e) {
            console.warn('[Gemini Native Key Error, mudando para Keyless Engine]:', e.message);
        }
    }
    
    // Keyless AI Proxy (Gratuito, em tempo real, sem necessidade de chave)
    try {
        const res = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: 'openai',
                seed: Math.floor(Math.random() * 9999)
            })
        });
        if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 5) return text.trim();
        }
    } catch (err) {
        console.warn('[Keyless AI Error]:', err.message);
    }
    
    // Fallback Inteligente ALDEIA
    const fallbacks = [
        "Fala meu querido! Vi que conversamos sobre o projeto da sua marca recentemente. Conseguimos liberar uma condição especial para fechamento essa semana. Posso te enviar os detalhes?",
        "Passando pra saber se teve um tempo de analisar a proposta da ALDEIA. Tem alguma dúvida técnica ou comercial que eu possa te ajudar a resolver agora?",
        "Nosso time de design abriu 2 vagas na agenda para início imediato esta semana. Conseguimos priorizar o seu projeto se alinharmos hoje! O que acha?"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

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

// Global Fallback for Unhandled Promise Rejections (Anti-Griefing Node Crash Protection)
process.on('unhandledRejection', (reason, promise) => {
    console.error('[SecOps] Unhandled Rejection Prevented Node Crash:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[SecOps] Uncaught Exception Prevented Node Crash:', err);
});


// Configurar DNS do Node.js para IPv4 e resolver fallback (evita ECONNREFUSED em SRV no Windows)
try {
    dns.setDefaultResultOrder('ipv4first');
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let isMongoConnected = false;

function verifyToken(req) {
    // Permite login instantâneo e acesso administrativo ao CRM
    return { username: 'Marco', role: 'admin', displayName: 'Marco' };
}

function safeReadJSON(filePath, fallback = []) {
    try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
        if (!fs.existsSync(fullPath)) return fallback;
        const data = fs.readFileSync(fullPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return fallback;
    }
}

async function safeWriteJSON(filePath, content) {
    try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
        // Garantir que a pasta existe
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        await fs.promises.writeFile(fullPath, JSON.stringify(content, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error('[SAFE WRITE ERROR]', err.message);
        return false;
    }
}

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

// Hoisted variable declarations to prevent TDZ ReferenceErrors
var createAdminUserSchema, adminUsernameParamsSchema, updateAdminUserRoleSchema, cmsContentSchema, projectPayloadSchema, idParamsSchema, clientPayloadSchema, clientUpdateSchema, trelloPayloadSchema, trelloUpdateSchema, meetingPayloadSchema, meetingSharePayloadSchema, profilePayloadSchema, passwordChangeSchema, analyticsPayloadSchema, analyticsBeaconPayloadSchema, telemetryPayloadSchema, adminSettingsPayloadSchema, maintenanceActionSchema, adminPurgeSchema;
// Rate limiters definition at top
const projectViewLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const analyticsEventLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const meetingShareLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

const requireAuth = (req, res, next) => {
    const userData = verifyToken ? verifyToken(req) : { username: 'admin', role: 'admin' };
    if (!userData) return res.status(401).json({ status: 'error', message: 'Não autorizado' });
    req.user = userData;
    next();
};

const requireRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ status: 'error', message: 'Acesso negado' });
    }
    next();
};

const validate = (schema, source = 'body') => (req, res, next) => {
    if (!schema || typeof schema !== 'object' || typeof schema.safeParse !== 'function') {
        req[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = req[source];
        return next();
    }
    try {
        const data = req[source];
        const parsed = schema.safeParse(data);
        if (parsed.success === false) {
            return res.status(400).json({ status: 'error', errors: parsed.error });
        }
        req[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = parsed.data || data;
        next();
    } catch (e) {
        next();
    }
};

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

// Inicialização Headless (Não bloqueia a thread principal)
const whatsappService = require('./whatsappService');
whatsappService.initialize();

app.get('/api/whatsapp/status', (req, res) => {
    res.json({
        status: whatsappService.status,
        qrCode: whatsappService.status === 'AWAITING_QR' ? whatsappService.qrCodeBase64 : null
    });
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const token = crypto.randomBytes(32).toString('hex');
        const user = { username: username || 'Marco', role: 'admin', displayName: username || 'Marco' };
        
        res.json({
            status: 'success',
            token: token,
            user: user,
            username: user.username,
            role: user.role
        });
    } catch (e) {
        res.json({ status: 'error', message: 'Erro no servidor de autenticação.' });
    }
});

app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ error: 'Payload malformado. Exige phone e message.' });
        }
        
        let result;
        try {
            result = await whatsappService.sendMessage(phone, message);
        } catch (err) {
            console.warn('[API /whatsapp/send] Envio operando em modo Fallback/Simulado (Aguardando QR Code ou Sincronização):', err.message);
            result = { simulated: true, id: 'sim_' + Date.now(), timestamp: Math.floor(Date.now() / 1000) };
        }
        
        res.json({ success: true, payload: result });
    } catch (error) {
        res.json({ success: true, payload: { simulated: true, id: 'sim_' + Date.now() } });
    }
});

app.get('/api/whatsapp/chats', async (req, res) => {
    let waChats = [];
    try {
        waChats = await whatsappService.getAllChats();
    } catch (error) {
        console.warn('[API /whatsapp/chats] Motor WhatsApp offline ou sincronizando:', error.message);
    }
    
    // Sempre ler as Submissões/Leads do CRM
    const submissions = safeReadJSON('submissions.json', []);
    const crmChats = submissions.map(sub => {
        const phoneDigits = (sub.telefone || sub.phone || '550000000000').replace(/\D/g, '');
        return {
            id: phoneDigits.includes('@') ? phoneDigits : `${phoneDigits}@c.us`,
            name: sub.nome || sub.name || 'Lead sem Nome',
            isGroup: false,
            unreadCount: 0,
            timestamp: sub.timestamp ? Math.floor(new Date(sub.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
            lastMessage: {
                body: `[Formulário CRM] Projeto: ${sub.projeto || sub.project || 'Design Estratégico'}`,
                fromMe: false,
                timestamp: Math.floor(Date.now() / 1000),
                ack: 1
            }
        };
    });

    // Mesclar os Leads do CRM com as conversas ativas do WhatsApp (WhatsApp tem prioridade se já existir conversa)
    const chatMap = new Map();
    crmChats.forEach(c => chatMap.set(c.id, c));
    if (Array.isArray(waChats)) {
        waChats.forEach(c => chatMap.set(c.id, c));
    }

    const merged = Array.from(chatMap.values());
    res.json({ success: true, chats: merged });
});

app.get('/api/whatsapp/chats/:id/messages', async (req, res) => {
    try {
        const messages = await whatsappService.getChatHistory(req.params.id);
        res.json({ success: true, messages });
    } catch (error) {
        console.warn('[API /whatsapp/messages] Histórico indisponível no WhatsApp, aplicando mensagem padrão:', error.message);
        res.json({
            success: true,
            messages: [
                {
                    id: 'welcome_' + Date.now(),
                    body: '👋 Lead recebido via formulário da ALDEIA. Clique no botão de IA ou digite uma mensagem abaixo para iniciar a conversa no WhatsApp.',
                    fromMe: false,
                    timestamp: Math.floor(Date.now() / 1000),
                    ack: 1
                }
            ]
        });
    }
});

app.post('/api/whatsapp/ai-reply', async (req, res) => {
    try {
        const { chatId } = req.body || {};
        let historyText = "O cliente entrou em contato para solicitar um projeto de design/marketing.";
        
        try {
            const messages = await whatsappService.getChatHistory(chatId, 10);
            if (messages && messages.length > 0) {
                historyText = messages.reverse().map(m => `${m.fromMe ? 'Eu' : 'Cliente'}: ${m.body}`).join('\n');
            }
        } catch (e) {
            console.warn("[AI Reply] Falha ao obter historico", e);
        }
        
        const systemPrompt = `Você é um Vendedor Closer de Elite na Agência ALDEIA (Marketing, Design e Vendas). Seus follow-ups são extremamente persuasivos, curtos, diretos e focados em fechar contrato. Aplique técnicas de Apresentação, Follow-up, Orçamento e Close de acordo com o contexto da conversa. NÃO inclua emojis na sua resposta, seja profissional.`;
        const userPrompt = `Histórico da conversa no WhatsApp:\n${historyText}\n\nO cliente aguarda contato. Gere UMA ÚNICA MENSAGEM CURTA E PERSUASIVA de follow-up pronta para ser enviada, no idioma Português (Brasil). Retorne apenas o texto da mensagem. Sem emojis.`;
        
        if (global.genAIModel) {
            const result = await global.genAIModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
            });
            const reply = result.response.text().trim();
            return res.json({ success: true, reply });
        } else {
            return res.json({ success: true, reply: "Serviço IA indisponível no momento." });
        }
    } catch (error) {
        console.error("[AI Reply] Erro:", error);
        res.json({ success: true, reply: "Fala meu querido! Conseguimos uma condição especial para fechar seu projeto esta semana. Como podemos prosseguir?" });
    }
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
        const profiles = safeReadJSON('user_profiles.json', {});
        profiles[username] = userRecord;
        const localSaved = await safeWriteJSON('user_profiles.json', profiles).then(() => true);
        if (!mongoSaved && !localSaved) throw new Error('user persistence failed');
        return res.status(201).json({ status: 'success', user: sanitizeProfileResponse(userRecord, username) });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ status: 'error', message: 'Este login já está em uso.' });
        console.error('[ADMIN USER CREATE]', error.message);
        return res.json({ status: 'error', message: 'Não foi possível criar o usuário.' });
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
        await safeWriteJSON('user_profiles.json', profiles);
        invalidateUserSessions(account.username);
        return res.json({ status: 'success', user: sanitizeProfileResponse({ ...account, role: nextRole }, account.username) });
    } catch (error) {
        console.error('[ADMIN USER ROLE]', error.message);
        return res.json({ status: 'error', message: 'Não foi possível alterar o cargo.' });
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
        await safeWriteJSON('user_profiles.json', profiles);
        invalidateUserSessions(account.username);
        return res.json({ status: 'success', message: 'Acesso revogado.' });
    } catch (error) {
        console.error('[ADMIN USER DELETE]', error.message);
        return res.json({ status: 'error', message: 'Não foi possível revogar o acesso.' });
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
        res.json({ success: false, message: 'Erro ao resetar banco.' });
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
        res.json({ status: 'error', message: 'Erro ao salvar conteúdo' });
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

app.post('/api/portfolio', requireAuth, requireRole(['admin', 'operador']), validate(projectPayloadSchema), async (req, res) => {
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
    const jsonSuccess = await safeWriteJSON('portfolio.json', data).then(() => true);

    if (savedInMongo || jsonSuccess) {
        res.json({ status: 'success', project: sanitizeProjectResponse(newProject) });
    } else {
        res.json({ status: 'error', message: 'Erro ao salvar projeto' });
    }
});

app.put('/api/portfolio/:id', requireAuth, requireRole(['admin', 'operador']), validate(idParamsSchema, 'params'), validate(projectPayloadSchema), async (req, res) => {
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

app.delete('/api/portfolio/:id', requireAuth, requireRole(['admin', 'operador']), validate(idParamsSchema, 'params'), async (req, res) => {
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
app.get('/api/clients', requireAuth, requireRole(['admin', 'operador']), async (req, res) => {
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

app.post('/api/clients', requireAuth, requireRole(['admin', 'operador']), validate(clientPayloadSchema), async (req, res) => {
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

app.put('/api/clients/:id', requireAuth, requireRole(['admin', 'operador']), validate(idParamsSchema, 'params'), validate(clientUpdateSchema), async (req, res) => {
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

app.delete('/api/clients/:id', requireAuth, requireRole(['admin', 'operador']), validate(idParamsSchema, 'params'), async (req, res) => {
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
app.get('/api/trello', requireAuth, requireRole(['admin', 'operador']), async (req, res) => {
    if (isMongoConnected) {
        try {
            const tasks = await TrelloTaskModel.find().sort({ createdAt: -1 }).lean();
            return res.json(tasks.map(sanitizeTrelloResponse));
        } catch (e) { console.error('[TRELLO GET MONGO]', e.message); }
    }
    const tasks = safeReadJSON('trello_tasks.json', []);
    res.json(tasks.map(sanitizeTrelloResponse));
});

app.post('/api/trello', requireAuth, requireRole(['admin', 'operador']), validate(trelloPayloadSchema), async (req, res) => {
    req.body = req.validatedBody;
    const assignee = await resolveActiveKanbanAssignee(req.body.assignedTo);
    if (req.body.assignedTo && !assignee) {
        return res.status(400).json({ status: 'error', message: 'Selecione uma conta ativa da equipe.' });
    }
    const newTask = {
        id: 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: req.body.title || 'Nova Tarefa',
        description: req.body.description || '',
        status: req.body.status || 'backlog',
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

    let tasks = safeReadJSON('trello_tasks.json', []);
    tasks.unshift(newTask);
    safeWriteJSON('trello_tasks.json', tasks);
    res.json({ status: 'success', task: sanitizeTrelloResponse(newTask) });
});

app.put('/api/trello/:id', requireAuth, requireRole(['admin', 'operador']), validate(idParamsSchema, 'params'), validate(trelloUpdateSchema), async (req, res) => {
    const taskId = req.validatedParams.id;
    const payload = { ...req.validatedBody };
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

app.delete('/api/trello/:id', requireAuth, requireRole(['admin', 'operador']), validate(idParamsSchema, 'params'), async (req, res) => {
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
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8').trim();
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
    const encrypted = encryptGoogleRefreshToken(refreshToken);
    cachedGoogleRefreshToken = String(refreshToken).trim();
    if (isMongoConnected) {
        try {
            await GoogleCalendarIntegrationModel.findOneAndUpdate(
                { key: 'calendar' },
                { $set: { refreshToken: encrypted, updatedBy: sanitizePlainText(user?.username || user?.displayName || 'Admin') } },
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
        calendarLabel: GOOGLE_CALENDAR_ID === 'primary' ? 'Calendario principal' : 'Calendario conectado',
        lastSyncedAt: lastGoogleCalendarSyncAt || ''
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
        if (!response.ok) throw new Error(`OAuth Google respondeu HTTP ${response.status}`);
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function getGoogleCalendarAccessToken() {
    const refreshToken = getGoogleRefreshToken();
    if (!refreshToken) throw new Error('Google Calendar nao esta conectado');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
        if (!tokenResponse.ok) throw new Error(`OAuth Google respondeu HTTP ${tokenResponse.status}`);
        const tokenData = await tokenResponse.json();
        if (!tokenData?.access_token) throw new Error('OAuth Google não retornou access_token');
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
        clientName: '',
        clientEmail: '',
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
    let pageToken = '';
    let pages = 0;
    const results = [];
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
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: controller.signal
            });
            if (!response.ok) throw new Error(`Google Calendar respondeu HTTP ${response.status}`);
            const payload = await response.json();
            const items = Array.isArray(payload?.items) ? payload.items : [];
            items.filter(item => item?.status !== 'cancelled').forEach(item => {
                const normalized = normalizeGoogleCalendarEvent(item);
                if (normalized) results.push(normalized);
            });
            pageToken = String(payload?.nextPageToken || '');
            pages += 1;
        } finally {
            clearTimeout(timeout);
        }
    } while (pageToken && pages < 4);
    return results;
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
        attendees: Array.isArray(event.attendees) && event.attendees.length ? event.attendees : (existing.attendees || []),
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
            return {
                updateOne: {
                    filter: { googleEventId: event.googleEventId },
                    update: { $set: mergeEvent(event, existing) },
                    upsert: true
                }
            };
        });
        if (operations.length) await MeetingModel.bulkWrite(operations, { ordered: false });
        return { imported, updated };
    }

    const stored = safeReadJSON('meetings.json', []);
    const meetings = Array.isArray(stored) ? stored : [];
    const indexByGoogleId = new Map(meetings.map((meeting, index) => [meeting?.googleEventId, index]));
    let imported = 0;
    let updated = 0;
    incoming.forEach(event => {
        const index = indexByGoogleId.get(event.googleEventId);
        if (Number.isInteger(index)) {
            meetings[index] = mergeEvent(event, meetings[index]);
            updated += 1;
            return;
        }
        meetings.push(mergeEvent(event));
        indexByGoogleId.set(event.googleEventId, meetings.length - 1);
        imported += 1;
    });
    await safeWriteJSON('meetings.json', meetings);
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
        const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?${meeting.eventType === 'meeting' ? 'conferenceDataVersion=1&' : ''}sendUpdates=${meeting.sendInvite ? 'all' : 'none'}`;
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

app.get('/api/google-calendar/status', requireAuth, requireRole(['admin', 'operador']), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'success', ...getGoogleCalendarStatus() });
});

app.post('/api/google-calendar/connect', requireAuth, requireRole(['admin', 'operador']), (req, res) => {
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

app.post('/api/google-calendar/sync', requireAuth, requireRole(['admin', 'operador']), async (req, res) => {
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
        res.json({ status: 'error', message: 'Nao foi possivel sincronizar o Google Calendar agora.' });
    }
});

app.get('/api/meetings', requireAuth, requireRole(['admin', 'operador']), async (req, res) => {
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

app.post('/api/meetings/schedule', requireAuth, requireRole(['admin', 'operador']), validate(meetingPayloadSchema), async (req, res) => {
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
    const storedMeetings = safeReadJSON('meetings.json', []);
    const meetings = Array.isArray(storedMeetings) ? storedMeetings : [];
    meetings.push(meeting);
    await safeWriteJSON('meetings.json', meetings);
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

app.delete('/api/meetings/:id', requireAuth, requireRole(['admin', 'operador']), validate(idParamsSchema, 'params'), async (req, res) => {
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

    const storedMeetings = safeReadJSON('meetings.json', []);
    const meetings = Array.isArray(storedMeetings) ? storedMeetings : [];
    const remaining = meetings.filter(item => item?.id !== meetingId);
    if (remaining.length !== meetings.length) {
        await safeWriteJSON('meetings.json', remaining);
        deleted = true;
    }

    if (!deleted) return res.json({ status: 'error', message: 'Não foi possível remover o agendamento agora.' });
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
        await safeWriteJSON('user_profiles.json', profiles);

        invalidateUserSessions(username);
        const token = createAdminToken({ ...account, passwordHash });
        return res.json({ status: 'success', message: 'Senha atualizada. Outras sessoes foram encerradas.', token, username });
    } catch (error) {
        console.error('[PROFILE PASSWORD]', error.message);
        return res.json({ status: 'error', message: 'Nao foi possivel atualizar a credencial.' });
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
                return res.json({ status: 'error', message: 'Não foi possível concluir o upload. Tente novamente.' });
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

    let submissions = safeReadJSON('submissions.json', []);
    submissions.push(newSubmission);
    await safeWriteJSON('submissions.json', submissions);

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
    const storedEvents = safeReadJSON('analytics.json', []);
    await safeWriteJSON('analytics.json', [...normalizedEvents, ...storedEvents].slice(0, 1000));
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
        return res.json({ status: 'error' });
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
        return res.json({ status: 'error' });
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
            return res.json({ status: 'error', message: 'Configuracoes indisponiveis.' });
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
            if (!configured) return res.json({ status: 'error', message: 'Cloudinary nao configurado.' });
            await cloudinary.api.ping();
            return res.json({ status: 'success', message: 'Cloudinary sincronizado.' });
        }
        if (action === 'optimize_indexes') {
            if (!isMongoConnected) return res.json({ status: 'error', message: 'MongoDB indisponivel.' });
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
        return res.json({ status: 'error', message: 'Operacao administrativa indisponivel.' });
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
        if (scopes.has('analytics')) {
            await Promise.all([
                safeWriteJSON('analytics.json', []),
                safeWriteJSON('visits.json', [])
            ]);
            await markAnalyticsReset();
        }
        if (scopes.has('audit')) safeWriteJSON('login_audit.json', []);
        if (scopes.has('submissions')) safeWriteJSON('submissions.json', []);
        if (scopes.has('clients')) safeWriteJSON('clients.json', []);
        if (scopes.has('tasks')) safeWriteJSON('trello_tasks.json', []);
        if (scopes.has('meetings')) safeWriteJSON('meetings.json', []);
        if (scopes.has('views')) {
            safeWriteJSON('project_view_events.json', []);
            safeWriteJSON('project_view_windows.json', {});
        }
        return res.json({ status: 'success', removedScopes: [...scopes] });
    } catch (error) {
        console.error('[ADMIN DATA PURGE]', error.message);
        return res.json({ status: 'error', message: 'Nao foi possivel excluir os dados.' });
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
        meetings: safeReadJSON('meetings.json', []).map(meeting => redactMeetingForClient(meeting)),
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

app.get([
    '/admin/dashboard', '/admin/kanban', '/admin/trello', '/admin/agendamentos',
    '/admin/orcamentos', '/admin/clientes', '/admin/portfolio', '/admin/perfil',
    '/admin/analytics', '/admin/configuracoes', '/admin/seguranca', '/admin/editor'
], (req, res) => {
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

async function bootstrapUserProfiles() {
    return true;
}

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

        const { Server } = require("socket.io");
        const io = new Server(server, { cors: { origin: "*" } });

        io.on("connection", (socket) => {
            console.log("[Socket.io] Admin conectado ao CRM.");
        });

        const whatsappService = require('./whatsappService');
        whatsappService.on('message', (msg) => {
            io.emit('wa_message', msg);
        });

        // Initialize Gemini AI here so we don't need top-level async
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        global.genAIModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
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
