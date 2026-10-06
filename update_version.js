const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

let ver = JSON.parse(fs.readFileSync('version.json', 'utf8'));
ver.versionName = "6.1.0";
ver.versionCode = 77;
ver.apkVersionCode = 77;
ver.updatedAt = Date.now();
ver.lastUpdated = new Date().toISOString();
ver.releaseNotes = "v6.1.0: Student Profile & Section-Set Lock + Multi-CR isolated alerts — each student gets only their section & set notifications; CRs manage classes by designated section.";

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<strong style="color:var\(--gold-accent\);">v[^<]+<\/strong>/, '<strong style="color:var(--gold-accent);">v' + ver.versionName + ' (Student Profile & Multi-CR Alerts)</strong>');
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
  if (fs.existsSync('cancelled_classes.json')) {
    fs.copyFileSync('cancelled_classes.json', 'android/app/src/main/assets/cancelled_classes.json');
  }
  console.log('✅ Synced index.html, sections_data.json, and cancelled_classes.json to Android assets'); 
} catch(e) {
  console.error(e);
}

console.log('Done! Version: ' + ver.versionName + ' | VersionCode: ' + ver.versionCode + ' | Hash: ' + h);
