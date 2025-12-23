
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Languages, Trash2, History } from 'lucide-react';
import { UserPreferences, TranscriptionEntry } from '../types';
import { startLiveSession } from '../services/geminiService';
import { createPcmBlob, decodeBase64, decodeAudioData } from '../utils/audioUtils';

interface HearingAssistantProps {
  preferences: UserPreferences;
}

const HearingAssistant: React.FC<HearingAssistantProps> = ({ preferences }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptionEntry[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, currentInput, currentOutput]);

  const stopSession = () => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    
    // Cleanup audio playback sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    setIsListening(false);
    setCurrentInput('');
    setCurrentOutput('');
  };

  const startSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const sessionPromise = startLiveSession(
        {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              // Guidelines: Solely rely on sessionPromise resolves to send realtime input.
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: pcmBlob, mimeType: 'audio/pcm;rate=16000' } });
              });
            };

            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current!.destination);
            setIsListening(true);
          },
          onmessage: async (msg: any) => {
            // Process transcriptions
            if (msg.serverContent?.inputTranscription) {
              setCurrentInput(prev => prev + msg.serverContent.inputTranscription.text);
            }
            if (msg.serverContent?.outputTranscription) {
              setCurrentOutput(prev => prev + msg.serverContent.outputTranscription.text);
            }

            // Process audio playback from Gemini Live API
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              // Guidelines: Schedule next audio chunk to start at nextStartTime for gapless playback.
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioData = decodeBase64(base64Audio);
              const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.playbackRate.value = preferences.speechRate;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration / preferences.speechRate;
              sourcesRef.current.add(source);
            }

            // Handle server-side interruptions
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // finalize a conversation turn
            if (msg.serverContent?.turnComplete) {
              // Added explicit const casting and type assertion to resolve speaker property mismatch
              setTranscript(prev => [
                ...prev, 
                { text: currentInput, timestamp: Date.now(), speaker: 'user' as const },
                { text: currentOutput, timestamp: Date.now(), speaker: 'model' as const }
              ].filter((t): t is TranscriptionEntry => t.text.trim() !== ''));
              setCurrentInput('');
              setCurrentOutput('');
            }
          },
          onerror: (e: any) => {
            console.error("Live session error:", e);
            stopSession();
          },
          onclose: () => stopSession()
        },
        `You are a real-time transcription and translation assistant for a hearing-impaired user. 
         Translate everything you hear into ${preferences.language}. Use clear, large-print-friendly language.`,
        preferences.voiceName
      );

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start listening:", err);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      stopSession();
    } else {
      await startSession();
    }
  };

  const clearHistory = () => {
    setTranscript([]);
    setCurrentInput('');
    setCurrentOutput('');
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <div className="p-4 bg-zinc-900 flex justify-between items-center border-b border-zinc-800">
        <div className="flex items-center space-x-2">
          <Languages className="text-blue-400" />
          <span className="font-bold text-lg">Translation: {preferences.language}</span>
        </div>
        <button 
          onClick={clearHistory}
          className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white"
          aria-label="Clear transcript"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {transcript.length === 0 && !currentInput && !currentOutput && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center px-10">
            <History size={48} className="mb-4 opacity-20" />
            <p className="text-xl">Transcripts will appear here in real-time. Tap the mic to begin.</p>
          </div>
        )}

        {transcript.map((entry, idx) => (
          <div key={idx} className={`animate-in fade-in slide-in-from-left-4 duration-300 ${entry.speaker === 'model' ? 'border-l-4 border-blue-600 pl-4' : ''}`}>
             <p className={`text-sm mb-1 font-bold uppercase tracking-widest ${entry.speaker === 'user' ? 'text-zinc-500' : 'text-blue-400'}`}>
                {entry.speaker === 'user' ? 'Heard' : 'Translated'}
             </p>
             <p 
                className="text-white leading-tight font-bold" 
                style={{ fontSize: `${preferences.fontScale * 1.5}rem`, lineHeight: 1.2 }}
             >
               {entry.text}
             </p>
          </div>
        ))}

        {currentInput && (
          <div className="animate-pulse">
            <p className="text-zinc-500 text-sm mb-1 font-bold uppercase tracking-widest">Hearing...</p>
            <p className="text-white font-bold opacity-80" style={{ fontSize: `${preferences.fontScale * 1.5}rem`, lineHeight: 1.2 }}>
              {currentInput}
            </p>
          </div>
        )}

        {currentOutput && (
          <div className="animate-pulse border-l-4 border-blue-600/50 pl-4">
            <p className="text-blue-400 text-sm mb-1 font-bold uppercase tracking-widest">Translating...</p>
            <p className="text-white font-bold opacity-80" style={{ fontSize: `${preferences.fontScale * 1.5}rem`, lineHeight: 1.2 }}>
              {currentOutput}
            </p>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      <div className="p-6 bg-gradient-to-t from-black to-transparent">
        <button
          onClick={toggleListening}
          className={`w-full flex items-center justify-center py-8 rounded-3xl transition-all shadow-2xl active:scale-95 ${
            isListening ? 'bg-red-600 animate-pulse' : 'bg-blue-600'
          }`}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {isListening ? (
            <>
              <MicOff size={40} className="mr-4" />
              <span className="text-2xl font-black">STOP LISTENING</span>
            </>
          ) : (
            <>
              <Mic size={40} className="mr-4" />
              <span className="text-2xl font-black">START LISTENING</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default HearingAssistant;
