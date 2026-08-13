document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');
    const safeColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#ffffff';
    const safeMedia = (value, fallback = '') => /^(?:https?:\/\/|\/?assets\/)/i.test(String(value || '')) ? String(value) : fallback;

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
            if (projectId) {
                const detailResponse = await fetch('/api/projects/' + encodeURIComponent(projectId) + '?t=' + Date.now());
                if (detailResponse.ok) project = await detailResponse.json();
            }

            if (!project) {
                let res = await fetch('/api/portfolio?t=' + Date.now());
                if (!res.ok) res = await fetch('portfolio.json?t=' + Date.now());
                if (res.ok) {
                    const projects = await res.json();
                    if (Array.isArray(projects)) project = projects.find(p => p.id === projectId);
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar do servidor, utilizando fallback:', e);
        }

        if (!project) {
            project = getFallbackProject(projectId);
        }

        // Aplicando a cor de destaque dinâmica da equipe no projeto
        const accentColor = safeColor(project?.accentColor || project?.color);
        document.documentElement.style.setProperty('--accent', accentColor);
        document.documentElement.style.setProperty('--accent-glow', accentColor + '44');

        // Preenchendo os dados
        const titleEl = document.getElementById('project-page-title');
        const catEl = document.getElementById('project-page-category');
        if (titleEl) {
            titleEl.textContent = String(project?.title ?? 'Projeto ALDEIA');
            titleEl.classList.add('shiny-text', 'scroll-float');
            titleEl.style.setProperty('--color', '#c8c8c8');
            titleEl.style.setProperty('--shine-color', '#ffffff');
            window.initScrollFloat?.();
        }
        if (catEl) {
            catEl.textContent = String(project?.categoryLabel ?? 'Design & Performance');
            catEl.style.color = accentColor;
        }

        // Render member credits
        if (project?.member && (project.member.name || project.member.photo)) {
            const heroContainer = document.querySelector('.project-hero .section-container');
            if (heroContainer) {
                // Remove existing if any (useful for fast reloads)
                const existing = heroContainer.querySelector('.project-member-credit');
                if (existing) existing.remove();

                const memberDiv = document.createElement('div');
                memberDiv.className = 'project-member-credit reveal-up';
                memberDiv.style.cssText = 'display: flex; align-items: center; gap: 14px; margin-top: 30px; animation-delay: 0.3s;';
                
                const photoSrc = safeMedia(project.member.photo, 'https://i.pravatar.cc/150?img=11');
                const name = String(project.member.name || 'Membro da Equipe');

                const avatar = document.createElement('img');
                avatar.src = photoSrc;
                avatar.alt = name;
                avatar.className = 'project-member-avatar';
                avatar.style.cssText = `width:52px;height:52px;aspect-ratio:1/1;flex:0 0 52px;border-radius:50%;object-fit:cover;border:2px solid ${accentColor};box-shadow:0 0 15px ${accentColor}44;`;

                const copy = document.createElement('div');
                const eyebrow = document.createElement('p');
                eyebrow.textContent = 'Feito por';
                eyebrow.style.cssText = 'color:var(--text-muted);font-size:.8rem;margin:0 0 4px;text-transform:uppercase;letter-spacing:.1em;font-weight:600;';
                const memberName = document.createElement('p');
                memberName.textContent = name;
                memberName.style.cssText = 'color:#fff;font-size:1.15rem;font-weight:600;margin:0;font-family:var(--font-h);letter-spacing:.02em;';
                if (project.member.role) {
                    const role = document.createElement('span');
                    role.textContent = ` (${String(project.member.role)})`;
                    role.style.cssText = `color:${accentColor};font-weight:400;font-size:.9rem;margin-left:6px;`;
                    memberName.appendChild(role);
                }
                copy.append(eyebrow, memberName);
                memberDiv.append(avatar, copy);
                heroContainer.appendChild(memberDiv);
            }
        }

        const bodyContainer = document.getElementById('project-page-body');
        if (bodyContainer) {
            bodyContainer.innerHTML = '';

            (Array.isArray(project?.assets) ? project.assets : []).forEach((asset, index) => {
                const delay = index * 0.1;
                const assetWrap = document.createElement('div');
                assetWrap.className = 'project-asset-wrap reveal-up';
                assetWrap.style.animationDelay = `${delay}s`;

                const format = /^(?:post|portrait|story|video|auto)$/i.test(String(project?.format || '')) ? String(project.format) : 'post';
                const source = safeMedia(asset?.src);
                if (!source) return;

                if (asset.type === 'video') {
                    bodyContainer.appendChild(assetWrap);
                    if (window.createAldeiaVideoPlayer) {
                        window.createAldeiaVideoPlayer(assetWrap, {
                            src: source,
                            format: format,
                            poster: safeMedia(project?.cover),
                            autoplay: false // Reprodução manual a pedido do usuário (sem lag)
                        });
                    } else {
                        const video = document.createElement('video');
                        video.src = source;
                        video.controls = true;
                        video.playsInline = true;
                        video.style.cssText = 'width:100%;border-radius:12px;';
                        assetWrap.appendChild(video);
                    }
                } else {
                    const imageContainer = document.createElement('div');
                    imageContainer.className = `aldeia-image-container format-${format}`;
                    const image = document.createElement('img');
                    image.src = source;
                    image.alt = `Detalhe de ${String(project?.title ?? 'Projeto ALDEIA')}`;
                    image.loading = 'lazy';
                    imageContainer.appendChild(image);
                    assetWrap.appendChild(imageContainer);
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

