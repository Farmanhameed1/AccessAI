
import React, { useState, useRef } from 'react';
import { Send, MapPin, Brain, Image as ImageIcon, Video, Loader2, Link as LinkIcon, Paperclip, X } from 'lucide-react';
import { chatWithGemini } from '../services/geminiService';
import { ChatMessage } from '../types';

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ data: string, mimeType: string, name: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setAttachedFile({ data: base64, mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const onSend = async () => {
    if (!input && !attachedFile) return;
    
    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      let location;
      if (useMaps) {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej)
        );
        location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }

      const response = await chatWithGemini(input, {
        isThinking,
        isMaps: useMaps,
        location,
        file: attachedFile ? { data: attachedFile.data, mimeType: attachedFile.mimeType } : undefined
      });

      setMessages(prev => [...prev, { 
        role: 'model', 
        text: response.text, 
        groundingUrls: response.urls 
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error processing that request." }]);
    } finally {
      setIsSending(false);
      setAttachedFile(null);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header with Tool Toggles */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex space-x-2">
          <button 
            onClick={() => { setIsThinking(!isThinking); setUseMaps(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full border-2 transition-all ${isThinking ? 'bg-purple-600 border-purple-400' : 'bg-zinc-800 border-zinc-700'}`}
          >
            <Brain size={18} />
            <span className="font-bold text-sm">Deep Think</span>
          </button>
          <button 
            onClick={() => { setUseMaps(!useMaps); setIsThinking(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full border-2 transition-all ${useMaps ? 'bg-blue-600 border-blue-400' : 'bg-zinc-800 border-zinc-700'}`}
          >
            <MapPin size={18} />
            <span className="font-bold text-sm">Local Search</span>
          </button>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-3xl ${m.role === 'user' ? 'bg-blue-600' : 'bg-zinc-900 border border-zinc-800'}`}>
              <p className="text-xl leading-relaxed whitespace-pre-wrap">{m.text}</p>
              {m.groundingUrls && m.groundingUrls.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
                  <p className="text-xs font-bold uppercase text-zinc-500 tracking-widest">Sources</p>
                  {m.groundingUrls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" className="flex items-center text-blue-400 text-sm hover:underline">
                      <LinkIcon size={12} className="mr-2" /> Maps Result {idx + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 p-4 rounded-3xl border border-zinc-800 flex items-center space-x-3">
              <Loader2 className="animate-spin text-zinc-400" />
              <span className="text-zinc-400 font-bold uppercase tracking-widest animate-pulse">
                {isThinking ? 'Analyzing deeply...' : 'Assistant is thinking...'}
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        {attachedFile && (
          <div className="mb-2 p-2 bg-zinc-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center">
              <Paperclip size={16} className="mr-2 text-zinc-400" />
              <span className="text-sm font-bold truncate max-w-[200px]">{attachedFile.name}</span>
            </div>
            <button onClick={() => setAttachedFile(null)} className="text-red-400"><X size={20} /></button>
          </div>
        )}
        <div className="flex items-center space-x-3">
          <label className="p-4 bg-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-700 transition-colors">
            <Paperclip size={24} />
            <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Ask anything..."
            className="flex-1 bg-zinc-800 rounded-2xl p-4 text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={1}
          />
          <button 
            onClick={onSend}
            disabled={isSending || (!input && !attachedFile)}
            className="p-4 bg-blue-600 rounded-2xl disabled:opacity-50"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
