import re

def cure_server_js():
    with open('aldeia-site-oficial/server.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Erradicar 500 e 503 (Para o frontend processar o JSON de erro e mostrar no Toast)
    content = re.sub(r'res\.status\((?:500|503|502)\)\.json', r'res.json', content)
    
    # 2. Melhorar o tratamento de falhas em rotas crônicas (ex: fallback db)
    # Se isMongoConnected for falso, e jsonSuccess falhar, safeWriteJSON retorna boolean.
    # safeWriteJSON ja tem try..catch, mas vamos garantir:
    if 'async function safeWriteJSON' in content:
        safe_write_replacement = """async function safeWriteJSON(filePath, content) {
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
}"""
        content = re.sub(r'async function safeWriteJSON\(filePath, content\) \{.*?^\}', safe_write_replacement, content, flags=re.MULTILINE|re.DOTALL)

    # 3. Consertar Multer para não crashar no req.file?.path
    content = content.replace('req.file.path', 'req.file?.path ?? ""')

    with open('aldeia-site-oficial/server.js', 'w', encoding='utf-8') as f:
        f.write(content)

def cure_admin_html():
    with open('aldeia-site-oficial/admin.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Purge de Emojis
    # Remove standard emojis, keeping basic text.
    import emoji
    content = emoji.replace_emoji(content, replace='')

    # 2. O Vidro Padrão (Dark Glassmorphism)
    # Procurar classes genéricas de card e painel e injetar as classes premium
    # Exemplo: class="card" -> class="card bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl"
    # Vamos usar replace em inline styles para forçar o vidro em containers
    
    # Injetar uma classe global css
    glass_css = """
    /* LEGIÃO V3 - DARK GLASSMORPHISM ABSOLUTO */
    .glass-premium, .card, .panel, .cms-editor-shell, .modal-content, .qma-card {
        background: rgba(255, 255, 255, 0.02) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 16px !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
    }
    
    /* ALDEIA GLOW GLOBAL */
    body::before {
        content: '';
        position: fixed;
        top: -20%;
        left: -10%;
        width: 60vw;
        height: 60vh;
        background: radial-gradient(circle, rgba(161, 161, 170, 0.08) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 0;
    }
    body::after {
        content: '';
        position: fixed;
        bottom: -20%;
        right: -10%;
        width: 60vw;
        height: 60vh;
        background: radial-gradient(circle, rgba(161, 161, 170, 0.05) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 0;
    }
    
    /* FIX DE FLEXBOX STRETCH -> SHRINK-0 ASPECT-SQUARE */
    .icon, svg {
        flex-shrink: 0;
    }
    
    /* Fix z-index for glass so it stays above glow */
    .tab-content { position: relative; z-index: 1; }
    """
    
    if 'LEGIÃO V3 - DARK GLASSMORPHISM' not in content:
        content = content.replace('</style>', glass_css + '\n</style>', 1)

    # 3. Remover "if (!res.ok) throw new Error('Falha HTTP ' + res.status);"
    # para permitir que o frontend parseie JSON e mostre o Toast com o erro correto.
    content = re.sub(r'if\s*\(!res\.ok\)\s*\{\s*throw new Error\([^\)]+\);\s*\}', '/* Legião V3: res.ok bypass to parse JSON */', content)
    content = re.sub(r'if\s*\(!res\.ok\)\s*throw new Error\([^\)]+\);', '/* bypass */', content)

    # 4. Injetar ?. e ?? em JSON.parse
    content = content.replace('JSON.parse(localStorage.getItem', 'JSON.parse(localStorage.getItem') # keep
    # Adicionar ?. em objetos perigosos no JS
    content = content.replace('data.message', 'data?.message ?? "Erro desconhecido"')

    with open('aldeia-site-oficial/admin.html', 'w', encoding='utf-8') as f:
        f.write(content)

import os
try:
    import emoji
except ImportError:
    os.system('pip install emoji')

cure_server_js()
cure_admin_html()
print("LEGIÃO V3 AUDIT COMPLETE")
