
import React, { useState, useEffect } from 'react';
// Changed non-existent 'AspectRatio' icon to 'Maximize'
import { Sparkles, Maximize, Loader2, Download, ExternalLink, ShieldCheck, Database, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { generateImage } from '../services/geminiService';

/**
 * Valid aspect ratios supported by the Gemini 2.5/3 image generation series.
 */
const RATIOS = [
  { id: '1:1', label: '1:1' },
  { id: '3:4', label: '3:4' },
  { id: '4:3', label: '4:3' },
  { id: '9:16', label: '9:16' },
  { id: '16:9', label: '16:9' }
];

const Creative: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    setIsCheckingKey(true);
    try {
      const has = await (window as any).aistudio.hasSelectedApiKey();
      setHasApiKey(has);
    } catch (err) {
      console.error("Error checking key status:", err);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const openKeySelector = async () => {
    try {
      await (window as any).aistudio.openSelectKey();
      // Guidelines: Assume the key selection was successful after triggering openSelectKey.
      setHasApiKey(true);
    } catch (err) {
      console.error("Error opening key selector:", err);
    }
  };

  const onGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const url = await generateImage(prompt, selectedRatio);
      setResultImage(url);
    } catch (err) {
      console.error(err);
      // If the request fails with 404/Not Found, instructions suggest resetting key state.
      if (err instanceof Error && err.message.includes("Requested entity was not found")) {
          setHasApiKey(false);
          alert("Selected project not found. Please re-select your API key.");
      } else {
          alert("Image generation failed. Ensure your selected API key has billing enabled and supports 3.0-pro models.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (isCheckingKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-950">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-zinc-400 font-bold uppercase tracking-widest">Verifying Studio Access...</p>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-8 bg-zinc-950">
        <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center relative">
          <ShieldCheck size={48} className="text-blue-500" />
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-2 py-1 rounded-full font-black uppercase">Required</div>
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black">Pro Image Studio</h2>
          <p className="text-xl text-zinc-400 max-w-md mx-auto leading-relaxed">
            High-fidelity 1K/2K/4K image generation requires a billing-enabled API key from a paid Google Cloud project.
          </p>
        </div>
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-left space-y-4">
          <div className="flex items-start space-x-3">
            <CreditCard className="text-emerald-500 mt-1" size={20} />
            <p className="text-sm text-zinc-300">Requires a <span className="text-white font-bold">Paid Tier</span> project for Gemini 3 Pro access.</p>
          </div>
          <div className="flex items-start space-x-3">
            <Database className="text-blue-500 mt-1" size={20} />
            <p className="text-sm text-zinc-300">Access to <span className="text-white font-bold">Imagen-3 / Gemini-3</span> image engines.</p>
          </div>
        </div>
        <button 
          onClick={openKeySelector}
          className="bg-blue-600 hover:bg-blue-500 px-10 py-5 rounded-3xl text-2xl font-black shadow-[0_12px_0_rgb(30,64,175)] active:translate-y-2 active:shadow-none transition-all active:scale-95"
        >
          Select Project API Key
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          className="flex items-center text-blue-400 font-bold hover:underline group"
        >
          Check billing documentation <ExternalLink size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-y-auto pb-32">
      <div className="p-8 space-y-10 max-w-4xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem]">
          <h2 className="text-4xl font-black flex items-center">
            <Sparkles className="mr-3 text-amber-500" /> Creative Studio
          </h2>
          
          {/* Key Management Dashboard */}
          <div className="flex flex-col space-y-2 text-xs">
            <div className="flex items-center justify-between bg-black/40 px-4 py-2 rounded-xl border border-zinc-700">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="font-bold text-zinc-300 uppercase tracking-widest">Status: Active Project</span>
              </div>
              <button 
                onClick={openKeySelector}
                className="ml-6 text-blue-400 hover:text-blue-300 flex items-center font-bold uppercase tracking-tighter"
              >
                <RefreshCw size={12} className="mr-1" /> Switch
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center space-x-2">
                <Database size={12} className="text-zinc-500" />
                <span className="text-zinc-400 font-medium">Quota: Unrestricted</span>
              </div>
              <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center space-x-2">
                <Calendar size={12} className="text-zinc-500" />
                <span className="text-zinc-400 font-medium">Expires: N/A (Project)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Prompt Input */}
        <section className="space-y-4">
          <label className="text-xl font-bold text-zinc-400 block uppercase tracking-wide">Visual Prompt</label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your vision... (e.g., 'An accessible city of the future with bioluminescent ramps and solar walkways')"
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-6 text-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all h-40 resize-none"
            />
            <div className="absolute bottom-4 right-4 text-xs font-bold text-zinc-600 uppercase tracking-widest bg-black/40 px-2 py-1 rounded">
              High-Fidelity Engine
            </div>
          </div>
        </section>

        {/* Aspect Ratio */}
        <section className="space-y-4">
          <label className="text-xl font-bold text-zinc-400 block flex items-center uppercase tracking-wide">
            {/* Updated non-existent 'AspectRatio' icon to 'Maximize' */}
            <Maximize className="mr-2" size={20} /> Frame Aspect Ratio
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {RATIOS.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRatio(r.id)}
                className={`py-4 rounded-2xl font-black text-lg border-2 transition-all active:scale-95 ${
                  selectedRatio === r.id 
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>

        <button
          onClick={onGenerate}
          disabled={isGenerating || !prompt}
          className="w-full bg-amber-600 hover:bg-amber-500 py-7 rounded-3xl text-3xl font-black shadow-[0_12px_0_rgb(146,64,14)] active:translate-y-2 active:shadow-none transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center">
              <Loader2 className="animate-spin mr-4" size={36} /> RENDER IN PROGRESS...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <Sparkles className="mr-3" /> CREATE IMAGE
            </span>
          )}
        </button>

        {/* Result Area */}
        {resultImage && (
          <div className="pt-8 space-y-6 animate-in fade-in zoom-in duration-700 slide-in-from-bottom-12">
            <div className="relative group bg-zinc-900 rounded-[3rem] overflow-hidden border-8 border-zinc-800 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)]">
              <img src={resultImage} alt="Generated accessibility art" className="w-full h-auto" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                <a 
                  href={resultImage} 
                  download="gemini-creative-masterpiece.png"
                  className="bg-white text-black p-8 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all"
                  title="Download in High Quality"
                >
                  <Download size={48} />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-4 text-zinc-500 font-bold uppercase tracking-widest text-sm">
              <div className="h-px w-12 bg-zinc-800" />
              <span>Gemini 3 Pro Image preview engine</span>
              <div className="h-px w-12 bg-zinc-800" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Creative;
