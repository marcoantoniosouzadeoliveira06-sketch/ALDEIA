export default async (page) => {
    console.log("Forcing dashboard visibility...");
    await page.evaluate(() => {
        const login = document.getElementById('admin-login');
        if(login) login.style.setProperty('display', 'none', 'important');
        
        const dash = document.getElementById('admin-dashboard');
        if(dash) dash.style.setProperty('display', 'flex', 'important');
    });
};
