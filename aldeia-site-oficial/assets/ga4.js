(() => {
    const CONSENT_KEY = 'aldeia_cookie_consent';
    const CONFIG_ENDPOINT = '/api/public/analytics-config';

    if (window.localStorage?.getItem(CONSENT_KEY) !== 'accepted') return;

    const loadGoogleAnalytics = (measurementId) => {
        if (!/^G-[A-Z0-9]{6,}$/.test(measurementId) || window.__aldeiaGa4Loaded) return;
        window.__aldeiaGa4Loaded = true;
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
        window.gtag('config', measurementId, {
            anonymize_ip: true,
            send_page_view: true
        });

        const tag = document.createElement('script');
        tag.async = true;
        tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(tag);
    };

    fetch(CONFIG_ENDPOINT, { credentials: 'same-origin' })
        .then((response) => response.ok ? response.json() : null)
        .then((config) => {
            if (config?.enabled && typeof config.measurementId === 'string') {
                loadGoogleAnalytics(config.measurementId);
            }
        })
        .catch(() => {});
})();
