// app.js — ALDEIA Design | Vídeo Cinematográfico + Todos os Efeitos
// ─────────────────────────────────────────────────────────────────────────────
//  V. VÍDEO HERO
//   V1. Grain Canvas (noise dinâmico de película)
//   V2. Glitch Effect (cortes aleatórios de tela)
//   V3. Parallax do vídeo no scroll
//   V4. Reveal clip-path após preloader (abre de baixo p/ cima + linha de luz)
//   V5. Dithering temporal (frames alterados via canvas overlay)
// ─────────────────────────────────────────────────────────────────────────────

function startApp() {

        // ════════════════════════════════════════════════
    // 1. PRELOADER CINEMÁTICO + REVEAL FOCAL DO VÍDEO
    // Transição suave por desfoque e opacidade (Sem cortes secos/pesados)
    // ════════════════════════════════════════════════
    const preloader = document.getElementById('preloader');
    const prelogo = document.querySelector('.preloader-logo');
    const videoWrap = document.getElementById('hero-video-wrap');
    const heroVideo = document.getElementById('hero-video');

    // Inicia o vídeo em segundo plano o quanto antes
    if (heroVideo) {
        heroVideo.play().catch(() => {
            document.addEventListener('click', () => heroVideo.play(), { once: true });
        });
    }

    // 1. Faz a logo do preloader focar suavemente ao abrir a página
    setTimeout(() => {
        if (prelogo) {
            prelogo.classList.add('focus-reveal');
        }
    }, 200);

    // 2. Inicia o desvanecimento cinematográfico
    setTimeout(() => {
        // Desfoca e dissolve a logo do preloader
        if (prelogo) {
            prelogo.classList.remove('focus-reveal');
            prelogo.classList.add('focus-dissolve');
        }

        // Revela o site: faz o preloader desvanecer
        if (preloader) {
            preloader.classList.add('fade-out');
        }
        
        // Remove a trava de rolagem no body
        document.body.classList.add('loaded');

        // Revela o vídeo com o efeito focal suave (blur + scale decrescente)
        if (videoWrap) {
            videoWrap.classList.add('focal-revealed');
        }

        // Limpa totalmente o preloader do DOM após o término da transição CSS
        setTimeout(() => {
            if (preloader) preloader.style.display = 'none';
        }, 1500);

    }, 2300);


    // ════════════════════════════════════════════════
    // V1. GRAIN CANVAS — Noise de película em tempo real
    // Cria grain de 8 bits que atualiza a 24fps
    // ════════════════════════════════════════════════
    (function initGrain() {
        const canvas = document.getElementById('grain-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        function resize() {
            // Usa resolução menor para performance (depois CSS faz scale)
            for (let i = 0; i < data.length; i += 4) {
                const v = (Math.random() * GRAIN_INTENSITY) | 0;
            canvas.style.width  = window.innerWidth  + 'px';
            canvas.style.height = window.innerHeight + 'px';
        }
        resize();
        window.addEventListener('resize', resize, { passive: true });

        let grainFrame;
        const GRAIN_INTENSITY = 40; // 0–255: intensidade do ruído

        function drawGrain() {
            const { width, height } = canvas;
            const imageData = ctx.createImageData(width, height);
            const data      = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const v = (Math.random() * GRAIN_INTENSITY) | 0;
                data[i]     = v; // R
                data[i + 1] = v; // G
                data[i + 2] = v; // B
                data[i + 3] = 180; // A (semi-transparente)
            }

            ctx.putImageData(imageData, 0, 0);
            grainFrame = requestAnimationFrame(drawGrain);
        }

        // Só anima quando o hero está visível (performance)
        const grainObserver = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                drawGrain();
            } else {
                cancelAnimationFrame(grainFrame);
            }
        }, { threshold: 0 });

        const heroSection = document.getElementById('home');
        if (heroSection) grainObserver.observe(heroSection);
        else drawGrain();
    })();


    // ════════════════════════════════════════════════
    // V2. GLITCH EFFECT — Cortes aleatórios no vídeo
    // Dispara glitches a intervalos aleatórios
    // ════════════════════════════════════════════════
    (function initGlitch() {
        const slices = document.querySelectorAll('.glitch-slice');
        if (!slices.length || !heroVideo) return;

        // Configuração das fatias: posição e altura
        const sliceConfig = [
            { top: '15%', height: '8px'  },
            { top: '42%', height: '5px'  },
            { top: '73%', height: '12px' },
        ];

        slices.forEach((slice, i) => {
            slice.style.top    = sliceConfig[i].top;
            slice.style.height = sliceConfig[i].height;
            // Cada fatia mostra uma versão offset do video
            slice.style.background = 'rgba(255,255,255,0.06)';
            slice.style.backdropFilter = 'invert(1) hue-rotate(180deg)';
        });

        function triggerGlitch() {
            // Seleciona 1–3 slices aleatórios
            const count  = Math.floor(Math.random() * 3) + 1;
            const chosen = [...slices]
                .sort(() => Math.random() - 0.5)
                .slice(0, count);

            chosen.forEach(s => {
                // Deslocamento horizontal aleatório
                const offset = (Math.random() - 0.5) * 30;
                s.style.transform  = `translateX(${offset}px)`;
                s.style.opacity    = '1';
                s.style.backdropFilter = `invert(${Math.random() > 0.5 ? 1 : 0}) brightness(${1.5 + Math.random()}) hue-rotate(${Math.floor(Math.random() * 360)}deg)`;
            });

            // Duração do glitch: 80–180ms
            const dur = 80 + Math.random() * 100;
            setTimeout(() => {
                chosen.forEach(s => {
                    s.style.opacity   = '0';
                    s.style.transform = 'translateX(0)';
                });
            }, dur);

            // Próximo glitch: intervalo aleatório 2.5s–12s
            const nextIn = 2500 + Math.random() * 9500;
            setTimeout(triggerGlitch, nextIn);
        }

        // Primeiro glitch após o reveal terminar
        setTimeout(triggerGlitch, OPENING_DELAY + 2200);
    })();


    // ════════════════════════════════════════════════
    // V3. PARALLAX DO VÍDEO NO SCROLL
    // O vídeo sobe mais devagar que a página (parallax)
    // ════════════════════════════════════════════════

    // ================================================
    // 5. HIGHLIGHT DO LINK DE NAV ATIVO (scroll spy)
    // ================================================
    const sections  = document.querySelectorAll('section[id]');
    const navLinkEls = document.querySelectorAll('.nav-link:not(.cta-nav)');

    const spyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinkEls.forEach(link => link.classList.remove('active'));
                const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
                if (active) active.classList.add('active');
            }
        });
    }, {
        threshold: 0.45
    });

    sections.forEach(sec => spyObserver.observe(sec));

