document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.portfolio-tab');
    const grid = document.getElementById('portfolio-grid');

    // MOCK DATA: Projetos e suas imagens detalhadas
    const projects = [
        {
            id: 'p1',
            title: 'Identidade FURY',
            category: 'identidade',
            categoryLabel: 'Identidade Visual',
            cover: 'assets/portfolio/1.webp'
        },
        {
            id: 'p2',
            title: 'Campanha FURY 2026',
            category: 'videos',
            categoryLabel: 'Vídeos',
            cover: 'assets/portfolio/6.webp'
        },
        {
            id: 'p3',
            title: 'Lançamento INFURIOUS',
            category: 'social',
            categoryLabel: 'Social Media',
            cover: 'assets/portfolio/2.webp'
        },
        {
            id: 'p4',
            title: 'Arte Avulsa X',
            category: 'artes',
            categoryLabel: 'Artes Avulsas',
            cover: 'assets/portfolio/7.webp'
        }
        // Você pode expandir este array via backend mais tarde.
    ];

    function renderGrid(filter) {
        if (!grid) return;
        grid.innerHTML = '';
        
        const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);
        
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
                // Ao clicar, redireciona para a página dedicada do projeto
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
    renderGrid('all');
});
