const qrcode = require('qrcode');
const EventEmitter = require('events');

class WhatsAppService extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.qrCodeBase64 = null;
        this.status = 'STARTING';
    }

    async initialize() {
        try {
            let Client;
            let LocalAuth;
            try {
                ({ Client, LocalAuth } = require('whatsapp-web.js'));
            } catch (_) {
                this.status = 'DISABLED';
                throw new Error('Runtime opcional do WhatsApp não está instalado neste ambiente.');
            }
            this.client = new Client({
                authStrategy: new LocalAuth({ clientId: 'ALDEIA_CRM' }),
                puppeteer: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            });

            this.client.on('qr', async (qr) => {
                try {
                    // whatsapp-web.js emite o QR como texto puro. Convertendo para Base64 Data URL.
                    this.qrCodeBase64 = await qrcode.toDataURL(qr);
                    this.status = 'AWAITING_QR';
                    this.emit('qr', this.qrCodeBase64);
                } catch (err) {
                    console.error('[WhatsAppService] Falha ao converter QR Code:', err);
                }
            });

            this.client.on('ready', () => {
                this.status = 'CONNECTED';
                this.qrCodeBase64 = null;
                this.emit('connected');
                console.log('[WhatsAppService] Engine pronta e sincronizada!');
            });

            // Listen to message_create to capture both incoming AND outgoing messages (from phone)
            this.client.on('message_create', async (msg) => {
                this.emit('message', msg);
            });

            this.client.on('authenticated', () => {
                this.status = 'AUTHENTICATED';
                this.emit('state', 'AUTHENTICATED');
            });

            this.client.on('auth_failure', msg => {
                console.error('[WhatsAppService] Falha de autenticação', msg);
                this.status = 'ERROR';
                this.emit('state', 'ERROR');
            });

            this.client.on('disconnected', (reason) => {
                console.log('[WhatsAppService] Desconectado:', reason);
                this.status = 'DISCONNECTED';
                this.qrCodeBase64 = null;
                this.emit('state', 'DISCONNECTED');
            });

            await this.client.initialize();
        } catch (error) {
            console.error('[WhatsAppService] Critical failure during initialization:', error);
            this.status = 'ERROR';
        }
    }

    async sendMessage(phone, message) {
        if (!['CONNECTED', 'AUTHENTICATED'].includes(this.status)) {
            throw new Error('Engine do WhatsApp offline ou aguardando autenticação.');
        }
        const to = phone.includes('@c.us') || phone.includes('@g.us') ? phone : `${phone.replace(/\D/g, '')}@c.us`;
        
        // Timeout para evitar hang infinito caso o Puppeteer falhe silenciosamente
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao enviar mensagem pelo WhatsApp')), 15000));
        return await Promise.race([
            this.client.sendMessage(to, message),
            timeoutPromise
        ]);
    }

    async getAllChats() {
        if (!['CONNECTED', 'AUTHENTICATED'].includes(this.status) || !this.client) {
            throw new Error('Engine do WhatsApp offline ou não autenticada.');
        }
        let chats = [];
        try {
            chats = await this.client.getChats();
        } catch (e) {
            console.warn('[WhatsAppService] getChats falhou, tentando getContacts fallback:', e.message);
            try {
                const contacts = await this.client.getContacts();
                return contacts.filter(c => c.name || c.pushname).map(c => {
                    const chatId = c.id && c.id._serialized ? c.id._serialized : (typeof c.id === 'string' ? c.id : String(c.number || Date.now()));
                    return {
                        id: chatId,
                        name: c.name || c.pushname || c.number || chatId.replace('@c.us', ''),
                        isGroup: Boolean(c.isGroup),
                        unreadCount: 0,
                        timestamp: Math.floor(Date.now() / 1000),
                        lastMessage: null
                    };
                });
            } catch (err2) {
                console.error('[WhatsAppService] Fallback getContacts também falhou:', err2.message);
                return [];
            }
        }

        if (!Array.isArray(chats)) return [];
        return chats.map(chat => {
            const chatId = chat.id && chat.id._serialized ? chat.id._serialized : (typeof chat.id === 'string' ? chat.id : String(chat.name || Date.now()));
            return {
                id: chatId,
                name: chat.name || chat.pushname || chatId.replace('@c.us', ''),
                isGroup: Boolean(chat.isGroup),
                unreadCount: chat.unreadCount || 0,
                timestamp: chat.timestamp || Math.floor(Date.now() / 1000),
                lastMessage: chat.lastMessage ? {
                    body: chat.lastMessage.body || '',
                    fromMe: Boolean(chat.lastMessage.fromMe),
                    timestamp: chat.lastMessage.timestamp || Math.floor(Date.now() / 1000),
                    ack: chat.lastMessage.ack !== undefined ? chat.lastMessage.ack : 0
                } : null
            };
        });
    }

    async getChatHistory(chatId, limit = 50) {
        if (!['CONNECTED', 'AUTHENTICATED'].includes(this.status)) {
            throw new Error('Engine do WhatsApp offline.');
        }
        const chat = await this.client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit });
        return messages.map(msg => ({
            id: msg.id._serialized,
            body: msg.body,
            fromMe: msg.fromMe,
            timestamp: msg.timestamp,
            ack: msg.ack
        }));
    }
}

module.exports = new WhatsAppService();
