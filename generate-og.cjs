const sharp = require('sharp');
const path = require('path');

async function createOgImage() {
  const width = 1200;
  const height = 630;
  const outputPath = path.join(__dirname, 'public', 'ting-ai-og-image.png');

  // We will create a dark background #0b0d12
  const background = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 11, g: 13, b: 18, alpha: 1 }
    }
  }).png().toBuffer();

  // Load the logo
  const logoPath = path.join(__dirname, 'public', 'ting-ai-logo-light-horizontal.png');
  
  // Resize logo to fit nicely, e.g., 600px wide
  const logo = await sharp(logoPath)
    .resize({ width: 600, fit: 'inside' })
    .toBuffer();

  // Composite the logo onto the background
  await sharp(background)
    .composite([
      {
        input: logo,
        gravity: 'center'
      }
    ])
    .toFile(outputPath);

  console.log('OG image created successfully at', outputPath);
}

createOgImage().catch(console.error);
