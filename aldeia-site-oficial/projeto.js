document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    // MOCK DATA (Idêntico ao do portfolio.js, com assets detalhados)
    const projects = [
        {
            id: 'p1',
            title: 'Identidade FURY',
            category: 'identidade',
            categoryLabel: 'Identidade Visual',
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
            assets: [
                { type: 'video', src: 'assets/hero-bg.mp4' }
            ]
        },
        {
            id: 'p3',
            title: 'Lançamento INFURIOUS',
            category: 'social',
            categoryLabel: 'Social Media',
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
            assets: [
                { type: 'image', src: 'assets/portfolio/7.webp' }
            ]
        }
    ];

    const project = projects.find(p => p.id === projectId);

    if (!project) {
        // Se o projeto não for encontrado, volta pro portfólio
        window.location.href = 'portfolio.html';
        return;
    }

    // Preenchendo os dados
    document.getElementById('project-page-title').textContent = project.title;
    document.getElementById('project-page-category').textContent = project.categoryLabel;

    const bodyContainer = document.getElementById('project-page-body');
    bodyContainer.innerHTML = '';

    project.assets.forEach((asset, index) => {
        const delay = index * 0.1;
        if (asset.type === 'video') {
            bodyContainer.innerHTML += `
                <div class="project-asset-wrap reveal-up" style="animation-delay: ${delay}s">
                    <video src="${asset.src}" autoplay loop muted playsinline></video>
                </div>
            `;
        } else {
            bodyContainer.innerHTML += `
                <div class="project-asset-wrap reveal-up" style="animation-delay: ${delay}s">
                    <img src="${asset.src}" alt="Detalhe de ${project.title}" loading="lazy">
                </div>
            `;
        }
    });

    // Animação de Lado (Vruum)
    const container = document.getElementById('project-page-container');
    if(container) {
        // Inicialmente escondido no CSS, disparamos a classe aqui
        setTimeout(() => {
            container.classList.add('vruum-active');
        }, 50);
    }
});
