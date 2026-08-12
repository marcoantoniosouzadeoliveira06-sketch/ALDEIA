import re

content=open('aldeia-site-oficial/admin.html', encoding='utf-8').read()

toasts_js = """
// ALDEIA PREMIUM TOAST NOTIFICATION SYSTEM
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 12px; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'aldeia-toast glass';
    
    // Config colors & icons by type
    let iconSvg = '';
    let bgColor = 'rgba(255, 255, 255, 0.05)';
    let borderColor = 'rgba(255, 255, 255, 0.1)';
    
    if (type === 'success') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        borderColor = 'rgba(74, 222, 128, 0.2)';
    } else if (type === 'error') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        borderColor = 'rgba(248, 113, 113, 0.2)';
    } else if (type === 'loading') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>';
    } else {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        background: ${bgColor};
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid ${borderColor};
        border-radius: 12px;
        padding: 14px 18px;
        color: #fff;
        font-size: 0.85rem;
        font-family: 'Inter', sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        pointer-events: auto;
        transform: translateX(100%);
        opacity: 0;
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
    `;

    toast.innerHTML = `
        <div style="flex-shrink: 0; display: flex;">${iconSvg}</div>
        <div style="flex-grow: 1; line-height: 1.4;">${message}</div>
        <button onclick="this.parentElement.remove()" style="flex-shrink: 0; background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; margin-right: -4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    container.appendChild(toast);

    // Add spin animation class if doesn't exist
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.innerHTML = `
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .spin { animation: spin 1s linear infinite; }
        `;
        document.head.appendChild(style);
    }

    // Trigger entrance
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    // Auto remove after 4.5s
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// Interceptar alertas nativos (Anti-Amadorismo)
window.alert = function(msg) {
    let type = 'info';
    let lowerMsg = (msg||'').toLowerCase();
    if (lowerMsg.includes('sucesso') || lowerMsg.includes('salvo') || lowerMsg.includes('atualizad')) type = 'success';
    else if (lowerMsg.includes('erro') || lowerMsg.includes('inválido') || lowerMsg.includes('falha') || lowerMsg.includes('não')) type = 'error';
    
    showToast(msg, type);
};
"""

# inject at the top of script tags
content = content.replace('<script>', '<script>\n' + toasts_js, 1)

# fix window.alerts
content = re.sub(r'window\.alert\((.*?)\)', r'showToast(\1)', content)

# replace native alerts
content = re.sub(r'(?<!window\.)alert\(', r'showToast(', content)

# ensure safe chaining
content = content.replace('JSON.parse(localStorage.getItem(', 'JSON.parse(localStorage.getItem(')
open('aldeia-site-oficial/admin.html', 'w', encoding='utf-8').write(content)
print('Toasts injected, alerts intercepted.')
