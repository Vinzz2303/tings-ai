const Jimp = require('jimp');

async function fixIcon() {
  const logo = await Jimp.read('public/ting-ai-logo-icon-only-dark.png');
  
  // Create a 512x512 background with color #080a0f (rgba 8, 10, 15, 255)
  // hex 0x080a0fff
  const bg = new Jimp(512, 512, 0x080a0fff);
  
  // Resize logo if it's too big, or scale it up if it's too small
  // Let's make it 300x300 roughly inside the 512x512 box to have nice padding
  logo.contain(300, 300);
  
  // Composite logo onto bg at center
  bg.composite(logo, (512 - 300) / 2, (512 - 300) / 2);
  
  await bg.writeAsync('public/pwa-512x512.png');
  
  // Also create a 192x192 version
  const bg192 = new Jimp(192, 192, 0x080a0fff);
  const logo192 = logo.clone().contain(110, 110);
  bg192.composite(logo192, (192 - 110) / 2, (192 - 110) / 2);
  await bg192.writeAsync('public/pwa-192x192.png');
  
  console.log("Icons generated successfully.");
}

fixIcon().catch(console.error);
