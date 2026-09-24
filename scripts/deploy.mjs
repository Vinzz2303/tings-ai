import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, "dist");

// ── Target A: Ting AI app (app.tingsai.my.id) ───────────────────────────
// This is served directly from dist — no copy needed, IIS points here.

// ── Target B: Personal portfolio (faturachman.my.id) ────────────────────
const faturachmanTarget = "C:\\inetpub\\wwwroot\\portofolio-faturachman";

if (!existsSync(sourceDir)) {
  console.error("Folder dist belum ada. Jalankan build terlebih dahulu.");
  process.exit(1);
}

// Copy all build assets to faturachman deployment dir
try {
  mkdirSync(faturachmanTarget, { recursive: true });
  for (const entry of readdirSync(faturachmanTarget)) {
    rmSync(path.join(faturachmanTarget, entry), { recursive: true, force: true });
  }
  cpSync(sourceDir, faturachmanTarget, { recursive: true, force: true });
  console.log(`✓ Assets copied to: ${faturachmanTarget}`);
} catch (err) {
  console.error(`✗ Failed to copy to ${faturachmanTarget}:`, err);
  process.exit(1);
}

// ── Patch faturachman index.html with personal branding ─────────────────
const indexPath = path.join(faturachmanTarget, "index.html");
let html = readFileSync(indexPath, "utf-8");

const PATCHES = [
  // Title
  [/<title>.*?<\/title>/, "<title>Faturachman Alkahfi | AI Product Builder</title>"],
  // Description
  [/(<meta\s+name="description"\s+content=")[^"]*(")/,
    '$1Portofolio Faturachman Alkahfi, spesialis pembuat produk AI dan Full Stack Developer berbasis di Indonesia.$2'],
  // OG Title
  [/(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    '$1Faturachman Alkahfi | AI Product Builder$2'],
  // OG Description
  [/(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    '$1Portofolio Faturachman Alkahfi, spesialis pembuat produk AI dan Full Stack Developer berbasis di Indonesia.$2'],
  // OG URL
  [/(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    '$1https://faturachman.my.id/$2'],
  // OG Image
  [/(<meta\s+property="og:image"\s+content=")[^"]*(")/,
    '$1https://faturachman.my.id/profile.png$2'],
  // OG Image Alt
  [/(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/,
    '$1Faturachman Alkahfi Profile$2'],
  // Twitter Title
  [/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    '$1Faturachman Alkahfi | AI Product Builder$2'],
  // Twitter Description
  [/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    '$1Portofolio Faturachman Alkahfi, spesialis pembuat produk AI dan Full Stack Developer berbasis di Indonesia.$2'],
  // Twitter Image
  [/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/,
    '$1https://faturachman.my.id/profile.png$2'],
  // Canonical URL
  [/(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    '$1https://faturachman.my.id/$2'],
  // Favicon PNG
  [/(<link\s+rel="icon"\s+type="image\/png"\s+href=")[^"]*(")/,
    '$1/profile.png$2'],
  // Apple touch icon
  [/(<link\s+rel="apple-touch-icon"\s+href=")[^"]*(")/,
    '$1/profile.png$2'],
  // Mask icon
  [/(<link\s+rel="mask-icon"\s+href=")[^"]*(")/,
    '$1/profile.png$2'],
  // PWA title
  [/(<meta\s+name="apple-mobile-web-app-title"\s+content=")[^"]*(")/,
    '$1Faturachman$2'],
  // JSON-LD name
  [/"name":\s*"Ting AI"/, '"name": "Faturachman Alkahfi"'],
  // JSON-LD URL
  [/"url":\s*"https:\/\/tingsai\.my\.id\/"/, '"url": "https://faturachman.my.id/"'],
  // Plausible domain
  [/plausible\.dataset\.domain = '[^']*'/, "plausible.dataset.domain = 'faturachman.my.id'"],
];

for (const [pattern, replacement] of PATCHES) {
  html = html.replace(pattern, replacement);
}

writeFileSync(indexPath, html, "utf-8");
console.log(`✓ Patched index.html for faturachman.my.id`);
console.log(`\n✅ Deploy selesai!`);
console.log(`   → app.tingsai.my.id → C:\\apps\\portofolio\\dist (IIS langsung)`);
console.log(`   → faturachman.my.id → ${faturachmanTarget} (patched copy)`);
