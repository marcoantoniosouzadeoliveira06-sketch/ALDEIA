document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    async function loadProject() {
        try {
            const res = await fetch('/api/portfolio');
            if (res.ok) {
                const projects = await res.json();
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
        }, 100);
    }
            }
        } catch (e) {
            console.error('Erro ao carregar projeto:', e);
        }
    }

    loadProject();
});
