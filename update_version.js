const fs = require('fs');
const crypto = require('crypto');

let ver = JSON.parse(fs.readFileSync('version.json', 'utf8'));
ver.versionName = "5.9.12";
ver.versionCode = 72;
ver.apkVersionCode = 72;
ver.updatedAt = Date.now();
ver.lastUpdated = new Date().toISOString();
ver.releaseNotes = "v5.9.12: Next-level cybernetic architectural background grid with HUD crosshairs, reactive touch spotlight, and laser scan beam.";

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<strong style="color:var\(--gold-accent\);">v[^<]+<\/strong>/, '<strong style="color:var(--gold-accent);">v' + ver.versionName + ' (Next-Gen Cyber Grid)</strong>');
html = html.replace(/📲 Direct Download & Install APK \(v[^)]+\)/, '📲 Direct Download & Install APK (v' + ver.versionName + ')');
html = html.replace(/const LOCAL_APP_VERSION_NAME = '[^']+';/, "const LOCAL_APP_VERSION_NAME = '" + ver.versionName + "';");
html = html.replace(/const LOCAL_APP_VERSION_CODE = \d+;/, 'const LOCAL_APP_VERSION_CODE = ' + ver.versionCode + ';');

// Compute MD5 of index.html with placeholder hash
html = html.replace(/const LOCAL_APP_BUILD_HASH = '[^']+';/, "const LOCAL_APP_BUILD_HASH = '__HASH__';");
const h = crypto.createHash('md5').update(html, 'utf8').digest('hex').slice(0, 12);
html = html.replace('__HASH__', h);
fs.writeFileSync('index.html', html, 'utf8');

ver.htmlHash = h;
fs.writeFileSync('version.json', JSON.stringify(ver, null, 2), 'utf8');

try { 
  fs.copyFileSync('index.html', 'android/app/src/main/assets/index.html'); 
  fs.copyFileSync('sections_data.json', 'android/app/src/main/assets/sections_data.json');
  console.log('✅ Synced index.html and sections_data.json to Android assets'); 
} catch(e) {
  console.error(e);
}

console.log('Done! Version: ' + ver.versionName + ' | VersionCode: ' + ver.versionCode + ' | Hash: ' + h);
