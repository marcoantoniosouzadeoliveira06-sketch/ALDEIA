(function () {
    'use strict';

    if (window.__aldeiaTranslatorBound) return;
    window.__aldeiaTranslatorBound = true;

    const packs = {
        en: {
            nav: ['Home', 'About', 'Portfolio', 'Solutions', 'Founders'],
            mobile: ['/01 Home', '/02 About', '/03 Portfolio', '/04 Solutions', '/05 Questions', '/06 Founders', '/07 Contact'],
            hero: ['UNIQUE PROJECTS', 'NEED A', 'UNIQUE AGENCY'],
            subtitle: 'Strategic design and digital experiences for brands that want to occupy a unique place — trusted by major names in competitive gaming in Brazil and abroad.',
            scroll: 'SCROLL DOWN',
            labels: ['About Aldeia', 'Aldeia Identity', 'Projects', 'Services', 'FAQ', 'Founders & CEOs'],
            headings: ['PORTFOLIO', 'SOLUTIONS', 'QUESTIONS', 'MINDSET'],
            identity: 'AGENCY DNA',
            portfolio: ['Projects that raise perception. Every detail, interaction and visual choice is designed to position your brand at the right level.', 'Case Gallery', 'VIEW THE FULL PORTFOLIO ↗'],
            about: ['We work with <em>professional designers focused on design and marketing for major brands and e-sports teams in Brazil and abroad.</em> Our focus is clear: <strong>websites, landing pages, visual identity, branding and high-impact creative work,</strong> with maximum attention to aesthetics, experience and technology.', 'We create for different markets and international clients, always exploring identity, visual rhythm and interaction.', 'Based in São Paulo and Rio de Janeiro, we work remotely with brands that value excellent design and premium digital presence.'],
            services: ['<strong>It is not about volume. It is about quality.</strong><br>Brands, websites and creative work built with strategy, aesthetics and intent.', ['Websites and Landing Pages', 'Logo and Visual Identity', 'Social Media Creative'], ['Websites with bold design, modern interactions and real performance, built to communicate value and generate results.', 'From strategy to symbol: memorable brands with purpose and a complete brand guide.', 'Social media as a premium visual showcase aligned with the brand’s positioning.']],
            faqIntro: ['Important answers before we begin.', 'Clarity is part of every well-executed project.'],
            faq: [['Does payment need to be made upfront?', 'When does the project begin?', 'What is the delivery timeline?', 'Can I request changes?', 'Which tools do you use to build websites?', 'What makes Aldeia different?'], ['No. Projects are split into 50% at the start and 50% upon final delivery. Credit card installments are also available.', 'After quote approval and the 50% deposit, the project enters the production schedule.', 'Timelines vary by scope: landing pages usually take 7–10 business days, while institutional websites and visual identities start at approximately 15 business days.', 'Yes. Every project includes an adjustment stage within the agreed scope.', 'We develop with HTML, CSS and JavaScript to ensure maximum performance, complete layout freedom and a publication-ready delivery.', 'We combine strategic design, creative direction and technology to build distinctive work with purpose.']],
            founders: 'The minds behind the agency’s design and strategic positioning.',
            cta: 'Let’s <strong>take it off the drawing board</strong> and bring it to life.',
            budget: 'Request a quote',
            future: 'If you want something <strong>above the standard,</strong> we are ready to build it.',
            footer: ['Looking for something <strong>outside the standard?</strong><br>Let’s talk.', ['Navigation', 'Social', 'Contact'], 'Aldeia Studio © 2026. All rights reserved.'],
            modal: ['Request your quote', 'Tell us your idea and let’s bring your project to life.', ['Full name', 'Contact email', 'WhatsApp', 'Instagram (Optional)', 'Project idea'], 'Send proposal']
        },
        es: {
            nav: ['Inicio', 'Nosotros', 'Portafolio', 'Soluciones', 'Fundadores'],
            mobile: ['/01 Inicio', '/02 Nosotros', '/03 Portafolio', '/04 Soluciones', '/05 Preguntas', '/06 Fundadores', '/07 Contacto'],
            hero: ['PROYECTOS ÚNICOS', 'NECESITAN UNA', 'AGENCIA ÚNICA'],
            subtitle: 'Diseño estratégico y experiencias digitales para marcas que quieren ocupar un lugar único — con la confianza de grandes nombres del gaming competitivo de Brasil y del exterior.',
            scroll: 'DESPLÁZATE HACIA ABAJO',
            labels: ['Sobre Aldeia', 'Identidad Aldeia', 'Proyectos', 'Servicios', 'Preguntas', 'Fundadores y CEOs'],
            headings: ['PORTAFOLIO', 'SOLUCIONES', 'PREGUNTAS', 'MENTALIDAD'],
            identity: 'ADN DE LA AGENCIA',
            portfolio: ['Proyectos que elevan la percepción. Cada detalle, interacción y elección visual posiciona tu marca en el nivel correcto.', 'Galería de casos', 'VER EL PORTAFOLIO COMPLETO ↗'],
            about: ['Trabajamos con <em>diseñadores profesionales enfocados en diseño y marketing para grandes marcas y equipos de e-sports de Brasil y del exterior.</em> Nuestro foco es claro: <strong>sitios web, landing pages, identidad visual, branding y piezas de alto impacto,</strong> con máxima atención a la estética, la experiencia y la tecnología.', 'Creamos para distintos mercados y clientes internacionales, explorando identidad, ritmo visual e interacción.', 'Desde São Paulo y Río de Janeiro, trabajamos de forma remota con marcas que valoran el diseño excelente y una presencia digital premium.'],
            services: ['<strong>No se trata de volumen, sino de nivel.</strong><br>Marcas, sitios y piezas creativas desarrolladas con estrategia, estética e intención.', ['Sitios web y landing pages', 'Logotipo e identidad visual', 'Creatividades para redes sociales'], ['Sitios con diseño sólido, interacciones modernas y rendimiento real, pensados para comunicar valor y generar resultados.', 'De la estrategia al símbolo: marcas memorables con propósito y un manual completo.', 'Las redes sociales como vitrina visual premium alineada con el posicionamiento de la marca.']],
            faqIntro: ['Respuestas importantes antes de comenzar.', 'La claridad forma parte de todo proyecto bien ejecutado.'],
            faq: [['¿El pago debe hacerse al contado?', '¿Cuándo comienza el proyecto?', '¿Cuál es el plazo de entrega?', '¿Puedo solicitar cambios?', '¿Qué herramientas utilizan para crear sitios?', '¿Qué hace diferente a Aldeia?'], ['No. Los proyectos se dividen en 50% al inicio y 50% en la entrega final. También es posible pagar con tarjeta.', 'Después de aprobar el presupuesto y abonar el 50%, el proyecto entra en la agenda de producción.', 'Los plazos varían según el alcance: una landing page suele tardar de 7 a 10 días hábiles; los sitios institucionales y las identidades visuales comienzan alrededor de 15 días.', 'Sí. Cada proyecto incluye una etapa de ajustes dentro del alcance acordado.', 'Desarrollamos con HTML, CSS y JavaScript para garantizar máximo rendimiento, libertad visual y una entrega lista para publicar.', 'Combinamos diseño estratégico, dirección creativa y tecnología para crear trabajos distintivos con propósito.']],
            founders: 'Las mentes detrás del diseño y el posicionamiento estratégico de la agencia.',
            cta: 'Vamos a <strong>sacarlo del borrador</strong> y hacerlo realidad.',
            budget: 'Solicitar presupuesto',
            future: 'Si buscas algo <strong>por encima del estándar,</strong> estamos listos para construirlo.',
            footer: ['¿Buscas algo <strong>fuera de lo común?</strong><br>Hablemos.', ['Navegación', 'Redes', 'Contacto'], 'Aldeia Studio © 2026. Todos los derechos reservados.'],
            modal: ['Solicita tu presupuesto', 'Cuéntanos tu idea y demos vida a tu proyecto.', ['Nombre completo', 'Correo de contacto', 'WhatsApp', 'Instagram (Opcional)', 'Idea del proyecto'], 'Enviar propuesta']
        },
        fr: {
            nav: ['Accueil', 'À propos', 'Portfolio', 'Solutions', 'Fondateurs'],
            mobile: ['/01 Accueil', '/02 À propos', '/03 Portfolio', '/04 Solutions', '/05 Questions', '/06 Fondateurs', '/07 Contact'],
            hero: ['PROJETS UNIQUES', 'MÉRITENT UNE', 'AGENCE UNIQUE'],
            subtitle: 'Design stratégique et expériences numériques pour les marques qui veulent occuper une place unique — avec la confiance de grands noms du gaming compétitif au Brésil et à l’étranger.',
            scroll: 'FAITES DÉFILER',
            labels: ['À propos d’Aldeia', 'Identité Aldeia', 'Projets', 'Services', 'FAQ', 'Fondateurs et CEOs'],
            headings: ['PORTFOLIO', 'SOLUTIONS', 'QUESTIONS', 'VISION'],
            identity: 'ADN DE L’AGENCE',
            portfolio: ['Des projets qui élèvent la perception. Chaque détail, interaction et choix visuel positionne votre marque au bon niveau.', 'Galerie de projets', 'VOIR LE PORTFOLIO COMPLET ↗'],
            about: ['Nous travaillons avec <em>des designers professionnels spécialisés dans le design et le marketing pour de grandes marques et équipes d’e-sport au Brésil et à l’étranger.</em> Notre objectif est clair : <strong>sites web, landing pages, identité visuelle, branding et créations à fort impact,</strong> avec une attention maximale portée à l’esthétique, à l’expérience et à la technologie.', 'Nous créons pour différents marchés et clients internationaux, en explorant l’identité, le rythme visuel et l’interaction.', 'Basés à São Paulo et Rio de Janeiro, nous travaillons à distance avec des marques qui valorisent l’excellence du design et une présence numérique premium.'],
            services: ['<strong>Ce n’est pas une question de volume, mais de niveau.</strong><br>Marques, sites et créations conçus avec stratégie, esthétique et intention.', ['Sites web et landing pages', 'Logo et identité visuelle', 'Créations pour réseaux sociaux'], ['Des sites au design affirmé, aux interactions modernes et aux performances réelles, conçus pour transmettre de la valeur et générer des résultats.', 'De la stratégie au symbole : des marques mémorables, porteuses de sens, avec un guide complet.', 'Les réseaux sociaux comme vitrine visuelle premium, alignée sur le positionnement de la marque.']],
            faqIntro: ['Des réponses importantes avant de commencer.', 'La clarté fait partie de tout projet bien exécuté.'],
            faq: [['Le paiement doit-il être effectué comptant ?', 'Quand le projet commence-t-il ?', 'Quel est le délai de livraison ?', 'Puis-je demander des modifications ?', 'Quels outils utilisez-vous pour créer les sites ?', 'Qu’est-ce qui distingue Aldeia ?'], ['Non. Les projets sont réglés à 50% au démarrage et à 50% lors de la livraison finale. Le paiement par carte est également possible.', 'Après validation du devis et versement de l’acompte de 50%, le projet entre dans le planning de production.', 'Les délais varient selon le périmètre : une landing page prend généralement 7 à 10 jours ouvrés, tandis que les sites institutionnels et identités visuelles commencent autour de 15 jours.', 'Oui. Chaque projet comprend une phase d’ajustements dans le périmètre convenu.', 'Nous développons en HTML, CSS et JavaScript afin de garantir des performances maximales, une liberté visuelle totale et une livraison prête à publier.', 'Nous associons design stratégique, direction créative et technologie pour créer des projets distinctifs et porteurs de sens.']],
            founders: 'Les esprits derrière le design et le positionnement stratégique de l’agence.',
            cta: 'Sortons-le <strong>du brouillon</strong> pour lui donner vie.',
            budget: 'Demander un devis',
            future: 'Si vous cherchez quelque chose <strong>au-dessus des standards,</strong> nous sommes prêts à le construire.',
            footer: ['Vous cherchez quelque chose <strong>hors norme ?</strong><br>Parlons-en.', ['Navigation', 'Réseaux', 'Contact'], 'Aldeia Studio © 2026. Tous droits réservés.'],
            modal: ['Demandez votre devis', 'Parlez-nous de votre idée et donnons vie à votre projet.', ['Nom complet', 'E-mail de contact', 'WhatsApp', 'Instagram (Optionnel)', 'Idée du projet'], 'Envoyer la proposition']
        }
    };

    const originals = new Map();
    const remember = (element) => {
        if (element && !originals.has(element)) originals.set(element, element.innerHTML);
        return element;
    };
    const set = (element, value, html) => {
        if (!element || value == null) return;
        remember(element);
        if (html) element.innerHTML = value;
        else element.textContent = value;
    };
    const setAll = (selector, values, html) => {
        document.querySelectorAll(selector).forEach((element, index) => set(element, values[index], html));
    };
    const restore = () => originals.forEach((value, element) => {
        if (element.isConnected) element.innerHTML = value;
    });

    const apply = (language) => {
        if (language === 'pt') {
            restore();
            return;
        }
        const pack = packs[language];
        if (!pack) return;
        setAll('#gooey-nav nav a', pack.nav);
        setAll('.mobile-nav-links .mobile-nav-link', pack.mobile);
        set(document.getElementById('hero-title-l1'), pack.hero[0]);
        set(document.getElementById('hero-title-l2'), pack.hero[1]);
        const typewriter = document.getElementById('typewriter-text');
        if (typewriter) typewriter.dataset.text = pack.hero[2];
        set(typewriter, pack.hero[2]);
        set(document.getElementById('hero-subtitle'), pack.subtitle);
        set(document.querySelector('.hero-scroll-cinematic span'), pack.scroll);
        setAll('main .section-label .label-text', pack.labels);
        setAll('main .mega-title', pack.headings);
        set(document.querySelector('.logos-section-title'), pack.identity);
        set(document.getElementById('home-port-subtitle'), pack.portfolio[0]);
        set(document.getElementById('home-port-title'), pack.portfolio[1]);
        set(document.getElementById('home-port-btn'), pack.portfolio[2]);
        set(document.getElementById('about-big-text'), pack.about[0], true);
        setAll('.about-cards > .about-card p', pack.about.slice(1));
        set(document.getElementById('services-desc'), pack.services[0], true);
        setAll('#services-accordion-list .svc-title', pack.services[1]);
        setAll('#services-accordion-list .svc-text > p', pack.services[2]);
        setAll('#faq-desc-container p', pack.faqIntro);
        setAll('#faq-list-container .faq-q', pack.faq[0]);
        setAll('#faq-list-container .faq-answer', pack.faq[1]);
        set(document.querySelector('#fundadores .section-desc'), pack.founders);
        set(document.querySelector('#contato .cta-left p'), pack.cta, true);
        document.querySelectorAll('[data-budget-trigger]:not(#floating-whatsapp-widget)')
            .forEach((element) => set(element, `${pack.budget}<span class="btn-arrow-icon">→</span>`, true));
        set(document.getElementById('future-subtitle'), pack.future, true);
        set(document.getElementById('footer-desc'), pack.footer[0], true);
        setAll('footer .footer-col:not(.footer-brand) h4', pack.footer[1]);
        set(document.querySelector('.footer-bottom span'), pack.footer[2]);
        set(document.querySelector('#modal-form-screen h2'), pack.modal[0]);
        set(document.querySelector('#modal-form-screen > p'), pack.modal[1]);
        setAll('#modal-cadastro-form .input-label', pack.modal[2]);
        set(document.getElementById('m-btn-text'), pack.modal[3]);
    };

    const bind = () => {
        const button = document.getElementById('lang-btn');
        const dropdown = document.getElementById('lang-dropdown');
        const current = document.querySelector('.lang-current');
        if (!button || !dropdown || !current) return;

        if (!button.hasAttribute('onclick')) {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const open = dropdown.classList.toggle('active');
                button.setAttribute('aria-expanded', String(open));
            });
        }
        document.addEventListener('click', () => {
            dropdown.classList.remove('active');
            button.setAttribute('aria-expanded', 'false');
        });

        window.changeLanguage = (languageCode) => {
            const language = String(languageCode).toLowerCase();
            if (language !== 'pt' && !packs[language]) return;
            document.documentElement.lang = language === 'pt' ? 'pt-BR' : language;
            localStorage.setItem('aldeia_language', language);
            current.textContent = language.toUpperCase();
            dropdown.classList.remove('active');
            button.setAttribute('aria-expanded', 'false');
            apply(language);
            window.dispatchEvent(new CustomEvent('aldeia:languagechange', { detail: { language } }));
        };

        ['pt', 'en', 'es', 'fr'].forEach((language, index) => {
            const option = dropdown.querySelectorAll('button')[index];
            if (!option) return;
            option.removeAttribute('onclick');
            option.addEventListener('click', () => window.changeLanguage(language));
        });

        document.querySelectorAll('[data-budget-trigger]').forEach((trigger) => {
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                if (typeof window.openBudgetModal === 'function') {
                    window.openBudgetModal();
                }
            });
        });

        document.querySelector('#budget-modal .modal-close')?.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof window.closeBudgetModal === 'function') {
                window.closeBudgetModal();
            }
        });

        const saved = localStorage.getItem('aldeia_language') || 'pt';
        current.textContent = saved.toUpperCase();
        apply(saved);
        setTimeout(() => apply(saved), 1400);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
    else bind();
})();
