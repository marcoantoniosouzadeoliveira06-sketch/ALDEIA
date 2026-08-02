document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    function getFallbackProject(id) {
        const numMatch = id ? id.match(/\d+/) : null;
        const index = numMatch ? parseInt(numMatch[0], 10) : 1;
        const safeIdx = ((Math.max(1, index) - 1) % 21) + 1;
        return {
            id: id || 'p1',
            title: `Projeto ALDEIA #${safeIdx}`,
            categoryLabel: 'Design & Performance',
            cover: `assets/portfolio/${safeIdx}.webp`,
            assets: [
                { type: 'image', src: `assets/portfolio/${safeIdx}.webp` },
                { type: 'image', src: `assets/portfolio/${((safeIdx % 21) + 1)}.webp` },
                { type: 'image', src: `assets/portfolio/${(((safeIdx + 1) % 21) + 1)}.webp` }
            ]
        };
    }

    async function loadProject() {
        let project = null;
        try {
            const res = await fetch('/api/portfolio');
            if (res.ok) {
                const projects = await res.json();
                if (Array.isArray(projects) && projects.length > 0) {
                    project = projects.find(p => p.id === projectId);
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar do servidor, utilizando fallback:', e);
        }

        if (!project) {
            project = getFallbackProject(projectId);
        }

        // Aplicando a cor de destaque dinâmica da equipe no projeto
        const accentColor = project.accentColor || project.color || '#a855f7';
        document.documentElement.style.setProperty('--accent', accentColor);
        document.documentElement.style.setProperty('--accent-glow', accentColor + '44');

        // Preenchendo os dados
        const titleEl = document.getElementById('project-page-title');
        const catEl = document.getElementById('project-page-category');
        if (titleEl) titleEl.textContent = project.title;
        if (catEl) {
            catEl.textContent = project.categoryLabel;
            catEl.style.color = accentColor;
        }

        const bodyContainer = document.getElementById('project-page-body');
        if (bodyContainer) {
            bodyContainer.innerHTML = '';

            (project.assets || []).forEach((asset, index) => {
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

            // Observer para animar os assets on scroll
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            document.querySelectorAll('.project-asset-wrap').forEach(el => {
                observer.observe(el);
            });
        }

        // Animação de Lado (Vruum)
        const container = document.getElementById('project-page-container');
        if (container) {
            setTimeout(() => {
                container.classList.add('vruum-active');
                if (window.lenis) window.lenis.start();
            }, 100);
        }
    }

    loadProject();
});

