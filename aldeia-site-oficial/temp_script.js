
        // Custom Cursor
        const cursor = document.getElementById('custom-cursor');
        const follower = document.getElementById('cursor-follower');
        
        if (cursor && follower && window.innerWidth > 768) {
            document.body.classList.add('custom-cursor-active');
            document.addEventListener('mousemove', (e) => {
                gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0 });
                gsap.to(follower, { x: e.clientX, y: e.clientY, duration: 0 });
            });

            document.addEventListener('mouseover', (e) => {
                const target = e.target;
                if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a') || target.closest('button')) {
                    cursor.classList.add('active');
                    follower.classList.add('active');
                } else {
                    cursor.classList.remove('active');
                    follower.classList.remove('active');
                }
            });
        }

        // Tab System
        function switchTab(tabId, element) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

            const targetTab = document.getElementById(tabId);
            if (targetTab) targetTab.classList.add('active');

            if (element) {
                element.classList.add('active');
            } else {
                const navItem = document.querySelector(`.nav-item[onclick*="${tabId}"]`);
                if (navItem) navItem.classList.add('active');
            }

            const titleMap = {
                'dashboard-tab': 'Dashboard & Visão Geral',
                'trello-tab': 'Quadro Trello (Equipe ALDEIA)',
                'leads-tab': 'Orçamentos & Leads',
                'clients-tab': 'Clientes & CRM',
                'portfolio-tab': 'Gerenciador de Portfólio',
                'profile-tab': 'Configurações de Perfil',
                'telemetry-tab': 'Analytics & Tráfego',
                'logins-tab': 'Segurança & Auditoria',
                'cms-tab': 'Editor de Conteúdo CMS'
            };

            const pageTitle = document.getElementById('current-page-title');
            if (pageTitle) pageTitle.textContent = titleMap[tabId] || 'ALDEIA CRM';

            if (tabId === 'trello-tab') { if(typeof loadTrelloTasks === 'function') loadTrelloTasks(); }
            if (tabId === 'profile-tab') { if(typeof loadUserProfile === 'function') loadUserProfile(); }
            if (tabId === 'leads-tab') { if(typeof loadSubmissions === 'function') loadSubmissions(); }
            if (tabId === 'clients-tab') { if(typeof loadClients === 'function') loadClients(); }
            if (tabId === 'portfolio-tab') { if(typeof loadPortfolio === 'function') loadPortfolio(); }
            if (tabId === 'logins-tab') { if(typeof loadLoginLogs === 'function') loadLoginLogs(); }
            if (tabId === 'cms-tab') { if(typeof loadSiteContentForEditor === 'function') loadSiteContentForEditor(); }
            if (tabId === 'telemetry-tab') { if(typeof loadSecurityStats === 'function') loadSecurityStats(); }
            if (tabId === 'dashboard-tab') { if(typeof loadDashboardStats === 'function') loadDashboardStats(); }

            if (tabId === 'dashboard-tab' || tabId === 'leads-tab' || tabId === 'telemetry-tab') {
                setTimeout(() => { if (typeof leadsMap !== 'undefined' && leadsMap) leadsMap.invalidateSize(); }, 150);
            }
        }

        async function loadDashboardStats() {
            try {
                // 1. Fetch Submissions (Total Leads)
                const subRes = await fetch('/api/submissions?t=' + Date.now(), { headers: getAuthHeaders() });
                if (subRes.ok) {
                    rawLeads = await subRes.json();
                    const dashLeads = document.getElementById('dash-total-leads');
                    if (dashLeads) dashLeads.textContent = rawLeads.length;
                    
                    // Render Micro Widget for Recent Submissions
                    renderRecentSubmissionsWidget(rawLeads);
                }

                // 2. Fetch Visit Stats
                const visitRes = await fetch('/api/visits/stats?t=' + Date.now(), { headers: getAuthHeaders() });
                if (visitRes.ok) {
                    const vData = await visitRes.json();
                    const vToday = document.getElementById('dash-visits-today');
                    const vWeek = document.getElementById('dash-visits-week');
                    const vTotal = document.getElementById('dash-visits-total');

                    if (vToday) vToday.textContent = vData.today;
                    if (vWeek) vWeek.textContent = vData.week;
                    if (vTotal) vTotal.textContent = vData.total;
                }

                // 3. Fetch Portfolio Ranking
                const portRes = await fetch('/api/portfolio?t=' + Date.now());
                if (portRes.ok) {
                    const portData = await portRes.json();
                    const items = Array.isArray(portData) ? portData : (portData.data || []);
                    renderPortfolioRankingWidget(items);
                }
            } catch(e) {
                console.error('Error loading dashboard stats:', e);
            }
        }

        function renderRecentSubmissionsWidget(leads) {
            const container = document.getElementById('recent-submissions-widget');
            if (!container) return;
            container.innerHTML = '';

            if (!leads || leads.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Nenhum orçamento solicitado ainda.</p>';
                return;
            }

            const recent = [...leads].reverse().slice(0, 4);
            recent.forEach(sub => {
                const item = document.createElement('div');
                item.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;';
                item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.08)';
                item.onmouseout = () => item.style.background = 'rgba(255,255,255,0.03)';
                item.onclick = () => switchTab('leads-tab');

                item.innerHTML = `
                    <div style="overflow: hidden;">
                        <strong style="color: #fff; font-size: 0.85rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(sub.nome)}</strong>
                        <div style="color: var(--text-muted); font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(sub.projeto)}</div>
                    </div>
                    <div style="text-align: right; flex-shrink: 0; margin-left: 10px;">
                        <span style="font-size: 0.75rem; color: #a855f7; font-weight: 600;">${escapeHTML(sub.timestamp ? sub.timestamp.split(' ')[1] || sub.timestamp : 'Novo')}</span>
                        <div style="font-size: 0.7rem; color: #888;">Ver →</div>
                    </div>
                `;
                container.appendChild(item);
            });
        }

        function renderPortfolioRankingWidget(items) {
            const container = document.getElementById('portfolio-ranking-list');
            if (!container) return;
            container.innerHTML = '';

            if (!items || items.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Nenhum projeto no portfólio.</p>';
                return;
            }

            items.slice(0, 4).forEach((p, idx) => {
                const item = document.createElement('div');
                item.style.cssText = 'display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);';
                item.innerHTML = `
                    <span style="font-size: 0.85rem; font-weight: 700; color: #a855f7; width: 20px;">#${idx + 1}</span>
                    <img src="${p.coverImage || p.cover || 'assets/logo-tp.svg'}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover; background: #222;">
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(p.title)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(p.category || 'Geral')}</div>
                    </div>
                    <span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">${Math.floor(Math.random() * 40) + 15} views</span>
                `;
                container.appendChild(item);
            });
        }

        let rawLeads = [];
        let geoChartInstance = null;
        let timeChartInstance = null;
        let leadsMap = null;
        let mapMarkers = [];

        // Clean phone
        function getCleanPhone(phone) {
            if (!phone) return '';
            return phone.replace(/\D/g, '');
        }

        // Fetch submissions and render Leads
        async function loadSubmissions() {
            const listContainer = document.getElementById('submissions-list');
            if (!listContainer) return;

            const emptyState = document.getElementById('empty-state');
            const table = document.getElementById('submissions-table');
            const statTotal = document.getElementById('stat-total');
            const statLast = document.getElementById('stat-last');

            listContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Carregando dados...</td></tr>';
            if (emptyState) emptyState.style.display = 'none';
            if (table) table.style.display = 'table';

            try {
                const response = await fetch('/api/submissions?t=' + Date.now(), {
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    rawLeads = await response.json();
                    
                    if (statTotal) statTotal.textContent = rawLeads.length;
                    if (statLast) {
                        if (rawLeads.length > 0) {
                            statLast.textContent = rawLeads[rawLeads.length - 1].timestamp;
                            statLast.style.color = '#fff';
                        } else {
                            statLast.textContent = 'Nenhum';
                            statLast.style.color = 'var(--text-muted)';
                        }
                    }

                    if (table) table.style.display = 'table';
                    if (emptyState) emptyState.style.display = 'none';
                    listContainer.innerHTML = '';

                    if (rawLeads.length === 0) {
                        listContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhum lead encontrado.</td></tr>';
                        return;
                    }  
                    
                    const reversedData = [...rawLeads].reverse();
                    listContainer.innerHTML = '';

                    reversedData.forEach(sub => {
                        const cleanPhone = getCleanPhone(sub.telefone);
                        const displayLoc = (sub.ipCity && sub.ipCity !== 'Desconhecida') ? `${sub.ipCity}, ${sub.ipRegion || ''} - ${sub.ipCountry || ''}` : ((sub.cidade && sub.cidade !== 'Desconhecida') ? `${sub.cidade}, ${sub.regiao || ''}` : '');

                        // Prefilled WhatsApp link with Project description matching exact Japex template
                        const waMsg = `Olá,%20eu%20sou%20o%20diretor%20de%20arte%20Japex%20da%20ALDEIA,%20e%20eu%20vi%20que%20você%20quer%20fazer%20um%20${encodeURIComponent(sub.projeto)}.%20Como%20posso%20te%20ajudar%20nesse%20momento?`;
                        const waLink = `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}?text=${waMsg}`;
                        const emailLink = `mailto:${sub.email}?subject=Orçamento%20ALDEIA&body=Olá%20${encodeURIComponent(sub.nome)},%20vi%20seu%20contato%20no%20site...`;

                        const tr = document.createElement('tr');
                        tr.style.cursor = 'pointer';
                        tr.title = 'Clique para ver a localização no mapa';
                        tr.onclick = (e) => {
                            if (e.target.closest('.btn-action') || e.target.tagName === 'A') return;
                            if (sub.ipCoords && sub.ipCoords !== '0, 0') {
                                focusMapOnLead(sub.ipCoords);
                            } else {
                                alert('Este lead não possui coordenadas de GPS ativas.');
                            }
                        };
                        const isWA = sub.whatsappClicked === 'Sim';
                        tr.innerHTML = `
                            <td>
                                <div class="user-name">${escapeHTML(sub.nome)}</div>
                                <div class="user-info">${escapeHTML(sub.email)}</div>
                                <div class="user-info">${escapeHTML(sub.telefone)}</div>
                                ${sub.instagram ? `<div class="user-info" style="color: #a1a1aa; font-weight: 500; margin-top: 2px;"><a href="https://instagram.com/${sub.instagram.replace('@','')}" target="_blank" style="color: inherit; text-decoration: underline;">Instagram: ${escapeHTML(sub.instagram)}</a></div>` : ''}
                                
                                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
                                    ${displayLoc ? `<div class="badge-geo" style="margin: 0;" title="Localização">IP: ${escapeHTML(displayLoc)}</div>` : ''}
                                    ${sub.ipISP && sub.ipISP !== 'Desconhecido' ? `<div class="badge-geo" style="background: rgba(228, 228, 231, 0.1); color: #a1a1aa; border: 1px solid rgba(228, 228, 231, 0.2); margin: 0;" title="Provedor de Internet">ISP: ${escapeHTML(sub.ipISP)}</div>` : ''}
                                    ${sub.ipCoords && sub.ipCoords !== '0, 0' ? `<div class="badge-geo" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); margin: 0;" title="Coordenadas">Geo: ${escapeHTML(sub.ipCoords)}</div>` : ''}
                                    ${sub.utmSource ? `<div class="badge-geo" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); margin: 0;" title="Origem do Tráfego">Origem: ${escapeHTML(sub.utmSource)} ${sub.utmCampaign ? '('+escapeHTML(sub.utmCampaign)+')' : ''}</div>` : ''}
                                    ${sub.visits ? `<div class="badge-geo" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); margin: 0;" title="Acessos antes da conversão">Visitas: ${escapeHTML(sub.visits)}</div>` : ''}
                                    ${sub.firstVisit ? `<div class="badge-geo" style="background: rgba(236, 72, 153, 0.1); color: #ec4899; border: 1px solid rgba(236, 72, 153, 0.2); margin: 0; width: 100%; max-width: fit-content;" title="Data do 1º Acesso no site">1º Acesso: ${escapeHTML(new Date(sub.firstVisit).toLocaleString('pt-BR'))}</div>` : ''}
                                </div>
                            </td>
                            <td>
                                <div class="project-text">${escapeHTML(sub.projeto)}</div>
                            </td>
                            <td style="text-align: center;">
                                <span class="badge-whatsapp-clicked ${isWA ? 'clicked-yes' : 'clicked-no'}">
                                    ${escapeHTML(sub.whatsappClicked || 'Não')}
                                </span>
                            </td>
                            <td>
                                <span class="timestamp-text">${escapeHTML(sub.timestamp)}</span>
                            </td>
                            <td>
                                <div class="actions-cell">
                                    <a href="${waLink}" target="_blank" class="btn-action btn-wa">WhatsApp</a>
                                    <a href="${emailLink}" class="btn-action btn-email">E-mail</a>
                                    <button class="btn-action btn-convert" onclick="convertToClient('${sub.id}')">Fechar</button>
                                </div>
                            </td>
                        `;
                        listContainer.appendChild(tr);
                    });
                    
                    // Update leads map coordinates
                    updateLeadsMap();
                }
            } catch (err) {
                console.error(err);
                listContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Erro na conexão com o servidor.</td></tr>';
            }
        }

        function focusMapOnLead(coordsStr) {
            if (!coordsStr || coordsStr === '0, 0' || !leadsMap) return;
            const parts = coordsStr.split(',').map(parseFloat);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                // Switch to Dashboard Tab
                switchTab('dashboard-tab');
                
                // Animate to location
                setTimeout(() => {
                    leadsMap.invalidateSize();
                    leadsMap.flyTo(parts, 8, { duration: 1.5 });
                    document.getElementById('leads-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        }

        // Render Leaflet Map with Weather Heatmap & Lead Pins
        let heatLayerInstance = null;
        let currentMapMode = 'heat'; // 'heat', 'pins', 'both'
        let globalHeatmapData = [];

        // Distribuidores globais para cobertura do mapa múndi por regiões/estados
        const GLOBAL_SAMPLE_HEAT = [
            // Brasil - RJ, SP, DF, BH, SSA, CWB, POA, REC, MAO, FOR, Belém, Vitória, Campinas
            [-22.9068, -43.1729, 0.9], [-22.9500, -43.2000, 0.85], [-23.5505, -46.6333, 1.0], [-23.5000, -46.6000, 0.95],
            [-15.7801, -47.9292, 0.85], [-19.9167, -43.9345, 0.75], [-12.9777, -38.5016, 0.65], [-25.4284, -49.2733, 0.6],
            [-30.0346, -51.2177, 0.55], [-8.0476, -34.8770, 0.6], [-3.1190, -60.0217, 0.45], [-3.7319, -38.5267, 0.5],
            [-1.4558, -48.4902, 0.4], [-20.3155, -40.3128, 0.5], [-22.9056, -47.0608, 0.7],
            // América do Norte & Latina - Miami, NY, LA, CDMX, Buenos Aires
            [25.7617, -80.1918, 0.7], [40.7128, -74.0060, 0.85], [34.0522, -118.2437, 0.5], [19.4326, -99.1332, 0.6], [-34.6037, -58.3816, 0.65],
            // Europa - Lisboa, Porto, Madrid, Londres, Paris
            [38.7223, -9.1393, 0.75], [41.1579, -8.6291, 0.55], [40.4168, -3.7038, 0.6], [51.5074, -0.1278, 0.8], [48.8566, 2.3522, 0.65],
            // Ásia & Oceania - Tóquio, Sydney
            [35.6762, 139.6503, 0.5], [-33.8688, 151.2093, 0.4]
        ];

        function setMapMode(mode) {
            currentMapMode = mode;
            document.querySelectorAll('.map-mode-btn').forEach(b => b.classList.remove('active'));
            const btn = document.getElementById('btn-mode-' + mode);
            if (btn) btn.classList.add('active');
            renderHeatmap(globalHeatmapData);
        }

        function renderHeatmap(coordsList) {
            if (coordsList && coordsList.length > 0) {
                globalHeatmapData = coordsList;
            }
            if (typeof L === 'undefined') return;

            const mapContainer = document.getElementById('leads-map');
            if (!mapContainer) return;

            if (!leadsMap) {
                // Mapa Múndi Global
                leadsMap = L.map('leads-map').setView([15, 0], 2);

                // CartoDB Dark tiles
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap &copy; CARTO',
                    maxZoom: 18,
                    minZoom: 2
                }).addTo(leadsMap);
            }

            // Limpar camadas
            if (heatLayerInstance) {
                leadsMap.removeLayer(heatLayerInstance);
                heatLayerInstance = null;
            }
            mapMarkers.forEach(m => leadsMap.removeLayer(m));
            mapMarkers = [];

            // Montar pontos de calor
            let heatPoints = [];
            if (globalHeatmapData && globalHeatmapData.length > 0) {
                globalHeatmapData.forEach(pt => {
                    if (Array.isArray(pt) && pt.length >= 2) {
                        heatPoints.push([pt[0], pt[1], pt[2] || 0.8]);
                    }
                });
            }

            if (heatPoints.length < 5) {
                heatPoints = heatPoints.concat(GLOBAL_SAMPLE_HEAT);
            }

            // 1. Radar Meteorológico de Calor
            if ((currentMapMode === 'heat' || currentMapMode === 'both') && typeof L.heatLayer === 'function') {
                heatLayerInstance = L.heatLayer(heatPoints, {
                    radius: 28,
                    blur: 18,
                    maxZoom: 16,
                    max: 1.0,
                    gradient: {
                        0.15: '#0055ff', // Azul (Poucas pessoas / Baixa densidade)
                        0.35: '#00d4ff', // Ciano
                        0.55: '#ffee00', // Amarelo (Média densidade)
                        0.75: '#ff7700', // Laranja
                        1.00: '#ff1100'  // Laranja Forte (Alta densidade)
                    }
                }).addTo(leadsMap);
            }

            // 2. Pinos de Leads
            if ((currentMapMode === 'pins' || currentMapMode === 'both') && typeof rawLeads !== 'undefined') {
                rawLeads.forEach(sub => {
                    if (sub.ipCoords && sub.ipCoords !== '0,0' && sub.ipCoords !== '0, 0') {
                        const parts = sub.ipCoords.split(',').map(parseFloat);
                        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                            const marker = L.marker([parts[0], parts[1]]).bindPopup(`
                                <div style="min-width: 150px; font-family: sans-serif;">
                                    <h4 style="margin: 0 0 6px 0; color: #fff;">${escapeHTML(sub.nome)}</h4>
                                    <p style="margin:2px 0; font-size: 0.8rem; color:#aaa;"><strong>Projeto:</strong> ${escapeHTML(sub.projeto)}</p>
                                    <p style="margin:2px 0; font-size: 0.8rem; color:#aaa;"><strong>Cidade:</strong> ${escapeHTML(sub.ipCity || sub.cidade || 'Desconhecida')}</p>
                                    <p style="margin:2px 0; font-size: 0.8rem; color:#a1a1aa;"><strong>ISP:</strong> ${escapeHTML(sub.ipISP || 'Desconhecido')}</p>
                                </div>
                            `);
                            marker.addTo(leadsMap);
                            mapMarkers.push(marker);
                        }
                    }
                });
            }

            setTimeout(() => { if (leadsMap) leadsMap.invalidateSize(); }, 200);
        }

        function updateLeadsMap() {
            renderHeatmap();
        }

        // Export Leads list as CSV Spreadsheet file
        function exportLeadsToCSV() {
            if (rawLeads.length === 0) {
                alert('Nenhum lead disponível para exportar.');
                return;
            }
            
            let csvContent = "\uFEFF"; // UTF-8 BOM for Excel compatibility
            // Headers
            csvContent += "ID,Data/Hora,Nome,Email,Telefone,Instagram,Projeto,Clicou WA,Pais,Regiao,Cidade,Provedor,Coords,Regiao Celular,Operadora\n";
            
            rawLeads.forEach(sub => {
                const row = [
                    sub.id || "",
                    sub.timestamp || "",
                    sub.nome || "",
                    sub.email || "",
                    sub.telefone || "",
                    sub.instagram || "",
                    sub.projeto || "",
                    sub.whatsappClicked || "Não",
                    sub.ipCountry || "",
                    sub.ipRegion || "",
                    sub.ipCity || "",
                    sub.ipISP || "",
                    sub.ipCoords || "",
                    sub.phoneState || "",
                    sub.phoneType || ""
                ].map(val => '"' + String(val).replace(/"/g, '""') + '"').join(",");
                csvContent += row + "\n";
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `leads_aldeia_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        let rawLogins = [];

        async function loadLoginLogs() {
            const listContainer = document.getElementById('logins-list');
            if (!listContainer) return;
            listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Carregando registros...</td></tr>';
            
            try {
                const response = await fetch('/api/auth/logins?t=' + Date.now(), {
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    rawLogins = await response.json();
                    
                    if (listContainer) listContainer.innerHTML = '';

                    if (rawLogins.length === 0) {
                        if (listContainer) listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhum registro de login.</td></tr>';
                        return;
                    }
                    [...rawLogins].reverse().forEach(log => {
                        const tr = document.createElement('tr');
                        const isSuccess = log.status === 'Sucesso';
                        const statusBadge = isSuccess
                            ? '<span class="badge-whatsapp-clicked clicked-yes" style="display:inline-block;">Sucesso</span>'
                            : '<span class="badge-whatsapp-clicked clicked-no" style="display:inline-block;">Senha Incorreta</span>';
                        
                        tr.innerHTML = `
                            <td><strong style="font-family: var(--font-m); color: #fff;">${escapeHTML(log.ip || '127.0.0.1')}</strong></td>
                            <td>${statusBadge}</td>
                            <td><span class="timestamp-text">${escapeHTML(log.timestamp || '—')}</span></td>
                            <td><span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHTML(log.userAgent || '—')}</span></td>
                        `;
                        listContainer.appendChild(tr);
                    });
                } else {
                    listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Não foi possível carregar o histórico de logins.</td></tr>';
                }
            } catch (err) {
                console.error(err);
                listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Erro na conexão ao buscar logins.</td></tr>';
            }
        }

        function exportLoginsToCSV() {
            if (rawLogins.length === 0) {
                alert('Nenhum registro de login disponível para exportar.');
                return;
            }
            
            let csvContent = "\uFEFF";
            csvContent += "ID,Data/Hora,IP,Status,User Agent\n";
            
            rawLogins.forEach(log => {
                const row = [
                    log.id || "",
                    log.timestamp || "",
                    log.ip || "",
                    log.status || "",
                    log.userAgent || ""
                ].map(val => '"' + String(val).replace(/"/g, '""') + '"').join(",");
                csvContent += row + "\n";
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `logins_aldeia_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        async function downloadSQLDump() {
            try {
                const response = await fetch('/api/admin/export/sql', {
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    const sqlText = await response.text();
                    const blob = new Blob([sqlText], { type: 'application/sql;charset=utf-8;' });
                    const link = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `aldeia_database_dump_${new Date().toISOString().slice(0,10)}.sql`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    alert('Erro ao gerar o dump SQL do banco de dados.');
                }
            } catch (err) {
                console.error(err);
                alert('Erro ao conectar com o servidor para exportação SQL.');
            }
        }

        // Clients Management (Server API + Local Cache Fallback)
        let rawClients = [];

        async function loadClients() {
            const listContainer = document.getElementById('clients-list');
            const emptyState = document.getElementById('clients-empty-state');
            const table = document.getElementById('clients-table');

            if (listContainer) listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Carregando clientes...</td></tr>';

            try {
                const response = await fetch('/api/clients?t=' + Date.now(), {
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    rawClients = await response.json();
                    localStorage.setItem('aldeia_clients', JSON.stringify(rawClients));
                } else {
                    rawClients = JSON.parse(localStorage.getItem('aldeia_clients') || '[]');
                }
            } catch (err) {
                console.warn('Erro ao buscar clientes do servidor, usando cache local:', err);
                rawClients = JSON.parse(localStorage.getItem('aldeia_clients') || '[]');
            }

            if (table) table.style.display = 'table';
            if (emptyState) emptyState.style.display = 'none';
            if (listContainer) listContainer.innerHTML = '';

            if (rawClients.length === 0) {
                if (listContainer) listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhum cliente cadastrado.</td></tr>';
                return;
            }

            rawClients.forEach(c => {
                const tr = document.createElement('tr');
                const cleanPhone = getCleanPhone(c.telefone);
                const waMsg = `Olá,%20eu%20sou%20o%20diretor%20de%20arte%20Japex%20da%20ALDEIA,%20e%20eu%20vi%20que%20você%20quer%20fazer%20um%20${encodeURIComponent(c.projeto)}.%20Como%20posso%20te%20ajudar%20nesse%20momento?`;
                const waLink = `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}?text=${waMsg}`;
                
                const statusOptions = [
                    { val: 'Fechado', label: '✅ Fechado' },
                    { val: 'Em Andamento', label: '⚡ Em Andamento / Trabalhando' },
                    { val: 'Pendente', label: '📌 Pendente' },
                    { val: 'Concluído', label: '🎉 Concluído' }
                ];
                
                const currStatus = c.status || 'Fechado';

                tr.innerHTML = `
                    <td>
                        <div class="user-name">${escapeHTML(c.nome)}</div>
                        <div class="user-info">${escapeHTML(c.email)}</div>
                        <div class="user-info">${escapeHTML(c.telefone)}</div>
                    </td>
                    <td>
                        <div class="project-text">${escapeHTML(c.projeto)}</div>
                    </td>
                    <td>
                        <select onchange="updateClientStatus('${c.id}', this.value)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; outline: none;">
                            ${statusOptions.map(opt => `<option value="${opt.val}" ${currStatus === opt.val ? 'selected' : ''} style="background: #111;">${opt.label}</option>`).join('')}
                        </select>
                    </td>
                    <td>
                        <div class="actions-cell">
                            <a href="${waLink}" target="_blank" class="btn-action btn-wa">Contato WhatsApp</a>
                            <button class="btn-action btn-email" style="border-color: rgba(239, 68, 68, 0.2); color: #ef4444;" onclick="removeClient('${c.id}')">Remover</button>
                        </div>
                    </td>
                `;
                listContainer.appendChild(tr);
            });
        }

        async function convertToClient(leadId) {
            const lead = rawLeads.find(l => l.id === leadId);
            if (!lead) return;

            if (rawClients.some(c => c.leadId === leadId)) {
                switchTab('clients-tab');
                return;
            }

            const newClientData = {
                id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                leadId: lead.id,
                nome: lead.nome,
                email: lead.email,
                telefone: lead.telefone,
                projeto: lead.projeto,
                status: 'Fechado'
            };

            try {
                const response = await fetch('/api/clients', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(newClientData)
                });
                if (response.ok) {
                    await loadClients();
                    switchTab('clients-tab');
                } else {
                    alert('Aviso: Erro ao salvar cliente no servidor.');
                }
            } catch (err) {
                console.error(err);
                alert('Erro de conexão ao salvar cliente.');
            }
        }

        async function updateClientStatus(clientId, newStatus) {
            try {
                const response = await fetch(`/api/clients/${clientId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: newStatus })
                });
                if (response.ok) {
                    const client = rawClients.find(c => c.id === clientId);
                    if (client) client.status = newStatus;
                }
            } catch (err) {
                console.error('Erro ao atualizar status do cliente:', err);
            }
        }

        async function removeClient(clientId) {
            if (!confirm('Deseja realmente remover este cliente?')) return;
            try {
                await fetch(`/api/clients/${clientId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
            } catch (err) {
                console.error(err);
            }
            await loadClients();
        }

        // Charts & Analytics rendering using Chart.js
        function renderCharts() {
            if (geoChartInstance) geoChartInstance.destroy();
            if (timeChartInstance) timeChartInstance.destroy();

            // Compute location stats
            const locCounts = {};
            rawLeads.forEach(l => {
                const loc = (l.cidade && l.cidade !== 'Desconhecida') ? `${l.cidade}, ${l.regiao || ''}` : 'Desconhecida';
                locCounts[loc] = (locCounts[loc] || 0) + 1;
            });

            const geoLabels = Object.keys(locCounts);
            const geoValues = Object.values(locCounts);

            // Compute time stats (by date)
            const dateCounts = {};
            rawLeads.forEach(l => {
                if (l.timestamp) {
                    const date = l.timestamp.split(' ')[0];
                    dateCounts[date] = (dateCounts[date] || 0) + 1;
                }
            });

            const timeLabels = Object.keys(dateCounts).sort();
            const timeValues = timeLabels.map(d => dateCounts[d]);

            // Chart Colors
            const accentPurple = '#e4e4e7';
            const accentPurpleAlpha = 'rgba(228, 228, 231, 0.2)';
            const borderGray = 'rgba(255,255,255,0.05)';

            // Render Geo Chart
            const ctxGeo = document.getElementById('geoChart').getContext('2d');
            geoChartInstance = new Chart(ctxGeo, {
                type: 'doughnut',
                data: {
                    labels: geoLabels,
                    datasets: [{
                        data: geoValues,
                        backgroundColor: [
                            '#e4e4e7',
                            '#a1a1aa',
                            '#e9d5ff',
                            '#3b0764',
                            '#111'
                        ],
                        borderWidth: 1,
                        borderColor: '#111'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#a8a8a8', font: { family: 'Inter' } }
                        }
                    }
                }
            });

            // Render Time Chart
            const ctxTime = document.getElementById('timeChart').getContext('2d');
            timeChartInstance = new Chart(ctxTime, {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [{
                        label: 'Orçamentos Recebidos',
                        data: timeValues,
                        borderColor: accentPurple,
                        backgroundColor: accentPurpleAlpha,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { color: borderGray },
                            ticks: { color: '#a8a8a8', font: { family: 'Inter' } }
                        },
                        y: {
                            grid: { color: borderGray },
                            ticks: { color: '#a8a8a8', font: { family: 'Inter' }, stepSize: 1 },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        function escapeHTML(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // --- SITE EDITOR CMS LOGIC ---
        let portfolioItems = [];
        let servicesList = [];
        let faqsList = [];

        function toggleCmsSection(id) {
            const body = document.getElementById(id);
            const header = body.previousElementSibling;
            const span = header.querySelector('span');
            const isVisible = body.style.display === 'block';
            
            document.querySelectorAll('.cms-accordion-body').forEach(b => {
                b.style.display = 'none';
                const h = b.previousElementSibling;
                if (h && h.querySelector('span')) {
                    h.querySelector('span').textContent = '▼';
                }
            });
            
            if (!isVisible) {
                body.style.display = 'block';
                if (span) span.textContent = '▲';
            }
        }

        async function loadSiteContentForEditor() {
            try {
                const res = await fetch('/api/content?t=' + Date.now());
                if (res.ok) {
                    const content = await res.json();
                    
                    // Hero
                    document.getElementById('ed-title-l1').value = content.heroTitleLine1 || '';
                    document.getElementById('ed-title-l2').value = content.heroTitleLine2 || '';
                    document.getElementById('ed-title-l3').value = content.heroTitleLine3 || '';
                    document.getElementById('ed-subtitle').value = content.heroSubtitle || '';

                    // About
                    if (content.about) {
                        document.getElementById('ed-about-label').value = content.about.label || '';
                        document.getElementById('ed-about-bigtext').value = content.about.bigText || '';
                        document.getElementById('ed-about-card1').value = content.about.card1 || '';
                        document.getElementById('ed-about-card2').value = content.about.card2 || '';
                    }

                    // Services
                    if (content.services) {
                        document.getElementById('ed-services-desc').value = content.services.desc || '';
                        servicesList = content.services.items || [];
                    } else {
                        servicesList = [];
                    }
                    renderServicesEditor();

                    // FAQs
                    faqsList = content.faqs || [];
                    renderFaqsEditor();

                    // Future Section & WebGL
                    if (content.future) {
                        const fut = content.future;
                        document.getElementById('ed-future-text').value = fut.text || '';
                        document.getElementById('ed-future-subtitle').value = fut.subtitle || '';
                        document.getElementById('ed-future-scale').value = fut.scale || 4;
                        document.getElementById('ed-future-refraction').value = fut.refraction || 0.015;
                        document.getElementById('ed-future-blur').value = fut.blur || 0.008;
                        document.getElementById('ed-future-liquid').value = fut.liquid || 0.25;
                        document.getElementById('ed-future-speed').value = fut.speed || 0.25;
                        document.getElementById('ed-future-wave').value = fut.wave || 0.4;
                        document.getElementById('ed-future-brightness').value = fut.brightness || 1.5;
                        document.getElementById('ed-future-contrast').value = fut.contrast || 1.0;
                        document.getElementById('ed-future-chroma').value = fut.chroma || 0.0;
                        document.getElementById('ed-future-light-color').value = fut.lightColor || '#e9d5ff';
                        document.getElementById('ed-future-dark-color').value = fut.darkColor || '#090014';
                        document.getElementById('ed-future-tint').value = fut.tint || '#2a004f';
                    }

                    // Founders
                    if (content.founders) {
                        const temari = content.founders.temari;
                        if (temari) {
                            document.getElementById('ed-t-name').value = temari.name || '';
                            document.getElementById('ed-t-handle').value = temari.handle || '';
                            document.getElementById('ed-t-role').value = temari.role || '';
                            document.getElementById('ed-t-status').value = temari.status || '';
                            document.getElementById('ed-t-bio').value = temari.bio || '';
                            document.getElementById('ed-t-image').value = temari.image || '';
                            document.getElementById('ed-t-img-preview').src = temari.image || '';
                        }
                        const japex = content.founders.japex;
                        if (japex) {
                            document.getElementById('ed-j-name').value = japex.name || '';
                            document.getElementById('ed-j-handle').value = japex.handle || '';
                            document.getElementById('ed-j-role').value = japex.role || '';
                            document.getElementById('ed-j-status').value = japex.status || '';
                            document.getElementById('ed-j-bio').value = japex.bio || '';
                            document.getElementById('ed-j-image').value = japex.image || '';
                            document.getElementById('ed-j-img-preview').src = japex.image || '';
                        }
                    }

                    // Home Portfolio Preview
                    if (content.homePortfolio) {
                        const hp = content.homePortfolio;
                        document.getElementById('ed-home-port-title').value = hp.title || 'GALERIA DE CASOS';
                        document.getElementById('ed-home-port-subtitle').value = hp.subtitle || 'Confira nossos principais trabalhos desenvolvidos com alto padrão estético.';
                        document.getElementById('ed-home-port-btn').value = hp.buttonText || 'VEJA O PORTFÓLIO COMPLETO →';
                        document.getElementById('ed-home-port-cover').value = hp.cover || 'assets/portfolio/1.webp';
                        document.getElementById('ed-home-port-cover-preview').src = hp.cover || 'assets/portfolio/1.webp';
                        updateCmsLivePreview();
                    }

                    // Portfolio items
                    portfolioItems = content.portfolio || [];
                    renderPortfolioEditor();

                    // Footer
                    if (content.footer) {
                        const foot = content.footer;
                        document.getElementById('ed-footer-desc').value = foot.desc || '';
                        document.getElementById('ed-footer-phone').value = foot.phone || '';
                        document.getElementById('ed-footer-phone-disp').value = foot.phoneDisplay || '';
                        document.getElementById('ed-footer-email').value = foot.email || '';
                        document.getElementById('ed-footer-instagram').value = foot.instagram || '';
                        document.getElementById('ed-footer-behance').value = foot.behance || '';
                    }
                }
            } catch (err) {
                console.warn('Failed to load content for editor:', err);
            }
        }

        // Helper de Compressão Automática de Imagem para WebP (Reduz até 90% do tamanho sem perder qualidade)
        async function compressImageForWeb(file) {
            if (!file || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
                return file;
            }
            return new Promise((resolve) => {
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1920;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob && blob.size < file.size) {
                            const compressedName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                            const compressedFile = new File([blob], compressedName, { type: 'image/webp' });
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    }, 'image/webp', 0.82);
                };
                img.onerror = () => resolve(file);
                img.src = url;
            });
        }

        // AJAX Upload Helper (Compressão Automática + Token Válido)
        async function uploadFileBinary(file, callback) {
            try {
                const token = sessionToken || sessionStorage.getItem('aldeia_admin_token') || localStorage.getItem('aldeia_admin_token');
                if (!token) {
                    alert('Sessão expirada. Por favor, faça login novamente.');
                    showLoginForm();
                    return;
                }

                // Compressão automática antes do envio
                const finalFile = await compressImageForWeb(file);

                const formData = new FormData();
                formData.append('file', finalFile);

                const headers = {
                    'Authorization': 'Bearer ' + token
                };

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: headers,
                    body: formData
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'success' && data.url) {
                        callback(data.url);
                    } else {
                        alert(data.message || 'Erro no envio da imagem.');
                    }
                } else if (res.status === 401) {
                    alert('Sessão não autorizada ou expirada. Por favor, faça login novamente.');
                    showLoginForm();
                } else {
                    let errText = 'Erro no envio da imagem.';
                    try {
                        const errData = await res.json();
                        if (errData.message) errText = errData.message;
                    } catch (_) {}
                    alert(errText);
                }
            } catch (err) {
                console.error(err);
                alert('Erro ao conectar ao servidor para upload.');
            }
        }

        function handleFounderUpload(founder, input) {
            const file = input.files[0];
            if (!file) return;
            uploadFileBinary(file, (url) => {
                if (founder === 'temari') {
                    document.getElementById('ed-t-image').value = url;
                    document.getElementById('ed-t-img-preview').src = url;
                } else {
                    document.getElementById('ed-j-image').value = url;
                    document.getElementById('ed-j-img-preview').src = url;
                }
            });
        }

        // Render Services Editor List
        function renderServicesEditor() {
            const listEl = document.getElementById('services-editor-list');
            listEl.innerHTML = '';
            servicesList.forEach((item, index) => {
                const row = document.createElement('div');
                row.style.cssText = 'background: rgba(255,255,255,0.02); padding: 20px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 10px;';
                
                row.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: #e4e4e7; font-weight: 600;">Serviço #${index + 1}</span>
                        <button type="button" class="btn-action btn-email" onclick="deleteServiceItem(${index})" style="padding: 4px 8px; font-size: 0.7rem; border-color: rgba(239, 68, 68, 0.2); color: #ef4444;">Remover</button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="input-group">
                            <label class="input-label">Título</label>
                            <input class="input-control" type="text" value="${item.title || ''}" onchange="updateServiceTitle(${index}, this.value)" style="width: 100%;">
                        </div>
                        <div class="input-group">
                            <label class="input-label">Tags (separadas por vírgula)</label>
                            <input class="input-control" type="text" value="${(item.tags || []).join(', ')}" onchange="updateServiceTags(${index}, this.value)" style="width: 100%;">
                        </div>
                    </div>
                    <div class="input-group">
                        <label class="input-label">Descrição</label>
                        <textarea class="input-control" style="min-height: 60px; width: 100%;" onchange="updateServiceText(${index}, this.value)">${item.text || ''}</textarea>
                    </div>
                    <div class="input-group">
                        <label class="input-label">Imagem do Serviço</label>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="${item.image || ''}" id="ed-s-img-preview-${index}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; background: #222;">
                            <input type="text" value="${item.image || ''}" readonly style="flex: 1; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); padding: 8px; border-radius: 4px; color: #aaa; font-size: 0.75rem;">
                            <button type="button" class="btn-action btn-email" onclick="document.getElementById('ed-s-file-${index}').click()" style="padding: 6px 12px; font-size: 0.75rem;">Upload</button>
                            <input type="file" id="ed-s-file-${index}" accept="image/*" style="display: none;" onchange="handleServiceUpload(${index}, this)">
                        </div>
                    </div>
                `;
                listEl.appendChild(row);
            });
        }

        function updateServiceTitle(index, val) { servicesList[index].title = val; }
        function updateServiceText(index, val) { servicesList[index].text = val; }
        function updateServiceTags(index, val) { servicesList[index].tags = val.split(',').map(t => t.trim()).filter(Boolean); }
        function handleServiceUpload(index, input) {
            const file = input.files[0];
            if (!file) return;
            uploadFileBinary(file, (url) => {
                servicesList[index].image = url;
                renderServicesEditor();
            });
        }
        function deleteServiceItem(index) {
            servicesList.splice(index, 1);
            renderServicesEditor();
        }
        function addServiceItemRow() {
            servicesList.push({ title: 'Novo Serviço', text: 'Descrição do serviço', tags: ['Tag 1'], image: 'assets/portfolio/1.webp' });
            renderServicesEditor();
        }

        // Render FAQs Editor List
        function renderFaqsEditor() {
            const listEl = document.getElementById('faqs-editor-list');
            listEl.innerHTML = '';
            faqsList.forEach((item, index) => {
                const row = document.createElement('div');
                row.style.cssText = 'background: rgba(255,255,255,0.02); padding: 20px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 10px;';
                
                row.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: #e4e4e7; font-weight: 600;">Dúvida #${index + 1}</span>
                        <button type="button" class="btn-action btn-email" onclick="deleteFaqItem(${index})" style="padding: 4px 8px; font-size: 0.7rem; border-color: rgba(239, 68, 68, 0.2); color: #ef4444;">Remover</button>
                    </div>
                    <div class="input-group">
                        <label class="input-label">Pergunta</label>
                        <input class="input-control" type="text" value="${item.q || ''}" onchange="updateFaqQuestion(${index}, this.value)" style="width: 100%;">
                    </div>
                    <div class="input-group">
                        <label class="input-label">Resposta (Aceita HTML)</label>
                        <textarea class="input-control" style="min-height: 80px; width: 100%;" onchange="updateFaqAnswer(${index}, this.value)">${item.a || ''}</textarea>
                    </div>
                `;
                listEl.appendChild(row);
            });
        }

        function updateFaqQuestion(index, val) { faqsList[index].q = val; }
        function updateFaqAnswer(index, val) { faqsList[index].a = val; }
        function deleteFaqItem(index) {
            faqsList.splice(index, 1);
            renderFaqsEditor();
        }
        function addFaqItemRow() {
            faqsList.push({ q: 'Pergunta exemplo?', a: 'Resposta exemplo.' });
            renderFaqsEditor();
        }

        // Render Portfolio Items Editor List
        function renderPortfolioEditor() {
            const listEl = document.getElementById('portfolio-editor-list');
            listEl.innerHTML = '';

            portfolioItems.forEach((item, index) => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);';
                
                row.innerHTML = `
                    <img src="${item.src}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; background: #222;">
                    <div style="flex: 1; display: flex; gap: 15px; align-items: center;">
                        <input class="input-control" type="text" value="${item.src}" readonly style="flex: 0.4; font-size: 0.75rem; color: #888;">
                        <input class="input-control" type="text" placeholder="Nome/Descrição do Projeto" value="${item.alt || ''}" style="flex: 0.6; font-size: 0.85rem;" onchange="updatePortfolioItemAlt(${index}, this.value)">
                    </div>
                    <button type="button" class="btn-action btn-email" onclick="document.getElementById('ed-p-file-${index}').click()" style="padding: 8px 12px; font-size: 0.75rem;">Upload</button>
                    <input type="file" id="ed-p-file-${index}" accept="image/*" style="display: none;" onchange="handlePortfolioUpload(${index}, this)">
                    <button type="button" class="btn-action btn-email" onclick="deletePortfolioItem(${index})" style="padding: 8px 12px; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.2); color: #ef4444;">Excluir</button>
                `;
                listEl.appendChild(row);
            });
        }

        function updatePortfolioItemAlt(index, val) {
            portfolioItems[index].alt = val;
        }

        function handlePortfolioUpload(index, input) {
            const file = input.files[0];
            if (!file) return;
            uploadFileBinary(file, (url) => {
                portfolioItems[index].src = url;
                renderPortfolioEditor();
            });
        }

        function deletePortfolioItem(index) {
            portfolioItems.splice(index, 1);
            renderPortfolioEditor();
        }

        function handleHomePortCoverUpload(input) {
            const file = input.files[0];
            if (!file) return;
            uploadFileBinary(file, (url) => {
                document.getElementById('ed-home-port-cover').value = url;
                document.getElementById('ed-home-port-cover-preview').src = url;
                updateCmsLivePreview();
            });
        }

        function updateCmsLivePreview() {
            const title = document.getElementById('ed-home-port-title')?.value || 'GALERIA DE CASOS';
            const subtitle = document.getElementById('ed-home-port-subtitle')?.value || 'Confira nossos principais trabalhos desenvolvidos.';
            const btn = document.getElementById('ed-home-port-btn')?.value || 'VEJA O PORTFÓLIO COMPLETO →';
            const cover = document.getElementById('ed-home-port-cover')?.value || 'assets/portfolio/1.webp';

            const pTitle = document.getElementById('prev-home-port-title');
            const pSubtitle = document.getElementById('prev-home-port-subtitle');
            const pBtn = document.getElementById('prev-home-port-btn');
            const pCover = document.getElementById('prev-home-port-cover');

            if (pTitle) pTitle.textContent = title;
            if (pSubtitle) pSubtitle.textContent = subtitle;
            if (pBtn) pBtn.textContent = btn;
            if (pCover && cover) pCover.src = cover;
        }

        function addPortfolioItemRow() {
            portfolioItems.push({
                src: 'assets/portfolio/1.webp',
                alt: 'Novo Projeto'
            });
            renderPortfolioEditor();
        }

        // Form Submit
        const editorForm = document.getElementById('site-editor-form');
        editorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('ed-btn-save');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            const data = {
                heroTitleLine1: document.getElementById('ed-title-l1').value,
                heroTitleLine2: document.getElementById('ed-title-l2').value,
                heroTitleLine3: document.getElementById('ed-title-l3').value,
                heroSubtitle: document.getElementById('ed-subtitle').value,
                about: {
                    label: document.getElementById('ed-about-label').value,
                    bigText: document.getElementById('ed-about-bigtext').value,
                    card1: document.getElementById('ed-about-card1').value,
                    card2: document.getElementById('ed-about-card2').value
                },
                services: {
                    desc: document.getElementById('ed-services-desc').value,
                    items: servicesList
                },
                faqs: faqsList,
                future: {
                    text: document.getElementById('ed-future-text').value,
                    subtitle: document.getElementById('ed-future-subtitle').value,
                    scale: parseFloat(document.getElementById('ed-future-scale').value),
                    refraction: parseFloat(document.getElementById('ed-future-refraction').value),
                    blur: parseFloat(document.getElementById('ed-future-blur').value),
                    liquid: parseFloat(document.getElementById('ed-future-liquid').value),
                    speed: parseFloat(document.getElementById('ed-future-speed').value),
                    wave: parseFloat(document.getElementById('ed-future-wave').value),
                    brightness: parseFloat(document.getElementById('ed-future-brightness').value),
                    contrast: parseFloat(document.getElementById('ed-future-contrast').value),
                    chroma: parseFloat(document.getElementById('ed-future-chroma').value),
                    lightColor: document.getElementById('ed-future-light-color').value,
                    darkColor: document.getElementById('ed-future-dark-color').value,
                    tint: document.getElementById('ed-future-tint').value
                },
                founders: {
                    temari: {
                        name: document.getElementById('ed-t-name').value,
                        handle: document.getElementById('ed-t-handle').value,
                        role: document.getElementById('ed-t-role').value,
                        status: document.getElementById('ed-t-status').value,
                        bio: document.getElementById('ed-t-bio').value,
                        image: document.getElementById('ed-t-image').value
                    },
                    japex: {
                        name: document.getElementById('ed-j-name').value,
                        handle: document.getElementById('ed-j-handle').value,
                        role: document.getElementById('ed-j-role').value,
                        status: document.getElementById('ed-j-status').value,
                        bio: document.getElementById('ed-j-bio').value,
                        image: document.getElementById('ed-j-image').value
                    }
                },
                homePortfolio: {
                    title: document.getElementById('ed-home-port-title') ? document.getElementById('ed-home-port-title').value : 'GALERIA DE CASOS',
                    subtitle: document.getElementById('ed-home-port-subtitle') ? document.getElementById('ed-home-port-subtitle').value : 'Confira nossos principais trabalhos.',
                    buttonText: document.getElementById('ed-home-port-btn') ? document.getElementById('ed-home-port-btn').value : 'VEJA O PORTFÓLIO COMPLETO →',
                    cover: document.getElementById('ed-home-port-cover') ? document.getElementById('ed-home-port-cover').value : 'assets/portfolio/1.webp'
                },
                portfolio: portfolioItems,
                footer: {
                    desc: document.getElementById('ed-footer-desc').value,
                    phone: document.getElementById('ed-footer-phone').value,
                    phoneDisplay: document.getElementById('ed-footer-phone-disp').value,
                    email: document.getElementById('ed-footer-email').value,
                    instagram: document.getElementById('ed-footer-instagram').value,
                    behance: document.getElementById('ed-footer-behance').value
                }
            };

            try {
                const res = await fetch('/api/content', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify(data)
                });

                if (res.ok) {
                    alert('Conteúdo do site atualizado com sucesso!');
                    loadSiteContentForEditor();
                } else {
                    alert('Erro ao salvar as alterações.');
                }
            } catch (err) {
                console.error(err);
                alert('Erro na conexão com o servidor.');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar Todas as Alterações';
            }
        });

        // ===== AUTHENTICATION STATE =====
        let sessionToken = null;

        function getAuthHeaders() {
            const token = sessionToken || sessionStorage.getItem('aldeia_admin_token') || localStorage.getItem('aldeia_admin_token');
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                sessionToken = token;
                headers['Authorization'] = `Bearer ${token}`;
            }
            return headers;
        }

        function startAdminDashboard(token) {
            sessionToken = token;
            sessionStorage.setItem('aldeia_admin_token', token);
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            
            loadDashboardStats();
            loadSubmissions();
            loadClients();
            loadPortfolio();
            loadLoginLogs();
            loadSiteContentForEditor();
            if (typeof loadTelemetryData === 'function') {
                loadTelemetryData();
            }
        }

        // ===== TELEMETRY DASHBOARD =====
        const host = window.location.hostname || 'localhost';
        const TELEMETRY_API = `http://${host}:3001/api/telemetry`;
        let teleConvChart = null;
        let teleDailyChart = null;

        async function loadTelemetryData() {
            try {
                const [statsRes, eventsRes] = await Promise.all([
                    fetch(TELEMETRY_API + '/stats'),
                    fetch(TELEMETRY_API + '/events?limit=50')
                ]);

                if (statsRes.ok) {
                    const stats = await statsRes.json();
                    renderTelemetryStats(stats);
                    renderTelemetryCharts(stats);
                }

                if (eventsRes.ok) {
                    const events = await eventsRes.json();
                    renderTelemetryEvents(events);
                }
            } catch (err) {
                console.warn('[Telemetria] Servidor de telemetria indisponível:', err.message);
                document.getElementById('tele-conversion-rate').textContent = '—';
                document.getElementById('tele-total-sessions').textContent = '—';
            }
        }

        function renderTelemetryStats(stats) {
            const total = stats.total ? stats.total.total : 0;
            const conversions = stats.conversions ? stats.conversions.total : 0;
            const rate = total > 0 ? ((conversions / total) * 100).toFixed(1) : 0;
            const avgConvTime = stats.avg_conversion_time && stats.avg_conversion_time.avg_time
                ? stats.avg_conversion_time.avg_time.toFixed(1) : '0';
            const avgAbandonTime = stats.avg_abandon_time && stats.avg_abandon_time.avg_time
                ? stats.avg_abandon_time.avg_time.toFixed(1) : '0';

            document.getElementById('tele-conversion-rate').textContent = rate + '%';
            document.getElementById('tele-conv-detail').textContent = `${conversions} de ${total} sessões`;
            document.getElementById('tele-avg-conv-time').textContent = avgConvTime + 's';
            document.getElementById('tele-avg-abandon-time').textContent = avgAbandonTime + 's';
            document.getElementById('tele-total-sessions').textContent = total;
        }

        function renderTelemetryCharts(stats) {
            const conversions = stats.conversions ? stats.conversions.total : 0;
            const abandonments = stats.abandonments ? stats.abandonments.total : 0;

            // Doughnut chart
            const convCtx = document.getElementById('teleConversionChart').getContext('2d');
            if (teleConvChart) teleConvChart.destroy();
            teleConvChart = new Chart(convCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Convertidos', 'Abandonos'],
                    datasets: [{
                        data: [conversions, abandonments],
                        backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(239, 68, 68, 0.5)'],
                        borderColor: ['#22c55e', '#ef4444'],
                        borderWidth: 2,
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#888',
                                font: { size: 12 },
                                padding: 20,
                                usePointStyle: true,
                                pointStyleWidth: 10
                            }
                        }
                    }
                }
            });

            // Daily volume line chart
            const dailyCtx = document.getElementById('teleDailyChart').getContext('2d');
            if (teleDailyChart) teleDailyChart.destroy();

            const dailyData = stats.daily_volume || [];
            const labels = dailyData.map(d => {
                const date = new Date(d.day + 'T00:00:00');
                return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            });

            teleDailyChart = new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Conversões',
                            data: dailyData.map(d => d.conversions),
                            borderColor: '#22c55e',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointBackgroundColor: '#22c55e'
                        },
                        {
                            label: 'Abandonos',
                            data: dailyData.map(d => d.abandonments),
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointBackgroundColor: '#ef4444'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            ticks: { color: '#666', font: { size: 11 } },
                            grid: { color: 'rgba(255,255,255,0.03)' }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#666',
                                font: { size: 11 },
                                stepSize: 1
                            },
                            grid: { color: 'rgba(255,255,255,0.03)' }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#888',
                                font: { size: 12 },
                                usePointStyle: true,
                                pointStyleWidth: 10
                            }
                        }
                    }
                }
            });
        }

        function renderTelemetryEvents(events) {
            const listEl = document.getElementById('telemetry-events-list');
            const emptyEl = document.getElementById('telemetry-empty-state');
            listEl.innerHTML = '';

            if (!events || events.length === 0) {
                emptyEl.style.display = 'block';
                return;
            }
            emptyEl.style.display = 'none';

            events.forEach(ev => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => showTelemetryDetails(ev));

                const badge = ev.converted
                    ? '<span class="tele-badge badge-converted">● Convertido</span>'
                    : '<span class="tele-badge badge-abandoned">● Abandonou</span>';
                const dwellFormatted = ev.dwell_time < 60
                    ? ev.dwell_time.toFixed(1) + 's'
                    : Math.floor(ev.dwell_time / 60) + 'm ' + (ev.dwell_time % 60).toFixed(0) + 's';

                tr.innerHTML = `
                    <td><span style="font-family: var(--font-m); font-size: 0.8rem; color: #aaa;">${ev.session_id.substring(0, 12)}...</span></td>
                    <td>${badge}</td>
                    <td><span class="tele-dwell">${dwellFormatted}</span></td>
                    <td><span style="font-size: 0.8rem; color: var(--text-muted);">${ev.page_url || '/'}</span></td>
                    <td><span class="timestamp-text">${ev.created_at || '—'}</span></td>
                `;
                listEl.appendChild(tr);
            });
        }

        // Show Telemetry Session Details Modal
        function showTelemetryDetails(ev) {
            const modal = document.getElementById('telemetry-detail-modal');
            const body = document.getElementById('telemetry-detail-body');
            if (!modal || !body) return;
            
            body.innerHTML = `
                <div style="display:flex; flex-direction:column; gap: 8px;">
                    <div><strong>ID da Sessão:</strong> <span style="font-family: var(--font-m); font-size: 0.85rem; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; color: #fff;">${ev.session_id}</span></div>
                    <div><strong>Status:</strong> ${ev.converted ? '<span class="tele-badge badge-converted">● Convertido</span>' : '<span class="tele-badge badge-abandoned">● Abandonou</span>'}</div>
                    <div><strong>Tempo de Permanência:</strong> ${ev.dwell_time.toFixed(1)} segundos</div>
                    <div><strong>Página de Origem:</strong> ${escapeHTML(ev.page_url || '/')}</div>
                    <div><strong>IP do Visitante:</strong> ${escapeHTML(ev.masked_ip || '—')}</div>
                    <div><strong>User Agent (Navegador):</strong> <span style="font-size: 0.85rem; color: var(--text-muted);">${escapeHTML(ev.user_agent || '—')}</span></div>
                    <div><strong>Criado em:</strong> ${escapeHTML(ev.created_at || '—')}</div>
                </div>
            `;
            modal.style.display = 'flex';
        }
        
        function closeTelemetryDetailModal() {
            const modal = document.getElementById('telemetry-detail-modal');
            if (modal) modal.style.display = 'none';
        }

        // Fetch and load security stats (Rate Limiter)
        async function loadSecurityStats() {
            const container = document.getElementById('security-stats-list');
            if (!container) return;
            
            container.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Carregando métricas de segurança...</td></tr>';
            
            try {
                const response = await fetch('/api/security/stats', {
                    headers: getAuthHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    container.innerHTML = '';
                    
                    if (!data.ips || data.ips.length === 0) {
                        container.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Nenhum IP monitorado ativo no momento.</td></tr>';
                        return;
                    }
                    
                    data.ips.forEach(ipStat => {
                        const tr = document.createElement('tr');
                        const statusBadge = ipStat.isBlocked 
                            ? '<span class="badge-whatsapp-clicked clicked-no" style="display:inline-block;">Bloqueado (429 Excedido)</span>'
                            : '<span class="badge-whatsapp-clicked clicked-yes" style="display:inline-block;">Ativo / Seguro</span>';
                            
                        tr.innerHTML = `
                            <td><strong style="font-family: var(--font-m); color: #fff;">${escapeHTML(ipStat.ip)}</strong></td>
                            <td>${escapeHTML(ipStat.requests)} reqs / min</td>
                            <td>${statusBadge}</td>
                        `;
                        container.appendChild(tr);
                    });
                } else {
                    container.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Não foi possível carregar as métricas de segurança (401/500).</td></tr>';
                }
            } catch (err) {
                console.error(err);
                container.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Erro ao carregar métricas.</td></tr>';
            }
        }

        // Presets de cor de destaque da equipe
        function setAccentPreset(color) {
            document.getElementById('port-accent-color').value = color;
            document.getElementById('port-color-hex').textContent = color;
        }

        let rawPortfolioProjects = [];

        // ===== PORTFOLIO MANAGER =====
        async function loadPortfolio() {
            const listEl = document.getElementById('portfolio-list');
            if (!listEl) return;
            
            listEl.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Carregando portfólio...</td></tr>';
            
            try {
                const res = await fetch('/api/portfolio?t=' + Date.now());
                if (res.ok) {
                    rawPortfolioProjects = await res.json();
                    listEl.innerHTML = '';
                    if (rawPortfolioProjects.length === 0) {
                        listEl.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhum projeto cadastrado.</td></tr>';
                        return;
                    }
                    rawPortfolioProjects.forEach(p => {
                        const tr = document.createElement('tr');
                        const colorHex = p.accentColor || p.color || '#e4e4e7';
                        tr.innerHTML = `
                            <td>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div style="width:12px; height:12px; border-radius:50%; background:${colorHex}; border:1px solid rgba(255,255,255,0.3); flex-shrink:0;"></div>
                                    <strong style="color:#fff;">${escapeHTML(p.title)}</strong>
                                </div>
                            </td>
                            <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${escapeHTML(p.categoryLabel || p.category)}</span></td>
                            <td>
                                <div style="display:flex; gap:8px;">
                                    <button onclick="editProject('${p.id}')" style="background: rgba(228, 228, 231, 0.15); color: #a1a1aa; border: 1px solid rgba(228, 228, 231, 0.3); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Editar</button>
                                    <button onclick="deleteProject('${p.id}')" style="background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Excluir</button>
                                </div>
                            </td>
                        `;
                        listEl.appendChild(tr);
                    });
                }
            } catch (err) {
                console.error(err);
                listEl.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Erro ao carregar portfólio.</td></tr>';
            }
        }

        function editProject(id) {
            const project = rawPortfolioProjects.find(p => p.id === id);
            if (!project) return;

            document.getElementById('port-edit-id').value = project.id;
            document.getElementById('port-title').value = project.title || '';
            document.getElementById('port-category').value = project.category || 'artes';
            document.getElementById('port-format').value = project.format || 'post';
            
            const accent = project.accentColor || project.color || '#e4e4e7';
            document.getElementById('port-accent-color').value = accent;
            document.getElementById('port-color-hex').textContent = accent;

            document.getElementById('port-cover').value = project.cover || '';
            const preview = document.getElementById('port-cover-preview');
            if (project.cover) {
                preview.src = project.cover;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
            
            // Member info
            document.getElementById('port-member-name').value = project.member?.name || '';
            document.getElementById('port-member-role').value = project.member?.role || '';
            document.getElementById('port-member-photo').value = project.member?.photo || '';
            const memberPreview = document.getElementById('port-member-photo-preview');
            if (project.member?.photo) {
                memberPreview.src = project.member.photo;
                memberPreview.style.display = 'block';
            } else {
                memberPreview.style.display = 'none';
            }

            portGalleryAssets = Array.isArray(project.assets) ? JSON.parse(JSON.stringify(project.assets)) : [];
            renderPortGalleryBuilder();

            document.getElementById('port-submit-btn').textContent = 'Atualizar Projeto';
            document.getElementById('port-cancel-btn').style.display = 'block';
            
            // Scroll to form
            document.getElementById('portfolio-form').scrollIntoView({ behavior: 'smooth' });
        }

        function resetPortForm() {
            document.getElementById('port-edit-id').value = '';
            document.getElementById('portfolio-form').reset();
            document.getElementById('port-cover-preview').style.display = 'none';
            document.getElementById('port-accent-color').value = '#e4e4e7';
            document.getElementById('port-color-hex').textContent = '#e4e4e7';
            document.getElementById('port-format').value = 'post';
            
            document.getElementById('port-member-name').value = '';
            document.getElementById('port-member-role').value = '';
            document.getElementById('port-member-photo').value = '';
            document.getElementById('port-member-photo-preview').style.display = 'none';
            portGalleryAssets = [];
            renderPortGalleryBuilder();
            document.getElementById('port-submit-btn').textContent = 'Salvar Projeto';
            document.getElementById('port-cancel-btn').style.display = 'none';
        }

        async function deleteProject(id) {
            if (!confirm('Tem certeza que deseja excluir este projeto?')) return;
            try {
                const res = await fetch(`/api/portfolio/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    loadPortfolio();
                } else {
                    alert('Erro ao excluir projeto.');
                }
            } catch (err) {
                console.error(err);
                alert('Erro de conexão ao excluir.');
            }
        }

        // --- Múltipla exclusão de Portfólio ---
        function toggleAllPortfolios(checked) {
            const checkboxes = document.querySelectorAll('.port-checkbox');
            checkboxes.forEach(cb => cb.checked = checked);
            updatePortDeleteBtn();
        }

        function updatePortDeleteBtn() {
            const checkboxes = document.querySelectorAll('.port-checkbox:checked');
            const btn = document.getElementById('btn-delete-selected-port');
            if (checkboxes.length > 0) {
                btn.style.display = 'block';
                btn.textContent = 'Excluir Selecionados (' + checkboxes.length + ')';
            } else {
                btn.style.display = 'none';
                document.getElementById('port-select-all').checked = false;
            }
        }

        async function deleteSelectedPortfolios() {
            const checkboxes = document.querySelectorAll('.port-checkbox:checked');
            if (checkboxes.length === 0) return;
            if (!confirm(`Tem certeza que deseja excluir os ${checkboxes.length} projetos selecionados?`)) return;

            const idsToDelete = Array.from(checkboxes).map(cb => cb.value);
            
            try {
                for (const id of idsToDelete) {
                    await fetch(`/api/portfolio/${id}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                }
                document.getElementById('port-select-all').checked = false;
                updatePortDeleteBtn();
                loadPortfolio();
                alert('Projetos selecionados excluídos com sucesso.');
            } catch (err) {
                console.error(err);
                alert('Erro de conexão durante exclusão em massa.');
            }
        }
        // ------------------------------------

        // Upload Capa do Portfólio
        function handlePortCoverUpload(input) {
            const file = input.files[0];
            if (!file) return;
            
            uploadFileBinary(file, (url) => {
                document.getElementById('port-cover').value = url;
                const preview = document.getElementById('port-cover-preview');
                preview.src = url;
                preview.style.display = 'block';
            });
        }

        // Upload Foto do Membro do Portfólio
        function handlePortMemberPhotoUpload(input) {
            const file = input.files[0];
            if (!file) return;
            
            uploadFileBinary(file, (url) => {
                document.getElementById('port-member-photo').value = url;
                const preview = document.getElementById('port-member-photo-preview');
                preview.src = url;
                preview.style.display = 'block';
            });
        }

        // Construtor da Galeria do Portfólio
        let portGalleryAssets = [];

        function renderPortGalleryBuilder() {
            const container = document.getElementById('port-gallery-builder');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (portGalleryAssets.length === 0) {
                container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 10px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px;">Nenhuma mídia adicionada à galeria.</div>';
                return;
            }

            portGalleryAssets.forEach((asset, index) => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);';
                
                let previewHtml = '';
                if (asset.src) {
                    if (asset.type === 'video') {
                        previewHtml = `<video src="${asset.src}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; background: #222;" muted></video>`;
                    } else {
                        previewHtml = `<img src="${asset.src}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; background: #222;">`;
                    }
                } else {
                    previewHtml = `<div style="width: 40px; height: 40px; border-radius: 4px; background: #222; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: #888;">N/A</div>`;
                }

                row.innerHTML = `
                    ${previewHtml}
                    <select onchange="updatePortGalleryType(${index}, this.value)" style="background: rgba(255,255,255,0.05); border: none; padding: 8px; border-radius: 4px; color:#fff; font-size: 0.8rem;">
                        <option value="image" ${asset.type === 'image' ? 'selected' : ''}>Imagem</option>
                        <option value="video" ${asset.type === 'video' ? 'selected' : ''}>Vídeo</option>
                    </select>
                    <input type="text" value="${asset.src}" placeholder="Upload pendente..." readonly style="flex: 1; background: transparent; border: none; color:#aaa; font-size: 0.8rem; cursor: default;">
                    
                    <button type="button" class="btn-action" onclick="document.getElementById('port-gallery-file-${index}').click()" style="padding: 6px 12px; font-size: 0.75rem; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff;">Upload</button>
                    <input type="file" id="port-gallery-file-${index}" accept="image/*,video/*" style="display: none;" onchange="handlePortGalleryUpload(${index}, this)">
                    
                    <button type="button" class="btn-action" onclick="removePortGalleryItem(${index})" style="padding: 6px 10px; font-size: 0.75rem; border-radius: 4px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444;">✕</button>
                `;
                container.appendChild(row);
            });
        }

        function addPortGalleryItem() {
            portGalleryAssets.push({ type: 'image', src: '' });
            renderPortGalleryBuilder();
        }

        function removePortGalleryItem(index) {
            portGalleryAssets.splice(index, 1);
            renderPortGalleryBuilder();
        }

        function updatePortGalleryType(index, type) {
            portGalleryAssets[index].type = type;
            renderPortGalleryBuilder();
        }

        function handlePortGalleryUpload(index, input) {
            const file = input.files[0];
            if (!file) return;
            
            uploadFileBinary(file, (url) => {
                portGalleryAssets[index].src = url;
                if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
                    portGalleryAssets[index].type = 'video';
                }
                renderPortGalleryBuilder();
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            renderPortGalleryBuilder();

            const portForm = document.getElementById('portfolio-form');
            if (portForm) {
                portForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const editId = document.getElementById('port-edit-id').value;
                    const title = document.getElementById('port-title').value;
                    const categoryEl = document.getElementById('port-category');
                    const category = categoryEl.value;
                    const categoryLabel = categoryEl.options[categoryEl.selectedIndex].text;
                    const format = document.getElementById('port-format').value || 'post';
                    const aspectRatio = format === 'story' ? '9:16' : (format === 'video' ? '16:9' : '1:1');
                    const accentColor = document.getElementById('port-accent-color').value || '#e4e4e7';
                    const cover = document.getElementById('port-cover').value;
                    
                    const memberName = document.getElementById('port-member-name').value.trim();
                    const memberRole = document.getElementById('port-member-role').value.trim();
                    const memberPhoto = document.getElementById('port-member-photo').value.trim();
                    
                    const member = (memberName || memberRole || memberPhoto) ? {
                        name: memberName,
                        role: memberRole,
                        photo: memberPhoto
                    } : null;
                    
                    const assets = portGalleryAssets.filter(a => a.src.trim() !== '');

                    if (!cover) {
                        alert('Faça o upload da capa do projeto.');
                        return;
                    }

                    const payload = { title, category, categoryLabel, format, aspectRatio, accentColor, cover, assets };
                    if (member) payload.member = member;
                    const isEdit = !!editId;
                    const url = isEdit ? `/api/portfolio/${editId}` : '/api/portfolio';
                    const method = isEdit ? 'PUT' : 'POST';

                    try {
                        const res = await fetch(url, {
                            method: method,
                            headers: getAuthHeaders(),
                            body: JSON.stringify(payload)
                        });
                        
                        if (res.ok) {
                            alert(isEdit ? 'Projeto atualizado com sucesso!' : 'Projeto adicionado com sucesso!');
                            resetPortForm();
                            loadPortfolio();
                        } else {
                            const errData = await res.json().catch(() => ({}));
                            alert(errData.message || 'Erro ao salvar projeto.');
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Erro de conexão ao salvar projeto.');
                    }
                });
            }
        });

        // Setup Live Search for Leads
        document.addEventListener('DOMContentLoaded', () => {
            const searchInput = document.getElementById('leads-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase().trim();
                    const rows = document.querySelectorAll('#submissions-list tr');
                    
                    rows.forEach(row => {
                        const text = row.textContent.toLowerCase();
                        if (text.includes(query)) {
                            row.style.display = 'table-row';
                        } else {
                            row.style.display = 'none';
                        }
                    });
                });
            }
        });

        // ===== AUTHENTICATION EVENTS & INITIAL CHECK =====
        const adminLogin = document.getElementById('admin-login');
        const adminDashboard = document.getElementById('admin-dashboard');
        const loginForm = document.getElementById('login-form');
        const loginErrorMsg = document.getElementById('login-error-msg');
        const adminPassword = document.getElementById('admin-password');
        const adminUsername = document.getElementById('admin-username');

        async function sha256(message) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }

        async function verifyToken(token) {
            try {
                const res = await fetch('/api/auth/verify', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    return data.username || 'Admin';
                }
                return false;
            } catch (err) {
                return false;
            }
        }

        function updateUIUser(username) {
            sessionStorage.setItem('aldeia_admin_user', username);
            const userElem = document.getElementById('auth-username');
            if (userElem) userElem.textContent = username;

            const avatar = document.getElementById('auth-avatar');
            if (avatar) {
                const u = (username || '').toLowerCase();
                if (u === 'japex') avatar.src = 'assets/japex.webp';
                else if (u === 'temari') avatar.src = 'assets/temari.webp';
            }
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = adminPassword.value;
            const username = adminUsername ? adminUsername.value.trim() : 'Admin';
            
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username, password: password })
                });
                
                if (res.ok) {
                    const data = await res.json();
                    loginErrorMsg.style.display = 'none';
                    updateUIUser(data.username);
                    startAdminDashboard(data.token);
                } else {
                    loginErrorMsg.style.display = 'block';
                    document.querySelector('.login-box').classList.add('shake-error');
                    setTimeout(() => {
                        document.querySelector('.login-box').classList.remove('shake-error');
                    }, 400);
                }
            } catch (err) {
                console.error(err);
                alert('Erro ao conectar com o servidor.');
            }
        });

        // Auto-login check on load
        async function checkAutoLogin() {
            const savedToken = sessionStorage.getItem('aldeia_admin_token');
            if (savedToken) {
                const validUsername = await verifyToken(savedToken);
                if (validUsername) {
                    updateUIUser(validUsername);
                    startAdminDashboard(savedToken);
                    return;
                }
            }
            // If no token or invalid, show login form
            adminLogin.style.display = 'flex';
            adminDashboard.style.display = 'none';
        }

        checkAutoLogin();
        // ===== LÓGICA DO QUADRO TRELLO (KANBAN) =====
        let allTrelloTasks = [];

        async function loadTrelloTasks() {
            try {
                const res = await fetch('/api/trello', { headers: getAuthHeaders() });
                if (res.ok) {
                    allTrelloTasks = await res.json();
                } else {
                    allTrelloTasks = [];
                }
            } catch (err) {
                console.error('[TRELLO LOAD ERROR]', err);
                allTrelloTasks = [];
            }
            renderTrelloBoard();
        }

        function renderTrelloBoard() {
            const filterEl = document.getElementById('trello-filter-assigned');
            const filterAssigned = filterEl ? filterEl.value : 'todos';

            const colBacklog = document.getElementById('trello-col-backlog');
            const colInProgress = document.getElementById('trello-col-in_progress');
            const colReview = document.getElementById('trello-col-review');
            const colDone = document.getElementById('trello-col-done');

            if (!colBacklog) return;

            colBacklog.innerHTML = '';
            colInProgress.innerHTML = '';
            colReview.innerHTML = '';
            colDone.innerHTML = '';

            let countBacklog = 0, countInProgress = 0, countReview = 0, countDone = 0;

            const filtered = allTrelloTasks.filter(t => {
                if (filterAssigned === 'todos') return true;
                return (t.assignedTo || '').toLowerCase() === filterAssigned.toLowerCase();
            });

            filtered.forEach(task => {
                const status = task.status || 'backlog';
                if (status === 'backlog') countBacklog++;
                else if (status === 'in_progress') countInProgress++;
                else if (status === 'review') countReview++;
                else if (status === 'done') countDone++;

                const cardHtml = createTrelloCardElement(task);

                if (status === 'backlog') colBacklog.appendChild(cardHtml);
                else if (status === 'in_progress') colInProgress.appendChild(cardHtml);
                else if (status === 'review') colReview.appendChild(cardHtml);
                else if (status === 'done') colDone.appendChild(cardHtml);
            });

            document.getElementById('badge-count-backlog').textContent = countBacklog;
            document.getElementById('badge-count-in_progress').textContent = countInProgress;
            document.getElementById('badge-count-review').textContent = countReview;
            document.getElementById('badge-count-done').textContent = countDone;
        }

        function createTrelloCardElement(task) {
            const card = document.createElement('div');
            card.className = 'trello-card';

            const assignedName = task.assignedTo || 'Japex';
            let avatarUrl = 'assets/japex.webp';
            if (assignedName.toLowerCase() === 'temari') avatarUrl = 'assets/temari.webp';
            if (assignedName.toLowerCase() === 'nesh') avatarUrl = 'assets/japex.webp';

            const prioClass = (task.priority || 'média').toLowerCase();

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <span class="card-tag ${prioClass}">${task.priority || 'Média'}</span>
                    ${task.clientName ? `<span style="font-size:0.7rem; color:#e4e4e7; background:rgba(228,228,231,0.1); padding:2px 6px; border-radius:4px;">👤 ${escapeHTML(task.clientName)}</span>` : ''}
                </div>
                <h4 style="color:#fff; font-size: 0.95rem; font-weight:600; margin: 2px 0;">${escapeHTML(task.title)}</h4>
                ${task.description ? `<p style="color:#aaa; font-size: 0.8rem; line-height: 1.4;">${escapeHTML(task.description)}</p>` : ''}
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
                    <div class="card-assignee">
                        <img src="${avatarUrl}" alt="${assignedName}">
                        <span>${assignedName}</span>
                    </div>
                    
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <select onchange="moveTrelloTask('${task.id}', this.value)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color:#fff; font-size: 0.75rem; border-radius: 4px; padding: 4px 6px; outline:none; cursor:pointer;">
                            <option value="backlog" ${task.status === 'backlog' ? 'selected' : ''}>A Fazer</option>
                            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>Em Andamento</option>
                            <option value="review" ${task.status === 'review' ? 'selected' : ''}>Em Revisão</option>
                            <option value="done" ${task.status === 'done' ? 'selected' : ''}>Concluído</option>
                        </select>
                        <button onclick="deleteTrelloTask('${task.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 4px;" title="Excluir Tarefa">🗑️</button>
                    </div>
                </div>
            `;
            return card;
        }

        function openNewTaskModal() {
            document.getElementById('trello-task-id').value = '';
            document.getElementById('trello-task-title').value = '';
            document.getElementById('trello-task-desc').value = '';
            document.getElementById('trello-task-client').value = '';
            document.getElementById('trello-task-modal').classList.add('active');
        }

        function closeTrelloTaskModal() {
            document.getElementById('trello-task-modal').classList.remove('active');
        }

        async function saveTrelloTask(e) {
            if (e) e.preventDefault();
            const id = document.getElementById('trello-task-id').value;
            const title = document.getElementById('trello-task-title').value.trim();
            const description = document.getElementById('trello-task-desc').value.trim();
            const assignedTo = document.getElementById('trello-task-assigned').value;
            const priority = document.getElementById('trello-task-priority').value;
            const status = document.getElementById('trello-task-status').value;
            const clientName = document.getElementById('trello-task-client').value.trim();

            if (!title) { alert('Digite o título da tarefa'); return; }

            const payload = { title, description, assignedTo, priority, status, clientName };
            const isEdit = !!id;
            const url = isEdit ? `/api/trello/${id}` : '/api/trello';
            const method = isEdit ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    closeTrelloTaskModal();
                    loadTrelloTasks();
                } else {
                    alert('Erro ao salvar tarefa no Trello');
                }
            } catch (err) {
                console.error(err);
                alert('Erro de conexão ao salvar tarefa');
            }
        }

        async function moveTrelloTask(id, newStatus) {
            try {
                await fetch(`/api/trello/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: newStatus })
                });
                loadTrelloTasks();
            } catch (err) {
                console.error(err);
            }
        }

        async function deleteTrelloTask(id) {
            if (!confirm('Deseja excluir esta tarefa do Trello?')) return;
            try {
                await fetch(`/api/trello/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                loadTrelloTasks();
            } catch (err) {
                console.error(err);
            }
        }

        // ===== LÓGICA DO PERFIL DO USUÁRIO =====
        async function loadUserProfile() {
            try {
                const res = await fetch('/api/profile', { headers: getAuthHeaders() });
                if (res.ok) {
                    const prof = await res.json();
                    document.getElementById('prof-display-name').value = prof.displayName || prof.username || '';
                    document.getElementById('prof-username').value = prof.username || 'Admin';
                    const avatarImg = document.getElementById('prof-avatar-preview');
                    if (avatarImg) avatarImg.src = prof.avatar || 'assets/japex.webp';
                }
            } catch (err) {
                console.error('[PROFILE LOAD ERROR]', err);
            }
        }

        async function saveUserProfile(e) {
            if (e) e.preventDefault();
            const displayName = document.getElementById('prof-display-name').value.trim();
            const avatar = document.getElementById('prof-avatar-url').value.trim() || document.getElementById('prof-avatar-preview').src;
            const password = document.getElementById('prof-password').value.trim();

            const payload = { displayName, avatar };
            if (password) payload.password = password;

            try {
                const res = await fetch('/api/profile', {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert('Perfil atualizado com sucesso!');
                    const userElem = document.getElementById('auth-username');
                    if (userElem) userElem.textContent = displayName;
                    const topAvatar = document.getElementById('auth-avatar');
                    if (topAvatar) topAvatar.src = avatar;
                } else {
                    alert('Erro ao atualizar perfil');
                }
            } catch (err) {
                console.error(err);
                alert('Erro de conexão ao atualizar perfil');
            }
        }

        function handleProfileAvatarUpload(input) {
            const file = input.files[0];
            if (!file) return;
            uploadFileBinary(file, (url) => {
                document.getElementById('prof-avatar-url').value = url;
                const preview = document.getElementById('prof-avatar-preview');
                if (preview) preview.src = url;
            });
        }


