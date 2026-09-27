@echo off
echo ========================================================
echo   CSE D Timetable — 1-Click Update Publisher
echo ========================================================
echo.

node -e "
const fs = require('fs');
const crypto = require('crypto');

let ver = { versionName: '4.7.1', versionCode: 21 };
try { ver = JSON.parse(fs.readFileSync('version.json', 'utf8')); } catch(e){}

ver.versionCode = (ver.versionCode || 21) + 1;
ver.apkVersionCode = ver.versionCode;

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/const LOCAL_APP_VERSION_CODE = \d+;/, 'const LOCAL_APP_VERSION_CODE = ' + ver.versionCode + ';');
html = html.replace(/const LOCAL_APP_BUILD_HASH = '[^']+';/, 'const LOCAL_APP_BUILD_HASH = \'__HASH__\';');
const h = crypto.createHash('md5').update(html, 'utf8').digest('hex').slice(0, 12);
html = html.replace('__HASH__', h);
fs.writeFileSync('index.html', html, 'utf8');

ver.htmlHash = h;
ver.updatedAt = Date.now();
fs.writeFileSync('version.json', JSON.stringify(ver, null, 2), 'utf8');

try {
  fs.copyFileSync('index.html', 'android/app/src/main/assets/index.html');
  console.log('✔ Synced index.html to Android assets');
} catch(e){}

console.log('✔ Published VersionCode: ' + ver.versionCode + ' (Hash: ' + h + ')');
"

echo.
echo [Pushing Update to GitHub 24/7 Cloud...]
git add -A
git commit -m "Auto-Update: Schedule / Feature changes"
git push origin main

echo.
echo ========================================================
echo   SUCCESS! Update is now LIVE on GitHub 24/7!
echo   Sabhi phones me sirf tabhi update aayega jab sach me naya change ho.
echo ========================================================
pause
