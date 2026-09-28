const fs = require('fs');

// Read logo as base64
const logoBase64 = fs.readFileSync('logo.png').toString('base64');
const logoDataUrl = `data:image/png;base64,${logoBase64}`;

// Read HTML
let html = fs.readFileSync('index.html', 'utf8');

// Replace logo.png src with base64 in brand-logo-img
html = html.replace(
  /<img src="logo\.png" alt="Qtimex Logo" class="brand-logo-img">/,
  `<img src="${logoDataUrl}" alt="Qtimex Logo" class="brand-logo-img">`
);

// Also replace favicon (link tags) - optional, may not work in WebView
// Keep icon links as-is for web

fs.writeFileSync('index.html', html, { encoding: 'utf8' });
console.log('Done! Logo embedded as base64. File size: ' + (fs.statSync('index.html').size / 1024).toFixed(1) + ' KB');
