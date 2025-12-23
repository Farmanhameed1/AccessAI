
import React, { useState } from 'react';
import { AppTab, UserPreferences } from './types';
import { DEFAULT_PREFERENCES } from './constants';
import VisualAssistant from './components/VisualAssistant';
import HearingAssistant from './components/HearingAssistant';
import Assistant from './components/Assistant';
import Creative from './components/Creative';
import Settings from './components/Settings';
import { Eye, Ear, Sparkles, MessageSquare, Settings as SettingsIcon } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.VISUAL);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.VISUAL:
        return <VisualAssistant preferences={preferences} />;
      case AppTab.HEARING:
        return <HearingAssistant preferences={preferences} />;
      case AppTab.ASSISTANT:
        return <Assistant />;
      case AppTab.CREATIVE:
        return <Creative />;
      case AppTab.SETTINGS:
        return <Settings preferences={preferences} setPreferences={setPreferences} />;
      default:
        return null;
    }
  };

  return (
    <div 
      className={`min-h-screen flex flex-col bg-black overflow-hidden`}
      style={{ fontSize: `${preferences.fontScale}rem` }}
    >
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>

      <nav 
        className="h-24 bg-zinc-900 border-t border-zinc-800 flex justify-around items-center px-2"
        aria-label="Bottom Navigation"
      >
        <NavButton 
          active={activeTab === AppTab.VISUAL} 
          onClick={() => setActiveTab(AppTab.VISUAL)}
          icon={<Eye size={28} />}
          label="Visual"
        />
        <NavButton 
          active={activeTab === AppTab.HEARING} 
          onClick={() => setActiveTab(AppTab.HEARING)}
          icon={<Ear size={28} />}
          label="Hearing"
        />
        <NavButton 
          active={activeTab === AppTab.ASSISTANT} 
          onClick={() => setActiveTab(AppTab.ASSISTANT)}
          icon={<MessageSquare size={28} />}
          label="Assistant"
        />
        <NavButton 
          active={activeTab === AppTab.CREATIVE} 
          onClick={() => setActiveTab(AppTab.CREATIVE)}
          icon={<Sparkles size={28} />}
          label="Creative"
        />
        <NavButton 
          active={activeTab === AppTab.SETTINGS} 
          onClick={() => setActiveTab(AppTab.SETTINGS)}
          icon={<SettingsIcon size={28} />}
          label="Settings"
        />
      </nav>
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-all ${
      active ? 'text-blue-500 scale-105' : 'text-zinc-500'
    }`}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
  >
    <div className={`p-2 rounded-xl ${active ? 'bg-blue-500/10' : ''}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-60'}`}>
      {label}
    </span>
  </button>
);

export default App;
