const sharp = require('sharp');

async function fixIcon() {
  const input = 'public/ting-ai-logo-icon-only-dark.png';
  
  // Create 512x512
  await sharp(input)
    .resize(320, 320, {
      fit: 'contain',
      background: { r: 8, g: 10, b: 15, alpha: 1 }
    })
    .extend({
      top: 96,
      bottom: 96,
      left: 96,
      right: 96,
      background: { r: 8, g: 10, b: 15, alpha: 1 }
    })
    .toFile('public/pwa-512x512.png');

  // Create 192x192
  await sharp(input)
    .resize(120, 120, {
      fit: 'contain',
      background: { r: 8, g: 10, b: 15, alpha: 1 }
    })
    .extend({
      top: 36,
      bottom: 36,
      left: 36,
      right: 36,
      background: { r: 8, g: 10, b: 15, alpha: 1 }
    })
    .toFile('public/pwa-192x192.png');
    
  console.log("Icons generated successfully.");
}

fixIcon().catch(console.error);
