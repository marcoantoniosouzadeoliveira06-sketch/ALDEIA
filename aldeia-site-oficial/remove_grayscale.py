import os

html_path = r"C:\Users\User\Documents\ALDEIA\aldeia-site-oficial\index.html"
css_path = r"C:\Users\User\Documents\ALDEIA\aldeia-site-oficial\style.css"
js_path = r"C:\Users\User\Documents\ALDEIA\aldeia-site-oficial\app.js"

# 1. REMOVER GRAYSCALE DO CSS (style.css)
if os.path.exists(css_path):
    with open(css_path, 'r', encoding='utf-8') as f:
        css_content = f.read()

    # Substitui a regra do vídeo
    old_video = "filter: grayscale(100%) contrast(1.05) brightness(0.7);"
    new_video = "filter: contrast(1.05) brightness(0.7);"
    
    if old_video in css_content:
        css_content = css_content.replace(old_video, new_video)
        print("CSS video grayscale removed!")
    else:
        # Padrão alternativo que acabamos de escrever
        alt_video = "filter: grayscale(100%) contrast(1.05) brightness(0.7);"
        # Vamos buscar qualquer ocorrência de grayscale no .hero-video
        # O style.css atual tem: filter: grayscale(100%) contrast(1.05) brightness(0.7);
        css_content = css_content.replace("filter: grayscale(100%) contrast(1.05) brightness(0.7);", "filter: contrast(1.05) brightness(0.7);")
        print("CSS video grayscale removed (fallback match)!")

    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css_content)

# 2. REMOVER GRAYSCALE DO JS (app.js)
if os.path.exists(js_path):
    with open(js_path, 'r', encoding='utf-8') as f:
        js_content = f.read()

    old_gray_var = "const grayscale = true;"
    new_gray_var = "const grayscale = false;"

    if old_gray_var in js_content:
        js_content = js_content.replace(old_gray_var, new_gray_var)
        print("JS DomeGallery grayscale disabled!")
    else:
        print("Warning: const grayscale = true; not found in JS.")

    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

print("Grayscale removal script finished!")
