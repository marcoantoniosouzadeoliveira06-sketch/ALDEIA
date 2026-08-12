const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tabs = [
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

// Fix JS in admin.html temporarily
let originalHtml = fs.readFileSync('admin.html', 'utf16le');
if (originalHtml.indexOf('\0') === -1) {
    // If not utf16, try utf8
    originalHtml = fs.readFileSync('admin.html', 'utf8');
}

// We don't need to rewrite admin.html if we inject the auth_script properly,
// but since checkAutoLogin overrides display on page load, let's keep the auth script approach.
// Remember: adminLogin is hidden, adminDashboard is flex, and we just need to hide all tab-content and show target tab.

for (const tab of tabs) {
    console.log(`\n\n--- PROCESSING TAB: ${tab.toUpperCase()} ---`);
    
    // 1. Generate auth script for this tab
    const authScriptCode = `
export default async (page) => {
    await page.evaluate(() => {
        // Hide login, show dashboard
        const login = document.getElementById('admin-login');
        if(login) login.style.setProperty('display', 'none', 'important');
        const dash = document.getElementById('admin-dashboard');
        if(dash) dash.style.setProperty('display', 'flex', 'important');

        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.remove('active');
        });
        
        // Show target tab
        const target = document.getElementById('${tab}-tab');
        if(target) {
            target.style.setProperty('display', 'block', 'important');
            target.classList.add('active');
        }

        // Deactivate all sidebar buttons
        document.querySelectorAll('.sidebar-nav-btn').forEach(el => {
            el.classList.remove('active');
        });
        // Activate target sidebar button
        const btn = document.querySelector('[data-tab="${tab}-tab"]');
        if (btn) btn.classList.add('active');
    });
};
    `;
    fs.writeFileSync('temp_auth_script.ts', authScriptCode);

    const snapshotPath = `.stitch/admin_${tab}.html`;
    const title = `ALDEIA_CRM_${tab.toUpperCase()}`;
    
    // 2. Run snapshot
    console.log(`Running snapshot for ${tab}...`);
    try {
        execSync(`npx --yes tsx c:\\Users\\User\\Documents\\ALDEIA\\.agents\\skills\\extract-static-html\\scripts\\snapshot.ts --url file:///c:/Users/User/Documents/ALDEIA/aldeia-site-oficial/admin.html --auth-script temp_auth_script.ts --output ${snapshotPath} --wait 2000`, {stdio: 'inherit'});
    } catch (e) {
        console.error(`Error snapshotting ${tab}:`, e);
        continue;
    }

    // 3. Upload to stitch
    console.log(`Uploading ${title} to Stitch...`);
    try {
        execSync(`python ${stitchUploadPy} --project-id ${projectId} --file-path ${snapshotPath} --title ${title} --api-key ${apiKey} --generated-by stitch::code-to-design`, {stdio: 'inherit'});
    } catch (e) {
        console.error(`Error uploading ${tab}:`, e);
    }
}

console.log("ALL TABS EXTRACTED AND UPLOADED.");
