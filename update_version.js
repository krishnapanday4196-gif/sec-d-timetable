const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

let ver = JSON.parse(fs.readFileSync('version.json', 'utf8'));
ver.versionName = "6.4.8";
ver.versionCode = 101;
ver.apkVersionCode = 101;
ver.updatedAt = Date.now();
ver.lastUpdated = new Date().toISOString();
ver.releaseNotes = "v6.4.8: Next-level mobile responsive layout (zero text truncation, stacked Quantum University title, fluid user pill) and luxury high-contrast White Theme (Aura Celestial) color combination";

let html = fs.readFileSync('index.html', 'utf8');
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
  if (fs.existsSync('campus.jpg')) {
    fs.copyFileSync('campus.jpg', 'android/app/src/main/assets/campus.jpg');
  }
  if (fs.existsSync('campus_data.js')) {
    fs.copyFileSync('campus_data.js', 'android/app/src/main/assets/campus_data.js');
  }
  if (fs.existsSync('logo.png')) {
    fs.copyFileSync('logo.png', 'android/app/src/main/assets/logo.png');
  }
  if (fs.existsSync('pyqs_data.json')) {
    fs.copyFileSync('pyqs_data.json', 'android/app/src/main/assets/pyqs_data.json');
  }
  if (fs.existsSync('cancelled_classes.json')) {
    fs.copyFileSync('cancelled_classes.json', 'android/app/src/main/assets/cancelled_classes.json');
  }
  if (fs.existsSync('registered_users.json')) {
    fs.copyFileSync('registered_users.json', 'android/app/src/main/assets/registered_users.json');
  }
  console.log('✅ Synced web assets, images, and data to Android assets'); 
} catch(e) {
  console.error(e);
}

console.log('Done! Version: ' + ver.versionName + ' | VersionCode: ' + ver.versionCode + ' | Hash: ' + h);