// MISSING LINE 201
// MISSING LINE 202
// MISSING LINE 203
// MISSING LINE 204
// MISSING LINE 205
// MISSING LINE 206
// MISSING LINE 207
// MISSING LINE 208
// MISSING LINE 209
// MISSING LINE 210
// MISSING LINE 211
// MISSING LINE 212
// MISSING LINE 213
// MISSING LINE 214
// MISSING LINE 215
// MISSING LINE 216
// MISSING LINE 217
// MISSING LINE 218
// MISSING LINE 219
// MISSING LINE 220
// MISSING LINE 221
// MISSING LINE 222
// MISSING LINE 223
// MISSING LINE 224
// MISSING LINE 225
// MISSING LINE 226
// MISSING LINE 227
// MISSING LINE 228
// MISSING LINE 229
// MISSING LINE 230
// MISSING LINE 231
// MISSING LINE 232
// MISSING LINE 233
// MISSING LINE 234
// MISSING LINE 235
// MISSING LINE 236
// MISSING LINE 237
// MISSING LINE 238
// MISSING LINE 239
                cursor.style.transform   = 'translate(-50%,-50%) scale(1)';
                follower.style.transform = 'translate(-50%,-50%) scale(1)';
                follower.style.borderColor = 'rgba(201,169,110,0.4)';
            });
        });
    }


    // ════════════════════════════════════════════════
    // 3. BLUR TEXT — hero tag + hero title
    // Divide texto em palavras, cada uma com .blur-word.
    // Cada palavra recebe a classe 'visible' em cascata.
    // ════════════════════════════════════════════════
    function initBlurText(el, text, startDelay = 0, stagger = 90, lines = null) {
        if (!el) return;
        el.innerHTML = '';

        if (lines) {
            // Suporte a quebras de linha (hero-title)
            lines.forEach((line, li) => {
                const lineDiv = document.createElement('span');
                lineDiv.className = 'blur-line';
                const words = line.split(' ').filter(w => w.length > 0);
                words.forEach((word, wi) => {
                    const span = document.createElement('span');
                    span.className = 'blur-word';
                    span.textContent = word;
                    const globalIdx = lines.slice(0, li).reduce((a, l) => a + l.split(' ').filter(w=>w).length, 0) + wi;
                    span.style.transitionDelay = (startDelay + globalIdx * stagger) + 'ms';
                    lineDiv.appendChild(span);
                });
                el.appendChild(lineDiv);
            });
        } else {
            text.split(' ').filter(w => w.length > 0).forEach((word, i) => {
                const span = document.createElement('span');
                span.className = 'blur-word';
                span.textContent = word;
                span.style.transitionDelay = (startDelay + i * stagger) + 'ms';
                el.appendChild(span);
            });
        }

        // Ativa após o preloader
        const allWords = el.querySelectorAll('.blur-word');
        setTimeout(() => {
            allWords.forEach(w => w.classList.add('visible'));
        }, OPENING_DELAY + 500);
    }

    // Hero tag (linha única)
    initBlurText(
        document.getElementById('blur-tag'),
        'Agência Boutique de Design',
        0, 80
    );

    // Hero title (3 linhas com quebras)
    initBlurText(
        document.getElementById('blur-title'),
        null,
// MISSING LINE 301
// MISSING LINE 302
// MISSING LINE 303
// MISSING LINE 304
// MISSING LINE 305
// MISSING LINE 306
// MISSING LINE 307
// MISSING LINE 308
// MISSING LINE 309
// MISSING LINE 310
// MISSING LINE 311
// MISSING LINE 312
// MISSING LINE 313
// MISSING LINE 314
// MISSING LINE 315
// MISSING LINE 316
// MISSING LINE 317
// MISSING LINE 318
// MISSING LINE 319
// MISSING LINE 320
// MISSING LINE 321
// MISSING LINE 322
        const titleEl = document.getElementById('blur-title');
        if (titleEl) {
            const lines = titleEl.querySelectorAll('.blur-line');
            if (lines[2]) {
                lines[2].querySelectorAll('.blur-word').forEach(w => {
                    w.style.WebkitTextStroke = '1px rgba(240,237,232,0.6)';
                    w.style.color = 'transparent';
                    w.style.fontStyle = 'italic';
                });
            }
            if (lines[1]) {
                lines[1].querySelectorAll('.blur-word').forEach(w => {
                    w.style.fontStyle = 'italic';
                    w.style.color = 'rgba(240,237,232,0.5)';
                });
            }
        }
    }, 0);


    // ════════════════════════════════════════════════
    // 4. TRUE FOCUS — manifesto h2
    // Cicla o foco entre as palavras em loop.
    // Uma caixa animada (.tf-focus-box) segue a palavra ativa.
    // ════════════════════════════════════════════════
    function initTrueFocus(el) {
        if (!el) return;

        const rawText = 'Uma aldeia não é apenas um lugar. É uma força coletiva.';
        el.innerHTML = '';
        el.style.position = 'relative';

        // Cria a caixa de foco
        const focusBox = document.createElement('div');
        focusBox.className = 'tf-focus-box';
        el.appendChild(focusBox);

        // Cria os spans de palavra preservando italics e highlights
// MISSING LINE 361
// MISSING LINE 362
// MISSING LINE 363
// MISSING LINE 364
            { text: 'é',         style: '' },
            { text: 'apenas',    style: 'italic' },
            { text: 'um',        style: 'italic' },
            { text: 'lugar.',    style: 'italic' },
            { text: 'É',         style: '' },
            { text: 'uma',       style: '' },
            { text: 'força',     style: 'accent' },
            { text: 'coletiva.', style: 'accent' },
        ];

        const wordEls = segments.map(seg => {
            const span = document.createElement('span');
            span.className = 'tf-word tf-blurred';
            span.textContent = seg.text;
            if (seg.style === 'italic') {
                span.style.fontStyle = 'italic';
                span.style.color = 'rgba(240,237,232,0.4)';
            } else if (seg.style === 'accent') {
                span.style.color = 'var(--accent)';
                span.style.fontStyle = 'italic';
            }
            el.appendChild(span);
            return { el: span, style: seg.style };
        });

        let currentIdx = 0;

        function focusWord(idx) {
            wordEls.forEach((w, i) => {
                w.el.classList.remove('tf-focused', 'tf-blurred');
                w.el.classList.add(i === idx ? 'tf-focused' : 'tf-blurred');
            });

            // Move a caixa de foco para a palavra ativa
            const wordEl = wordEls[idx].el;
            const parentRect = el.getBoundingClientRect();
            const wordRect   = wordEl.getBoundingClientRect();

            focusBox.style.opacity = '1';
            focusBox.style.left   = (wordRect.left - parentRect.left - 6)  + 'px';
            focusBox.style.top    = (wordRect.top  - parentRect.top  - 4)  + 'px';
            focusBox.style.width  = (wordRect.width  + 12) + 'px';
            focusBox.style.height = (wordRect.height + 8)  + 'px';
        }

        // Inicia o loop quando o manifesto entra no viewport
        let tfInterval = null;
        const tfObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !tfInterval) {
                    focusWord(0);
                    tfInterval = setInterval(() => {
                        currentIdx = (currentIdx + 1) % wordEls.length;
                        focusWord(currentIdx);
                    }, 1800);
                } else if (!entry.isIntersecting && tfInterval) {
                    clearInterval(tfInterval);
                    tfInterval = null;
                }
            });
        }, { threshold: 0.4 });

        tfObserver.observe(el);
    }

    initTrueFocus(document.getElementById('true-focus-title'));


    // ═══════════════════════════════
    }


    // ════════════════════════════════════════════════
    // 6. SPOTLIGHT CARD — portfolio items
    // Um holofote (radial-gradient) segue o mouse dentro do card.
    // ════════════════════════════════════════════════
    document.querySelectorAll('.spotlight-card').forEach(card => {
        const overlay = card.querySelector('.spotlight-overlay');
        if (!overlay) return;

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x    = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + '%';
            const y    = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
            overlay.style.setProperty('--sx', x);
            overlay.style.setProperty('--sy', y);
        });
    });


    // ════════════════════════════════════════════════
    // 7. DOME GALLERY
    // Cada card recebe uma inclinação sutil baseada na sua
    // posição no grid, criando a ilusão de uma cúpula côncava.
    // ════════════════════════════════════════════════
    function initDomeGallery() {
        const gallery = document.getElementById('dome-gallery');
        if (!gallery) return;

        const items = [...gallery.querySelectorAll('.portfolio-item')];
        const cols  = 3; // colunas do grid no desktop
            overlay.style.setProperty('--sy', y);
        });
    });


            // ════════════════════════════════════════════════
    // 7. DOME GALLERY (React Bits DomeGallery 100% original)
    // Grade cilíndrica tridimensional côncava de cards com física e zoom
    // ════════════════════════════════════════════════
    function initDomeGallery() {
        const root = document.getElementById('dome-gallery-root');
        const main = document.getElementById('dome-gallery-main');
        const sphere = document.getElementById('dome-sphere');
        const viewer = document.getElementById('dome-viewer');
        const dragDampening = 2;
        const grayscale = true;
        const overlayBlurColor = '#080808';
        const imageBorderRadius = '16px';
        const openedImageBorderRadius = '24px';
        const openedImageWidth = '320px';
        const openedImageHeight = '420px';

        // 1. Imagens do portfólio (as 20 imagens reais)
        const images = [];
        for (let i = 1; i <= 20; i++) {
            images.push({
                src: `assets/portfolio/${i}.png`,
                alt: `Projeto ${i}`
            });
        }

        // 2. buildItems — Grade de domo regular
        const xCols = Array.from({ length: segments }, (_, i) => -37 + i * 2);
        const evenYs = [-4, -2, 0, 2, 4];
        const oddYs = [-3, -1, 1, 3, 5];
            images.push({
                src: `assets/portfolio/${i}.png`,
                alt: `Projeto ${i}`
            });
        }

        // 2. buildItems — Grade de domo regular
        const xCols = Array.from({ length: segments }, (_, i) => -37 + i * 2);
        const evenYs = [-4, -2, 0, 2, 4];
        const oddYs = [-3, -1, 1, 3, 5];

        const coords = xCols.flatMap((x, c) => {
            const ys = c % 2 === 0 ? evenYs : oddYs;
            return ys.map(y => ({ x, y, sizeX: 2, sizeY: 2 }));
        });

        const totalSlots = coords.length;
        const normalizedImages = images.map(img => ({ src: img.src, alt: img.alt }));
        const usedImages = Array.from({ length: totalSlots }, (_, i) => normalizedImages[i % normalizedImages.length]);

        // Permuta vizinhos para evitar imagens duplicadas lado a lado
        for (let i = 1; i < usedImages.length; i++) {
            if (usedImages[i].src === usedImages[i - 1].src) {
                for (let j = i + 1; j < usedImages.length; j++) {
                    if (usedImages[j].src !== usedImages[i].src) {
                        const tmp = usedImages[i];
                        usedImages[i] = usedImages[j];
                        usedImages[j] = tmp;
                        break;
                    }
                }
            }
        }

            const normY = (y - cy) / cy;

            const rotY = normX * MAX_TILT;
            const rotX = -normY * MAX_TILT;

            profileCard.style.transition = 'box-shadow 0.4s ease';
            profileCard.style.transform  = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;

            // Glow segue o mouse
            if (glow) {
                const gx = (x / rect.width  * 100).toFixed(1) + '%';
                const gy = (y / rect.height * 100).toFixed(1) + '%';
                glow.style.setProperty('--pc-x', gx);
                glow.style.setProperty('--pc-y', gy);
            }
        });
