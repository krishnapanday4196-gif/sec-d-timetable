const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

const baseDir = 'android/app/src/main/res';
const src = 'logo.png';

async function run() {
  for (const { folder, size } of sizes) {
    const dir = path.join(baseDir, folder);
    const outLauncher = path.join(dir, 'ic_launcher.png');
    const outRound   = path.join(dir, 'ic_launcher_round.png');

    await sharp(src).resize(size, size).toFile(outLauncher);
    await sharp(src).resize(size, size).toFile(outRound);

    console.log(`✅ ${folder}: ${size}x${size}`);
  }

  // Also replace drawable ic_launcher
  const drawableDir = 'android/app/src/main/res/drawable';
  await sharp(src).resize(192, 192).toFile(path.join(drawableDir, 'ic_launcher.png'));
  await sharp(src).resize(192, 192).toFile(path.join(drawableDir, 'ic_launcher_round.png'));
  console.log('✅ drawable: 192x192');
  console.log('Done! All launcher icons replaced.');
}

run().catch(console.error);
