
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Volume2, BookOpen, Search, HelpCircle, Loader2, Sparkles, Target, Mic, WifiOff, AlertCircle, CheckCircle2, SwitchCamera } from 'lucide-react';
import { describeImage, generateSpeech } from '../services/geminiService';
import { UserPreferences } from '../types';
import { decodeBase64, decodeAudioData } from '../utils/audioUtils';
import Tesseract from 'https://esm.sh/tesseract.js@5';

/**
 * Simple 1D Kalman Filter to smooth jittery motion measurements.
 */
class KalmanFilter {
  private x: number = 0; // State
  private p: number = 1; // Covariance
  private q: number = 0.1; // Process noise
  private r: number = 0.5; // Measurement noise

  filter(measurement: number): number {
    this.p = this.p + this.q;
    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (measurement - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }
}

/**
 * Generic retry utility for API calls.
 */
const retryTask = async <T,>(task: () => Promise<T>, maxRetries = 2, delay = 1000): Promise<T> => {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await task();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      attempt++;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unexpected retry failure");
};

const LANG_MAP_OCR: Record<string, string> = {
  'English': 'eng', 'Spanish': 'spa', 'Urdu': 'urd', 'Arabic': 'ara', 
  'Chinese': 'chi_sim', 'French': 'fra', 'Hindi': 'hin', 'Japanese': 'jpn'
};

const LANG_MAP_TTS: Record<string, string> = {
  'English': 'en-US', 'Spanish': 'es-ES', 'Urdu': 'ur-PK', 'Arabic': 'ar-SA', 
  'Chinese': 'zh-CN', 'French': 'fr-FR', 'Hindi': 'hi-IN', 'Japanese': 'ja-JP'
};

interface VisualAssistantProps {
  preferences: UserPreferences;
}

const VisualAssistant: React.FC<VisualAssistantProps> = ({ preferences }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStabilizing, setIsStabilizing] = useState(false);
  const [stabilityLevel, setStabilityLevel] = useState(0); 
  const [resultText, setResultText] = useState<string>('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [audioContext] = useState(() => new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }));

  // Monitor network status
  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 },
          focusMode: 'continuous' 
        } as any
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, [facingMode, stopCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!videoRef.current || !videoRef.current.srcObject) return;

    const rect = videoRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    // Visual feedback
    setFocusRing({ x: clientX - rect.left, y: clientY - rect.top, visible: true });
    setTimeout(() => setFocusRing(prev => ({ ...prev, visible: false })), 1000);

    // Apply camera constraints if supported
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    
    try {
      const capabilities: any = track.getCapabilities();
      const constraints: any = { advanced: [] };

      if (capabilities.focusMode?.includes('manual') && capabilities.pointsOfInterest) {
        constraints.advanced.push({
          focusMode: 'manual',
          pointsOfInterest: [{ x, y }]
        });
      } else if (capabilities.focusMode?.includes('continuous')) {
        constraints.advanced.push({ focusMode: 'continuous' });
      }

      if (constraints.advanced.length > 0) {
        await track.applyConstraints(constraints);
      }
    } catch (err) {
      console.warn("Manual focus not fully supported by this device/browser.", err);
    }
  };

  const speakOffline = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_MAP_TTS[preferences.language] || 'en-US';
    utterance.rate = preferences.speechRate;
    window.speechSynthesis.speak(utterance);
  };

  const performOfflineOCR = async (base64Image: string): Promise<string> => {
    const langCode = LANG_MAP_OCR[preferences.language] || 'eng';
    // @ts-ignore
    const { data: { text } } = await Tesseract.recognize(
      `data:image/jpeg;base64,${base64Image}`,
      langCode
    );
    return text.trim() || "No clear text found in the image.";
  };

  const getStabilizedFrame = async (): Promise<string> => {
    return new Promise((resolve) => {
      const MAX_DURATION = 3000;
      const SAMPLE_RATE = 80;
      const kFilter = new KalmanFilter();
      let bestFrame: string = '';
      let minFilteredMotion = Infinity;
      let prevData: Uint8ClampedArray | null = null;
      const startTime = Date.now();
      const motionCtx = motionCanvasRef.current?.getContext('2d', { willReadFrequently: true });
      const mainCtx = canvasRef.current?.getContext('2d');

      const checkMotion = async () => {
        if (!videoRef.current || !motionCanvasRef.current || !canvasRef.current || !motionCtx || !mainCtx) return;
        const mSize = 64;
        motionCtx.drawImage(videoRef.current, 0, 0, mSize, mSize);
        const currData = motionCtx.getImageData(0, 0, mSize, mSize).data;
        let rawMotionScore = 0;
        if (prevData) {
          const gridSize = 4;
          const blockSize = mSize / gridSize;
          for (let gy = 0; gy < gridSize; gy++) {
            for (let gx = 0; gx < gridSize; gx++) {
              let blockDiff = 0;
              for (let y = 0; y < blockSize; y += 2) {
                for (let x = 0; x < blockSize; x += 2) {
                  const idx = ((gy * blockSize + y) * mSize + (gx * blockSize + x)) * 4;
                  blockDiff += Math.abs(currData[idx] - prevData[idx]);
                }
              }
              rawMotionScore += blockDiff;
            }
          }
        }
        const filteredMotion = kFilter.filter(rawMotionScore);
        const STABILITY_THRESHOLD = 18000; 
        const currentStability = Math.max(0, Math.min(100, 100 - (filteredMotion / STABILITY_THRESHOLD * 100)));
        setStabilityLevel(currentStability);

        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        mainCtx.drawImage(videoRef.current, 0, 0);
        const currentFrame = canvasRef.current.toDataURL('image/jpeg', 0.9).split(',')[1];
        
        if (filteredMotion < minFilteredMotion || !bestFrame) {
          minFilteredMotion = filteredMotion;
          bestFrame = currentFrame;
        }
        prevData = currData;

        const timeElapsed = Date.now() - startTime;
        if ((currentStability > 95 && timeElapsed > 400) || timeElapsed >= MAX_DURATION) {
          setStabilityLevel(100);
          await new Promise(r => setTimeout(r, 400));
          resolve(bestFrame);
        } else {
          setTimeout(checkMotion, SAMPLE_RATE);
        }
      };
      checkMotion();
    });
  };

  const captureAndAnalyze = useCallback(async (mode: 'read' | 'summarize' | 'explain') => {
    if (!videoRef.current || !canvasRef.current || isProcessing || isStabilizing) return;
    
    setIsStabilizing(true);
    setStabilityLevel(0);
    setResultText('');

    try {
      const stabilizedBase64 = await getStabilizedFrame();
      setIsStabilizing(false);
      setIsProcessing(true);

      if (isOnline) {
        try {
          const text = await retryTask(() => describeImage(stabilizedBase64, preferences, mode));
          setResultText(text);
          const audioData = await retryTask(() => generateSpeech(text, preferences.voiceName));
          const decoded = decodeBase64(audioData);
          const audioBuffer = await decodeAudioData(decoded, audioContext);
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = preferences.speechRate;
          source.connect(audioContext.destination);
          source.start();
        } catch (apiError) {
          console.error("Gemini API persistent failure, falling back to offline engine", apiError);
          const offlineText = await performOfflineOCR(stabilizedBase64);
          setResultText(`(Offline Fallback) ${offlineText}`);
          speakOffline(offlineText);
        }
      } else {
        const offlineText = await performOfflineOCR(stabilizedBase64);
        let finalDisplay = offlineText;
        if (mode !== 'read') {
          finalDisplay = `Offline Mode: Only basic reading is available. Text found: ${offlineText}`;
        }
        setResultText(finalDisplay);
        speakOffline(offlineText);
      }
    } catch (err) {
      console.error("Analysis failed", err);
      setResultText("I couldn't process the image. Please try again.");
    } finally {
      setIsStabilizing(false);
      setIsProcessing(false);
      setStabilityLevel(0);
    }
  }, [preferences, audioContext, isProcessing, isStabilizing, isOnline]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.toLowerCase();
        if (transcript.includes('capture') || transcript.includes('analyze')) {
          captureAndAnalyze('read');
        }
      };

      recognition.onstart = () => setIsVoiceActive(true);
      recognition.onend = () => {
        if (!isProcessing && !isStabilizing) {
          try { recognition.start(); } catch(e) {}
        } else {
          setIsVoiceActive(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, [captureAndAnalyze, isProcessing, isStabilizing]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const getStabilityText = () => {
    if (stabilityLevel >= 100) return "CAPTURE LOCKED!";
    if (stabilityLevel > 90) return "PERFECT! HOLD STILL...";
    if (stabilityLevel > 70) return "HOLD STEADY...";
    if (stabilityLevel > 40) return "KEEPING STILL...";
    return "STABILIZING...";
  };

  return (
    <div className="flex flex-col h-full bg-black text-white p-4 space-y-4" role="main">
      <div 
        className="relative aspect-video bg-zinc-900 rounded-3xl overflow-hidden border-4 border-zinc-800 shadow-2xl transition-all duration-500 cursor-crosshair"
        onClick={handleTapToFocus}
        role="button"
        aria-label="Camera viewfinder. Tap anywhere to focus."
      >
        <video 
          ref={videoRef} autoPlay playsInline 
          className={`w-full h-full object-cover transition-filter duration-700 ${isProcessing ? 'blur-md grayscale' : ''} ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          aria-hidden="true"
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        <canvas ref={motionCanvasRef} width="64" height="64" className="hidden" aria-hidden="true" />
        
        {focusRing.visible && (
          <div 
            className="absolute border-2 border-amber-400 rounded-lg w-16 h-16 pointer-events-none z-50 animate-focus-pulse"
            style={{ 
              left: focusRing.x - 32, 
              top: focusRing.y - 32,
              animation: 'focus-lock 0.6s ease-out forwards'
            }}
            aria-hidden="true"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-amber-400 text-[10px] font-bold uppercase tracking-tighter bg-black/40 px-1 rounded">Focusing</div>
          </div>
        )}

        {!isOnline && (
          <div className="absolute top-4 left-4 bg-red-600 px-4 py-1 rounded-full flex items-center space-x-2 animate-pulse shadow-lg z-40" role="status">
            <WifiOff size={16} />
            <span className="text-xs font-black uppercase tracking-widest">Offline Mode</span>
          </div>
        )}

        {isVoiceActive && !isProcessing && !isStabilizing && (
          <div className="absolute top-4 right-4 bg-emerald-500/20 border border-emerald-500/50 backdrop-blur-md px-3 py-1 rounded-full flex items-center space-x-2 z-40" role="status">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <Mic size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Voice Commands Ready</span>
          </div>
        )}

        {isStabilizing && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none" role="alert" aria-live="assertive">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full transition-all duration-300 ${stabilityLevel > 90 ? 'bg-emerald-500/20 scale-125 blur-xl' : 'bg-transparent'}`} />
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="74" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/10" />
                <circle cx="80" cy="80" r="74" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={465} strokeDashoffset={465 - (465 * stabilityLevel) / 100} className={`transition-all duration-150 ${stabilityLevel > 90 ? 'text-emerald-400' : (stabilityLevel > 70 ? 'text-emerald-500' : 'text-amber-500')}`} strokeLinecap="round" />
              </svg>
              <div className={`p-6 rounded-full bg-black/50 backdrop-blur-md transition-all duration-300 ${stabilityLevel > 90 ? 'scale-110 bg-emerald-600/60 shadow-[0_0_30px_rgba(52,211,153,0.5)]' : 'scale-100'}`}>
                {stabilityLevel >= 100 ? (
                  <CheckCircle2 className="w-16 h-16 text-white animate-in zoom-in-50 duration-300" />
                ) : (
                  <Target className={`w-16 h-16 transition-all duration-300 ${stabilityLevel > 90 ? 'text-white animate-pulse' : 'text-white/80'}`} />
                )}
              </div>
            </div>
            <div className={`absolute bottom-12 px-8 py-3 rounded-full border-2 transition-all duration-300 backdrop-blur-xl ${stabilityLevel > 90 ? 'bg-emerald-600 border-emerald-400 scale-110 shadow-lg' : 'bg-black/60 border-white/20'}`}>
              <p className={`text-2xl font-black uppercase tracking-widest transition-colors duration-300 ${stabilityLevel > 90 ? 'text-white' : 'text-zinc-100'}`}>
                {getStabilityText()}
              </p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-blue-600/20 flex flex-col items-center justify-center z-30 backdrop-blur-sm" role="status" aria-live="polite">
            <Loader2 className="w-20 h-20 text-blue-400 animate-spin mb-6" />
            <p className="text-3xl font-black text-white animate-pulse uppercase tracking-tighter">
              {isOnline ? 'AI Processing...' : 'Local OCR Thinking...'}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 flex-none" role="group" aria-label="Visual Assistance Controls">
        <button
          onClick={() => captureAndAnalyze('read')}
          disabled={isProcessing || isStabilizing}
          className="group relative h-32 flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-3xl transition-all active:scale-95 disabled:opacity-50 shadow-[0_12px_0_rgb(30,64,175)] active:translate-y-2 active:shadow-none"
          aria-label="Read text aloud from image"
        >
          <BookOpen size={40} className="mb-2" aria-hidden="true" />
          <span className="text-xl font-black uppercase tracking-tight">Read Aloud</span>
        </button>

        <button
          onClick={() => captureAndAnalyze('summarize')}
          disabled={isProcessing || isStabilizing}
          className={`group relative h-32 flex flex-col items-center justify-center rounded-3xl transition-all active:scale-95 disabled:opacity-50 shadow-[0_12px_0_rgb(6,95,70)] active:translate-y-2 active:shadow-none ${isOnline ? 'bg-emerald-600' : 'bg-zinc-700 opacity-80'}`}
          aria-label="Summarize content from image"
        >
          <Search size={40} className="mb-2" aria-hidden="true" />
          <div className="flex flex-col items-center">
            <span className="text-xl font-black uppercase tracking-tight">Summarize</span>
            {!isOnline && <span className="text-[10px] opacity-60 font-bold uppercase">Basic OCR Only</span>}
          </div>
        </button>

        <button
          onClick={() => captureAndAnalyze('explain')}
          disabled={isProcessing || isStabilizing}
          className={`group relative h-32 flex flex-col items-center justify-center rounded-3xl transition-all active:scale-95 disabled:opacity-50 shadow-[0_12px_0_rgb(146,64,14)] active:translate-y-2 active:shadow-none ${isOnline ? 'bg-amber-600' : 'bg-zinc-700 opacity-80'}`}
          aria-label="Explain image content in detail"
        >
          <HelpCircle size={40} className="mb-2" aria-hidden="true" />
          <div className="flex flex-col items-center">
            <span className="text-xl font-black uppercase tracking-tight">Explain</span>
            {!isOnline && <span className="text-[10px] opacity-60 font-bold uppercase">Basic OCR Only</span>}
          </div>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={toggleCamera}
            className="group relative h-32 flex flex-col items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-3xl transition-all active:scale-95 shadow-[0_12px_0_rgb(39,39,42)] active:translate-y-2 active:shadow-none"
            aria-label={`Switch to ${facingMode === 'environment' ? 'front' : 'rear'} camera`}
          >
            <SwitchCamera size={40} className="mb-2" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-tight">Switch</span>
          </button>
          <button
            onClick={startCamera}
            className="group relative h-32 flex flex-col items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-3xl transition-all active:scale-95 shadow-[0_12px_0_rgb(39,39,42)] active:translate-y-2 active:shadow-none"
            aria-label="Reset camera lens and restart stream"
          >
            <RefreshCw size={40} className="mb-2" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-tight">Reset</span>
          </button>
        </div>
      </div>

      {resultText && (
        <div 
          className="flex-1 overflow-y-auto min-h-[160px] p-8 bg-zinc-900 border-x-4 border-t-4 border-zinc-700 rounded-t-[3rem] shadow-[0_-20px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-12 duration-500"
          role="region"
          aria-live="polite"
          aria-label="Analysis results"
        >
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center space-x-3 text-emerald-400">
                <Volume2 className="w-8 h-8 animate-bounce" aria-hidden="true" />
                <span className="text-lg font-black uppercase tracking-widest">{isOnline ? 'Assistant' : 'Local Reader'}</span>
              </div>
              {!isOnline && (
                <div className="flex items-center text-amber-500 space-x-1">
                  <AlertCircle size={14} aria-hidden="true" />
                  <span className="text-[10px] font-bold">Local Voice</span>
                </div>
              )}
            </div>
            <p className="font-bold leading-[1.3] text-white" style={{ fontSize: `${preferences.fontScale * 1.75}rem` }}>
              {resultText}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes focus-lock {
          0% { transform: scale(1.5); opacity: 0; }
          50% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default VisualAssistant;
