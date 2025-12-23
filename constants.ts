
import { UserPreferences } from './types';

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'English',
  voiceName: 'Kore',
  fontScale: 1.25,
  speechRate: 1.0,
  highContrast: true,
  verbosity: 'detailed'
};

export const LANGUAGES = [
  'English', 'Spanish', 'Urdu', 'Arabic', 'Chinese', 'French', 'Hindi', 'Japanese'
];

export const VOICES = [
  { id: 'Kore', name: 'Kore (Balanced)' },
  { id: 'Puck', name: 'Puck (Youthful)' },
  { id: 'Charon', name: 'Charon (Deep)' },
  { id: 'Fenrir', name: 'Fenrir (Energetic)' },
  { id: 'Zephyr', name: 'Zephyr (Smooth)' }
];
