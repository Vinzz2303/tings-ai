<div align="center">
  <img src="https://tingsai.my.id/logo.png" alt="Tings AI Logo" width="120" />
  <h1>Tings AI</h1>
  <p><strong>Market Intelligence on Autopilot</strong></p>
  <p>Submission for <a href="https://sectors.app">Sectors Hackathon 2026</a> • Track 3: Market Intelligence</p>
</div>

---

## 💡 The Problem

Indonesian retail traders often suffer losses due to information overload, delayed news, and the inability to quickly interpret complex macroeconomic data and fundamental indicators. 

## 🚀 The Solution: Tings AI

**Tings AI** is a dual-engine AI copilot that helps Indonesian retail investors overcome information overload by translating complex Sectors data into actionable setups. 

By leveraging the **Sectors.app API**, Tings AI fetches real-time financial data, company fundamentals, and market sentiment, and processes it through our hybrid AI routing system (Groq for speed, Gemini 1.5 Pro for deep reasoning) to deliver instant, institutional-grade insights directly to your dashboard or Telegram.

## ✨ Key Features

- **Real-Time Fundamental Analysis**: Instant breakdown of PE, PBV, ROE, and more, powered by Sectors API.
- **Support, Resistance & Momentum Detection**: "Trader Mode" generates actionable technical setups.
- **Dual-Bot Engine (JAGAT Framework)**: Seamlessly routes queries between Groq (fast/cheap) and Gemini (complex/deep).
- **Telegram & Web Dashboard**: Accessible 24/7 on the platforms traders already use.

## 🛠 Tech Stack

- **Data Source**: [Sectors API](https://sectors.app)
- **Frontend**: Next.js / Vite, TailwindCSS
- **Backend**: Node.js, Express, PM2
- **AI Models**: Groq (Llama-3), Gemini 1.5 Pro
- **Bot Engine**: Telegraf (Telegram API)

## 💻 How to Run Locally

### 1. Clone & Install
```bash
git clone https://github.com/your-username/tings-ai.git
cd tings-ai
npm install
```

### 2. Environment Setup
Create a `.env.local` file in the root directory:
```env
SECTORS_API_KEY=your_sectors_key
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
TELEGRAM_BOT_TOKEN=your_bot_token
```

### 3. Run Development Server
```bash
# Start frontend
npm run dev

# Start backend (in another terminal)
cd server
npm install
npm run dev
```

---

<div align="center">
  Built with ❤️ by Faturachman Alkahfi for the Sectors Hackathon
</div>
