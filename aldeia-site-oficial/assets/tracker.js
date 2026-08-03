// aldeia-tracker.js
(function() {
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            let date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    function getCookie(name) {
        let nameEQ = name + "=";
        let ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    // Inicializa tracking
    const today = new Date().toISOString();
    
    // Visitas
    let visits = parseInt(getCookie('aldeia_visits') || '0');
    if (!sessionStorage.getItem('aldeia_session_started')) {
        visits++;
        setCookie('aldeia_visits', visits, 365);
        sessionStorage.setItem('aldeia_session_started', 'true');
    }

    // Primeiro acesso
    let firstVisit = getCookie('aldeia_first_visit');
    if (!firstVisit) {
        firstVisit = today;
        setCookie('aldeia_first_visit', firstVisit, 365);
    }

    // UTMs e Referrer
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');
    
    // Atualiza Source apenas se houver UTM nova ou não existir Source
    let currentSource = getCookie('aldeia_utm_source');
    if (utmSource) {
        setCookie('aldeia_utm_source', utmSource, 30);
    } else if (!currentSource) {
        let ref = document.referrer;
        if (ref && !ref.includes(window.location.hostname)) {
            try {
                let sourceDomain = new URL(ref).hostname;
                setCookie('aldeia_utm_source', 'Referrer: ' + sourceDomain, 30);
            } catch(e) {
                setCookie('aldeia_utm_source', 'Direto', 30);
            }
        } else if (!ref) {
            setCookie('aldeia_utm_source', 'Direto', 30);
        }
    }

    if (utmMedium) setCookie('aldeia_utm_medium', utmMedium, 30);
    if (utmCampaign) setCookie('aldeia_utm_campaign', utmCampaign, 30);

    // Expor API para formulários
    window.__aldeiaTracker = {
        getTrackingData: function() {
            return {
                visits: parseInt(getCookie('aldeia_visits') || '1'),
                firstVisit: getCookie('aldeia_first_visit') || today,
                utmSource: getCookie('aldeia_utm_source') || 'Direto',
                utmMedium: getCookie('aldeia_utm_medium') || '',
                utmCampaign: getCookie('aldeia_utm_campaign') || ''
            };
        }
    };
})();
