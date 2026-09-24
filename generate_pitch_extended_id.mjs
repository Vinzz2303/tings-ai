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
slide.addText("TING AI", { x: 1, y: 2, w: 8, h: 1, fontSize: 48, color: TITLE_COLOR, bold: true, align: "center", fontFace: "Courier New" });
slide.addText("MACRO & WEALTH INTELLIGENCE", { x: 1, y: 3, w: 8, h: 0.5, fontSize: 20, color: TEXT_COLOR, letterSpacing: 2, align: "center", fontFace: "Arial" });
slide.addText("B2C SaaS untuk HNW & Ritel Serius.\nAnti-gamifikasi. Murni analitik.", { x: 1, y: 3.8, w: 8, h: 1, fontSize: 14, color: MUTED_COLOR, align: "center", fontFace: "Arial" });

// 2. Problem
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("REALITA PASAR (THE PROBLEM)", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Data (2024): 12.1 Juta investor ritel di Indonesia.", { x: 0.5, y: 1.5, w: 9, fontSize: 18, color: TEXT_COLOR, bold: true });
slide.addText([ { text: "1. Information Overload: ", options: { color: HIGHLIGHT, bold: true } }, { text: "Investor dibanjiri rumor grup Telegram/WhatsApp, tanpa filter makro-ekonomi yang jelas.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 2.2, w: 9, fontSize: 16 });
slide.addText([ { text: "2. Keputusan Emosional: ", options: { color: HIGHLIGHT, bold: true } }, { text: "90% investor ritel rugi karena UI aplikasi broker dirancang layaknya game, memicu impulse buying & overtrading.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.0, w: 9, fontSize: 16 });
slide.addText([ { text: "3. Kesenjangan Alat: ", options: { color: HIGHLIGHT, bold: true } }, { text: "Bloomberg Terminal berharga Rp 380 Jt/tahun. Ritel hanya dibekali chart kosong.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.8, w: 9, fontSize: 16 });

// 3. Solution
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("SOLUSI: TING AI", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Menghadirkan intelijen kelas institusi ke saku investor ritel.", { x: 0.5, y: 1.5, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText([ { text: "Proactive AI (Komando Pagi): ", options: { color: TITLE_COLOR, bold: true } }, { text: "Bukan sekadar data. AI kami mencerna ratusan titik data makro menjadi instruksi taktis (actionable) setiap harinya.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 2.2, w: 9, fontSize: 14 });
slide.addText([ { text: "Industrial Brutalist UI (Anti-Slop): ", options: { color: TITLE_COLOR, bold: true } }, { text: "Desain gelap, kaku, dan monospace. Sengaja didesain untuk memaksa ketenangan logis, membuang euforia emosional.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.0, w: 9, fontSize: 14 });

// 4. Product & Traction
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("PRODUK & TRAKSI", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Telah Tayang (Live MVP): app.tingsai.my.id", { x: 0.5, y: 1.2, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("• Simulator Risiko (Real-time): Kalkulasi kerugian instan jika indeks turun -5% / -10%.", { x: 0.5, y: 1.8, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("• Sistem Pengenalan Eksposur Aset: Pembacaan otomatis konsentrasi portofolio.", { x: 0.5, y: 2.4, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("• Jurnal Keputusan (Decision Journal): Memastikan setiap pembelian memiliki tesis tertulis.", { x: 0.5, y: 3.0, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("Traksi Teknologi: Dibangun dengan arsitektur Edge modern (Next.js), latency sub-100ms, terintegrasi dengan LLM & Market API.", { x: 0.5, y: 3.8, w: 9, fontSize: 14, color: MUTED_COLOR });

// 5. Market Size
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("POTENSI PASAR (MARKET SIZING)", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Fokus pada segmen yang haus akan rasionalitas.", { x: 0.5, y: 1.5, w: 9, fontSize: 16, color: MUTED_COLOR });
slide.addText([ { text: "TAM (Total Addressable Market): ", options: { color: TITLE_COLOR, bold: true } }, { text: "12,1 Juta Investor Pasar Modal Indonesia.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 2.2, w: 9, fontSize: 16 });
slide.addText([ { text: "SAM (Serviceable Available Market): ", options: { color: HIGHLIGHT, bold: true } }, { text: "4.000.000 Investor aktif yang mengelola saham secara mandiri.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.0, w: 9, fontSize: 16 });
slide.addText([ { text: "SOM (Serviceable Obtainable Market): ", options: { color: HIGHLIGHT, bold: true } }, { text: "100.000 Investor berduit (High Net Worth / Ritel Serius) yang bersedia membayar untuk 'ketenangan tidur'.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.8, w: 9, fontSize: 16 });

// 6. Business Model
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("MODEL BISNIS & UNIT EKONOMI", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Model: B2C SaaS (Freemium -> Pro Gate)", { x: 0.5, y: 1.5, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });
slide.addText("• Biaya Langganan TING AI PRO: Rp 99.000 / bulan", { x: 0.5, y: 2.2, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("• Target Konversi Realistis: 1% dari SAM (40.000 Pengguna)", { x: 0.5, y: 2.8, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("• Potensi ARR (Pendapatan Berulang Tahunan): Rp 47.5 Miliar", { x: 0.5, y: 3.4, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("• Gross Margin: 85%+ (Optimalisasi caching API market data secara agregat).", { x: 0.5, y: 4.0, w: 9, fontSize: 16, color: TEXT_COLOR });

// 7. Go To Market
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("GO-TO-MARKET STRATEGY", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Cara Kami Mengakuisisi Pengguna Baru Secara Murah:", { x: 0.5, y: 1.5, w: 9, fontSize: 16, color: MUTED_COLOR });
slide.addText([ { text: "1. Edukator Finansial (B2B2C): ", options: { color: TITLE_COLOR, bold: true } }, { text: "Bekerja sama dengan KOL yang lelah mengajarkan hal dasar. Mereka akan merekomendasikan Ting AI sebagai alat praktik audiensnya.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 2.2, w: 9, fontSize: 14 });
slide.addText([ { text: "2. Cult Following (Komunitas Brutalist): ", options: { color: TITLE_COLOR, bold: true } }, { text: "Memasarkan diri sebagai 'Anti-Broker'. Sebuah gerakan bawah tanah bagi investor yang benci dengan tampilan aplikasi saham yang kekanak-kanakan.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.0, w: 9, fontSize: 14 });
slide.addText([ { text: "3. 'Komando Pagi' SEO & Newsletter: ", options: { color: TITLE_COLOR, bold: true } }, { text: "Membagikan cuplikan rangkuman makro harian ke publik untuk memicu viralitas organik.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.8, w: 9, fontSize: 14 });

// 8. Competitor
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("PETA PERSAINGAN & MOAT", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Mengapa kita kebal dari kompetisi aplikasi sekuritas besar?", { x: 0.5, y: 1.5, w: 9, fontSize: 16, color: MUTED_COLOR });
slide.addText([ { text: "1. Tidak Ada Konflik Kepentingan: ", options: { color: TITLE_COLOR, bold: true } }, { text: "Aplikasi broker mendapat uang (fee) jika pengguna TERUS BERTARUNG (trading). Kami mendapat uang jika pengguna TETAP HIDUP dan tenang (langganan bulanan).", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 2.2, w: 9, fontSize: 14 });
slide.addText([ { text: "2. Retensi Psikologis Ekstrem: ", options: { color: TITLE_COLOR, bold: true } }, { text: "Integrasi fitur 'Decision Journal' membuat pengguna enggan pindah, karena seluruh sejarah rasionalitas mereka tertanam di Ting AI.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.0, w: 9, fontSize: 14 });
slide.addText([ { text: "3. Kategori Baru (WealthTech vs TradeTech): ", options: { color: TITLE_COLOR, bold: true } }, { text: "Kami tidak bersaing sebagai alat beli-jual. Kami adalah alat intelijen pelindung aset pendamping mereka.", options: { color: TEXT_COLOR } } ], { x: 0.5, y: 3.8, w: 9, fontSize: 14 });

// 9. Team
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("TIM (WHY US?)", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Faturachman Al Kahfi", { x: 0.5, y: 1.5, w: 9, fontSize: 20, color: HIGHLIGHT, bold: true });
slide.addText("Founder & Lead Builder", { x: 0.5, y: 2.0, w: 9, fontSize: 16, color: MUTED_COLOR });
slide.addText("• Memiliki kapabilitas rekayasa (engineering) Full-Stack mendalam. Mampu membangun sistem AI dan arsitektur Edge skala institusi seorang diri secara efisien.", { x: 0.5, y: 2.6, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("• Memahami lanskap UI/UX modern, mendobrak pola desain tradisional dengan estetika 'Industrial Brutalism' untuk mengendalikan bias psikologi pasar.", { x: 0.5, y: 3.4, w: 9, fontSize: 16, color: TEXT_COLOR });
slide.addText("Kecepatan Eksekusi (Velocity): Produk berhasil mencapai tahap Live MVP dalam kurun waktu yang memakan biaya miliaran di korporasi tradisional.", { x: 0.5, y: 4.2, w: 9, fontSize: 14, color: HIGHLIGHT, italic: true });

// 10. The Ask & Roadmap
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("PENAWARAN (THE ASK) & ROADMAP", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });
slide.addText("Targeting: Rp 2.4 Miliar ($150,000) Pre-Seed (Runway 18 Bulan)", { x: 0.5, y: 1.5, w: 9, fontSize: 18, color: HIGHLIGHT, bold: true });
slide.addText("Alokasi 12 Bulan ke Depan:", { x: 0.5, y: 2.2, w: 9, fontSize: 16, color: TITLE_COLOR, bold: true });
slide.addText("• 50% Engineering: Pembayaran lisensi real-time data feeds, fine-tuning LLM skala besar.", { x: 0.5, y: 2.6, w: 9, fontSize: 14, color: TEXT_COLOR });
slide.addText("• 30% Growth: Kemitraan eksklusif KOL & peluncuran program Beta publik.", { x: 0.5, y: 3.0, w: 9, fontSize: 14, color: TEXT_COLOR });
slide.addText("• 20% Legal Ops: Izin PSE, legalitas korporasi (PT).", { x: 0.5, y: 3.4, w: 9, fontSize: 14, color: TEXT_COLOR });
slide.addText("METRIK TARGET: 5.000 Pengguna Berbayar (ARR Rp 6 Miliar) di Bulan ke-12.", { x: 0.5, y: 4.2, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });

pptx.writeFile({ fileName: "TingAI_PitchDeck_Extended_ID.pptx" }).then(() => {
    console.log("Extended PPTX created successfully.");
});
