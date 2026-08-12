const { execSync } = require('child_process');
const fs = require('fs');

const tabs = [
  'dashboard',
  'leads',
  'clients',   
  'trello',
  'scheduler', 
  'profile',
  'portfolio', 
  'telemetry',
  'logins',    
  'cms',
  'editor',    
  'settings'
];

const projectId = '10648088187007246559';
const apiKey = 'YOUR_API_KEY';
const stitchUploadPy = 'c:\\Users\\User\\Documents\\ALDEIA\\.agents\\skills\\upload-to-stitch\\scripts\\upload_to_stitch.py';

for (const tab of tabs) {
    console.log(`\n\n--- PROCESSING TAB PROTOTYPE: ${tab.toUpperCase()} ---`);
    
    // Generate auth script
    const authScriptCode = `
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
        
        const target = document.getElementById('${tab}-tab');
        if(target) {
            target.style.setProperty('display', 'block', 'important');
            target.classList.add('active');
        }

        // --- INJECT PROTOTYPE LINKS FOR FIGMA ---
        const allTabs = ['dashboard', 'leads', 'clients', 'trello', 'scheduler', 'profile', 'portfolio', 'telemetry', 'logins', 'cms', 'editor', 'settings'];
        allTabs.forEach(t => {
            const btn = document.querySelector(\`[data-tab="\${t}-tab"]\`);
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
        const activeBtn = document.querySelector('[data-tab="${tab}-tab"]');
        if (activeBtn) activeBtn.classList.add('active');
    });
};
    `;
    fs.writeFileSync('temp_auth_script.ts', authScriptCode);

    const snapshotPath = `.stitch/admin_${tab}_proto.html`;
    const title = `ALDEIA_CRM_${tab.toUpperCase()}`;
    
    console.log(`Running snapshot for ${tab}...`);
    try {
        execSync(`npx --yes tsx c:\\Users\\User\\Documents\\ALDEIA\\.agents\\skills\\extract-static-html\\scripts\\snapshot.ts --url file:///c:/Users/User/Documents/ALDEIA/aldeia-site-oficial/admin.html --auth-script temp_auth_script.ts --output ${snapshotPath} --wait 2000`, {stdio: 'inherit'});
    } catch (e) {
        console.error(`Error snapshotting ${tab}:`, e);
        continue;
    }

    console.log(`Uploading ${title} to Stitch...`);
    try {
        execSync(`python ${stitchUploadPy} --project-id ${projectId} --file-path ${snapshotPath} --title ${title} --api-key ${apiKey} --generated-by stitch::code-to-design`, {stdio: 'inherit'});
    } catch (e) {
        console.error(`Error uploading ${tab}:`, e);
    }
}

console.log("ALL TABS EXTRACTED WITH PROTOTYPE LINKS AND UPLOADED.");
