import pptxgen from "pptxgenjs";

const pptx = new pptxgen();

// Layout and theme
pptx.layout = "LAYOUT_16x9";
pptx.defineSlideMaster({
  title: "MASTER_SLIDE",
  background: { color: "0B0D12" }, // Dark Brutalist BG
  slideNumber: { x: "95%", y: "95%", color: "8FBFBA", fontSize: 10 },
});

const TITLE_COLOR = "D6B26B"; // Gold Accent
const TEXT_COLOR = "EEF2F7";
const MUTED_COLOR = "A7B0BF";
const HIGHLIGHT = "8FBFBA"; // Teal Accent

// Slide 1: Title
let slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("TING AI", {
  x: 1, y: 2, w: 8, h: 1,
  fontSize: 48, color: TITLE_COLOR, bold: true, align: "center", fontFace: "Courier New"
});
slide.addText("MACRO & WEALTH INTELLIGENCE", {
  x: 1, y: 3, w: 8, h: 0.5,
  fontSize: 20, color: TEXT_COLOR, letterSpacing: 2, align: "center", fontFace: "Arial"
});
slide.addText("B2C SaaS untuk HNW & Ritel Serius.\nAnti-gamifikasi. Murni analitik.", {
  x: 1, y: 3.8, w: 8, h: 1,
  fontSize: 14, color: MUTED_COLOR, align: "center", fontFace: "Arial"
});

// Slide 2: Market Reality (The Problem)
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("REALITA PASAR", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText("Data (2024): 12.1 Juta investor ritel di Indonesia.", { x: 0.5, y: 1.5, w: 9, fontSize: 18, color: TEXT_COLOR, bold: true });
slide.addText([
  { text: "Titik Lemah 1: ", options: { color: HIGHLIGHT, bold: true } },
  { text: "90% investor ritel rugi karena trading emosional & UI broker yang digamifikasi (memicu impulse buying).", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 2.2, w: 9, fontSize: 16 });

slide.addText([
  { text: "Titik Lemah 2: ", options: { color: HIGHLIGHT, bold: true } },
  { text: "Banjir informasi (noise) tak berdasar dari grup Telegram/WhatsApp, tanpa konteks makro-ekonomi yang jelas.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.0, w: 9, fontSize: 16 });

slide.addText([
  { text: "Kesenjangan (The Gap): ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Bloomberg Terminal seharga Rp 380 Jt/tahun. Ritel tidak memiliki alternatif profesional berbiaya rendah.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.8, w: 9, fontSize: 16 });


// Slide 3: The Solution
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("REALITA PRODUK (TING AI)", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText("Telah Tayang (Live): app.tingsai.my.id", { x: 0.5, y: 1.5, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });

slide.addText([
  { text: "1. Intelijen Proaktif ('Komando Pagi'): ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Memproses ratusan titik data makro menjadi satu instruksi taktis harian yang siap dieksekusi.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 2.2, w: 9, fontSize: 14 });

slide.addText([
  { text: "2. Simulator Risiko Real-time: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Menguji ketahanan (stress-test) portofolio terhadap skenario pasar turun -5% atau -10% secara instan.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.0, w: 9, fontSize: 14 });

slide.addText([
  { text: "3. Industrial Brutalist UI: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Antarmuka gelap, kaku, dan monospace. Memaksa pembacaan logika dan mengeliminasi perjudian emosional.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.8, w: 9, fontSize: 14 });


// Slide 4: Business Model & Unit Economics
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("UNIT EKONOMI & MODEL BISNIS", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText("Model: Freemium B2C SaaS", { x: 0.5, y: 1.2, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });

let yPos = 1.8;
let metrics = [
  { k: "SAM (Investor Aktif):", v: "4.000.000 Pengguna" },
  { k: "Target Konversi (1%):", v: "40.000 Pengguna Berbayar" },
  { k: "Harga Pro Tier:", v: "Rp 99.000 / bulan" },
  { k: "Proyeksi ARR (Pendapatan Berulang Tahunan):", v: "Rp 47.5 Miliar" },
  { k: "Gross Margin (Laba Kotor):", v: "85% (Optimalisasi caching API & arsitektur Edge server)" }
];

metrics.forEach(m => {
  slide.addText([
    { text: m.k + " ", options: { color: MUTED_COLOR, bold: true } },
    { text: m.v, options: { color: TEXT_COLOR } }
  ], { x: 0.5, y: yPos, w: 9, fontSize: 16 });
  yPos += 0.6;
});


// Slide 5: Competitive Moat
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("KEUNGGULAN KOMPETITIF (MOAT)", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText([
  { text: "1. Nol Konflik Kepentingan: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Kami BUKAN broker. Kami tidak mengeruk untung dari komisi transaksi beli/jual. Tujuan AI kami murni pelestarian kekayaan (wealth preservation).", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 1.5, w: 9, fontSize: 16 });

slide.addText([
  { text: "2. Retensi Melalui 'Decision Journal': ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Pengguna mencatat tesis logis sebelum membeli saham. Retensi pengguna harian (DAU) sangat tinggi melalui notifikasi 'Komando Pagi'.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 2.5, w: 9, fontSize: 16 });

slide.addText([
  { text: "3. Pemosisian Psikologis: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Saat kompetitor memburu pemula dengan UI warna-warni layaknya game, kami menargetkan uang serius (portofolio bernilai puluhan hingga ratusan juta).", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.5, w: 9, fontSize: 16 });


// Slide 6: The Ask
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("PENAWARAN (THE ASK)", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText("Targeting: Pendanaan Pre-Seed Rp 2.4 Miliar ($150,000)", { x: 0.5, y: 1.5, w: 9, fontSize: 18, color: HIGHLIGHT, bold: true });
slide.addText("Runway (Napas Bisnis): 18 Bulan", { x: 0.5, y: 2.0, w: 9, fontSize: 14, color: MUTED_COLOR });

slide.addText("Alokasi Dana:", { x: 0.5, y: 2.6, w: 9, fontSize: 16, color: TITLE_COLOR, bold: true });
slide.addText("• 50% Engineering: Fine-tuning LLM (AI), akses API data pasar proprietary secara real-time.", { x: 0.5, y: 3.0, w: 9, fontSize: 14, color: TEXT_COLOR });
slide.addText("• 30% Akuisisi Pengguna: Kemitraan eksklusif KOL (Influencer saham fundamental), distribusi via edukator B2B2C.", { x: 0.5, y: 3.4, w: 9, fontSize: 14, color: TEXT_COLOR });
slide.addText("• 20% Operasional & Legal: Pendirian PT, lisensi regulasi PSE Kominfo.", { x: 0.5, y: 3.8, w: 9, fontSize: 14, color: TEXT_COLOR });

slide.addText("GOAL: 5.000 Pengguna Berbayar (ARR Rp 6 Miliar) dalam 12 Bulan ke depan.", { x: 0.5, y: 4.5, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });

pptx.writeFile({ fileName: "TingAI_PitchDeck_ID.pptx" }).then(() => {
    console.log("PPTX created successfully.");
});
