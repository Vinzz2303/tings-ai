import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export default function DemoPercetakan() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Halo Kak! Selamat datang di Layanan Otomatis Gratia Print. Ada yang bisa saya bantu untuk kebutuhan cetak Kakak hari ini?',
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
      let botResponse = 'Maaf Kak, pertanyaan tersebut di luar jangkauan otomatis. Mau saya sambungkan ke Admin (Manusia)?';

      if (lowerInput.includes('harga') || lowerInput.includes('spanduk') || lowerInput.includes('banner') || lowerInput.includes('mmt')) {
        botResponse = 'Siap Kak! Untuk spanduk/banner (bahan MMT standar) harganya Rp 25.000 per meter persegi. Kakak mau cetak ukuran berapa?';
      } else if (lowerInput.includes('undangan') || lowerInput.includes('nikah')) {
        botResponse = 'Bisa banget Kak! Harga undangan nikah mulai dari Rp 1.500/pcs (minimal order 100 pcs). Tapi mohon maaf, butuh waktu produksi 3-5 hari ya Kak, agar potongannya rapi 🙏.';
      } else if (lowerInput.includes('kirim') || lowerInput.includes('file') || lowerInput.includes('desain')) {
        botResponse = 'Untuk desain yang sudah siap cetak, tolong di-download dalam format PDF Print atau CorelDraw (CDR). Setelah itu langsung kirim file-nya ke email: cetakdisini@email.com ya Kak.';
      } else if (lowerInput.includes('halo') || lowerInput.includes('pagi') || lowerInput.includes('siang') || lowerInput.includes('sore') || lowerInput.includes('malam')) {
        botResponse = 'Halo juga Kak! Ada yang mau ditanyakan soal harga cetak banner, undangan, atau cara kirim file?';
      } else if (lowerInput.includes('terima kasih') || lowerInput.includes('makasih') || lowerInput.includes('oke') || lowerInput.includes('ok')) {
        botResponse = 'Sama-sama Kak! Ditunggu pesanannya ya. Kalau ada pertanyaan lain, ketik saja di sini.';
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: botResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#ece5dd] sm:bg-gray-100 font-sans">
      <div className="sm:max-w-md sm:mx-auto sm:w-full sm:h-full sm:shadow-2xl sm:flex sm:flex-col bg-[#ece5dd] relative overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center shadow-md z-10">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#075e54] font-bold text-xl mr-3 overflow-hidden">
            GP
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-tight">Gratia Print (AI Asisten)</h1>
            <p className="text-xs text-green-200">Online | Balas Otomatis</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 z-10 pb-20">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm relative ${
                  msg.sender === 'user' 
                    ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none' 
                    : 'bg-white text-gray-800 rounded-tl-none'
                }`}
              >
                <p className="text-[15px] leading-snug break-words">{msg.text}</p>
                <p className="text-[10px] text-gray-500 text-right mt-1.5 float-right ml-3">{msg.time}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-500 rounded-lg rounded-tl-none px-4 py-3 shadow-sm flex items-center space-x-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Background Pattern overlay (simulating WhatsApp chat background) */}
        <div className="absolute inset-0 opacity-5 pointer-events-none z-0" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-cool-dark-green-new-theme-whatsapp.jpg")', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}></div>

        {/* Input Area */}
        <div className="bg-transparent absolute bottom-0 w-full p-2 z-20">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-white rounded-full px-4 py-2.5 shadow-sm flex items-center">
              <input 
                type="text" 
                placeholder="Ketik pesan..." 
                className="flex-1 bg-transparent outline-none text-[15px] placeholder-gray-500 text-gray-800"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <button 
              onClick={handleSend}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                inputValue.trim() ? 'bg-[#00a884] text-white shadow-md' : 'bg-gray-200 text-gray-400'
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
