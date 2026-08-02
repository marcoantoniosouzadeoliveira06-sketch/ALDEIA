import re
import os

html_path = r"C:\Users\User\Documents\ALDEIA\aldeia-site-oficial\index.html"
css_path = r"C:\Users\User\Documents\ALDEIA\aldeia-site-oficial\style.css"
js_path = r"C:\Users\User\Documents\ALDEIA\aldeia-site-oficial\app.js"

# 1. ATUALIZAR HTML (index.html)
if os.path.exists(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    new_preloader_html = """    <!-- ===== PRELOADER CINEMATOGRÁFICO ===== -->
    <div id="preloader">
        <div class="preloader-logo">
            <img src="assets/logo-secundaria.png" alt="ALDEIA Logo">
        </div>
    </div>"""

    # Localiza o bloco do preloader e substitui
    pattern_preloader = re.compile(r'<!-- ===== PRELOADER.*?<div id="preloader">.*?</div>\s*</div>', re.DOTALL)
    if pattern_preloader.search(html_content):
        html_content = pattern_preloader.sub(new_preloader_html, html_content)
        print("HTML preloader simplified successfully!")
    else:
        # Padrão alternativo mais abrangente
        pattern_preloader_alt = re.compile(r'<div id="preloader">.*?</div>\s*</div>', re.DOTALL)
        if pattern_preloader_alt.search(html_content):
            html_content = pattern_preloader_alt.sub(new_preloader_html, html_content)
            print("HTML preloader simplified via alternative pattern!")
        else:
            print("Warning: HTML preloader pattern match failed.")

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

# 2. ATUALIZAR CSS (style.css)
if os.path.exists(css_path):
    with open(css_path, 'r', encoding='utf-8') as f:
        css_content = f.read()

    # Novas regras do preloader
    new_preloader_css = """/* ===================================================
   PRELOADER CINEMATOGRÁFICO (Focal Smooth System)
   =================================================== */
#preloader {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #080808;
    pointer-events: all;
    transition: opacity 1.5s cubic-bezier(0.25, 1, 0.5, 1), visibility 1.5s;
    opacity: 1;
    visibility: visible;
}

#preloader.fade-out {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}

.preloader-logo {
    z-index: 2;
    width: 250px;
    opacity: 0;
    filter: blur(20px);
    transform: scale(0.95);
    transition: 
        opacity 1.8s cubic-bezier(0.25, 1, 0.5, 1), 
        filter 1.8s cubic-bezier(0.25, 1, 0.5, 1), 
        transform 1.8s cubic-bezier(0.25, 1, 0.5, 1);
}

.preloader-logo img {
    width: 100%;
    height: auto;
    object-fit: contain;
    border-radius: 12px;
}

.preloader-logo.focus-reveal {
    opacity: 1;
    filter: blur(0px);
    transform: scale(1);
}

.preloader-logo.focus-dissolve {
    opacity: 0;
    filter: blur(15px);
    transform: scale(1.03);
}"""

    # Substitui as regras de preloader no CSS
    pattern_preloader_css = re.compile(r'/\* ===================================================\s*PRELOADER CINEMATOGRÁFICO.*?(/\* ===================================================\s*NAVEGAÇÃO)', re.DOTALL)
    if pattern_preloader_css.search(css_content):
        css_content = pattern_preloader_css.sub(new_preloader_css + "\n\n\\1", css_content)
        print("CSS Preloader rules updated!")
    else:
        print("Warning: CSS Preloader pattern match failed.")

    # Novas regras do video-wrap
    new_video_wrap_css = """/* ── WRAP geral: posicionamento absolute dentro do hero ── */
.hero-video-wrap {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    /* Começa desfocado e com leve zoom de lente */
    filter: blur(18px);
    transform: scale(1.08);
    opacity: 0.65;
    transition: 
        filter 2.5s cubic-bezier(0.25, 1, 0.5, 1), 
        transform 2.5s cubic-bezier(0.25, 1, 0.5, 1),
        opacity 2.5s cubic-bezier(0.25, 1, 0.5, 1);
}

/* Estado revelado — JS adiciona .focal-revealed */
.hero-video-wrap.focal-revealed {
    filter: blur(0px);
    transform: scale(1.01);
    opacity: 1;
}"""

    # Substitui a definição antiga de hero-video-wrap
    pattern_video_wrap = re.compile(r'/\* ── WRAP geral: posicionamento absolute dentro do hero ── \*/\s*\.hero-video-wrap \{.*?\}\s*/\* Estado revelado — JS adiciona \.revealed \*/\s*\.hero-video-wrap\.revealed \{.*?\}', re.DOTALL)
    if pattern_video_wrap.search(css_content):
        css_content = pattern_video_wrap.sub(new_video_wrap_css, css_content)
        print("CSS Video Wrap reveal updated!")
    else:
        print("Warning: CSS Video Wrap pattern match failed.")

    # Remove o reveal line (linha de luz antiga) e o parallax
    pattern_reveal_line = re.compile(r'/\* ══════════════════════════════════════════════════════════\s*EFEITO DE REVEAL DO VÍDEO.*?══════════════════════════════════════════════════════════ \*/\s*\.hero-video-wrap::before \{.*?\}\s*\.hero-video-wrap\.revealing::before \{.*?\}\s*@keyframes revealLine \{.*?\}', re.DOTALL)
    if pattern_reveal_line.search(css_content):
        css_content = pattern_reveal_line.sub("", css_content)
        print("CSS Reveal line code removed for weight reduction!")
    else:
        print("Warning: CSS Reveal line pattern match failed or already removed.")

    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css_content)

# 3. ATUALIZAR JS (app.js)
if os.path.exists(js_path):
    with open(js_path, 'r', encoding='utf-8') as f:
        js_content = f.read()

    new_preloader_js = """    // ════════════════════════════════════════════════
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

    }, 2300);"""

    # Substitui a seção 1 no js
    pattern_js_preloader = re.compile(r'// ════════════════════════════════════════════════\s*// 1\. PRELOADER \+ REVEAL DO VÍDEO.*?// ════════════════════════════════════════════════\s*// V1\. GRAIN CANVAS', re.DOTALL)
    if pattern_js_preloader.search(js_content):
        # Substitui mantendo o cabeçalho do GRAIN CANVAS
        js_content = pattern_js_preloader.sub(new_preloader_js + "\n\n\n    // ════════════════════════════════════════════════\n    // V1. GRAIN CANVAS", js_content)
        print("JS Preloader logic updated!")
    else:
        print("Warning: JS Preloader pattern match failed.")

    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

print("All smooth transitions applied!")
