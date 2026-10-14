const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

let ver = JSON.parse(fs.readFileSync('version.json', 'utf8'));
ver.versionName = "6.3.5";
ver.versionCode = 89;
ver.apkVersionCode = 89;
ver.updatedAt = Date.now();
ver.lastUpdated = new Date().toISOString();
ver.releaseNotes = "v6.3.5: Next-Level Universal Login Portal - Unmissable Header Login Button, Mobile First Role Gateway, 1-Tap Student Instant Login, 1-Tap CR Login (Sec-A to Sec-L), 1-Tap Master Admin, and Instant Role Switcher";

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<strong style="color:var\(--gold-accent\);">v[^<]+<\/strong>/, '<strong style="color:var(--gold-accent);">v' + ver.versionName + ' (Strict Isolation & PYQ Vault)</strong>');
html = html.replace(/📲 Direct Download & Install APK \(v[^)]+\)/, '📲 Direct Download & Install APK (v' + ver.versionName + ')');
html = html.replace(/const LOCAL_APP_VERSION_NAME = '[^']+';/, "const LOCAL_APP_VERSION_NAME = '" + ver.versionName + "';");
html = html.replace(/const LOCAL_APP_VERSION_CODE = \d+;/, 'const LOCAL_APP_VERSION_CODE = ' + ver.versionCode + ';');

// Compute MD5 of index.html with placeholder hash
html = html.replace(/const LOCAL_APP_BUILD_HASH = '[^']+';/, "const LOCAL_APP_BUILD_HASH = '__HASH__';");
const h = crypto.createHash('md5').update(html, 'utf8').digest('hex').slice(0, 12);
html = html.replace('__HASH__', h);
fs.writeFileSync('index.html', html, 'utf8');

ver.htmlHash = h;

// Calculate APK hash and size if present
const apkPath = path.join(__dirname, 'SecD_Timetable.apk');
if (fs.existsSync(apkPath)) {
  const apkBuf = fs.readFileSync(apkPath);
  ver.apkMd5 = crypto.createHash('md5').update(apkBuf).digest('hex');
  ver.apkHash = ver.apkMd5.slice(0, 12);
  ver.apkSizeBytes = apkBuf.length;
  ver.apkSizeFormatted = (apkBuf.length / (1024 * 1024)).toFixed(2) + ' MB';
}

fs.writeFileSync('version.json', JSON.stringify(ver, null, 2), 'utf8');

try { 
  fs.copyFileSync('index.html', 'android/app/src/main/assets/index.html'); 
  fs.copyFileSync('sections_data.json', 'android/app/src/main/assets/sections_data.json');
  if (fs.existsSync('pyqs_data.json')) {
    fs.copyFileSync('pyqs_data.json', 'android/app/src/main/assets/pyqs_data.json');
  }
  if (fs.existsSync('cancelled_classes.json')) {
    fs.copyFileSync('cancelled_classes.json', 'android/app/src/main/assets/cancelled_classes.json');
  }
  console.log('✅ Synced index.html, pyqs_data.json, sections_data.json, and cancelled_classes.json to Android assets'); 
} catch(e) {
  console.error(e);
}

console.log('Done! Version: ' + ver.versionName + ' | VersionCode: ' + ver.versionCode + ' | Hash: ' + h);
