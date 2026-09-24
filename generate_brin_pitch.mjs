import pptxgen from "pptxgenjs";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_16x9";
pptx.defineSlideMaster({
  title: "MASTER_SLIDE",
  background: { color: "0B0D12" }, // Dark theme
  slideNumber: { x: "95%", y: "95%", color: "8FBFBA", fontSize: 10 },
});

// Slide 1: Title
let slide1 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide1.addText("JAGAT: Autonomous Agentic Framework", { x: "10%", y: "40%", w: "80%", fontSize: 36, bold: true, color: "FFFFFF" });
slide1.addText("Peta Jalan Menuju Super Intelligence (AGI) Nasional", { x: "10%", y: "55%", w: "80%", fontSize: 18, color: "8FBFBA" });
slide1.addText("Presented to: BRIN", { x: "10%", y: "65%", w: "80%", fontSize: 14, color: "A0AAB5" });

// Slide 2: Vision
let slide2 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide2.addText("Visi JAGAT", { x: "10%", y: "10%", w: "80%", fontSize: 28, bold: true, color: "FFFFFF" });
slide2.addText([
    { text: "Bukan Sekadar Chatbot: ", options: { bold: true, color: "FFFFFF" } },
    { text: "JAGAT adalah 'Agentic Swarm'—sekumpulan AI yang bisa mengeksekusi perintah terminal, menganalisis file, dan berkolaborasi secara otonom.", options: { color: "A0AAB5" } }
], { x: "10%", y: "30%", w: "80%", fontSize: 18, bullet: true });
slide2.addText([
    { text: "Efisiensi Nasional: ", options: { bold: true, color: "FFFFFF" } },
    { text: "Mencapai kapabilitas AGI tanpa perlu modal triliunan untuk training LLM dari nol, melainkan melalui orkestrasi Cognitive Loop.", options: { color: "A0AAB5" } }
], { x: "10%", y: "50%", w: "80%", fontSize: 18, bullet: true });

// Slide 3: Roadmap Phase 1
let slide3 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide3.addText("Fase 1: Sistem Asisten Eksekutif Otonom", { x: "10%", y: "10%", w: "80%", fontSize: 28, bold: true, color: "FFFFFF" });
slide3.addText([
    { text: "Dual-Engine Router: Routing pintar antara LLM cepat (Groq) dan LLM pemikir (Gemini 1.5 Pro).", options: { color: "A0AAB5", bullet: true } },
    { text: "Server Control: AI dapat membaca log server dan melakukan self-healing.", options: { color: "A0AAB5", bullet: true } },
    { text: "Integrasi Telegram: Komando instan dari mana saja.", options: { color: "A0AAB5", bullet: true } }
], { x: "10%", y: "30%", w: "80%", fontSize: 18 });

// Slide 4: Roadmap Phase 2 & 3
let slide4 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide4.addText("Fase 2 & 3: Agentic Swarm & AGI-Level Reasoning", { x: "10%", y: "10%", w: "80%", fontSize: 28, bold: true, color: "FFFFFF" });
slide4.addText([
    { text: "Multi-Agent Collaboration: Agen riset, agen eksekusi, dan agen validasi bekerja secara paralel.", options: { color: "A0AAB5", bullet: true } },
    { text: "Long-Term Memory: Vector Database (RAG) untuk ingatan jangka panjang dan konteks operasional nasional.", options: { color: "A0AAB5", bullet: true } },
    { text: "Resource Optimization: Mampu mensintesis pengetahuan riset BRIN secara otomatis.", options: { color: "A0AAB5", bullet: true } }
], { x: "10%", y: "30%", w: "80%", fontSize: 18 });

// Slide 5: Keamanan & Blueprint (Blackbox Approach)
let slide5 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide5.addText("Keamanan & Implementasi (Blackbox Strategy)", { x: "10%", y: "10%", w: "80%", fontSize: 28, bold: true, color: "FFFFFF" });
slide5.addText([
    { text: "Arsitektur Modular: BRIN dapat melihat alur kerja (Blueprint Konseptual), tetapi Source Code Inti tetap terenkripsi (Proprietary).", options: { color: "A0AAB5", bullet: true } },
    { text: "On-Premise Ready: JAGAT dapat dideploy di server lokal BRIN untuk menjamin kedaulatan data.", options: { color: "A0AAB5", bullet: true } }
], { x: "10%", y: "30%", w: "80%", fontSize: 18 });

pptx.writeFile({ fileName: "Roadmap_JAGAT_BRIN.pptx" }).then(() => {
    console.log("Berhasil membuat Roadmap_JAGAT_BRIN.pptx");
});
