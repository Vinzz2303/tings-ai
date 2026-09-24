import React, { useState, useEffect, useRef } from 'react';
import { Send, ShieldCheck, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export default function DemoSekolah() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Halo Ayah/Bunda! 👋 Selamat datang di layanan TING AI Parent Care. \n\nAda yang bisa kami bantu terkait informasi akademik, biaya administrasi, keluhan, atau jadwal sekolah?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const lowerInput = userMessage.text.toLowerCase();
      let botResponse = 'Terima kasih Ayah/Bunda. Karena pertanyaan ini membutuhkan pengecekan manual, tiket pengaduan #10023 telah dibuat. Staf admin kami akan segera menghubungi Ayah/Bunda. 🙏';

      if (lowerInput.includes('spp') || lowerInput.includes('bayar') || lowerInput.includes('tagihan') || lowerInput.includes('keuangan')) {
        botResponse = '💳 [SMART ESCALATION]\nUntuk informasi rincian tagihan SPP dan status pembayaran tunggakan, pertanyaan ini telah saya teruskan secara otomatis ke **Bagian Bendahara/Keuangan**. Mohon tunggu sebentar ya Ayah/Bunda, staf terkait akan segera membalas di chat ini.';
      } else if (lowerInput.includes('jam') || lowerInput.includes('pulang') || lowerInput.includes('masuk') || lowerInput.includes('jadwal')) {
        botResponse = '🏫 [INFO AKADEMIK 24/7]\nBerdasarkan kalender akademik resmi sekolah, jam masuk siswa SD IT adalah pukul 07:00 WIB dan jam pulang pukul 14:30 WIB. \nApakah ada yang ingin ditanyakan terkait jadwal eskul?';
      } else if (lowerInput.includes('nakal') || lowerInput.includes('berantem') || lowerInput.includes('dibully') || lowerInput.includes('perilaku') || lowerInput.includes('masalah')) {
        botResponse = '🤝 [SMART ESCALATION]\nKami sangat memahami kekhawatiran Ayah/Bunda. Laporan ini bersifat sensitif dan telah saya eskalasi otomatis ke **Bimbingan Konseling (BK) / Kesiswaan**. Wali kelas dan guru BK akan segera memprioritaskan dan menghubungi Ayah/Bunda untuk tindak lanjut secepatnya.';
      } else if (lowerInput.includes('ac') || lowerInput.includes('kotor') || lowerInput.includes('fasilitas') || lowerInput.includes('rusak')) {
        botResponse = '🛠️ [MANAJEMEN TIKET]\nTerima kasih atas laporannya, Ayah/Bunda. Tiket pengaduan fasilitas nomor #12346 telah dibuat dan langsung diteruskan ke bagian **Sarpras (Sarana Prasarana)** untuk perbaikan per hari ini. Kami akan mengupdate statusnya jika sudah selesai diperbaiki.';
      } else if (lowerInput.includes('halo') || lowerInput.includes('pagi') || lowerInput.includes('siang') || lowerInput.includes('sore') || lowerInput.includes('malam')) {
        botResponse = 'Halo Ayah/Bunda! Ada yang mau ditanyakan seputar kegiatan siswa hari ini atau informasi administrasi?';
      } else if (lowerInput.includes('terima kasih') || lowerInput.includes('makasih') || lowerInput.includes('oke') || lowerInput.includes('ok')) {
        botResponse = 'Sama-sama Ayah/Bunda! Terima kasih telah mempercayakan pendidikan putra-putrinya di sekolah kami. Semoga harinya menyenangkan!';
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: botResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f0f2f5] font-sans items-center justify-center sm:py-8">
      <div className="w-full h-full sm:max-w-md sm:max-h-[850px] sm:rounded-[2.5rem] sm:border-[12px] sm:border-gray-900 shadow-2xl flex flex-col bg-[#e5ddd5] relative overflow-hidden">
        
        {/* Header - TING AI Education Theme (Blue) */}
        <div className="bg-[#1e40af] text-white px-4 py-3 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1e40af] font-bold mr-3 shadow-sm border-2 border-blue-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-semibold text-[16px] leading-tight flex items-center gap-1">
                SD IT / SMP IT Bot <ShieldCheck className="w-4 h-4 text-blue-300" />
              </h1>
              <p className="text-[11px] text-blue-200">Powered by TING AI Parent Care</p>
            </div>
          </div>
          <HelpCircle className="w-5 h-5 text-blue-200 opacity-80" />
        </div>

        {/* Informational Banner */}
        <div className="bg-[#eff6ff] border-b border-blue-100 p-2 text-center z-10 shadow-sm">
          <p className="text-[11px] text-blue-700 font-medium">🔒 Percakapan ini dienkripsi dan terekam di Dashboard Yayasan</p>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 z-10 pb-20">
          <div className="text-center mb-4">
            <span className="bg-yellow-100/80 text-yellow-800 text-[11px] px-3 py-1 rounded-lg font-medium shadow-sm">
              Hari Ini
            </span>
          </div>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm relative ${
                  msg.sender === 'user' 
                    ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none' 
                    : 'bg-white text-gray-800 rounded-tl-none border-l-4 border-[#1e40af]'
                }`}
              >
                <p className="text-[14px] leading-snug whitespace-pre-wrap">{msg.text}</p>
                <p className="text-[10px] text-gray-500 text-right mt-1.5 float-right ml-3">{msg.time}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-500 rounded-lg rounded-tl-none px-4 py-3 shadow-sm flex items-center space-x-1 border-l-4 border-[#1e40af]">
                <div className="text-[11px] font-medium text-blue-800 mr-2">AI sedang menganalisis</div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-cool-dark-green-new-theme-whatsapp.jpg")', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}></div>

        {/* Input Area */}
        <div className="bg-transparent absolute bottom-0 w-full p-2 z-20">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-white rounded-full px-4 py-2.5 shadow-md flex items-center border border-gray-200">
              <input 
                type="text" 
                placeholder="Ketik keluhan atau pertanyaan..." 
                className="flex-1 bg-transparent outline-none text-[14px] placeholder-gray-400 text-gray-800"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <button 
              onClick={handleSend}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-md ${
                inputValue.trim() ? 'bg-[#1e40af] text-white hover:bg-blue-800' : 'bg-gray-300 text-gray-500'
              }`}
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
