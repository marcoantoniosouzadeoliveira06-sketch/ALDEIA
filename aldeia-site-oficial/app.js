/* ============================================
   ALDEIA DESIGN — APP.JS (Firsight Dark Theme)
   ============================================ */

(function () {
    'use strict';

    // ===== LENIS SMOOTH SCROLL =====
    let lenis;
    try {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
        window.lenis = lenis;

        // Stop during preloader
        lenis.stop();
    } catch (e) {
        console.warn('Lenis not loaded:', e);
    }

    // ===== PRELOADER =====
    const preloader = document.getElementById('preloader');
    const preloaderContent = document.querySelector('.preloader-content');
    const preloaderText = document.getElementById('preloader-text');

    if (preloader) {
        if (preloaderContent && preloaderText) {
            // Step 1: Activate cinematic logo fade/blur focus reveal
            setTimeout(() => {
                preloaderText.classList.add('active');
            }, 100);

            // Step 2: Dissolve the logo after it is fully focused
            setTimeout(() => {
                preloaderContent.classList.add('dissolve');
                
                // Step 3: Split and slide panels open
                setTimeout(() => {
                    preloader.classList.add('loaded');
                    document.body.classList.add('preloader-done');
                    if (lenis) lenis.start();
                    
                    // Step 4: Sincronizar digitação com o meio do movimento de abertura
                    setTimeout(() => {
                        if (typeof startHeroAnimations === 'function') {
                            startHeroAnimations();
                        }
                    }, 400);
                    
                    // Step 5: Clean up preloader display
                    setTimeout(() => {
                        preloader.style.display = 'none';
                    }, 800);
                }, 400);
            }, 1200);
        } else {
            // Fallback rápido se não houver conteúdo do preloader
            preloader.classList.add('loaded');
            document.body.classList.add('preloader-done');
            if (lenis) lenis.start();
            setTimeout(() => { preloader.style.display = 'none'; }, 500);
        }
    } else {
        // Se a página nem tiver preloader, libera o scroll
        document.body.classList.add('preloader-done');
        if (lenis) lenis.start();
    }

    // ===== GRAIN CANVAS =====
    function initGrain(canvasId, parentEl) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const parent = parentEl || canvas.parentElement;

        function resize() {
            canvas.width = parent.offsetWidth;
            canvas.height = parent.offsetHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        function renderGrain() {
            const w = canvas.width;
            const h = canvas.height;
            if (w === 0 || h === 0) {
                requestAnimationFrame(renderGrain);
                return;
            }
            const imageData = ctx.createImageData(w, h);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const v = Math.random() * 255;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
                data[i + 3] = 20; // Subtle grain
            }

            ctx.putImageData(imageData, 0, 0);
            requestAnimationFrame(renderGrain);
        }
        renderGrain();
    }

    initGrain('preloader-grain');
    initGrain('hero-grain');

    // ===== CUSTOM CURSOR =====
    const cursor = document.getElementById('custom-cursor');
    const follower = document.getElementById('cursor-follower');

    if (cursor && follower && window.innerWidth > 768) {
        document.body.classList.add('custom-cursor-active');

        document.addEventListener('mousemove', (e) => {
            const x = e.clientX;
            const y = e.clientY;
            cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
            follower.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        }, { passive: true });

        // Hover interactions
        const hoverTargets = document.querySelectorAll('a, button, .portfolio-card, .svc-header, .faq-btn, .svc-close, .color-chip');
        hoverTargets.forEach((el) => {
            el.addEventListener('mouseenter', () => {
                cursor.classList.add('hovered');
                follower.classList.add('hovered');
            });
            el.addEventListener('mouseleave', () => {
                cursor.classList.remove('hovered');
                follower.classList.remove('hovered');
            });
        });
    }

    // ===== NAVIGATION =====
    const navToggle = document.getElementById('nav-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (navToggle && mobileMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
        });

        // Close mobile menu on link click
        const mobileLinks = mobileMenu.querySelectorAll('.mobile-nav-link');
        mobileLinks.forEach((link) => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // Smooth scroll for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href');
            if (!targetId || targetId === '#') return;

            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                if (lenis) {
                    lenis.scrollTo(targetEl, { offset: -72 });
                } else {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // ===== SCROLL REVEAL (Intersection Observer) =====
    const revealElements = document.querySelectorAll('.reveal-up, .reveal-scale');
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px',
            }
        );

        revealElements.forEach((el) => revealObserver.observe(el));
    }

    // ===== WORD-BY-WORD TEXT REVEAL =====
    function splitTextIntoWords(element) {
        function traverse(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const regex = /(\s+)/;
                const parts = text.split(regex);
                const fragment = document.createDocumentFragment();
                
                parts.forEach(part => {
                    if (part.trim() === '') {
                        fragment.appendChild(document.createTextNode(part));
                    } else {
                        const span = document.createElement('span');
                        span.className = 'text-word-inner';
                        span.textContent = part;
                        fragment.appendChild(span);
                    }
                });
                node.parentNode.replaceChild(fragment, node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList.contains('text-word-inner')) return;
                const children = Array.from(node.childNodes);
                children.forEach(traverse);
            }
        }
        traverse(element);
    }

    function initWordReveal() {
        const revealContainers = document.querySelectorAll('.reveal-words');
        revealContainers.forEach(container => {
            splitTextIntoWords(container);
            const words = container.querySelectorAll('.text-word-inner');
            
            function updateOpacity() {
                const rect = container.getBoundingClientRect();
                const winHeight = window.innerHeight;
                
                const start = winHeight * 0.85;
                const end = winHeight * 0.25;
                
                if (rect.top < start && rect.bottom > 0) {
                    const total = start - end;
                    const progress = Math.max(0, Math.min(1, (start - rect.top) / total));
                    
                    const totalWords = words.length;
                    words.forEach((word, index) => {
                        const wordStart = (index / totalWords) * 0.8;
                        const wordEnd = wordStart + 0.2;
                        
                        let opacity = 0.15;
                        if (progress > wordStart) {
                            if (progress > wordEnd) {
                                opacity = 1;
                            } else {
                                const p = (progress - wordStart) / (wordEnd - wordStart);
                                opacity = 0.15 + 0.85 * p;
                            }
                        }
                        word.style.opacity = opacity;
                    });
                } else if (rect.top >= start) {
                    words.forEach(w => w.style.opacity = 0.15);
                } else {
                    words.forEach(w => w.style.opacity = 1);
                }
            }
            
            window.addEventListener('scroll', updateOpacity);
            window.addEventListener('resize', updateOpacity);
            updateOpacity();
        });
    }
    initWordReveal();

    // ===== STAT COUNTER ANIMATION =====
    const statCounter = document.getElementById('stat-counter');
    if (statCounter) {
        let hasAnimated = false;

        const statObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !hasAnimated) {
                        hasAnimated = true;
                        animateCounter(statCounter, 80, 2000);
                    }
                });
            },
            { threshold: 0.5 }
        );

        statObserver.observe(statCounter);
    }

    function animateCounter(element, target, duration) {
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * target);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // ===== SERVICE ACCORDION =====
    const svcItems = document.querySelectorAll('.svc-item');
    svcItems.forEach((item) => {
        const header = item.querySelector('.svc-header');
        const body = item.querySelector('.svc-body');
        const closeBtn = item.querySelector('.svc-close');

        if (header && body) {
            header.addEventListener('click', () => {
                const isActive = item.classList.contains('active');

                // Close all
                svcItems.forEach((si) => {
                    si.classList.remove('active');
                    const sb = si.querySelector('.svc-body');
                    if (sb) sb.style.maxHeight = '0px';
                });

                // Open this one
                if (!isActive) {
                    item.classList.add('active');
                    body.style.maxHeight = body.scrollHeight + 'px';
                }
            });
        }

        if (closeBtn && body) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                item.classList.remove('active');
                body.style.maxHeight = '0px';
            });
        }
    });

    // ===== FAQ ACCORDION =====
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach((item) => {
        const btn = item.querySelector('.faq-btn');
        const answer = item.querySelector('.faq-answer');

        if (btn && answer) {
            btn.addEventListener('click', () => {
                const isActive = item.classList.contains('active');

                // Close all
                faqItems.forEach((fi) => {
                    fi.classList.remove('active');
                    const fa = fi.querySelector('.faq-answer');
                    if (fa) fa.style.maxHeight = '0px';
                });

                // Toggle this one
                if (!isActive) {
                    item.classList.add('active');
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                }
            });
        }
    });

    // ===== HEADER SCROLL EFFECT =====
    const mainNav = document.getElementById('main-nav');
    if (mainNav) {
        let lastScroll = 0;
        const scrollThreshold = 10; // minimum px delta to trigger hide/show

        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY;
            const delta = currentScroll - lastScroll;

            // Always show nav when near the top of the page
            if (currentScroll <= 80) {
                mainNav.classList.remove('hide-nav');
                lastScroll = currentScroll;
                return;
            }

            // Only react if the scroll delta exceeds the threshold
            if (Math.abs(delta) < scrollThreshold) return;

            if (delta > 0) {
                // Scrolling DOWN → hide
                mainNav.classList.add('hide-nav');
            } else {
                // Scrolling UP → show
                mainNav.classList.remove('hide-nav');
            }

            lastScroll = currentScroll;
        });
    }

    // ===== PARALLAX HERO WORDMARK =====
    const heroWordmark = document.querySelector('.hero-wordmark');
    if (heroWordmark) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const speed = 0.3;
            heroWordmark.style.transform = `translate(-50%, calc(-60% + ${scrollY * speed}px))`;
        });
    }

    // ===== VIDEO PAUSE/PLAY ON VISIBILITY =====
    const heroVideo = document.getElementById('hero-video');
    if (heroVideo) {
        const videoObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        heroVideo.play().catch(() => {});
                    } else {
                        heroVideo.pause();
                    }
                });
            },
            { threshold: 0.25 }
        );
        videoObserver.observe(heroVideo);
    }

    // ===== HERO SCROLL DOTS =====
    const dots = document.querySelectorAll('.hero-scroll-dots .dot');
    if (dots.length > 0) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const height = window.innerHeight;
            const activeIdx = Math.min(dots.length - 1, Math.floor(scrollY / (height * 0.8)));
            dots.forEach((dot, idx) => {
                if (idx === activeIdx) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        });
    }

    // ===== COLOR CHIP COPY TO CLIPBOARD =====
    const colorChips = document.querySelectorAll('.color-chip');
    colorChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const hex = chip.getAttribute('data-hex');
            if (!hex) return;
            
            navigator.clipboard.writeText(hex).then(() => {
                const hexLabel = chip.querySelector('.chip-hex');
                if (hexLabel) {
                    const originalText = hexLabel.textContent;
                    hexLabel.textContent = 'COPIADO!';
                    hexLabel.style.color = '#22c55e'; // Green feedback
                    
                    setTimeout(() => {
                        hexLabel.textContent = originalText;
                        hexLabel.style.color = ''; // Reset color
                    }, 1200);
                }
            }).catch(err => {
                console.error('Erro ao copiar:', err);
            });
        });
    });

    // ===== TYPEWRITER & HERO ANIMATIONS =====
    function startHeroAnimations() {
        const line1 = document.querySelector('.hero-title-cinematic .line-1');
        const line2 = document.querySelector('.hero-title-cinematic .line-2');
        const sub = document.querySelector('.hero-subtitle-cinematic');
        const scrollInd = document.querySelector('.hero-scroll-cinematic');
        
        setTimeout(() => {
            if (line1) line1.classList.add('active');
        }, 200);
        
        setTimeout(() => {
            if (line2) line2.classList.add('active');
        }, 600);
        
        setTimeout(() => {
            const twEl = document.getElementById('typewriter-text');
            const defaultText = (twEl && twEl.getAttribute('data-text')) || (window.location.pathname.includes('portfolio') ? "DESIGN EXCLUSIVO" : "AGÊNCIA ÚNICA");
            typeWriter(defaultText, 'typewriter-text', 120, () => {
                setTimeout(() => {
                    if (sub) sub.classList.add('active');
                    if (scrollInd) scrollInd.classList.add('active');
                }, 100);
            });
        }, 1200);
    }
    
    function typeWriter(text, elementId, speed, callback) {
        const el = document.getElementById(elementId);
        if (!el) {
            if (callback) callback();
            return;
        }
        let i = 0;
        el.textContent = '';
        function type() {
            if (i < text.length) {
                el.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else if (callback) {
                callback();
            }
        }
        type();
    }

    // ===== PROFILE CARD 3D TILT ENGINE =====
    function initProfileCards() {
        const cards = document.querySelectorAll('.pc-card-wrapper');
        
        cards.forEach((wrap) => {
            const shell = wrap.querySelector('.pc-card-shell');
            if (!shell) return;
            
            let running = false;
            let rafId = null;
            let lastTs = 0;
            
            let currentX = 0;
            let currentY = 0;
            let targetX = 0;
            let targetY = 0;
            
            const DEFAULT_TAU = 0.14;
            const INITIAL_TAU = 0.6;
            let initialUntil = 0;
            
            const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
            const round = (v, precision = 3) => parseFloat(v.toFixed(precision));
            const adjust = (v, fMin, fMax, tMin, tMax) => round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));
            
            const setVarsFromXY = (x, y) => {
                const width = shell.clientWidth || 1;
                const height = shell.clientHeight || 1;
                
                const percentX = clamp((100 / width) * x);
                const percentY = clamp((100 / height) * y);
                
                const centerX = percentX - 50;
                const centerY = percentY - 50;
                
                const properties = {
                    '--pointer-x': `${percentX}%`,
                    '--pointer-y': `${percentY}%`,
                    '--background-x': `${adjust(percentX, 0, 100, 35, 65)}%`,
                    '--background-y': `${adjust(percentY, 0, 100, 35, 65)}%`,
                    '--pointer-from-center': `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
                    '--pointer-from-top': `${percentY / 100}`,
                    '--pointer-from-left': `${percentX / 100}`,
                    '--rotate-x': `${round(-(centerX / 5))}deg`,
                    '--rotate-y': `${round(centerY / 4)}deg`
                };
                
                for (const [k, v] of Object.entries(properties)) {
                    wrap.style.setProperty(k, v);
                }
            };
            
            const step = (ts) => {
                if (!running) return;
                if (lastTs === 0) lastTs = ts;
                const dt = (ts - lastTs) / 1000;
                lastTs = ts;
                
                const tau = ts < initialUntil ? INITIAL_TAU : DEFAULT_TAU;
                const k = 1 - Math.exp(-dt / tau);
                
                currentX += (targetX - currentX) * k;
                currentY += (targetY - currentY) * k;
                
                setVarsFromXY(currentX, currentY);
                
                const stillFar = Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05;
                
                if (stillFar || document.hasFocus()) {
                    rafId = requestAnimationFrame(step);
                } else {
                    running = false;
                    lastTs = 0;
                    if (rafId) {
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }
                }
            };
            
            const start = () => {
                if (running) return;
                running = true;
                lastTs = 0;
                rafId = requestAnimationFrame(step);
            };
            
            const setTarget = (x, y) => {
                targetX = x;
                targetY = y;
                start();
            };
            
            const setImmediate = (x, y) => {
                currentX = x;
                currentY = y;
                setVarsFromXY(currentX, currentY);
            };
            
            const toCenter = () => {
                setTarget(shell.clientWidth / 2, shell.clientHeight / 2);
            };
            
            const getOffsets = (evt, el) => {
                const rect = el.getBoundingClientRect();
                return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
            };
            
            let enterTimer = null;
            let leaveRaf = null;
            
            shell.addEventListener('pointerenter', (event) => {
                shell.classList.add('active');
                shell.classList.add('entering');
                if (enterTimer) clearTimeout(enterTimer);
                enterTimer = setTimeout(() => {
                    shell.classList.remove('entering');
                }, 180);
                
                const { x, y } = getOffsets(event, shell);
                setTarget(x, y);
            });
            
            shell.addEventListener('pointermove', (event) => {
                const { x, y } = getOffsets(event, shell);
                setTarget(x, y);
            });
            
            shell.addEventListener('pointerleave', () => {
                toCenter();
                
                const checkSettle = () => {
                    const settled = Math.hypot(targetX - currentX, targetY - currentY) < 0.6;
                    if (settled) {
                        shell.classList.remove('active');
                        leaveRaf = null;
                    } else {
                        leaveRaf = requestAnimationFrame(checkSettle);
                    }
                };
                if (leaveRaf) cancelAnimationFrame(leaveRaf);
                leaveRaf = requestAnimationFrame(checkSettle);
            });
            
            // Set initial position and transition to center on load
            const initX = (shell.clientWidth || 250) - 70;
            const initY = 60;
            setImmediate(initX, initY);
            toCenter();
            initialUntil = performance.now() + 1200;
            start();
        });
    }

    // Initialize Profile Cards
    initProfileCards();

    // ===== LANGUAGE SELECTOR =====
    const langBtn = document.getElementById('lang-btn');
    const langDropdown = document.getElementById('lang-dropdown');
    const langCurrent = document.querySelector('.lang-current');

    if (langBtn && langDropdown) {
        // Toggle dropdown
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle('active');
        });

        // Close on click outside
        document.addEventListener('click', () => {
            langDropdown.classList.remove('active');
        });

        // Parse cookie to show active language
        const getCookie = (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
        };

        const googtrans = getCookie('googtrans');
        if (googtrans) {
            const activeLang = googtrans.split('/').pop().toUpperCase();
            if (langCurrent) langCurrent.textContent = activeLang;
        } else {
            if (langCurrent) langCurrent.textContent = 'PT';
        }
    }

    // Function to change language
    window.changeLanguage = function(langCode) {
        const targetLang = langCode.toLowerCase();
        const domain = window.location.hostname;
        const isLocalhost = domain === 'localhost' || domain === '127.0.0.1' || /^(\d+\.){3}\d+$/.test(domain);

        // Delete previous cookies to avoid conflicts/duplicates
        document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + domain + ";";
        if (!isLocalhost) {
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=." + domain + ";";
            const parts = domain.split('.');
            if (parts.length > 2) {
                const parentDomain = parts.slice(-2).join('.');
                document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=." + parentDomain + ";";
            }
        }

        if (targetLang !== 'pt') {
            // Set cookie for both domain and path (omit domain on localhost)
            document.cookie = "googtrans=/pt/" + targetLang + "; path=/;";
            if (!isLocalhost) {
                document.cookie = "googtrans=/pt/" + targetLang + "; path=/; domain=" + domain + ";";
                document.cookie = "googtrans=/pt/" + targetLang + "; path=/; domain=." + domain + ";";
            }
        }

        // Dynamically trigger Google Translate dropdown in the DOM if it is loaded
        const selectEl = document.querySelector('.goog-te-combo');
        if (selectEl) {
            selectEl.value = targetLang === 'pt' ? '' : targetLang;
            selectEl.dispatchEvent(new Event('change'));
            if (langCurrent) langCurrent.textContent = targetLang.toUpperCase();
        } else {
            // Fallback: reload the page so Google Translate reads the newly set cookie on load
            location.reload();
        }
    };

    // ===== GOOEY NAV COMPONENT (ALDEIA STYLE) =====
    function initGooeyNav() {
        const container = document.getElementById('gooey-nav');
        if (!container) return;

        const nav = container.querySelector('nav');
        const ul = nav.querySelector('ul');
        const lis = ul.querySelectorAll('li');
        const filterEl = container.querySelector('.effect.filter');
        const textEl = container.querySelector('.effect.text');

        let activeIndex = 0;
        const animationTime = 600;
        const particleCount = 15;
        const particleDistances = [90, 10];
        const particleR = 100;
        const timeVariance = 300;
        
        // Grayscale colors
        const colors = [1, 2, 3, 1, 2, 3, 1, 4];

        const noise = (n = 1) => n / 2 - Math.random() * n;

        const getXY = (distance, pointIndex, totalPoints) => {
            const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
            return [distance * Math.cos(angle), distance * Math.sin(angle)];
        };

        const createParticle = (i, t, d, r) => {
            let rotate = noise(r / 10);
            return {
                start: getXY(d[0], particleCount - i, particleCount),
                end: getXY(d[1] + noise(7), particleCount - i, particleCount),
                time: t,
                scale: 1 + noise(0.2),
                color: colors[Math.floor(Math.random() * colors.length)],
                rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10
            };
        };

        const makeParticles = (element) => {
            const d = particleDistances;
            const r = particleR;
            const bubbleTime = animationTime * 2 + timeVariance;
            element.style.setProperty('--time', `${bubbleTime}ms`);

            for (let i = 0; i < particleCount; i++) {
                const t = animationTime * 2 + noise(timeVariance * 2);
                const p = createParticle(i, t, d, r);
                element.classList.remove('active');

                setTimeout(() => {
                    const particle = document.createElement('span');
                    const point = document.createElement('span');
                    particle.classList.add('particle');
                    particle.style.setProperty('--start-x', `${p.start[0]}px`);
                    particle.style.setProperty('--start-y', `${p.start[1]}px`);
                    particle.style.setProperty('--end-x', `${p.end[0]}px`);
                    particle.style.setProperty('--end-y', `${p.end[1]}px`);
                    particle.style.setProperty('--time', `${p.time}ms`);
                    particle.style.setProperty('--scale', `${p.scale}`);
                    particle.style.setProperty('--color', `rgba(255, 255, 255, 0.85)`);
                    particle.style.setProperty('--rotate', `${p.rotate}deg`);

                    point.classList.add('point');
                    particle.appendChild(point);
                    element.appendChild(particle);
                    requestAnimationFrame(() => {
                        element.classList.add('active');
                    });
                    setTimeout(() => {
                        try {
                            element.removeChild(particle);
                        } catch (err) {}
                    }, t);
                }, 30);
            }
        };

        const updateEffectPosition = (element) => {
            const containerRect = container.getBoundingClientRect();
            const pos = element.getBoundingClientRect();

            const styles = {
                left: `${pos.x - containerRect.x}px`,
                top: `${pos.y - containerRect.y}px`,
                width: `${pos.width}px`,
                height: `${pos.height}px`
            };
            
            Object.assign(filterEl.style, styles);
            Object.assign(textEl.style, styles);
            textEl.innerText = element.innerText;
        };

        const handleClick = (liEl, index) => {
            if (activeIndex === index) return;

            lis[activeIndex].classList.remove('active');
            activeIndex = index;
            liEl.classList.add('active');
            updateEffectPosition(liEl);

            const particles = filterEl.querySelectorAll('.particle');
            particles.forEach(p => {
                try { filterEl.removeChild(p); } catch(err) {}
            });

            textEl.classList.remove('active');
            void textEl.offsetWidth; // Trigger reflow
            textEl.classList.add('active');

            makeParticles(filterEl);
        };

        lis.forEach((li, index) => {
            const link = li.querySelector('a');
            
            link.addEventListener('click', (e) => {
                if (link.getAttribute('href').startsWith('#')) {
                    e.preventDefault();
                    const targetId = link.getAttribute('href');
                    const targetEl = document.querySelector(targetId);
                    if (targetEl) {
                        if (window.lenis) {
                            window.lenis.scrollTo(targetEl);
                        } else {
                            targetEl.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                }
                handleClick(li, index);
            });

            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick(li, index);
                    link.click();
                }
            });
        });

        // Initialize position on load
        const initActive = lis[activeIndex];
        if (initActive) {
            setTimeout(() => {
                updateEffectPosition(initActive);
                textEl.classList.add('active');
            }, 200);
        }

        // Handle window resize
        const resizeObserver = new ResizeObserver(() => {
            const currentActive = lis[activeIndex];
            if (currentActive) {
                updateEffectPosition(currentActive);
            }
        });
        resizeObserver.observe(container);

        // ScrollSpy to update active link on scroll
        const sections = ['#inicio', '#sobre', '#portfolio', '#servicos', '#fundadores'].map(id => document.querySelector(id)).filter(Boolean);
        
        if (sections.length > 0) {
            const observerOptions = {
                root: null,
                rootMargin: '-50% 0px -50% 0px',
                threshold: 0
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = '#' + entry.target.id;
                        const activeLi = ul.querySelector(`li a[href="${id}"]`)?.parentElement;
                        if (activeLi) {
                            const index = Array.from(lis).indexOf(activeLi);
                            if (index !== -1 && index !== activeIndex) {
                                lis[activeIndex].classList.remove('active');
                                activeIndex = index;
                                activeLi.classList.add('active');
                                updateEffectPosition(activeLi);
                            }
                        }
                    }
                });
            }, observerOptions);

            sections.forEach(section => observer.observe(section));
        }
    }

    // ===== REACTBITS COMPONENT INITIALIZERS (VANILLA MODULES) =====

    // Helper to generate a text mask PNG dynamically
    function generateTextMask(text, font, size) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const letterSpacingVal = `${size * 0.12}px`; // Slightly tighter spacing now that we don't have stroke bloating
        ctx.font = `900 ${size}px "${font}", "Arial Black", sans-serif`;
        ctx.letterSpacing = letterSpacingVal;
        const metrics = ctx.measureText(text);
        
        const ascent = metrics.actualBoundingBoxAscent || (size * 0.85);
        const descent = metrics.actualBoundingBoxDescent || (size * 0.15);
        const textHeight = ascent + descent;
        
        const paddingX = 35; // 35px padding to prevent edge clipping during shader liquid distortions
        const paddingY = 25; // 25px vertical padding
        
        const width = Math.ceil(metrics.width) + paddingX * 2;
        const height = Math.ceil(textHeight) + paddingY * 2;
        
        canvas.width = width;
        canvas.height = height;
        
        // Re-apply context state (font, letter-spacing) as sizing canvas resets it
        ctx.font = `900 ${size}px "${font}", "Arial Black", sans-serif`;
        ctx.letterSpacing = letterSpacingVal;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.clearRect(0, 0, width, height);
        
        // Fill only (no stroke) to keep typographic forms clean, readable, and prevent letter deformation
        ctx.fillText(text, width / 2, height / 2);
        
        return canvas.toDataURL('image/png');
    }


    // LogoLoop is now handled by pure GPU-accelerated CSS marquee for maximum smoothness and zero CPU lag.

    // 2. GradualBlur Initialization
    function initGradualBlur() {
        const blurs = document.querySelectorAll('.gradual-blur');
        blurs.forEach(el => {
            const position = el.getAttribute('data-position') || 'bottom';
            const strength = parseFloat(el.getAttribute('data-strength')) || 2;
            const divCount = parseInt(el.getAttribute('data-div-count')) || 5;
            const curve = el.getAttribute('data-curve') || 'linear';
            const exponential = el.getAttribute('data-exponential') === 'true';
            const opacity = parseFloat(el.getAttribute('data-opacity')) || 1;

            const inner = el.querySelector('.gradual-blur-inner') || document.createElement('div');
            inner.className = 'gradual-blur-inner';
            inner.style.position = 'relative';
            inner.style.width = '100%';
            inner.style.height = '100%';
            inner.innerHTML = '';

            const curves = {
                linear: p => p,
                bezier: p => p * p * (3 - 2 * p),
                'ease-in': p => p * p,
                'ease-out': p => 1 - Math.pow(1 - p, 2),
                'ease-in-out': p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
            };

            const curveFunc = curves[curve] || curves.linear;
            const increment = 100 / divCount;
            const directions = {
                top: 'to top',
                bottom: 'to bottom',
                left: 'to left',
                right: 'to right'
            };
            const dir = directions[position] || 'to bottom';

            for (let i = 1; i <= divCount; i++) {
                let progress = i / divCount;
                progress = curveFunc(progress);

                let blurValue;
                if (exponential) {
                    blurValue = Math.pow(2, progress * 4) * 0.0625 * strength;
                } else {
                    blurValue = 0.0625 * (progress * divCount + 1) * strength;
                }

                const p1 = Math.round((increment * i - increment) * 10) / 10;
                const p2 = Math.round(increment * i * 10) / 10;
                const p3 = Math.round((increment * i + increment) * 10) / 10;
                const p4 = Math.round((increment * i + increment * 2) * 10) / 10;

                let gradient = `transparent ${p1}%, black ${p2}%`;
                if (p3 <= 100) gradient += `, black ${p3}%`;
                if (p4 <= 100) gradient += `, transparent ${p4}%`;

                const child = document.createElement('div');
                child.style.position = 'absolute';
                child.style.inset = '0';
                
                const maskStyle = `linear-gradient(${dir}, ${gradient})`;
                child.style.maskImage = maskStyle;
                child.style.webkitMaskImage = maskStyle;
                
                const blurStyle = `blur(${blurValue.toFixed(3)}rem)`;
                child.style.backdropFilter = blurStyle;
                child.style.webkitBackdropFilter = blurStyle;
                
                child.style.opacity = opacity;

                inner.appendChild(child);
            }
            if (!el.contains(inner)) {
                el.appendChild(inner);
            }
        });
    }

    // 3. ScrollFloat Initialization
    function initScrollFloat() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            console.warn('GSAP or ScrollTrigger not loaded for ScrollFloat');
            return;
        }
        gsap.registerPlugin(ScrollTrigger);

        const floaters = document.querySelectorAll('.scroll-float');
        floaters.forEach(el => {
            const text = el.innerText.trim();
            el.innerHTML = ''; // Clear text

            const textSpan = document.createElement('span');
            textSpan.className = 'scroll-float-text';

            const chars = text.split('').map(char => {
                const span = document.createElement('span');
                span.className = 'char';
                span.textContent = char === ' ' ? '\u00A0' : char;
                textSpan.appendChild(span);
                return span;
            });
            el.appendChild(textSpan);

            const animationDuration = parseFloat(el.getAttribute('data-duration')) || 1;
            const ease = el.getAttribute('data-ease') || 'back.inOut(2)';
            const scrollStart = el.getAttribute('data-start') || 'center bottom+=50%';
            const scrollEnd = el.getAttribute('data-end') || 'bottom bottom-=40%';
            const stagger = parseFloat(el.getAttribute('data-stagger')) || 0.03;

            gsap.fromTo(
                chars,
                {
                    willChange: 'opacity, transform',
                    opacity: 0,
                    yPercent: 120,
                    scaleY: 2.3,
                    scaleX: 0.7,
                    transformOrigin: '50% 0%'
                },
                {
                    duration: animationDuration,
                    ease: ease,
                    opacity: 1,
                    yPercent: 0,
                    scaleY: 1,
                    scaleX: 1,
                    stagger: stagger,
                    scrollTrigger: {
                        trigger: el,
                        start: scrollStart,
                        end: scrollEnd,
                        scrub: true
                    }
                }
            );
        });
    }

    // 4. MetallicPaint WebGL Initialization
    function initMetallicPaint() {
        document.fonts.ready.then(() => {
            const paintElements = document.querySelectorAll('.metallic-paint');
        paintElements.forEach(el => {
            const text = el.getAttribute('data-text');
            const font = el.getAttribute('data-font') || 'Clash Display';
            const size = parseInt(el.getAttribute('data-size')) || 120;
            
            let imageSrc = el.getAttribute('data-image-src');
            if (!imageSrc && text) {
                // Generate high-res image mask from text dynamically!
                imageSrc = generateTextMask(text, font, size);
            }
            if (!imageSrc) return;

            const seed = parseFloat(el.getAttribute('data-seed')) || 42;
            const scale = parseFloat(el.getAttribute('data-scale')) || 4;
            const refraction = parseFloat(el.getAttribute('data-refraction')) || 0.01;
            const blur = parseFloat(el.getAttribute('data-blur')) || 0.015;
            const liquid = parseFloat(el.getAttribute('data-liquid')) || 0.75;
            const speed = parseFloat(el.getAttribute('data-speed')) || 0.3;
            const brightness = parseFloat(el.getAttribute('data-brightness')) || 2;
            const contrast = parseFloat(el.getAttribute('data-contrast')) || 0.5;
            const angle = parseFloat(el.getAttribute('data-angle')) || 0;
            const fresnel = parseFloat(el.getAttribute('data-fresnel')) || 1;
            const lightColor = el.getAttribute('data-light-color') || '#ffffff';
            const darkColor = el.getAttribute('data-dark-color') || '#000000';
            const patternSharpness = parseFloat(el.getAttribute('data-sharpness')) || 1;
            const waveAmplitude = parseFloat(el.getAttribute('data-wave')) || 1;
            const noiseScale = parseFloat(el.getAttribute('data-noise')) || 0.5;
            const chromaticSpread = parseFloat(el.getAttribute('data-chroma')) || 2;
            const mouseAnimation = el.getAttribute('data-mouse') === 'true';
            const distortion = parseFloat(el.getAttribute('data-distort')) || 1;
            const contour = parseFloat(el.getAttribute('data-contour')) || 0.2;
            const tintColor = el.getAttribute('data-tint') || '#ffffff';

            const canvas = document.createElement('canvas');
            canvas.className = 'paint-container';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            el.appendChild(canvas);

            const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
            if (!gl) return;

            const vertexShader = `#version 300 es
            precision highp float;
            in vec2 a_position;
            out vec2 vP;
            void main(){vP=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;

            const fragmentShader = `#version 300 es
            precision highp float;
            in vec2 vP;
            out vec4 oC;
            uniform sampler2D u_tex;
            uniform float u_time,u_ratio,u_imgRatio,u_seed,u_scale,u_refract,u_blur,u_liquid;
            uniform float u_bright,u_contrast,u_angle,u_fresnel,u_sharp,u_wave,u_noise,u_chroma;
            uniform float u_distort,u_contour;
            uniform vec3 u_lightColor,u_darkColor,u_tint;

            vec3 sC,sM;

            vec3 pW(vec3 v){
              vec3 i=floor(v),f=fract(v),s=sign(fract(v*.5)-.5),h=fract(sM*i+i.yzx),c=f*(f-1.);
              return s*c*((h*16.-4.)*c-1.);
            }

            vec3 aF(vec3 b,vec3 c){return pW(b+c.zxy-pW(b.zxy+c.yzx)+pW(b.yzx+c.xyz));}
            vec3 lM(vec3 s,vec3 p){return(p+aF(s,p))*.5;}

            vec2 fA(){
              vec2 c=vP-.5;
              c.x*=u_ratio>u_imgRatio?u_ratio/u_imgRatio:1.;
              c.y*=u_ratio>u_imgRatio?1.:u_imgRatio/u_ratio;
              return vec2(c.x+.5,.5-c.y);
            }

            vec2 rot(vec2 p,float r){float c=cos(r),s=sin(r);return vec2(p.x*c+p.y*s,p.y*c-p.x*s);}

            float bM(vec2 c,float t){
              vec2 l=smoothstep(vec2(0.),vec2(t),c),u=smoothstep(vec2(0.),vec2(t),1.-c);
              return l.x*l.y*u.x*u.y;
            }

            float mG(float hi,float lo,float t,float sh,float cv){
              // A smooth, high-specular chrome reflection curve for an organic 3D volume
              float reflection = cos(t * 3.14159265 * 2.0) * 0.5 + 0.5;
              // Raise to power to tighten highlights and soften shadow transitions
              reflection = pow(reflection, 1.5);
              return mix(lo, hi, reflection);
            }

            void main(){
              sC=fract(vec3(.7548,.5698,.4154)*(u_seed+17.31))+.5;
              sM=fract(sC.zxy-sC.yzx*1.618);
              vec2 sc=vec2(vP.x*u_ratio,1.-vP.y);
              float angleRad=u_angle*3.14159/180.;
              sc=rot(sc-.5,angleRad)+.5;
              sc=clamp(sc,0.,1.);
              float sl=sc.x-sc.y,an=u_time*.001;
              vec2 iC=fA();
              vec4 texSample=texture(u_tex,iC);
              float dp=texSample.r;
              float shapeMask=texSample.a;
              vec3 hi=u_lightColor*u_bright;
              vec3 lo=u_darkColor*(2.-u_bright);
              lo.b+=smoothstep(.6,1.4,sc.x+sc.y)*.08;
              vec2 fC=sc-.5;
              float rd=length(fC+vec2(0.,sl*.15));
              vec2 ag=rot(fC,(.22-sl*.18)*3.14159);
              float cv=1.-pow(rd*1.65,1.15);
              cv*=pow(sc.y,.35);
              float vs=shapeMask;
              vs*=bM(iC,.01);
              float fr=pow(1.-cv,u_fresnel)*.3;
              vs=min(vs+fr*vs,1.);
              float mT=an*.0625;
              vec3 wO=vec3(-1.05,1.35,1.55);
              vec3 wA=aF(vec3(31.,73.,56.),mT+wO)*.22*u_wave;
              vec3 wB=aF(vec3(24.,64.,42.),mT-wO.yzx)*.22*u_wave;
              vec2 nC=sc*45.*u_noise;
              nC+=aF(sC.zxy,an*.17*sC.yzx-sc.yxy*.35).xy*18.*u_wave;
              vec3 tC=vec3(.00041,.00053,.00076)*mT+wB*nC.x+wA*nC.y;
              tC=lM(sC,tC);
              tC=lM(sC+1.618,tC);
              float tb=sin(tC.x*3.14159)*.5+.5;
              tb=tb*2.-1.;
              float noiseVal=pW(vec3(sc*8.+an,an*.5)).x;
              float edgeFactor=smoothstep(0.,.5,dp)*smoothstep(1.,.5,dp);
              float lD=dp+(1.-dp)*u_liquid*tb;
              lD+=noiseVal*u_distort*.15*edgeFactor;
              float rB=clamp(1.-cv,0.,1.);
              float fl=ag.x+sl;
              fl+=noiseVal*sl*u_distort*edgeFactor;
              fl*=mix(1.,1.-dp*.5,u_contour);
              fl-=dp*u_contour*.8;
              float eI=smoothstep(0.,1.,lD)*smoothstep(1.,0.,lD);
              fl-=tb*sl*1.8*eI;
              float cA=cv*clamp(pow(sc.y,.12),.25,1.);
              fl*=.12+(1.05-lD)*cA;
              fl*=smoothstep(1.,.65,lD);
              float vA1=smoothstep(.08,.18,sc.y)*smoothstep(.38,.18,sc.y);
              float vA2=smoothstep(.08,.18,1.-sc.y)*smoothstep(.38,.18,1.-sc.y);
              fl+=vA1*.16+vA2*.025;
              fl*=.45+pow(sc.y,2.)*.55;
              fl*=u_scale;
              fl-=an;
              float rO=rB+cv*tb*.025;
              float vM1=smoothstep(-.12,.18,sc.y)*smoothstep(.48,.08,sc.y);
              float cM1=smoothstep(.35,.55,cv)*smoothstep(.95,.35,cv);
              rO+=vM1*cM1*4.5;
              rO-=sl;
              float bO=rB*1.25;
              float vM2=smoothstep(-.02,.35,sc.y)*smoothstep(.75,.08,sc.y);
              float cM2=smoothstep(.35,.55,cv)*smoothstep(.75,.35,cv);
              bO+=vM2*cM2*.9;
              bO-=lD*.18;
              rO*=u_refract*u_chroma;
              bO*=u_refract*u_chroma;
              float sf=u_blur;
              float rP=fract(fl+rO);
              float rC=mG(hi.r,lo.r,rP,sf+.018+u_refract*cv*.025,cv);
              float gP=fract(fl);
              float gC=mG(hi.g,lo.g,gP,sf+.008/max(.01,1.-sl),cv);
              float bP=fract(fl-bO);
              float bC=mG(hi.b,lo.b,bP,sf+.008,cv);
              vec3 col=vec3(rC,gC,bC);
              col=(col-.5)*u_contrast+.5;
              col=clamp(col,0.,1.);
              col=mix(col,1.-min(vec3(1.),(1.-col)/max(u_tint,vec3(.001))),length(u_tint-1.)*.5);
              col=clamp(col,0.,1.);
              oC=vec4(col*vs,vs);
            }`;

            const compile = (src, type) => {
              const s = gl.createShader(type);
              gl.shaderSource(s, src);
              gl.compileShader(s);
              if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(s));
                return null;
              }
              return s;
            };

            const vs = compile(vertexShader, gl.VERTEX_SHADER);
            const fs = compile(fragmentShader, gl.FRAGMENT_SHADER);
            if (!vs || !fs) return;

            const prog = gl.createProgram();
            gl.attachShader(prog, vs);
            gl.attachShader(prog, fs);
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
              console.error(gl.getProgramInfoLog(prog));
              return;
            }

            const uniforms = {};
            const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < count; i++) {
              const info = gl.getActiveUniform(prog, i);
              if (info) uniforms[info.name] = gl.getUniformLocation(prog, info.name);
            }

            const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

            gl.useProgram(prog);
            const posAttr = gl.getAttribLocation(prog, 'a_position');
            gl.enableVertexAttribArray(posAttr);
            gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

            gl.uniform1f(uniforms.u_seed, seed);
            gl.uniform1f(uniforms.u_scale, scale);
            gl.uniform1f(uniforms.u_refract, refraction);
            gl.uniform1f(uniforms.u_blur, blur);
            gl.uniform1f(uniforms.u_liquid, liquid);
            gl.uniform1f(uniforms.u_bright, brightness);
            gl.uniform1f(uniforms.u_contrast, contrast);
            gl.uniform1f(uniforms.u_angle, angle);
            gl.uniform1f(uniforms.u_fresnel, fresnel);

            const hexToRgb = (hex) => {
              const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return r ? [parseInt(r[1], 16) / 255, parseInt(r[2], 16) / 255, parseInt(r[3], 16) / 255] : [1, 1, 1];
            };

            const light = hexToRgb(lightColor);
            const dark = hexToRgb(darkColor);
            const tint = hexToRgb(tintColor);
            gl.uniform3f(uniforms.u_lightColor, light[0], light[1], light[2]);
            gl.uniform3f(uniforms.u_darkColor, dark[0], dark[1], dark[2]);
            gl.uniform1f(uniforms.u_sharp, patternSharpness);
            gl.uniform1f(uniforms.u_wave, waveAmplitude);
            gl.uniform1f(uniforms.u_noise, noiseScale);
            gl.uniform1f(uniforms.u_chroma, chromaticSpread);
            gl.uniform1f(uniforms.u_distort, distortion);
            gl.uniform1f(uniforms.u_contour, contour);
            gl.uniform3f(uniforms.u_tint, tint[0], tint[1], tint[2]);

            const rect = el.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const canvasW = (rect.width || 1100) * dpr;
            const canvasH = (rect.height || 380) * dpr;
            canvas.width = canvasW;
            canvas.height = canvasH;
            gl.viewport(0, 0, canvasW, canvasH);

            function processImage(img) {
              const MAX_SIZE = 1000;
              const MIN_SIZE = 500;
              let width = img.naturalWidth || img.width;
              let height = img.naturalHeight || img.height;

              if (width > MAX_SIZE || height > MAX_SIZE || width < MIN_SIZE || height < MIN_SIZE) {
                const s = width > height
                  ? (width > MAX_SIZE ? MAX_SIZE / width : (width < MIN_SIZE ? MIN_SIZE / width : 1))
                  : (height > MAX_SIZE ? MAX_SIZE / height : (height < MIN_SIZE ? MIN_SIZE / height : 1));
                width = Math.round(width * s);
                height = Math.round(height * s);
              }

              const cv = document.createElement('canvas');
              cv.width = width;
              cv.height = height;
              const ctx = cv.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);

              const imageData = ctx.getImageData(0, 0, width, height);
              const data = imageData.data;
              const size = width * height;
              const alphaValues = new Float32Array(size);
              const shapeMask = new Uint8Array(size);
              const boundaryMask = new Uint8Array(size);

              for (let i = 0; i < size; i++) {
                const idx = i * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
                const isBackground = (r > 250 && g > 250 && b > 250 && a === 255) || a < 5;
                alphaValues[i] = isBackground ? 0 : a / 255;
                shapeMask[i] = alphaValues[i] > 0.1 ? 1 : 0;
              }

              for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                  const idx = y * width + x;
                  if (!shapeMask[idx]) continue;
                  if (x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
                      !shapeMask[idx - 1] || !shapeMask[idx + 1] ||
                      !shapeMask[idx - width] || !shapeMask[idx + width]) {
                    boundaryMask[idx] = 1;
                  }
                }
              }

              const uArray = new Float32Array(size);
              const ITERATIONS = 200;
              const C_val = 0.01;
              const omega = 1.85;

              for (let iter = 0; iter < ITERATIONS; iter++) {
                for (let y = 1; y < height - 1; y++) {
                  for (let x = 1; x < width - 1; x++) {
                    const idx = y * width + x;
                    if (!shapeMask[idx] || boundaryMask[idx]) continue;
                    const sum =
                      (shapeMask[idx + 1] ? uArray[idx + 1] : 0) +
                      (shapeMask[idx - 1] ? uArray[idx - 1] : 0) +
                      (shapeMask[idx + width] ? uArray[idx + width] : 0) +
                      (shapeMask[idx - width] ? uArray[idx - width] : 0);
                    const newVal = (C_val + sum) / 4;
                    uArray[idx] = omega * newVal + (1 - omega) * uArray[idx];
                  }
                }
              }

              let maxVal = 0;
              for (let i = 0; i < size; i++) if (uArray[i] > maxVal) maxVal = uArray[i];
              if (maxVal === 0) maxVal = 1;

              const outData = ctx.createImageData(width, height);
              for (let i = 0; i < size; i++) {
                const px = i * 4;
                const depth = uArray[i] / maxVal;
                const gray = Math.round(255 * (1 - depth * depth));
                outData.data[px] = outData.data[px + 1] = outData.data[px + 2] = gray;
                outData.data[px + 3] = Math.round(alphaValues[i] * 255);
              }

              return outData;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const imgData = processImage(img);
              const tex = gl.createTexture();
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, tex);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, imgData.width, imgData.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgData.data);
              gl.uniform1i(uniforms.u_tex, 0);

              const ratio = imgData.width / imgData.height;
              gl.uniform1f(uniforms.u_imgRatio, ratio);
              gl.uniform1f(uniforms.u_ratio, canvas.width / canvas.height);

              // Intersection Observer to pause/play WebGL rendering loop based on viewport visibility
              let isVisible = false;
              const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                  isVisible = entry.isIntersecting;
                });
              }, { threshold: 0.01 });
              observer.observe(canvas);

              let animTime = 0;
              let lastTime = performance.now();
              const mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };

              const handleMouseMove = (e) => {
                const rect = canvas.getBoundingClientRect();
                mouse.targetX = (e.clientX - rect.left) / rect.width;
                mouse.targetY = (e.clientY - rect.top) / rect.height;
              };

              canvas.addEventListener('mousemove', handleMouseMove);

              const render = (time) => {
                if (!isVisible) {
                  // Skip WebGL operations when off-screen to save 100% CPU/GPU resources
                  requestAnimationFrame(render);
                  return;
                }
                const delta = time - lastTime;
                lastTime = time;

                if (mouseAnimation) {
                  mouse.x += (mouse.targetX - mouse.x) * 0.08;
                  mouse.y += (mouse.targetY - mouse.y) * 0.08;
                  animTime = mouse.x * 3000 + mouse.y * 1500;
                } else {
                  animTime += delta * speed;
                }

                gl.uniform1f(uniforms.u_time, animTime);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                requestAnimationFrame(render);
              };

              requestAnimationFrame(render);
            };
            img.src = imageSrc;
        });
      });
    }
    window.initMetallicPaint = initMetallicPaint;

    // ===== CARREGAMENTO DINÂMICO DO CMS (SITE CONTENT) =====
    async function loadDynamicCMSContent() {
        try {
            const res = await fetch('/api/content?t=' + Date.now());
            if (!res.ok) return;
            const data = await res.json();
            if (!data || Object.keys(data).length === 0) return;

            const isPortfolioPage = window.location.pathname.includes('portfolio.html');
            if (!isPortfolioPage) {
                if (data.heroTitleLine1) {
                    const el = document.getElementById('hero-title-l1');
                    if (el) el.textContent = data.heroTitleLine1;
                }
                if (data.heroTitleLine2) {
                    const el = document.getElementById('hero-title-l2');
                    if (el) el.textContent = data.heroTitleLine2;
                }
                if (data.heroSubtitle) {
                    const el = document.getElementById('hero-subtitle');
                    if (el) el.innerHTML = data.heroSubtitle;
                }
            }

            if (data.about && data.about.bigText) {
                const el = document.querySelector('.about-big-text');
                if (el) el.innerHTML = data.about.bigText;
            }

            if (data.services && data.services.items && data.services.items.length > 0) {
                const serviceCards = document.querySelectorAll('.service-card');
                data.services.items.forEach((item, idx) => {
                    if (serviceCards[idx]) {
                        const titleEl = serviceCards[idx].querySelector('h3, .service-title');
                        const textEl = serviceCards[idx].querySelector('p, .service-desc');
                        if (titleEl && item.title) titleEl.textContent = item.title;
                        if (textEl && item.text) textEl.textContent = item.text;
                    }
                });
            }

            if (data.faqs && data.faqs.length > 0) {
                const faqContainer = document.querySelector('.faq-list');
                if (faqContainer) {
                    faqContainer.innerHTML = data.faqs.map(faq => `
                        <div class="faq-item">
                            <button class="faq-question">
                                <span>${faq.q}</span>
                                <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>
                            </button>
                            <div class="faq-answer">
                                <p>${faq.a}</p>
                            </div>
                        </div>
                    `).join('');
                    initFaqAccordion();
                }
            }
        } catch (e) {
            console.warn('[CMS] Erro ao carregar conteúdo dinâmico:', e);
        }
    }

    function initFaqAccordion() {
        const faqQuestions = document.querySelectorAll('.faq-question');
        faqQuestions.forEach(q => {
            q.removeEventListener('click', handleFaqClick);
            q.addEventListener('click', handleFaqClick);
        });
    }

    function handleFaqClick(e) {
        const btn = e.currentTarget;
        const item = btn.closest('.faq-item');
        const isActive = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
        if (!isActive) item.classList.add('active');
    }

    try { if (typeof initGradualBlur === 'function') initGradualBlur(); } catch (e) {}
    try { if (typeof initScrollFloat === 'function') initScrollFloat(); } catch (e) {}
    try { if (typeof initMetallicPaint === 'function') initMetallicPaint(); } catch (e) {}
    try { if (typeof initGooeyNav === 'function') initGooeyNav(); } catch (e) {}

    loadDynamicCMSContent();

    // ===== DOME GALLERY INITIALIZATION (ALDEIA STYLE) =====
    function initDomeGallery() {
        const root = document.getElementById('portfolio-dome');
        if (!root) return;

        const main = root.querySelector('.sphere-main');
        const sphere = root.querySelector('.sphere');
        const viewer = root.querySelector('.viewer');
        const scrim = root.querySelector('.scrim');
        const frame = root.querySelector('.frame');

        if (!main || !sphere || !viewer || !scrim || !frame) return;

        const segments = 35;
        const dragSensitivity = 20;
        const maxVerticalRotationDeg = 5;

        const images = window.aldeiaPortfolioImages || Array.from({ length: 21 }, (_, i) => ({
            src: `assets/portfolio/${i + 1}.webp`,
            alt: `Projeto ${i + 1}`
        }));

        function buildItems(pool, seg) {
            const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
            const evenYs = [-4, -2, 0, 2, 4];
            const oddYs = [-3, -1, 1, 3, 5];
            const coords = xCols.flatMap((x, c) => {
                const ys = c % 2 === 0 ? evenYs : oddYs;
                return ys.map(y => ({ x, y, sizeX: 2, sizeY: 2 }));
            });
            const totalSlots = coords.length;
            const usedImages = Array.from({ length: totalSlots }, (_, i) => pool[i % pool.length]);
            return coords.map((c, i) => ({ ...c, src: usedImages[i].src, alt: usedImages[i].alt }));
        }

        const items = buildItems(images, segments);

        sphere.innerHTML = '';
        items.forEach((it) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'item';
            itemEl.setAttribute('data-src', it.src);
            itemEl.style.setProperty('--offset-x', it.x);
            itemEl.style.setProperty('--offset-y', it.y);
            itemEl.style.setProperty('--item-size-x', it.sizeX);
            itemEl.style.setProperty('--item-size-y', it.sizeY);

            const imgWrap = document.createElement('div');
            imgWrap.className = 'item__image';
            imgWrap.setAttribute('role', 'button');
            imgWrap.setAttribute('tabindex', '0');
            imgWrap.setAttribute('aria-label', it.alt || 'Abrir imagem');

            const img = document.createElement('img');
            img.src = it.src;
            img.setAttribute('draggable', 'false');
            img.alt = it.alt;

            imgWrap.appendChild(img);
            itemEl.appendChild(imgWrap);
            sphere.appendChild(itemEl);
        });

        let rotationX = 0;
        let rotationY = 0;
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startRotX = 0;
        let startRotY = 0;

        function updateRotation() {
            sphere.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
        }

        main.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.item__image')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startRotX = rotationX;
            startRotY = rotationY;
            main.style.cursor = 'grabbing';
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const deltaX = (e.clientX - startX) / dragSensitivity;
            const deltaY = (e.clientY - startY) / dragSensitivity;
            rotationY = startRotY + deltaX;
            rotationX = Math.max(-maxVerticalRotationDeg, Math.min(maxVerticalRotationDeg, startRotX - deltaY));
            updateRotation();
        });

        window.addEventListener('pointerup', () => {
            if (isDragging) {
                isDragging = false;
                main.style.cursor = 'grab';
            }
        });

        sphere.addEventListener('click', (e) => {
            const wrap = e.target.closest('.item__image');
            if (!wrap) return;
            const realSrc = wrap.querySelector('img')?.src;
            if (realSrc && frame) {
                frame.innerHTML = `<img src="${realSrc}" alt="Ampliação" style="max-width: 90vw; max-height: 85vh; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.8); object-fit: contain;">`;
                root.classList.add('enlarged');
            }
        });

        if (scrim) {
            scrim.addEventListener('click', () => {
                root.classList.remove('enlarged');
            });
        }
    }

    try {
        initDomeGallery();
    } catch (e) {
        console.warn('[DomeGallery] Erro na inicialização:', e);
    }
})();