// MISSING LINE 551
// MISSING LINE 552
// MISSING LINE 553
// MISSING LINE 554
// MISSING LINE 555
// MISSING LINE 556
// MISSING LINE 557
// MISSING LINE 558
// MISSING LINE 559
// MISSING LINE 560
// MISSING LINE 561
// MISSING LINE 562
// MISSING LINE 563
// MISSING LINE 564
// MISSING LINE 565
// MISSING LINE 566
// MISSING LINE 567
// MISSING LINE 568
// MISSING LINE 569
// MISSING LINE 570
// MISSING LINE 571
// MISSING LINE 572
// MISSING LINE 573
// MISSING LINE 574
// MISSING LINE 575
// MISSING LINE 576
// MISSING LINE 577
// MISSING LINE 578
// MISSING LINE 579
// MISSING LINE 580
// MISSING LINE 581
// MISSING LINE 582
// MISSING LINE 583
// MISSING LINE 584
// MISSING LINE 585
// MISSING LINE 586
// MISSING LINE 587
// MISSING LINE 588
// MISSING LINE 589
// MISSING LINE 590
// MISSING LINE 591
// MISSING LINE 592
// MISSING LINE 593
// MISSING LINE 594
// MISSING LINE 595
// MISSING LINE 596
// MISSING LINE 597
// MISSING LINE 598
// MISSING LINE 599
// MISSING LINE 600
// MISSING LINE 601
// MISSING LINE 602
// MISSING LINE 603
// MISSING LINE 604
// MISSING LINE 605
// MISSING LINE 606
// MISSING LINE 607
// MISSING LINE 608
// MISSING LINE 609
// MISSING LINE 610
// MISSING LINE 611
// MISSING LINE 612
// MISSING LINE 613
// MISSING LINE 614
// MISSING LINE 615
// MISSING LINE 616
// MISSING LINE 617
// MISSING LINE 618
// MISSING LINE 619
// MISSING LINE 620
// MISSING LINE 621
// MISSING LINE 622
// MISSING LINE 623
// MISSING LINE 624
// MISSING LINE 625
// MISSING LINE 626
// MISSING LINE 627
// MISSING LINE 628
// MISSING LINE 629
// MISSING LINE 630
// MISSING LINE 631
// MISSING LINE 632
// MISSING LINE 633
// MISSING LINE 634
// MISSING LINE 635
// MISSING LINE 636
// MISSING LINE 637
// MISSING LINE 638
// MISSING LINE 639
// MISSING LINE 640
// MISSING LINE 641
// MISSING LINE 642
// MISSING LINE 643
// MISSING LINE 644
// MISSING LINE 645
// MISSING LINE 646
// MISSING LINE 647
// MISSING LINE 648
// MISSING LINE 649
// MISSING LINE 650
// MISSING LINE 651
// MISSING LINE 652
// MISSING LINE 653
// MISSING LINE 654
// MISSING LINE 655
// MISSING LINE 656
// MISSING LINE 657
// MISSING LINE 658
            return { rotateX: rX, rotateY: rY };
        };

        // Inércia
        const stopInertia = () => {
            if (inertiaRAF) {
                cancelAnimationFrame(inertiaRAF);
                inertiaRAF = null;
            }
        };

        const startInertia = (vx, vy) => {
            const MAX_V = 1.4;
            let vX = Math.max(-MAX_V, Math.min(vx, MAX_V)) * 80;
            let vY = Math.max(-MAX_V, Math.min(vy, MAX_V)) * 80;
            let frames = 0;
            const d = Math.max(0, Math.min(dragDampening, 1));
            const frictionMul = 0.94 + 0.055 * d;
            const stopThreshold = 0.015 - 0.01 * d;
            const maxFrames = Math.round(90 + 270 * d);

            const step = () => {
                vX *= frictionMul;
                vY *= frictionMul;
                if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) {
                    inertiaRAF = null;
                    return;
                }
                if (++frames > maxFrames) {
                    inertiaRAF = null;
                    return;
                }
                const nextX = Math.max(-maxVerticalRotationDeg, Math.min(rotationX - vY / 200, maxVerticalRotationDeg));
                const nextY = wrapAngleSigned(rotationY + vX / 200);
                rotationX = nextX;
                rotationY = nextY;
                applyTransform(nextX, nextY);
                inertiaRAF = requestAnimationFrame(step);
            };
            stopInertia();
            inertiaRAF = requestAnimationFrame(step);
        };
