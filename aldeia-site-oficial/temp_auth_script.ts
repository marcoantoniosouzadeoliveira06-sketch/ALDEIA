
export default async (page) => {
    await page.evaluate(() => {
        const login = document.getElementById('admin-login');
        if(login) login.style.setProperty('display', 'none', 'important');
        const dash = document.getElementById('admin-dashboard');
        if(dash) dash.style.setProperty('display', 'flex', 'important');

        document.querySelectorAll('.tab-content').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.remove('active');
        });
        
        const target = document.getElementById('settings-tab');
        if(target) {
            target.style.setProperty('display', 'block', 'important');
            target.classList.add('active');
        }

        // --- INJECT PROTOTYPE LINKS FOR FIGMA ---
        const allTabs = ['dashboard', 'leads', 'clients', 'trello', 'scheduler', 'profile', 'portfolio', 'telemetry', 'logins', 'cms', 'editor', 'settings'];
        allTabs.forEach(t => {
            const btn = document.querySelector(`[data-tab="${t}-tab"]`);
            if (btn && btn.tagName !== 'A') {
                const a = document.createElement('a');
                a.href = '#ALDEIA_CRM_' + t.toUpperCase();
                Array.from(btn.attributes).forEach(attr => {
                    a.setAttribute(attr.name, attr.value);
                });
                a.innerHTML = btn.innerHTML;
                a.style.textDecoration = 'none';
                a.style.color = 'inherit';
                btn.parentNode.replaceChild(a, btn);
            }
        });

        document.querySelectorAll('.sidebar-nav-btn').forEach(el => {
            el.classList.remove('active');
        });
        const activeBtn = document.querySelector('[data-tab="settings-tab"]');
        if (activeBtn) activeBtn.classList.add('active');
    });
};
    