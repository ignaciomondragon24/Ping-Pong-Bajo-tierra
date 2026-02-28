import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, Image as ImageIcon, Loader2, Info, Table, Users, Clock, MessageCircle, X, MapPin, Phone, Instagram, Beer, Pizza, Dices, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';

const SYSTEM_INSTRUCTION = `Eres "Bajo Tierra Bot", el gestor inteligente de "Ping Pong Bajo Tierra - Club de Juegos", ubicado en San Abasto (Sánchez de Bustamante 632), Buenos Aires. Tu tono es urbano, directo, con la vibra de un club de nicho pero muy profesional.

### INFORMACIÓN DEL CLUB:
- Ubicación: Sánchez de Bustamante 632 (San Abasto).
- Oferta: Bar, tragos, pizzas y 3 salas de juegos con música independiente.
- Horarios: Domingos de 14:00 a 00:00 hs.
- Entrada general (Derecho de admisión): $10.000 por persona. Incluye 1 consumición (1 vaso de gaseosa o cerveza + 2 empanadas o 2 porciones de pizza).

### SALAS DISPONIBLES:
- Sala 1 "El Barcito": Juegos de mesa libres (Ajedrez, Damas, Jenga, Dados, Cartas, Dominó, TEG, etc).
- Salas Privadas de Ping Pong (Sala 2 "La del Medio" y Sala 3 "La Negra"): La sala es solo para el grupo. MÍNIMO 4 PERSONAS PARA RESERVAR.
  - Sala 2: $12.000 por grupo + derecho de admisión por persona.
  - Sala 3: $15.000 por grupo + derecho de admisión por persona.

### CLASES GRUPALES DE PING PONG:
- Nivel: Iniciación.
- Profesor: Joaquín Escobari.
- Días y horarios: Martes, jueves y domingos de 10:30 a 12:00 hs.
- Precios: 1 vez por semana $35.000 / 2 veces por semana $60.000.
- Consultas: 11 6013 8638.

### RESERVAS Y CONTACTO:
- WhatsApp: 11 6013 8638
- Instagram: @pingpongbajotierra

### IDENTIDAD VISUAL Y NOTICIAS:
- Ayudas a los usuarios a subir "Flyers" extrayendo la info clave.
- Generas avisos de "Último Momento".

### PERSONALIDAD:
- Usas voseo (sos de Buenos Aires).
- Sos eficiente y directo.
- Si detectas que alguien es principiante, recomendale las clases de iniciación.

### RESPUESTAS CLAVE:
- Si preguntan disponibilidad de ping pong: "Che, decime a qué hora querés venir. Acordate que para las salas de ping pong son mínimo 4 personas. ¿Cuántos son?".
- Si preguntan por reservas: "Podés mandarnos un WhatsApp al 11 6013 8638 o hablarnos por Instagram para asegurar tu lugar."`;

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
};

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: '¡Buenas! Soy Bajo Tierra Bot. Bienvenido al subsuelo del Abasto. ¿Buscás mesa para jugar, info de las clases o querés saber los precios?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      image: selectedImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const chatHistory = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      let responseText = '';

      if (userMessage.image) {
        const base64Data = userMessage.image.split(',')[1];
        const mimeType = userMessage.image.split(';')[0].split(':')[1];
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType } },
              { text: userMessage.text || 'Extraé la info clave de este flyer o decime de qué trata.' }
            ]
          },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          }
        });
        responseText = response.text || 'No pude procesar la imagen, che.';
      } else {
        const properChat = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
            }
        });
        
        for (const msg of messages) {
            if (msg.role === 'user') {
                await properChat.sendMessage({ message: msg.text });
            }
        }
        
        const chatResponse = await properChat.sendMessage({ message: userMessage.text });
        responseText = chatResponse.text || 'Hubo un error de conexión en el subsuelo.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: responseText,
        },
      ]);
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: 'Che, se me cortó la señal acá abajo. ¿Me repetís?',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-16 h-16 bg-red-600 text-white rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center justify-center hover:bg-red-500 transition-all z-50 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <MessageCircle className="w-8 h-8" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 w-[90vw] sm:w-[400px] h-[600px] max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col z-50 transition-all origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <Table className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white leading-tight">Bajo Tierra Bot</h3>
              <p className="text-[10px] text-zinc-400 font-mono">EN LÍNEA</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-3 flex gap-3 items-start">
            <Info className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-300">
              <strong className="text-red-400">Recordatorio:</strong> Las salas de ping pong son para grupos de mínimo 4 personas.
            </p>
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-zinc-800' : 'bg-red-600'}`}>
                {msg.role === 'user' ? <Users className="w-4 h-4 text-zinc-300" /> : <Table className="w-4 h-4 text-white" />}
              </div>
              <div className={`max-w-[75%] rounded-2xl p-3 text-sm ${msg.role === 'user' ? 'bg-zinc-800 text-white rounded-tr-sm' : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                {msg.image && (
                  <img src={msg.image} alt="Uploaded" className="max-w-full rounded-lg mb-2 border border-zinc-700" referrerPolicy="no-referrer" />
                )}
                <div className="prose prose-invert prose-sm max-w-none">
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 flex-row">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                <Table className="w-4 h-4 text-white" />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                <span className="text-xs text-zinc-400 font-mono">Escribiendo...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-zinc-900 border-t border-zinc-800 rounded-b-2xl">
          {selectedImage && (
            <div className="mb-2 relative inline-block">
              <img src={selectedImage} alt="Selected" className="h-16 rounded-lg border border-zinc-700" />
              <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-500">×</button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors">
              <ImageIcon className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu mensaje..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-all"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || (!input.trim() && !selectedImage)} className="p-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-red-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 z-40">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
              <Table className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight uppercase">Bajo Tierra</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#salas" className="hover:text-white transition-colors">Salas</a>
            <a href="#precios" className="hover:text-white transition-colors">Precios</a>
            <a href="#clases" className="hover:text-white transition-colors">Clases</a>
            <a href="https://wa.me/5491160138638" target="_blank" rel="noreferrer" className="bg-white text-black px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors font-bold">
              Reservar
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(220,38,38,0.1),_transparent_50%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-red-400 mb-8">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            DOMINGOS 14:00 A 00:00 HS
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter mb-6 leading-[0.9]">
            Ping Pong <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
              Bajo Tierra
            </span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Club de juegos en el subsuelo del Abasto. Bar, pizzas, ping pong y 3 salas con música independiente. ¿Tu plan de domingo? Ahora sí lo tenés.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="https://wa.me/5491160138638" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2">
              <Phone className="w-5 h-5" />
              Reservar Mesa
            </a>
            <a href="https://www.instagram.com/p/DVCo96JjfrE/?igsh=MTNrcHN3aXh3NjRjNg==" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2">
              <Instagram className="w-5 h-5" />
              Ver Instagram
            </a>
          </div>
        </div>
      </section>

      {/* Info / Admisión */}
      <section id="precios" className="py-20 bg-zinc-900/50 border-y border-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-3xl">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Admisión General</h3>
              <p className="text-4xl font-black text-red-500 mb-4">$10.000<span className="text-lg text-zinc-500 font-normal"> /pers</span></p>
              <p className="text-zinc-400 text-sm">Derecho de admisión obligatorio para ingresar al club.</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-3xl md:col-span-2 flex flex-col justify-center">
              <h3 className="text-2xl font-bold mb-6">Tu entrada incluye 1 consumición:</h3>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center shrink-0">
                    <Beer className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Bebida</h4>
                    <p className="text-zinc-400 text-sm">1 vaso de gaseosa o cerveza bien fría.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center shrink-0">
                    <Pizza className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Comida</h4>
                    <p className="text-zinc-400 text-sm">2 empanadas o 2 porciones de pizza.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Salas */}
      <section id="salas" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">Nuestras Salas</h2>
            <p className="text-xl text-zinc-400">Espacios privados con música independiente. Mínimo 4 personas para reservar ping pong.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Sala 1 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <span className="text-xs font-mono text-zinc-500 border border-zinc-700 px-3 py-1 rounded-full">SALA 1</span>
                <Dices className="w-6 h-6 text-zinc-400" />
              </div>
              <h3 className="text-3xl font-black mb-2">El Barcito</h3>
              <p className="text-zinc-400 mb-8 flex-1">Juegos de mesa libres. Ajedrez, Damas, Jenga, Dados, Cartas, Dominó, TEG y más.</p>
              <div className="pt-6 border-t border-zinc-800">
                <p className="text-sm text-zinc-500 uppercase tracking-wider font-bold">Acceso con la entrada general</p>
              </div>
            </div>

            {/* Sala 2 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full" />
              <div className="flex items-center justify-between mb-8 relative z-10">
                <span className="text-xs font-mono text-red-400 border border-red-900/50 bg-red-950/30 px-3 py-1 rounded-full">SALA 2</span>
                <Table className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-3xl font-black mb-2 relative z-10">La del Medio</h3>
              <p className="text-zinc-400 mb-8 flex-1 relative z-10">Sala privada de ping pong. La sala es solo para ustedes.</p>
              <div className="pt-6 border-t border-zinc-800 relative z-10">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-black text-white">$12.000</span>
                  <span className="text-zinc-500 pb-1">/ grupo</span>
                </div>
                <p className="text-xs text-zinc-500">+ Derecho de admisión por persona</p>
              </div>
            </div>

            {/* Sala 3 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full" />
              <div className="flex items-center justify-between mb-8 relative z-10">
                <span className="text-xs font-mono text-red-400 border border-red-900/50 bg-red-950/30 px-3 py-1 rounded-full">SALA 3</span>
                <Table className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-3xl font-black mb-2 relative z-10">La Negra</h3>
              <p className="text-zinc-400 mb-8 flex-1 relative z-10">Nuestra sala premium de ping pong. Exclusiva para tu grupo.</p>
              <div className="pt-6 border-t border-zinc-800 relative z-10">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-black text-white">$15.000</span>
                  <span className="text-zinc-500 pb-1">/ grupo</span>
                </div>
                <p className="text-xs text-zinc-500">+ Derecho de admisión por persona</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clases */}
      <section id="clases" className="py-24 bg-zinc-900/30 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 md:p-16 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 mb-6">
                <Users className="w-4 h-4" />
                NIVEL INICIACIÓN
              </div>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-6">Clases Grupales</h2>
              <p className="text-lg text-zinc-400 mb-8">
                Aprende técnica, saques y desplazamientos con el Prof. Joaquín Escobari. Ideal para dar tus primeros pasos en el deporte.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-zinc-300">
                  <Clock className="w-5 h-5 text-red-500" />
                  <span>Martes, Jueves y Domingos de 10:30 a 12:00 hs.</span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300">
                  <ChevronRight className="w-5 h-5 text-red-500" />
                  <span>1 vez x semana: <strong>$35.000</strong></span>
                </li>
                <li className="flex items-center gap-3 text-zinc-300">
                  <ChevronRight className="w-5 h-5 text-red-500" />
                  <span>2 veces x semana: <strong>$60.000</strong></span>
                </li>
              </ul>
              <a href="https://wa.me/5491160138638" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-colors">
                <Phone className="w-4 h-4" />
                Consultar por clases
              </a>
            </div>
            <div className="w-full md:w-1/3 aspect-square bg-zinc-900 rounded-3xl border border-zinc-800 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(220,38,38,0.2),_transparent_70%)]" />
              <Table className="w-32 h-32 text-zinc-800" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 py-12 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <Table className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight uppercase">Bajo Tierra</span>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-6 text-sm text-zinc-400">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>Sánchez de Bustamante 632, San Abasto</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>11 6013 8638</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a href="https://www.instagram.com/p/DVCo96JjfrE/?igsh=MTNrcHN3aXh3NjRjNg==" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
              <Instagram className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>

      {/* Chatbot Widget */}
      <ChatWidget />
    </div>
  );
}
