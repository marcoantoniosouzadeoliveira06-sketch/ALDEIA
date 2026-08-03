document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.portfolio-tab');
    const grid = document.getElementById('portfolio-grid');

    let projects = [];

    const CATEGORY_MAP = {
        'identidade': 'Identidade Visual',
        'social': 'Social Media',
        'videos': 'Vídeos',
        'artes': 'Artes Avulsas'
    };

    // Retorna projetos padrão caso a API não tenha dados ou esteja offline
    function getFallbackProjects() {
        return Array.from({ length: 21 }, (_, i) => {
            const catKeys = ['identidade', 'videos', 'social', 'artes'];
            const cat = catKeys[i % catKeys.length];
            return {
                id: `p${i + 1}`,
                title: `Projeto ALDEIA #${i + 1}`,
                category: cat,
                categoryLabel: CATEGORY_MAP[cat],
                cover: `assets/portfolio/${i + 1}.webp`,
                assets: [
                    { type: 'image', src: `assets/portfolio/${i + 1}.webp` }
                ]
            };
        });
    }

    // Busca os dados da API
    async function loadPortfolio() {
        try {
            let res = await fetch('/api/portfolio?t=' + Date.now());
            if (!res.ok) {
                res = await fetch('portfolio.json?t=' + Date.now());
            }
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    projects = data;
                } else {
                    projects = getFallbackProjects();
                }
            } else {
                projects = getFallbackProjects();
            }
        } catch (e) {
            console.warn('Servidor offline ou rota indisponível, tentando portfolio.json local:', e);
            try {
                const resLocal = await fetch('portfolio.json?t=' + Date.now());
                if (resLocal.ok) {
                    const dataLocal = await resLocal.json();
                    if (Array.isArray(dataLocal)) {
                        projects = dataLocal;
                    } else {
                        projects = getFallbackProjects();
                    }
                } else {
                    projects = getFallbackProjects();
                }
            } catch (err) {
                projects = getFallbackProjects();
            }
        }
        renderGrid('all');
    }

    function renderGrid(filter) {
        if (!grid) return;
        grid.innerHTML = '';
        
        const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);
        
        if (filtered.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 60px 20px; font-size: 1.1rem;">Nenhum projeto encontrado nesta categoria.</p>';
            return;
        }

        filtered.forEach((p, index) => {
            const delay = index * 0.04;
            const el = document.createElement('div');
            el.className = 'portfolio-card';
            el.style.animationDelay = `${delay}s`;
            
            const accentColor = p.accentColor || p.color || '#a855f7';
            el.style.setProperty('--card-accent', accentColor);

            // Mapeamento de formatos de imagem
            let ratio = '4 / 5'; // default
            if (p.format === 'post') ratio = '1 / 1';
            else if (p.format === 'portrait') ratio = '4 / 5';
            else if (p.format === 'story') ratio = '9 / 16';
            else if (p.format === 'video') ratio = '16 / 9';
            
            if (p.format === 'auto') {
                el.classList.add('format-auto');
                el.style.aspectRatio = 'auto';
            } else {
                el.style.aspectRatio = ratio;
            }
            
            const catLabel = p.categoryLabel || CATEGORY_MAP[p.category] || 'Arte Avulsa';
            const badgeStyle = `background: ${accentColor}22; border: 1px solid ${accentColor}66; color: ${accentColor === '#ffffff' ? '#fff' : accentColor};`;
            
            let creatorHtml = '';
            if (p.member && p.member.name) {
                const rawPhoto = p.member.photo ? p.member.photo.trim() : '';
                const fallbackAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.member.name) + '&background=random';
                const photoSrc = rawPhoto || fallbackAvatar;
                creatorHtml = `
                    <div class="portfolio-card-creator" style="display: flex; align-items: center; gap: 8px; margin-top: 12px; transform: translateY(10px); opacity: 0.8; transition: opacity 0.3s;">
                        <img src="${photoSrc}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1.5px solid ${accentColor}88;" alt="${p.member.name}" onerror="this.onerror=null;this.src='${fallbackAvatar}';">
                        <div style="display: flex; flex-direction: column; line-height: 1.2;">
                            <span style="font-size: 0.75rem; color: #aaa;">Criador</span>
                            <span style="font-size: 0.85rem; color: #fff; font-weight: 600;">${p.member.name}</span>
                        </div>
                    </div>
                `;
            }

            el.innerHTML = `
                <div class="portfolio-card-img">
                    <img src="${p.cover}" alt="${p.title}" loading="lazy" onerror="this.onerror=null;this.src='assets/portfolio/${(index % 21) + 1}.webp';">
                </div>
                <div class="portfolio-card-badge" style="${badgeStyle}">${catLabel}</div>
                <div class="portfolio-card-overlay">
                    <span class="portfolio-card-cat" style="color:${accentColor}">${catLabel}</span>
                    <h3 class="portfolio-card-title">${p.title}</h3>
                    ${creatorHtml}
                </div>
            `;
            
            el.addEventListener('click', () => {
                if (window.__aldeiaTracker && window.__aldeiaTracker.trackPortfolioClick) {
                    window.__aldeiaTracker.trackPortfolioClick(p.title);
                }
                window.location.href = 'projeto.html?id=' + p.id;
            });
            grid.appendChild(el);
        });
    }

    // Event Listeners para os botões de abas / filtros
    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderGrid(tab.getAttribute('data-filter'));
            });
        });
    }

    // Inicialização
    loadPortfolio();
});
