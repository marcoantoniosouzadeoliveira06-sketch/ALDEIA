document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.portfolio-tab');
    const grid = document.getElementById('portfolio-grid');
    const modal = document.getElementById('project-modal');
    const modalOverlay = document.getElementById('project-modal-overlay');
    const modalClose = document.getElementById('project-modal-close');
    const modalTitle = document.getElementById('project-modal-title');
    const modalCategory = document.getElementById('project-modal-category');
    const modalBody = document.getElementById('project-modal-body');

    // MOCK DATA: Projetos e suas imagens detalhadas
    const projects = [
        {
            id: 'p1',
            title: 'Identidade FURY',
            category: 'identidade',
            categoryLabel: 'Identidade Visual',
            cover: 'assets/portfolio/1.webp',
            assets: [
                { type: 'image', src: 'assets/portfolio/1.webp' },
                { type: 'image', src: 'assets/portfolio/5.webp' },
                { type: 'image', src: 'assets/portfolio/3.webp' }
            ]
        },
        {
            id: 'p2',
            title: 'Campanha FURY 2026',
            category: 'videos',
            categoryLabel: 'Vídeos',
            cover: 'assets/portfolio/6.webp', // fallback de thumb
            assets: [
                { type: 'video', src: 'assets/hero-bg.mp4' }
            ]
        },
        {
            id: 'p3',
            title: 'Lançamento INFURIOUS',
            category: 'social',
            categoryLabel: 'Social Media',
            cover: 'assets/portfolio/2.webp',
            assets: [
                { type: 'image', src: 'assets/portfolio/2.webp' },
                { type: 'image', src: 'assets/portfolio/4.webp' }
            ]
        },
        {
            id: 'p4',
            title: 'Arte Avulsa X',
            category: 'artes',
            categoryLabel: 'Artes Avulsas',
            cover: 'assets/portfolio/7.webp',
            assets: [
                { type: 'image', src: 'assets/portfolio/7.webp' }
            ]
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
            
            el.addEventListener('click', () => openProjectModal(p));
            grid.appendChild(el);
        });
    }

    function openProjectModal(project) {
        if (!modal) return;
        
        modalTitle.textContent = project.title;
        modalCategory.textContent = project.categoryLabel;
        modalBody.innerHTML = '';
        
        project.assets.forEach(asset => {
            if (asset.type === 'video') {
                modalBody.innerHTML += `<div class="project-asset-wrap"><video src="${asset.src}" autoplay loop controls playsinline></video></div>`;
            } else {
                modalBody.innerHTML += `<div class="project-asset-wrap"><img src="${asset.src}" alt="Detalhe do projeto" loading="lazy"></div>`;
            }
        });

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (window.lenis) window.lenis.stop();
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
        if (window.lenis) window.lenis.start();
        setTimeout(() => { modalBody.innerHTML = ''; }, 400); // clear on end transition
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

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

    // Init
    renderGrid('all');
});
