@echo off
echo ========================================================
echo   CSE D Timetable — 1-Click Update Publisher
echo ========================================================
echo.

node -e "
const fs = require('fs');
const crypto = require('crypto');

// 1. Calculate new hash of index.html
const html = fs.readFileSync('index.html', 'utf8');
const newHash = crypto.createHash('md5').update(html, 'utf8').digest('hex').slice(0, 12);

// 2. Read and update version.json
let ver = { versionName: '4.7.1', versionCode: 20 };
try { ver = JSON.parse(fs.readFileSync('version.json', 'utf8')); } catch(e){}

ver.versionCode = (ver.versionCode || 20) + 1;
ver.apkVersionCode = ver.versionCode;
ver.htmlHash = newHash;
ver.updatedAt = Date.now();

fs.writeFileSync('version.json', JSON.stringify(ver, null, 2), 'utf8');
console.log('✔ Updated version.json (Build ' + ver.versionCode + ', Hash: ' + newHash + ')');

// 3. Sync to Android assets
try {
  fs.copyFileSync('index.html', 'android/app/src/main/assets/index.html');
  console.log('✔ Synced index.html to Android assets');
} catch(e){}
"

echo.
echo [Pushing Update to GitHub 24/7 Cloud...]
git add -A
git commit -m "Auto-Update: Schedule / Feature changes"
git push origin main

echo.
echo ========================================================
echo   SUCCESS! Update is now LIVE on GitHub 24/7!
echo   Sabhi phones me app kholte hi Update aa jayega.
echo ========================================================
pause
