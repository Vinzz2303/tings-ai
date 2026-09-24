import pptxgen from "pptxgenjs";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_16x9";
pptx.defineSlideMaster({
  title: "MASTER_SLIDE",
  background: { color: "0B0D12" }, 
  slideNumber: { x: "95%", y: "95%", color: "8FBFBA", fontSize: 10 },
});

const TITLE_COLOR = "D6B26B"; 
const TEXT_COLOR = "EEF2F7";
const MUTED_COLOR = "A7B0BF";
const HIGHLIGHT = "8FBFBA"; 

// 1. Title
let slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("TING AI", { x: 1, y: 2, w: 8, h: 1, fontSize: 54, color: TITLE_COLOR, bold: true, align: "center", fontFace: "Courier New" });
slide.addText("MACRO & WEALTH INTELLIGENCE", { x: 1, y: 3.2, w: 8, h: 0.5, fontSize: 22, color: TEXT_COLOR, letterSpacing: 2, align: "center", fontFace: "Arial" });
slide.addText("B2C SaaS untuk HNW & Ritel Serius. Anti-gamifikasi. Murni analitik.", { x: 1, y: 4.0, w: 8, h: 1, fontSize: 14, color: MUTED_COLOR, align: "center", fontFace: "Arial" });

// 2. Problem
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("REALITA PASAR (THE PROBLEM)", { x: 0.5, y: 0.5, w: 9, fontSize: 28, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Data (2024): 12.1 Juta investor ritel di Indonesia.", { x: 0.5, y: 1.5, w: 9, fontSize: 18, color: TEXT_COLOR, bold: true });
slide.addText([ { text: "1. Information Overload: ", options: { color: HIGHLIGHT, bold: true } }, { text: "Investor dibanjiri rumor tanpa filter makro-ekonomi yang jelas.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 2.3, w: 9, fontSize: 16 });
slide.addText([ { text: "2. Keputusan Emosional: ", options: { color: HIGHLIGHT, bold: true } }, { text: "90% investor ritel rugi karena UI aplikasi broker memicu impulse trading.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.1, w: 9, fontSize: 16 });
slide.addText([ { text: "3. Kesenjangan Alat: ", options: { color: HIGHLIGHT, bold: true } }, { text: "Bloomberg Terminal berharga Rp 380 Jt/tahun. Ritel hanya dibekali chart kosong.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.9, w: 9, fontSize: 16 });

// 3. Solution
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("SOLUSI: TING AI", { x: 0.5, y: 0.5, w: 4.5, fontSize: 26, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Bukan memberi sinyal, tapi menyadarkan realita.", { x: 0.5, y: 1.5, w: 4.5, fontSize: 18, color: HIGHLIGHT, bold: true });
slide.addText("Ting AI dirancang sebagai teman diskusi (Thinking Partner) agar investor bisa membaca konteks pasar dan kelemahan portofolionya sendiri sebelum bertindak.", { x: 0.5, y: 2.3, w: 4.2, fontSize: 14, color: TEXT_COLOR });
slide.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.0, w: 4.5, h: 3.5, fill: { color: "1A1D24" }, line: { color: "333333" } });
slide.addText("[ GAMBAR 1: Bukan memberi sinyal... ]", { x: 5.0, y: 2.5, w: 4.5, align: "center", color: MUTED_COLOR, fontSize: 12 });

// 4. Morning Command
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("KOMANDO PAGI & DASHBOARD", { x: 0.5, y: 0.5, w: 4.5, fontSize: 26, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Proactive AI", { x: 0.5, y: 1.5, w: 4.5, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("Mencerna ratusan titik data makro menjadi instruksi taktis harian. Desain Brutalist UI membuang euforia emosional dan memaksa ketenangan logis.", { x: 0.5, y: 2.0, w: 4.2, fontSize: 14, color: TEXT_COLOR });
slide.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.0, w: 4.5, h: 3.5, fill: { color: "1A1D24" }, line: { color: "333333" } });
slide.addText("[ GAMBAR 2: Dashboard Morning Command ]", { x: 5.0, y: 2.5, w: 4.5, align: "center", color: MUTED_COLOR, fontSize: 12 });

// 5. Explore Intelligence
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("MARKET PULSE", { x: 0.5, y: 0.5, w: 4.5, fontSize: 26, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Konteks Makro Sekali Lirik", { x: 0.5, y: 1.5, w: 4.5, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("Pantau komoditas, kripto, saham AS, dan IHSG secara bersamaan. Pahami tekanan likuiditas sebelum masuk ke market.", { x: 0.5, y: 2.0, w: 4.2, fontSize: 14, color: TEXT_COLOR });
slide.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.0, w: 4.5, h: 3.5, fill: { color: "1A1D24" }, line: { color: "333333" } });
slide.addText("[ GAMBAR 3: Explore Intelligence ]", { x: 5.0, y: 2.5, w: 4.5, align: "center", color: MUTED_COLOR, fontSize: 12 });

// 6. Probability
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("AI PROBABILITY", { x: 0.5, y: 0.5, w: 4.5, fontSize: 26, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Simulasi Probabilitas Matematis", { x: 0.5, y: 1.5, w: 4.5, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("AI kami menghitung skenario Bullish vs Bearish berdasarkan momentum historikal (1-2 minggu).", { x: 0.5, y: 2.0, w: 4.2, fontSize: 14, color: TEXT_COLOR });
slide.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.0, w: 4.5, h: 3.5, fill: { color: "1A1D24" }, line: { color: "333333" } });
slide.addText("[ GAMBAR 4: AI Probability Scenarios ]", { x: 5.0, y: 2.5, w: 4.5, align: "center", color: MUTED_COLOR, fontSize: 12 });

// 7. Whale Radar
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("WHALE RADAR (COT)", { x: 0.5, y: 0.5, w: 4.5, fontSize: 26, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Membaca Posisi Institusi", { x: 0.5, y: 1.5, w: 4.5, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("Melacak aliran dana Hedge Fund vs Komersial. Memberikan ritel visibilitas institusional.", { x: 0.5, y: 2.0, w: 4.2, fontSize: 14, color: TEXT_COLOR });
slide.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.0, w: 4.5, h: 3.5, fill: { color: "1A1D24" }, line: { color: "333333" } });
slide.addText("[ GAMBAR 5: Commodity Whale Radar ]", { x: 5.0, y: 2.5, w: 4.5, align: "center", color: MUTED_COLOR, fontSize: 12 });

// 8. Economic Calendar & FOMC (New)
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("MACRO CALENDAR & FOMC", { x: 0.5, y: 0.5, w: 4.5, fontSize: 26, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Antisipasi Event Berisiko Tinggi", { x: 0.5, y: 1.5, w: 4.5, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("Menyajikan hitung mundur (countdown) menuju rapat FOMC, rilis data Non-Farm Payrolls (NFP), dan CPI, lengkap dengan ekspektasi pasar (Rate Cut probabilities).", { x: 0.5, y: 2.0, w: 4.2, fontSize: 14, color: TEXT_COLOR });
slide.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.0, w: 4.5, h: 3.5, fill: { color: "1A1D24" }, line: { color: "333333" } });
slide.addText("[ GAMBAR 6: FOMC Meeting & Economic Calendar ]", { x: 5.0, y: 2.5, w: 4.5, align: "center", color: MUTED_COLOR, fontSize: 12 });

// 9. Global Macro & Alpha Signals (New)
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("GLOBAL MACRO & ALPHA", { x: 0.5, y: 0.5, w: 4.5, fontSize: 26, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Indikator Makro AS & Sinyal AI", { x: 0.5, y: 1.5, w: 4.5, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("Memantau Fear & Greed Index, yield obligasi AS (2Y & 10Y), serta memberikan 'Tings AI Briefing' dan sinyal Alpha secara langsung tanpa perlu membaca chart rumit.", { x: 0.5, y: 2.0, w: 4.2, fontSize: 14, color: TEXT_COLOR });
slide.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.0, w: 4.5, h: 3.5, fill: { color: "1A1D24" }, line: { color: "333333" } });
slide.addText("[ GAMBAR 7: Global Macro & Alpha Signals ]", { x: 5.0, y: 2.5, w: 4.5, align: "center", color: MUTED_COLOR, fontSize: 12 });

// 10. News Intelligence (New)
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("NEWS INTELLIGENCE", { x: 0.5, y: 0.5, w: 4.5, fontSize: 26, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Analisis Sentimen Otomatis", { x: 0.5, y: 1.5, w: 4.5, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("Mesin NLP (Natural Language Processing) kami menyortir ribuan berita global secara real-time dan langsung melabeli sentimennya (Bullish / Bearish / Neutral).", { x: 0.5, y: 2.0, w: 4.2, fontSize: 14, color: TEXT_COLOR });
slide.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.0, w: 4.5, h: 3.5, fill: { color: "1A1D24" }, line: { color: "333333" } });
slide.addText("[ GAMBAR 8: News Intelligence Sentiment ]", { x: 5.0, y: 2.5, w: 4.5, align: "center", color: MUTED_COLOR, fontSize: 12 });

// 11. Business Model
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("MODEL BISNIS & UNIT EKONOMI", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
let metrics2 = [
  { k: "Model:", v: "Freemium B2C SaaS" },
  { k: "SAM (Investor Aktif):", v: "4.000.000 Pengguna" },
  { k: "Target Konversi (1%):", v: "40.000 Pengguna Berbayar" },
  { k: "Harga Pro Tier:", v: "Rp 99.000 / bulan" },
  { k: "Proyeksi ARR:", v: "Rp 47.5 Miliar (Gross Margin 85%)" }
];
let yPos2 = 1.5;
metrics2.forEach(m => {
  slide.addText([{ text: m.k + " ", options: { color: MUTED_COLOR, bold: true } }, { text: m.v, options: { color: TEXT_COLOR } }], { x: 0.5, y: yPos2, w: 9, fontSize: 16 });
  yPos2 += 0.6;
});

// 12. Competitor Moat
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("MOAT & PERSAINGAN", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText([ { text: "1. Nol Konflik Kepentingan: ", options: { color: TITLE_COLOR, bold: true } }, { text: "Kami tidak meraup untung dari volume trading pengguna.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 1.5, w: 9, fontSize: 16 });
slide.addText([ { text: "2. Retensi 'Decision Journal': ", options: { color: TITLE_COLOR, bold: true } }, { text: "Mencatat tesis logis sebelum membeli saham. Retensi DAU sangat tinggi.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 2.5, w: 9, fontSize: 16 });
slide.addText([ { text: "3. Psikologi Desain: ", options: { color: TITLE_COLOR, bold: true } }, { text: "Bukan membujuk pemula, kami menargetkan uang serius lewat UI yang kaku dan objektif.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.5, w: 9, fontSize: 16 });

// 13. The Ask
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("PENAWARAN (THE ASK)", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Targeting: Rp 2.4 Miliar ($150,000) Pre-Seed", { x: 0.5, y: 1.5, w: 9, fontSize: 20, color: HIGHLIGHT, bold: true });
slide.addText("• 50% Engineering: Akses API data pasar riil & operasional LLM.", { x: 0.5, y: 2.5, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("• 30% Growth: Kemitraan eksklusif KOL & akuisisi B2B2C.", { x: 0.5, y: 3.2, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("• 20% Legal Ops: Izin PSE & legalitas korporasi (PT).", { x: 0.5, y: 3.9, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("GOAL: 5.000 Pengguna Berbayar (ARR Rp 6 Miliar) di Bulan ke-12.", { x: 0.5, y: 4.7, w: 9, fontSize: 16, color: TITLE_COLOR, bold: true });

pptx.writeFile({ fileName: "TingAI_PitchDeck_Final_V2.pptx" }).then(() => {
    console.log("Final V2 PPTX created.");
});
