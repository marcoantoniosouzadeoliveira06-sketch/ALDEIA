import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Send, CheckCircle2, AlertCircle, Loader2, MessageSquare, 
    Clock, UploadCloud, BellOff, Bell, CalendarClock, 
    Users, Activity, Smartphone, Battery, ChevronRight
} from 'lucide-react';

export default function WhatsAppTab({ leads = [] }) {
    // FASE 4 & 10: Estado da Conexão e API Health
    const [waStatus, setWaStatus] = useState('STARTING');
    const [qrCode, setQrCode] = useState(null);
    const [battery, setBattery] = useState(85); // Mocked battery
    const [latency, setLatency] = useState(24); // Mocked latency
    
    // FASE 1: Split-View
    const [activeLead, setActiveLead] = useState(null);
    const [filter, setFilter] = useState('Follow-up');
    const [selectedLeads, setSelectedLeads] = useState(new Set()); // FASE 9: Broadcast
    
    // FASE 2: Mensageria & Dropzone
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    // FASE 2: Deep Work Mute
    const [muteMode, setMuteMode] = useState(false);

    // Mock API Fetch
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            setWaStatus(data.status);
            if (data.status === 'AWAITING_QR' && data.qrCode) {
                setQrCode(data.qrCode);
            } else if (data.status === 'CONNECTED' || data.status === 'CONNECTED_EXT') {
                setQrCode(null);
                setLatency(Math.floor(Math.random() * (45 - 15 + 1) + 15)); // Atualiza latência
            }
        } catch (err) {
            console.error('API Health Check Failed', err);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // FASE 2: Quick Replies (Smart)
    const quickReplies = [
        { label: 'Apresentação', template: 'Olá {nome}, tudo bem? Sou da equipe da ALDEIA. Segue nossa apresentação oficial sobre {projeto}.' },
        { label: 'Follow-up', template: 'Oi {nome}! Passando para saber se conseguiu dar uma olhada na nossa proposta enviada ontem.' },
        { label: 'Orçamento', template: '{nome}, seu orçamento para o projeto de {projeto} acaba de ser liberado no nosso portal.' }
    ];

    const applyTemplate = (template) => {
        if (!activeLead) return;
        let text = template.replace(/{nome}/g, activeLead.nome.split(' ')[0]);
        text = text.replace(/{projeto}/g, activeLead.projeto || 'Design');
        setMessageText(text);
    };

    // FASE 1: Ghost Lead Radar (Lógica Mockada > 48h inativo)
    const isGhostLead = (timestamp) => {
        if (!timestamp) return true;
        // Mocking: se não tiver 'hoje', consideramos ghost
        return !timestamp.includes('Hoje');
    };

    // FASE 9: Broadcast Selection
    const toggleLeadSelection = (e, id) => {
        e.stopPropagation();
        const newSet = new Set(selectedLeads);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedLeads(newSet);
    };

    // Drag & Drop
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); /* Process File */ };

    const isConnected = waStatus === 'CONNECTED' || waStatus === 'CONNECTED_EXT';

    return (
        <div className="relative w-full h-full min-h-screen bg-[#030303] text-zinc-300 overflow-hidden flex font-sans">
            {/* ALDEIA GLOW */}
            <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-zinc-400/5 blur-[120px] pointer-events-none rounded-full" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-zinc-500/5 blur-[100px] pointer-events-none rounded-full" />

            {/* FEATURE 10: Painel de Saúde da API (Absolute Top Right) */}
            <div className="absolute top-6 right-6 z-40 flex items-center gap-4 bg-white/[0.02] border border-white/5 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-2xl">
                <div className="flex items-center gap-2">
                    <Activity className={`w-4 h-4 ${isConnected ? 'text-emerald-500' : 'text-amber-500'}`} />
                    <span className="text-xs font-medium tracking-widest uppercase text-zinc-400">{latency}ms</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-zinc-400" />
                    <Battery className={`w-4 h-4 ${battery > 20 ? 'text-emerald-500' : 'text-red-500'}`} />
                    <span className="text-xs font-medium text-zinc-400">{battery}%</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                {/* FEATURE 6: Deep Work Mute Mode */}
                <button onClick={() => setMuteMode(!muteMode)} className="transition-colors hover:text-white">
                    {muteMode ? <BellOff className="w-4 h-4 text-red-400" /> : <Bell className="w-4 h-4 text-zinc-400" />}
                </button>
            </div>

            {/* FEATURE 1: Split-View Coluna Esquerda */}
            <div className="w-[420px] border-r border-white/5 bg-white/[0.01] backdrop-blur-3xl flex flex-col z-10 relative shadow-[10px_0_30px_-10px_rgba(0,0,0,0.5)]">
                <div className="p-8 border-b border-white/5">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-medium tracking-tight text-white flex items-center gap-3">
                            <MessageSquare className="w-6 h-6 text-zinc-400" />
                            Pipeline
                        </h2>
                        {/* Status Badge */}
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${isConnected ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-amber-500/20 bg-amber-500/5 text-amber-400'} text-xs font-medium uppercase tracking-widest shadow-inner`}>
                            {isConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {isConnected ? 'Sync On' : 'Connecting'}
                        </div>
                    </div>
                    
                    {/* Filtros e Broadcast */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                            {['Follow-up', 'Fechado'].map(f => (
                                <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${filter === f ? 'bg-zinc-200 text-black shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                    {f}
                                </button>
                            ))}
                        </div>
                        {/* FEATURE 9: Broadcast Mode Toggle */}
                        <button className="p-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-zinc-400 transition-all">
                            <Users className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {leads.map(lead => {
                        const isGhost = isGhostLead(lead.timestamp);
                        const isSelected = selectedLeads.has(lead.id);
                        
                        return (
                        <div 
                            key={lead.id} 
                            onClick={() => setActiveLead(lead)}
                            className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-500 border overflow-hidden
                                ${activeLead?.id === lead.id ? 'bg-white/[0.04] border-white/20 shadow-2xl scale-[1.02]' : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'}
                                ${isGhost ? 'shadow-[0_0_15px_rgba(239,68,68,0.05)]' : ''}
                            `}
                        >
                            {/* FEATURE 2: Ghost Lead Glow Effect */}
                            {isGhost && <div className="absolute top-0 left-0 w-1 h-full bg-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />}
                            
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-zinc-100 font-medium text-lg tracking-tight">{lead.nome}</h4>
                                    <p className="text-zinc-500 text-sm mt-1">{lead.projeto || 'Design Estratégico'}</p>
                                </div>
                                <div onClick={(e) => toggleLeadSelection(e, lead.id)} className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-zinc-200 border-zinc-200 text-black' : 'border-white/10 opacity-0 group-hover:opacity-100'}`}>
                                    {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mt-4 text-xs font-medium">
                                <div className={`flex items-center gap-1.5 ${isGhost ? 'text-red-400' : 'text-zinc-500'}`}>
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{isGhost ? '+48h sem contato' : (lead.timestamp || 'Hoje')}</span>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            </div>

            {/* Coluna Direita: Central de Disparo */}
            <div className="flex-1 flex flex-col z-10 relative bg-black/20"
                 onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                
                {/* FEATURE 5: Asset Dropzone Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-2 border-dashed border-zinc-500 rounded-3xl m-4 flex flex-col items-center justify-center">
                        <UploadCloud className="w-16 h-16 text-zinc-400 mb-4 animate-bounce" />
                        <h2 className="text-2xl text-white font-medium">Solte o arquivo para enviar</h2>
                        <p className="text-zinc-500 mt-2">Mídia, PDF ou Portfólio</p>
                    </div>
                )}

                {activeLead ? (
                    <>
                        {/* Chat Header */}
                        <div className="px-10 py-8 border-b border-white/5 bg-white/[0.01] flex justify-between items-center backdrop-blur-md">
                            <div>
                                <h3 className="text-3xl font-medium text-white tracking-tight">{activeLead.nome}</h3>
                                <p className="text-zinc-400 mt-2 font-mono text-sm tracking-widest">{activeLead.telefone}</p>
                            </div>
                            {/* FEATURE 8: Auto-Tagging Status Suggestion (Simulado) */}
                            <button className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-zinc-300 transition-all flex items-center gap-2">
                                Fechar Negócio
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {/* Histórico Vazio */}
                        <div className="flex-1 p-10 overflow-y-auto">
                            <div className="flex flex-col gap-6 max-w-4xl mx-auto h-full justify-end">
                                <div className="text-center text-xs text-zinc-600 font-medium uppercase tracking-widest my-8">
                                    Conexão Criptografada End-to-End
                                </div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-10 border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
                            <div className="max-w-4xl mx-auto">
                                
                                {/* FEATURE 4: Smart Quick Replies */}
                                <div className="flex gap-3 mb-4 overflow-x-auto custom-scrollbar pb-2">
                                    {quickReplies.map((qr, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => applyTemplate(qr.template)}
                                            className="whitespace-nowrap px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl text-xs font-medium text-zinc-300 transition-all"
                                        >
                                            {qr.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-4">
                                    <textarea 
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        placeholder="Redija a mensagem..."
                                        className="flex-1 bg-[#050505] border border-white/10 rounded-2xl p-5 text-zinc-200 outline-none focus:border-zinc-400 focus:bg-[#080808] transition-all resize-none min-h-[140px] shadow-inner font-medium leading-relaxed"
                                    />
                                    <div className="flex flex-col gap-3 w-[220px]">
                                        <button 
                                            disabled={!isConnected || isSending || !messageText.trim()}
                                            className="h-16 px-8 bg-zinc-200 hover:bg-white text-zinc-950 font-medium rounded-2xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:-translate-y-0.5"
                                        >
                                            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                            Disparar
                                        </button>
                                        
                                        {/* FEATURE 7: One-Click Follow-up Tracker */}
                                        <button className="flex-1 flex items-center justify-center gap-2 px-4 bg-white/5 hover:bg-white/10 text-zinc-400 text-sm font-medium rounded-2xl transition-all border border-white/5">
                                            <CalendarClock className="w-4 h-4" />
                                            Lembrar em 24h
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                        <div className="w-24 h-24 rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center mb-6 shadow-2xl">
                            <MessageSquare className="w-10 h-10 opacity-20" />
                        </div>
                        <h2 className="text-xl font-medium text-zinc-300">Nenhum Lead Selecionado</h2>
                        <p className="mt-2 text-sm">Selecione um cliente no pipeline à esquerda.</p>
                    </div>
                )}
            </div>

            {/* FEATURE 3: Glass QR Authentication Modal */}
            <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${waStatus === 'AWAITING_QR' ? 'opacity-100 visible backdrop-blur-2xl bg-black/60' : 'opacity-0 invisible pointer-events-none'}`}>
                <div className={`relative p-12 rounded-[2rem] flex flex-col items-center bg-[#050505]/95 border border-white/10 shadow-[0_60px_120px_-20px_rgba(0,0,0,1)] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${waStatus === 'AWAITING_QR' ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'}`}>
                    
                    {/* Efeito Glow Interno */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/10 to-transparent rounded-[2rem] pointer-events-none" />
                    
                    <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mb-6 shadow-inner">
                        <Smartphone className="w-8 h-8 text-zinc-300" />
                    </div>

                    <h3 className="text-white text-3xl font-medium mb-3 tracking-tight">Sync OpenWA</h3>
                    <p className="text-zinc-400 text-sm mb-10 text-center max-w-[320px] leading-relaxed">
                        Abra o WhatsApp no seu celular, acesse <strong>Aparelhos Conectados</strong> e aponte para o código.
                    </p>

                    <div className="w-80 h-80 bg-white rounded-3xl flex items-center justify-center overflow-hidden border-4 border-white/10 relative p-4 shadow-2xl">
                        {qrCode ? (
                            <img src={qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain filter contrast-125" />
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-8 h-8 text-zinc-800 animate-spin" />
                                <span className="text-zinc-800 text-xs font-bold uppercase tracking-[0.2em]">Interceptando Engine...</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-10 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                        <AlertCircle className="w-4 h-4" />
                        Ponte End-to-End Segura
                    </div>
                </div>
            </div>
        </div>
    );
}
