const fs = require('fs');

const jsContent = fs.readFileSync('admin_js_only.txt', 'utf8');
const oldHtml = fs.readFileSync('admin.html', 'utf8');

const cmsStart = oldHtml.indexOf('<div id="editor-tab" class="tab-content">');
let cmsEnd = oldHtml.indexOf('</main>');

// We only need the inner HTML of the editor-tab
const cmsHtml = oldHtml.substring(cmsStart, cmsEnd);

const newHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALDEIA | CRM Administrativo</title>
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        :root {
            --bg-color: #080808;
            --sidebar-bg: #111111;
            --card-bg: #151515;
            --card-border: rgba(255,255,255,0.05);
            --text-main: #ffffff;
            --text-muted: #888888;
            --accent: #e0e0e0;
            --font-main: 'Inter', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: var(--font-main);
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-main);
            overflow-x: hidden;
        }

        /* ----- LOGIN SCREEN ----- */
        .login-container {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: radial-gradient(circle at center, #1a1a1a 0%, #000 100%);
        }
        .login-box {
            background: rgba(20,20,20,0.8);
            backdrop-filter: blur(20px);
            border: 1px solid var(--card-border);
            padding: 40px;
            border-radius: 16px;
            width: 100%;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .login-box h2 {
            font-size: 1.5rem;
            margin-bottom: 20px;
            font-weight: 500;
            letter-spacing: 1px;
        }
        .login-input {
            width: 100%;
            padding: 14px;
            margin-bottom: 15px;
            background: #000;
            border: 1px solid var(--card-border);
            color: #fff;
            border-radius: 8px;
            font-size: 1rem;
            outline: none;
            transition: all 0.3s ease;
        }
        .login-input:focus {
            border-color: #666;
            background: #0a0a0a;
        }
        .btn-login {
            width: 100%;
            padding: 14px;
            background: #fff;
            color: #000;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1rem;
        }
        .btn-login:hover {
            background: #ccc;
        }

        /* ----- MAIN CRM LAYOUT ----- */
        #admin-dashboard {
            display: none;
            height: 100vh;
        }
        .crm-wrapper {
            display: flex;
            height: 100vh;
        }
        
        /* SIDEBAR */
        .sidebar {
            width: 260px;
            background: var(--sidebar-bg);
            border-right: 1px solid var(--card-border);
            display: flex;
            flex-direction: column;
            padding: 30px 20px;
            flex-shrink: 0;
        }
        .sidebar-logo {
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: 2px;
            margin-bottom: 50px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .sidebar-nav {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .nav-item {
            padding: 14px 16px;
            border-radius: 8px;
            color: var(--text-muted);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .nav-item:hover {
            color: #fff;
            background: rgba(255,255,255,0.03);
        }
        .nav-item.active {
            color: #000;
            background: #fff;
        }
        .nav-item.active svg {
            stroke: #000;
        }
        
        /* MAIN CONTENT */
        .main-content {
            flex-grow: 1;
            padding: 30px 40px;
            overflow-y: auto;
            background: var(--bg-color);
        }
        
        /* HEADER BAR */
        .topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
        }
        .page-title {
            font-size: 1.8rem;
            font-weight: 600;
        }
        .user-profile {
            display: flex;
            align-items: center;
            gap: 15px;
            background: var(--card-bg);
            padding: 8px 16px;
            border-radius: 50px;
            border: 1px solid var(--card-border);
        }
        .user-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #333;
            object-fit: cover;
        }
        .user-greeting {
            font-size: 0.9rem;
            color: var(--text-muted);
        }
        .user-name {
            font-weight: 600;
            color: #fff;
        }
        .btn-logout {
            background: none;
            border: none;
            color: #ff4444;
            cursor: pointer;
            font-size: 0.85rem;
            margin-left: 10px;
        }

        /* ----- TABS & CARDS ----- */
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        .grid-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .crm-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .crm-card-title {
            font-size: 0.85rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .crm-card-value {
            font-size: 2.2rem;
            font-weight: 600;
            color: #fff;
        }

        /* TABLES */
        .table-container {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            text-align: left;
            padding: 16px 20px;
            font-size: 0.8rem;
            text-transform: uppercase;
            color: var(--text-muted);
            border-bottom: 1px solid var(--card-border);
            font-weight: 600;
            background: rgba(255,255,255,0.02);
        }
        td {
            padding: 16px 20px;
            border-bottom: 1px solid var(--card-border);
            font-size: 0.9rem;
            vertical-align: middle;
        }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); }

        .badge-geo {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            background: rgba(255,255,255,0.1);
            color: #ccc;
        }
        .badge-whatsapp-clicked {
            font-size: 0.75rem;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            display: inline-block;
        }
        .clicked-yes { background: rgba(255, 255, 255, 0.15); color: #fff; border: 1px solid rgba(255, 255, 255, 0.3); }
        .clicked-no { background: rgba(0, 0, 0, 0.5); color: #888; border: 1px solid rgba(255, 255, 255, 0.1); }
        
        /* Buttons */
        .btn-action {
            padding: 8px 14px;
            border-radius: 6px;
            background: #fff;
            color: #000;
            border: none;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-action.dark {
            background: #222;
            color: #fff;
            border: 1px solid #444;
        }
        .btn-action:hover { opacity: 0.9; }

        /* Map Container */
        #leads-map {
            height: 350px;
            border-radius: 12px;
            background: #111;
        }
        .leaflet-container { background: #0b0b0b !important; }
        .leaflet-bar a { background-color: #111 !important; color: #fff !important; border-bottom: 1px solid #222 !important; }
        .leaflet-bar a:hover { background-color: #222 !important; }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: #111 !important; color: #fff !important; border: 1px solid rgba(255,255,255,0.06); }

        /* CMS Editor Adapters to inherit Dark theme */
        .cms-section { background: var(--card-bg); border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--card-border); overflow: hidden; }
        .cms-accordion-header { padding: 20px; font-weight: 600; cursor: pointer; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; }
        .cms-accordion-body { padding: 20px; display: none; }
        .cms-group { margin-bottom: 15px; }
        .cms-group label { display: block; margin-bottom: 6px; font-size: 0.85rem; color: var(--text-muted); }
        .cms-group input, .cms-group textarea { width: 100%; padding: 12px; background: #000; border: 1px solid var(--card-border); color: #fff; border-radius: 6px; outline: none; }
        .cms-group input:focus, .cms-group textarea:focus { border-color: #666; }
    </style>
</head>
<body>

    <!-- TELA DE LOGIN -->
    <div id="admin-login" class="login-container">
        <div class="login-box">
            <h2>HELIOS CRM</h2>
            <input type="text" id="admin-username" class="login-input" placeholder="Usuário (Japex / Temari)" required>
            <input type="password" id="admin-password" class="login-input" placeholder="Senha" required>
            <button class="btn-login" onclick="login()">Entrar no Sistema</button>
        </div>
    </div>

    <!-- PAINEL CRM -->
    <div id="admin-dashboard">
        <div class="crm-wrapper">
            <!-- SIDEBAR -->
            <aside class="sidebar">
                <div class="sidebar-logo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/></svg>
                    ALDEIA
                </div>
                
                <nav class="sidebar-nav">
                    <a class="nav-item active" onclick="switchTab('dashboard-tab', this)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M3 9h18M9 21V9"></path></svg>
                        Dashboard
                    </a>
                    <a class="nav-item" onclick="switchTab('leads-tab', this)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        Orçamentos
                    </a>
                    <a class="nav-item" onclick="switchTab('clients-tab', this)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        Clientes
                    </a>
                    <a class="nav-item" onclick="switchTab('telemetry-tab', this)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        Analytics
                    </a>
                    <a class="nav-item" onclick="switchTab('logins-tab', this)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        Segurança
                    </a>
                    <a class="nav-item" onclick="switchTab('cms-tab', this)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        Editor
                    </a>
                </nav>
            </aside>

            <!-- MAIN RIGHT PANEL -->
            <main class="main-content">
                <header class="topbar">
                    <h1 class="page-title" id="current-page-title">Dashboard</h1>
                    <div class="user-profile">
                        <div class="user-greeting">Welcome, <span id="auth-username" class="user-name">User</span></div>
                        <img src="assets/favicon.png" id="auth-avatar" class="user-avatar" alt="Avatar">
                        <button class="btn-logout" onclick="logout()">Sair</button>
                    </div>
                </header>

                <!-- TAB: DASHBOARD -->
                <div id="dashboard-tab" class="tab-content active">
                    <div class="grid-cards">
                        <div class="crm-card">
                            <span class="crm-card-title">Total Leads (Orçamentos)</span>
                            <span class="crm-card-value" id="dash-total-leads">-</span>
                        </div>
                        <div class="crm-card">
                            <span class="crm-card-title">Visitantes Hoje</span>
                            <span class="crm-card-value" id="dash-visits-today">-</span>
                        </div>
                        <div class="crm-card">
                            <span class="crm-card-title">Visitantes 7 Dias</span>
                            <span class="crm-card-value" id="dash-visits-week">-</span>
                        </div>
                        <div class="crm-card">
                            <span class="crm-card-title">Visitantes Total</span>
                            <span class="crm-card-value" id="dash-visits-total">-</span>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                        <div class="crm-card">
                            <span class="crm-card-title" style="margin-bottom: 15px;">Heatmap de Tráfego</span>
                            <div id="leads-map"></div>
                        </div>
                        <div class="crm-card">
                            <span class="crm-card-title" style="margin-bottom: 15px;">Top Portfólio (Mais Vistos)</span>
                            <div id="portfolio-ranking-list" style="display:flex; flex-direction:column; gap:12px;">
                                <!-- Dynamic -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB: LEADS -->
                <div id="leads-tab" class="tab-content">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 20px;">
                        <button class="btn-action dark" onclick="loadSubmissions()">Atualizar Lista</button>
                        <div>
                            <button class="btn-action dark" onclick="exportLeadsToCSV()">Exportar CSV</button>
                            <button class="btn-action dark" onclick="downloadSQLDump()">Exportar SQL</button>
                        </div>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Contato</th>
                                    <th>Projeto</th>
                                    <th>WhatsApp</th>
                                    <th>Data</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="submissions-list">
                                <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Carregando leads...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TAB: CLIENTS -->
                <div id="clients-tab" class="tab-content">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Projeto Fechado</th>
                                    <th>Data de Conversão</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="clients-list">
                                <tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Carregando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TAB: TELEMETRY -->
                <div id="telemetry-tab" class="tab-content">
                    <div class="crm-card">
                        <span class="crm-card-title">Últimos Eventos de Tráfego</span>
                        <div class="table-container" style="margin-top: 15px; border:none;">
                            <table>
                                <thead><tr><th>Horário</th><th>Sessão</th><th>Tipo do Evento</th><th>Detalhe</th></tr></thead>
                                <tbody id="telemetry-logs-body">
                                    <tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- TAB: LOGINS -->
                <div id="logins-tab" class="tab-content">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Data / Hora</th>
                                    <th>Usuário</th>
                                    <th>Status</th>
                                    <th>Navegador / IP</th>
                                </tr>
                            </thead>
                            <tbody id="logins-list">
                                <tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Carregando registros...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TAB: CMS EDITOR -->
                <div id="cms-tab" class="tab-content">
                    <button id="btn-save-content" class="btn-action" style="margin-bottom: 20px; width: 100%; justify-content:center; padding: 16px;">Salvar Todas as Alterações</button>
                    ${cmsHtml.replace('<div id="cms-tab" class="tab-content">', '')}
`; // CMS ends inside here

fs.writeFileSync('new_admin.html', newHtml + '\n' + jsContent);
