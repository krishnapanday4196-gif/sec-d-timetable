const fs = require('fs');

const newHash = Date.now().toString(36).slice(-8);

const vj = JSON.parse(fs.readFileSync('e:/sec d/version.json', 'utf8'));
vj.versionCode = 47;
vj.htmlHash = newHash;
vj.lastUpdated = new Date().toISOString();
fs.writeFileSync('e:/sec d/version.json', JSON.stringify(vj, null, 2), 'utf8');
console.log('version.json: versionCode=47, hash=' + newHash);

let html = fs.readFileSync('e:/sec d/index.html', 'utf8');
html = html.replace('const LOCAL_APP_VERSION_CODE = 46;', 'const LOCAL_APP_VERSION_CODE = 47;');
html = html.replace("const LOCAL_APP_BUILD_HASH = 'mukq6wbk';", "const LOCAL_APP_BUILD_HASH = '" + newHash + "';");
fs.writeFileSync('e:/sec d/index.html', html, 'utf8');
console.log('index.html updated: v47, hash=' + newHash);
