
import React from 'react';
import { UserPreferences } from '../types';
import { LANGUAGES, VOICES } from '../constants';
import { Type, Mic, Eye, Sliders, Check, FastForward } from 'lucide-react';

interface SettingsProps {
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
}

const Settings: React.FC<SettingsProps> = ({ preferences, setPreferences }) => {
  const update = (key: keyof UserPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-full overflow-y-auto bg-black p-6 space-y-8 pb-32">
      <h2 className="text-3xl font-black text-white flex items-center">
        <Sliders className="mr-3 text-blue-500" /> Personalize
      </h2>

      {/* Language */}
      <section className="space-y-4">
        <label className="text-xl font-bold text-zinc-400 block">Preferred Language</label>
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              onClick={() => update('language', lang)}
              className={`p-4 rounded-xl text-lg font-bold border-2 transition-all flex justify-between items-center ${
                preferences.language === lang 
                  ? 'bg-blue-600 border-blue-400 text-white' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              {lang}
              {preferences.language === lang && <Check size={20} />}
            </button>
          ))}
        </div>
      </section>

      {/* Text Size */}
      <section className="space-y-4">
        <label className="text-xl font-bold text-zinc-400 block flex items-center">
          <Type className="mr-2" size={20} /> Text Size
        </label>
        <input
          type="range"
          min="1"
          max="2.5"
          step="0.1"
          value={preferences.fontScale}
          onChange={(e) => update('fontScale', parseFloat(e.target.value))}
          className="w-full h-4 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-zinc-500 font-bold">
          <span>Standard</span>
          <span>Extra Large</span>
        </div>
      </section>

      {/* Speech Speed */}
      <section className="space-y-4">
        <label className="text-xl font-bold text-zinc-400 block flex items-center">
          <FastForward className="mr-2" size={20} /> Speech Speed
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={preferences.speechRate}
          onChange={(e) => update('speechRate', parseFloat(e.target.value))}
          className="w-full h-4 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          aria-valuetext={`${preferences.speechRate}x speed`}
        />
        <div className="flex justify-between text-zinc-500 font-bold">
          <span>Slower (0.5x)</span>
          <span>Faster (2.0x)</span>
        </div>
        <p className="text-center text-emerald-400 font-black text-2xl">{preferences.speechRate}x</p>
      </section>

      {/* Voice Selection */}
      <section className="space-y-4">
        <label className="text-xl font-bold text-zinc-400 block flex items-center">
          <Mic className="mr-2" size={20} /> AI Voice Persona
        </label>
        <div className="space-y-3">
          {VOICES.map(voice => (
            <button
              key={voice.id}
              onClick={() => update('voiceName', voice.id)}
              className={`w-full p-4 rounded-xl text-lg font-bold border-2 transition-all flex justify-between items-center ${
                preferences.voiceName === voice.id 
                  ? 'bg-emerald-600 border-emerald-400 text-white' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              {voice.name}
              {preferences.voiceName === voice.id && <Check size={20} />}
            </button>
          ))}
        </div>
      </section>

      {/* High Contrast */}
      <section className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
        <div className="flex items-center">
          <Eye className="mr-3 text-amber-500" />
          <span className="text-xl font-bold">Ultra-High Contrast</span>
        </div>
        <button
          onClick={() => update('highContrast', !preferences.highContrast)}
          className={`w-14 h-8 rounded-full p-1 transition-colors ${preferences.highContrast ? 'bg-blue-600' : 'bg-zinc-700'}`}
        >
          <div className={`bg-white w-6 h-6 rounded-full transform transition-transform ${preferences.highContrast ? 'translate-x-6' : ''}`} />
        </button>
      </section>

      <div className="pt-6 border-t border-zinc-800">
        <p className="text-zinc-600 text-center font-bold">
          Global AI Accessibility Companion v1.0<br/>
          Privacy First: No data is stored locally.
        </p>
      </div>
    </div>
  );
};

export default Settings;
