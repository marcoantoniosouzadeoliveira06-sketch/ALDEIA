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
            let res = await fetch('/api/portfolio?t=' + Date.now());
            if (!res.ok) {
                res = await fetch('portfolio.json?t=' + Date.now());
            }
            if (res.ok) {
                const projects = await res.json();
                if (Array.isArray(projects)) {
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

        // Render member credits
        if (project.member && (project.member.name || project.member.photo)) {
            const heroContainer = document.querySelector('.project-hero .section-container');
            if (heroContainer) {
                // Remove existing if any (useful for fast reloads)
                const existing = heroContainer.querySelector('.project-member-credit');
                if (existing) existing.remove();

                const memberDiv = document.createElement('div');
                memberDiv.className = 'project-member-credit reveal-up';
                memberDiv.style.cssText = 'display: flex; align-items: center; gap: 14px; margin-top: 30px; animation-delay: 0.3s;';
                
                const photoSrc = project.member.photo || 'https://i.pravatar.cc/150?img=11';
                const name = project.member.name || 'Membro da Equipe';
                const role = project.member.role ? `<span style="color: ${accentColor}; font-weight: 400; font-size: 0.9rem; margin-left: 6px;">(${project.member.role})</span>` : '';
                
                memberDiv.innerHTML = `
                    <img src="${photoSrc}" alt="${name}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid ${accentColor}; box-shadow: 0 0 15px ${accentColor}44;">
                    <div>
                        <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;">Feito por</p>
                        <p style="color: #fff; font-size: 1.15rem; font-weight: 600; margin: 0; font-family: var(--font-h); letter-spacing: 0.02em;">${name}${role}</p>
                    </div>
                `;
                heroContainer.appendChild(memberDiv);
            }
        }

        const bodyContainer = document.getElementById('project-page-body');
        if (bodyContainer) {
            bodyContainer.innerHTML = '';

            (project.assets || []).forEach((asset, index) => {
                const delay = index * 0.1;
                const assetWrap = document.createElement('div');
                assetWrap.className = 'project-asset-wrap reveal-up';
                assetWrap.style.animationDelay = `${delay}s`;

                const format = project.format || 'post';

                if (asset.type === 'video') {
                    bodyContainer.appendChild(assetWrap);
                    if (window.createAldeiaVideoPlayer) {
                        window.createAldeiaVideoPlayer(assetWrap, {
                            src: asset.src,
                            format: format,
                            poster: project.cover,
                            autoplay: false // Reprodução manual a pedido do usuário (sem lag)
                        });
                    } else {
                        assetWrap.innerHTML = `<video src="${asset.src}" controls playsinline style="width:100%; border-radius:12px;"></video>`;
                    }
                } else {
                    assetWrap.innerHTML = `
                        <div class="aldeia-image-container format-${format}">
                            <img src="${asset.src}" alt="Detalhe de ${project.title}" loading="lazy">
                        </div>
                    `;
                    bodyContainer.appendChild(assetWrap);
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