// MISSING LINE 701
// MISSING LINE 702
// MISSING LINE 703
// MISSING LINE 704
// MISSING LINE 705
// MISSING LINE 706
// MISSING LINE 707
// MISSING LINE 708
// MISSING LINE 709
// MISSING LINE 710
// MISSING LINE 711
// MISSING LINE 712
// MISSING LINE 713
// MISSING LINE 714
// MISSING LINE 715
// MISSING LINE 716
// MISSING LINE 717
// MISSING LINE 718
// MISSING LINE 719
// MISSING LINE 720
// MISSING LINE 721
// MISSING LINE 722
// MISSING LINE 723
// MISSING LINE 724
// MISSING LINE 725
// MISSING LINE 726
// MISSING LINE 727
// MISSING LINE 728
// MISSING LINE 729
// MISSING LINE 730
// MISSING LINE 731
// MISSING LINE 732
// MISSING LINE 733
// MISSING LINE 734
// MISSING LINE 735
// MISSING LINE 736
// MISSING LINE 737
// MISSING LINE 738
// MISSING LINE 739
// MISSING LINE 740
// MISSING LINE 741
// MISSING LINE 742
// MISSING LINE 743
// MISSING LINE 744
// MISSING LINE 745
// MISSING LINE 746
// MISSING LINE 747
// MISSING LINE 748
// MISSING LINE 749
// MISSING LINE 750
// MISSING LINE 751
// MISSING LINE 752
// MISSING LINE 753
// MISSING LINE 754
// MISSING LINE 755
// MISSING LINE 756
// MISSING LINE 757
// MISSING LINE 758
// MISSING LINE 759
// MISSING LINE 760
// MISSING LINE 761
// MISSING LINE 762
// MISSING LINE 763
// MISSING LINE 764
// MISSING LINE 765
// MISSING LINE 766
// MISSING LINE 767
// MISSING LINE 768
// MISSING LINE 769
// MISSING LINE 770
// MISSING LINE 771
// MISSING LINE 772
// MISSING LINE 773
// MISSING LINE 774
// MISSING LINE 775
// MISSING LINE 776
// MISSING LINE 777
// MISSING LINE 778
// MISSING LINE 779
// MISSING LINE 780
// MISSING LINE 781
// MISSING LINE 782
// MISSING LINE 783
// MISSING LINE 784
// MISSING LINE 785
// MISSING LINE 786
// MISSING LINE 787
// MISSING LINE 788
// MISSING LINE 789
// MISSING LINE 790
// MISSING LINE 791
// MISSING LINE 792
// MISSING LINE 793
// MISSING LINE 794
// MISSING LINE 795
// MISSING LINE 796
// MISSING LINE 797
// MISSING LINE 798
// MISSING LINE 799
// MISSING LINE 800
// MISSING LINE 801
// MISSING LINE 802
// MISSING LINE 803
// MISSING LINE 804
// MISSING LINE 805
// MISSING LINE 806
// MISSING LINE 807
// MISSING LINE 808
// MISSING LINE 809
// MISSING LINE 810
// MISSING LINE 811
// MISSING LINE 812
// MISSING LINE 813
// MISSING LINE 814
// MISSING LINE 815
// MISSING LINE 816
// MISSING LINE 817
// MISSING LINE 818
// MISSING LINE 819
// MISSING LINE 820
// MISSING LINE 821
// MISSING LINE 822
// MISSING LINE 823
// MISSING LINE 824
// MISSING LINE 825
// MISSING LINE 826
// MISSING LINE 827
// MISSING LINE 828
// MISSING LINE 829
// MISSING LINE 830
// MISSING LINE 831
// MISSING LINE 832
// MISSING LINE 833
// MISSING LINE 834
// MISSING LINE 835
// MISSING LINE 836
// MISSING LINE 837
// MISSING LINE 838
// MISSING LINE 839
// MISSING LINE 840
// MISSING LINE 841
// MISSING LINE 842
// MISSING LINE 843
// MISSING LINE 844
// MISSING LINE 845
// MISSING LINE 846
// MISSING LINE 847
// MISSING LINE 848
// MISSING LINE 849
// MISSING LINE 850
// MISSING LINE 851
// MISSING LINE 852
// MISSING LINE 853
// MISSING LINE 854
// MISSING LINE 855
// MISSING LINE 856
// MISSING LINE 857
// MISSING LINE 858
// MISSING LINE 859
// MISSING LINE 860
// MISSING LINE 861
// MISSING LINE 862
// MISSING LINE 863
// MISSING LINE 864
// MISSING LINE 865
// MISSING LINE 866
// MISSING LINE 867
// MISSING LINE 868
// MISSING LINE 869
// MISSING LINE 870
// MISSING LINE 871
// MISSING LINE 872
// MISSING LINE 873
// MISSING LINE 874
// MISSING LINE 875
// MISSING LINE 876
// MISSING LINE 877
// MISSING LINE 878
// MISSING LINE 879
// MISSING LINE 880
// MISSING LINE 881
// MISSING LINE 882
// MISSING LINE 883
// MISSING LINE 884
// MISSING LINE 885
// MISSING LINE 886
// MISSING LINE 887
// MISSING LINE 888
// MISSING LINE 889
// MISSING LINE 890
// MISSING LINE 891
// MISSING LINE 892
// MISSING LINE 893
// MISSING LINE 894
// MISSING LINE 895
// MISSING LINE 896
// MISSING LINE 897
// MISSING LINE 898
// MISSING LINE 899
// MISSING LINE 900
// MISSING LINE 901
// MISSING LINE 902
// MISSING LINE 903
// MISSING LINE 904
// MISSING LINE 905
// MISSING LINE 906
// MISSING LINE 907
// MISSING LINE 908
// MISSING LINE 909
// MISSING LINE 910
// MISSING LINE 911
// MISSING LINE 912
// MISSING LINE 913
// MISSING LINE 914
// MISSING LINE 915
// MISSING LINE 916
// MISSING LINE 917
// MISSING LINE 918
// MISSING LINE 919
// MISSING LINE 920
// MISSING LINE 921
// MISSING LINE 922
// MISSING LINE 923
// MISSING LINE 924
// MISSING LINE 925
// MISSING LINE 926
// MISSING LINE 927
// MISSING LINE 928
// MISSING LINE 929
// MISSING LINE 930
// MISSING LINE 931
// MISSING LINE 932
// MISSING LINE 933
// MISSING LINE 934
// MISSING LINE 935
// MISSING LINE 936
// MISSING LINE 937
// MISSING LINE 938
// MISSING LINE 939
// MISSING LINE 940
// MISSING LINE 941
// MISSING LINE 942
// MISSING LINE 943
// MISSING LINE 944
// MISSING LINE 945
// MISSING LINE 946
// MISSING LINE 947
// MISSING LINE 948
// MISSING LINE 949
// MISSING LINE 950
// MISSING LINE 951
// MISSING LINE 952
// MISSING LINE 953
// MISSING LINE 954
// MISSING LINE 955
// MISSING LINE 956
// MISSING LINE 957
// MISSING LINE 958
// MISSING LINE 959
// MISSING LINE 960
// MISSING LINE 961
// MISSING LINE 962
// MISSING LINE 963
// MISSING LINE 964
// MISSING LINE 965
// MISSING LINE 966
// MISSING LINE 967
// MISSING LINE 968
// MISSING LINE 969
// MISSING LINE 970
// MISSING LINE 971
// MISSING LINE 972
// MISSING LINE 973
// MISSING LINE 974
// MISSING LINE 975
// MISSING LINE 976
// MISSING LINE 977
// MISSING LINE 978
// MISSING LINE 979
// MISSING LINE 980
// MISSING LINE 981
// MISSING LINE 982
// MISSING LINE 983
// MISSING LINE 984
// MISSING LINE 985
// MISSING LINE 986
// MISSING LINE 987
// MISSING LINE 988
// MISSING LINE 989
// MISSING LINE 990
// MISSING LINE 991
// MISSING LINE 992
// MISSING LINE 993
// MISSING LINE 994
// MISSING LINE 995
// MISSING LINE 996
// MISSING LINE 997
// MISSING LINE 998
// MISSING LINE 999
                                document.body.classList.remove('dg-scroll-lock');
                            }, 300);
                        });
                    });
                });
            };
            animatingOverlay.addEventListener('transitionend', cleanup, { once: true });
        };

        scrim.addEventListener('click', closeEnlarge);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeEnlarge();
        });
    }

    initDomeGallery();


    // ════════════════════════════════════════════════
    // 8. BORDER GLOW — service items
    // O ângulo do conic-gradient gira animado via CSS
    // @keyframes, mas o centro (mx, my) segue o mouse.
    // ════════════════════════════════════════════════
    document.querySelectorAll('.border-glow').forEach(item => {
        item.addEventListener('mousemove', (e) => {
            const rect = item.getBoundingClientRect();
            const mx   = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + '%';
            const my   = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
            item.style.setProperty('--bg-mx', mx);
            item.style.setProperty('--bg-my', my);
        });
    });


    // ════════════════════════════════════════════════
    // 9. PROFILE CARD — contato
    // Tilt 3D em perspectiva + glow que segue o mouse.
    // ════════════════════════════════════════════════
    const profileCard = document.getElementById('profile-card');
    if (profileCard) {
        const glow = profileCard.querySelector('.profile-card-glow');
        const MAX_TILT = 12; // graus

        profileCard.addEventListener('mousemove', (e) => {
            const rect   = profileCard.getBoundingClientRect();
            const x      = e.clientX - rect.left;
            const y      = e.clientY - rect.top;
            const cx     = rect.width  / 2;
            const cy     = rect.height / 2;

            // Normaliza -1 → +1
            const normX = (x - cx) / cx;
            const normY = (y - cy) / cy;

            const rotY = normX * MAX_TILT;
            const rotX = -normY * MAX_TILT;

            profileCard.style.transition = 'box-shadow 0.4s ease';
            profileCard.style.transform  = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;

            // Glow segue o mouse
            if (glow) {
                const gx = (x / rect.width  * 100).toFixed(1) + '%';
                const gy = (y / rect.height * 100).toFixed(1) + '%';
                glow.style.setProperty('--pc-x', gx);
                glow.style.setProperty('--pc-y', gy);
            }
        });

        profileCard.addEventListener('mouseleave', () => {
            profileCard.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease';
            profileCard.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)';
        });
    }


    // ════════════════════════════════════════════════
    // 10. PILL NAV — pílula deslizante
    // ════════════════════════════════════════════════
    const pill      = document.getElementById('nav-pill');
    const pillLinks = document.querySelectorAll('[data-pill]');

    function movePillTo(target) {
        if (!pill || !target) return;
        const wrap     = document.getElementById('nav-links');
        if (!wrap) return;
        const wrapRect = wrap.getBoundingClientRect();
        const rect     = target.getBoundingClientRect();
        pill.style.width   = rect.width + 'px';
        pill.style.left    = (rect.left - wrapRect.left) + 'px';
        pill.style.opacity = '1';
    }

    function hidePill() { if (pill) pill.style.opacity = '0'; }

    if (pill && pillLinks.length > 0) {
        pillLinks.forEach(link => {
            link.addEventListener('mouseenter', () => movePillTo(link));
        });
        const navList = document.querySelector('.nav-links');
        if (navList) {
            navList.addEventListener('mouseleave', () => {
                const active = document.querySelector('[data-pill].active');
                if (active) movePillTo(active);
                else hidePill();
            });
        }

        function syncPillToActive() {
            const active = document.querySelector('[data-pill].active');
            if (active) movePillTo(active);
            else hidePill();
        }

        setTimeout(syncPillToActive, OPENING_DELAY + 1400);
        window.addEventListener('resize', syncPillToActive, { passive: true });
    }


    // ════════════════════════════════════════════════
    // 11. SCROLL REVEAL (Intersection Observer)
    // ════════════════════════════════════════════════
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.scroll-reveal').forEach(el => revea
// MISSING LINE 1132
// MISSING LINE 1133
// MISSING LINE 1134
// MISSING LINE 1135
// MISSING LINE 1136
// MISSING LINE 1137
// MISSING LINE 1138
// MISSING LINE 1139
// MISSING LINE 1140
// MISSING LINE 1141
// MISSING LINE 1142
// MISSING LINE 1143
// MISSING LINE 1144
// MISSING LINE 1145
// MISSING LINE 1146
// MISSING LINE 1147
// MISSING LINE 1148
// MISSING LINE 1149
// MISSING LINE 1150
// MISSING LINE 1151
// MISSING LINE 1152
// MISSING LINE 1153
// MISSING LINE 1154
// MISSING LINE 1155
// MISSING LINE 1156
// MISSING LINE 1157
// MISSING LINE 1158
// MISSING LINE 1159
// MISSING LINE 1160
// MISSING LINE 1161
// MISSING LINE 1162
// MISSING LINE 1163
// MISSING LINE 1164
// MISSING LINE 1165
// MISSING LINE 1166
// MISSING LINE 1167
// MISSING LINE 1168
// MISSING LINE 1169
// MISSING LINE 1170
// MISSING LINE 1171
// MISSING LINE 1172
// MISSING LINE 1173
// MISSING LINE 1174
// MISSING LINE 1175
// MISSING LINE 1176
// MISSING LINE 1177
// MISSING LINE 1178
// MISSING LINE 1179
// MISSING LINE 1180
// MISSING LINE 1181
// MISSING LINE 1182
// MISSING LINE 1183
// MISSING LINE 1184
// MISSING LINE 1185
// MISSING LINE 1186
// MISSING LINE 1187
// MISSING LINE 1188
// MISSING LINE 1189
// MISSING LINE 1190
// MISSING LINE 1191
// MISSING LINE 1192
// MISSING LINE 1193
// MISSING LINE 1194
// MISSING LINE 1195
// MISSING LINE 1196
// MISSING LINE 1197
// MISSING LINE 1198
            const prefix   = text.startsWith('+') ? '+' : '';
            const suffix   = text.endsWith('%')   ? '%' : '';
            const duration = 1800;
            const start    = performance.now();
            function tick(now) {
                const p = Math.min((now - start) / duration, 1);
                const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
                el.textContent = prefix + Math.round(e * num) + suffix;
                if (p < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        });
    }, { threshold: 0.6 });

    statNums.forEach(el => countObserver.observe(el));


    // ════════════════════════════════════════════════
    // 14. HERO PARALLAX BLOBS (mouse)
    // ════════════════════════════════════════════════
    const blob1 = document.querySelector('.blob-1');
    const blob2 = document.querySelector('.blob-2');
    if (blob1 && blob2) {
        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth  - 0.5) * 40;
            const y = (e.clientY / window.innerHeight - 0.5) * 40;
            blob1.style.transform = `scale(1) translate(${x * 0.5}px, ${y * 0.5}px)`;
            blob2.style.transform = `scale(1) translate(${-x * 0.3}px, ${-y * 0.3}px)`;
        }, { passive: true });
    }

}); // end DOMContentLoaded

