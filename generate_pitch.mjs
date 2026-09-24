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
slide.addText("B2C SaaS for HNW & Serious Retail.\nAnti-gamification. Pure analytics.", {
  x: 1, y: 3.8, w: 8, h: 1,
  fontSize: 14, color: MUTED_COLOR, align: "center", fontFace: "Arial"
});

// Slide 2: Market Reality (The Problem)
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("MARKET REALITY", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText("Data (2024): 12.1M retail investors in ID.", { x: 0.5, y: 1.5, w: 9, fontSize: 18, color: TEXT_COLOR, bold: true });
slide.addText([
  { text: "Pain Point 1: ", options: { color: HIGHLIGHT, bold: true } },
  { text: "90% of retail investors lose money due to emotional trading and gamified broker UI (impulse buying).", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 2.2, w: 9, fontSize: 16 });

slide.addText([
  { text: "Pain Point 2: ", options: { color: HIGHLIGHT, bold: true } },
  { text: "Information overload. High noise from Telegram/WhatsApp rumors, zero macro-economic context.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.0, w: 9, fontSize: 16 });

slide.addText([
  { text: "The Gap: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Bloomberg Terminal costs $24,000/year. Retail has $0 robust alternatives.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.8, w: 9, fontSize: 16 });


// Slide 3: The Solution
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("PRODUCT REALITY (TING AI)", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText("Live & Deployed: app.tingsai.my.id", { x: 0.5, y: 1.5, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });

slide.addText([
  { text: "1. Proactive Intelligence ('Komando Pagi'): ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Parses hundreds of macro data points into a single actionable daily thesis.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 2.2, w: 9, fontSize: 14 });

slide.addText([
  { text: "2. Real-time Risk Simulator: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Stress-test portfolio against -5% or -10% market drawdowns instantly.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.0, w: 9, fontSize: 14 });

slide.addText([
  { text: "3. Industrial Brutalist UI: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Dark, rigid, monospace data structures. Forces logical reading over emotional gambling.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.8, w: 9, fontSize: 14 });


// Slide 4: Business Model & Unit Economics
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("UNIT ECONOMICS & BUSINESS MODEL", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText("Model: Freemium B2C SaaS", { x: 0.5, y: 1.2, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });

let yPos = 1.8;
let metrics = [
  { k: "SAM (Active Investors):", v: "4,000,000 Users" },
  { k: "Target Conversion (1%):", v: "40,000 Paying Users" },
  { k: "Pro Tier Pricing:", v: "Rp 99,000 / month ($6.50)" },
  { k: "Projected ARR:", v: "Rp 47.5 Billion ($3.1M)" },
  { k: "Gross Margin:", v: "85% (Optimized API caching & Edge infrastructure)" }
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
slide.addText("COMPETITIVE MOAT", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText([
  { text: "1. Zero Conflict of Interest: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "We are NOT a broker. We do not profit from trading volume. Our AI's only goal is wealth preservation.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 1.5, w: 9, fontSize: 16 });

slide.addText([
  { text: "2. Stickiness via 'Decision Journal': ", options: { color: TITLE_COLOR, bold: true } },
  { text: "Users log investment thesis before buying. High DAU retention via daily 'Komando Pagi'.", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 2.5, w: 9, fontSize: 16 });

slide.addText([
  { text: "3. Psychological Positioning: ", options: { color: TITLE_COLOR, bold: true } },
  { text: "While competitors target novice gamblers with colorful UI, we target serious money (Rp 50M+ portfolios).", options: { color: TEXT_COLOR } }
], { x: 0.5, y: 3.5, w: 9, fontSize: 16 });


// Slide 6: The Ask
slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("THE ASK", { x: 0.5, y: 0.5, w: 9, fontSize: 24, color: TITLE_COLOR, bold: true, fontFace: "Courier New" });

slide.addText("Targeting: USD $150,000 (Rp 2.4 Billion) Pre-Seed", { x: 0.5, y: 1.5, w: 9, fontSize: 18, color: HIGHLIGHT, bold: true });
slide.addText("Runway: 18 Months", { x: 0.5, y: 2.0, w: 9, fontSize: 14, color: MUTED_COLOR });

slide.addText("Use of Funds:", { x: 0.5, y: 2.6, w: 9, fontSize: 16, color: TITLE_COLOR, bold: true });
slide.addText("• 50% Engineering: LLM fine-tuning, real-time proprietary data feeds.", { x: 0.5, y: 3.0, w: 9, fontSize: 14, color: TEXT_COLOR });
slide.addText("• 30% User Acquisition: KOL partnerships, B2B2C distribution via fin-educators.", { x: 0.5, y: 3.4, w: 9, fontSize: 14, color: TEXT_COLOR });
slide.addText("• 20% Ops & Legal: Corporate setup, licensing compliance (PSE).", { x: 0.5, y: 3.8, w: 9, fontSize: 14, color: TEXT_COLOR });

slide.addText("GOAL: 5,000 Paying Users (Rp 6B ARR) by Month 12.", { x: 0.5, y: 4.5, w: 9, fontSize: 16, color: HIGHLIGHT, bold: true });

pptx.writeFile({ fileName: "TingAI_PitchDeck.pptx" }).then(() => {
    console.log("PPTX created successfully.");
});
