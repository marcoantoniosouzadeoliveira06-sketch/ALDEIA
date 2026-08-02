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
            const res = await fetch('/api/portfolio');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    projects = data;
                } else {
                    projects = getFallbackProjects();
                }
            } else {
                projects = getFallbackProjects();
            }
        } catch (e) {
            console.warn('Servidor offline ou rota indisponível, carregando portfólio local:', e);
            projects = getFallbackProjects();
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
            
            const catLabel = p.categoryLabel || CATEGORY_MAP[p.category] || 'Arte Avulsa';
            const badgeStyle = `background: ${accentColor}22; border: 1px solid ${accentColor}66; color: ${accentColor === '#ffffff' ? '#fff' : accentColor};`;
            
            el.innerHTML = `
                <div class="portfolio-card-img">
                    <img src="${p.cover}" alt="${p.title}" loading="lazy" onerror="this.onerror=null;this.src='assets/portfolio/${(index % 21) + 1}.webp';">
                </div>
                <div class="portfolio-card-badge" style="${badgeStyle}">${catLabel}</div>
                <div class="portfolio-card-overlay">
                    <span class="portfolio-card-cat" style="color:${accentColor}">${catLabel}</span>
                    <h3 class="portfolio-card-title">${p.title}</h3>
                </div>
            `;
            
            el.addEventListener('click', () => {
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
