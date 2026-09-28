const fs = require('fs');
const crypto = require('crypto');

let ver = JSON.parse(fs.readFileSync('version.json', 'utf8'));
ver.versionCode = ver.versionCode + 1;
ver.apkVersionCode = ver.versionCode;
ver.updatedAt = Date.now();

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/const LOCAL_APP_VERSION_CODE = \d+;/, 'const LOCAL_APP_VERSION_CODE = ' + ver.versionCode + ';');
const h = crypto.createHash('md5').update(html, 'utf8').digest('hex').slice(0, 12);
html = html.replace(/const LOCAL_APP_BUILD_HASH = '[^']+';/, "const LOCAL_APP_BUILD_HASH = '" + h + "';");
fs.writeFileSync('index.html', html, 'utf8');

ver.htmlHash = h;
fs.writeFileSync('version.json', JSON.stringify(ver, null, 2), 'utf8');

try { fs.copyFileSync('index.html', 'android/app/src/main/assets/index.html'); console.log('Synced to Android'); } catch(e){}

console.log('Done! VersionCode: ' + ver.versionCode + ' | Hash: ' + h);
