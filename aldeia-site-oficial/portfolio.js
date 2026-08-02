document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.portfolio-tab');
    const grid = document.getElementById('portfolio-grid');

    let projects = [];

    // Busca os dados da API
    async function loadPortfolio() {
        try {
            const res = await fetch('/api/portfolio');
            if (res.ok) {
                projects = await res.json();
                renderGrid('all');
            }
        } catch (e) {
            console.error('Erro ao carregar portfólio:', e);
        }
    }

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
    loadPortfolio();
});
