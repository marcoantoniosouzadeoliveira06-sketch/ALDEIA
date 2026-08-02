document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.portfolio-tab');
    const grid = document.getElementById('portfolio-grid');

    let projects = [];

    // Retorna projetos padrão caso a API não tenha dados
    function getFallbackProjects() {
        return Array.from({ length: 21 }, (_, i) => ({
            id: `p${i + 1}`,
            title: `Projeto ALDEIA #${i + 1}`,
            category: i % 4 === 0 ? 'identidade' : i % 3 === 0 ? 'videos' : i % 2 === 0 ? 'social' : 'artes',
            categoryLabel: i % 4 === 0 ? 'Identidade Visual' : i % 3 === 0 ? 'Vídeos' : i % 2 === 0 ? 'Social Media' : 'Artes Avulsas',
            cover: `assets/portfolio/${i + 1}.webp`,
            assets: [
                { type: 'image', src: `assets/portfolio/${i + 1}.webp` }
            ]
        }));
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
            console.error('Erro ao carregar portfólio:', e);
            projects = getFallbackProjects();
        }
        renderGrid('all');
    }

    function renderGrid(filter) {
        if (!grid) return;
        grid.innerHTML = '';
        
        const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);
        
        if (filtered.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Nenhum projeto encontrado nesta categoria.</p>';
            return;
        }

        filtered.forEach((p, index) => {
            const delay = index * 0.05;
            const el = document.createElement('div');
            el.className = 'portfolio-card';
            el.style.animationDelay = `${delay}s`;
            
            el.innerHTML = `
                <div class="portfolio-card-img">
                    <img src="${p.cover}" alt="${p.title}" loading="lazy">
                </div>
                <div class="portfolio-card-overlay">
                    <span class="portfolio-card-cat">${p.categoryLabel}</span>
                    <h3 class="portfolio-card-title">${p.title}</h3>
                </div>
            `;
            
            el.addEventListener('click', () => {
                window.location.href = 'projeto.html?id=' + p.id;
            });
            grid.appendChild(el);
        });
    }

    // Event Listeners
    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderGrid(tab.getAttribute('data-filter'));
            });
        });
    }

    // Init
    loadPortfolio();
});

