const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Remove base64 logo, replace back with logo.png
html = html.replace(
  /<img src="data:image\/png;base64,[^"]*" alt="Qtimex Logo" class="brand-logo-img">/,
  '<img src="logo.png" alt="Qtimex Logo" class="brand-logo-img">'
);

fs.writeFileSync('index.html', html, { encoding: 'utf8' });

const size = (fs.statSync('index.html').size / 1024).toFixed(1);
console.log('Done! File size now: ' + size + ' KB');
