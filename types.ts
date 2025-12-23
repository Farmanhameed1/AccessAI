
export enum AppTab {
  VISUAL = 'VISUAL',
  HEARING = 'HEARING',
  ASSISTANT = 'ASSISTANT',
  CREATIVE = 'CREATIVE',
  SETTINGS = 'SETTINGS'
}

export interface UserPreferences {
  language: string;
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  fontScale: number;
  speechRate: number;
  highContrast: boolean;
  verbosity: 'concise' | 'detailed';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  type?: 'text' | 'image' | 'video' | 'map';
  groundingUrls?: string[];
}

/**
 * Interface representing a single entry in the real-time audio transcription log.
 */
export interface TranscriptionEntry {
  text: string;
  timestamp: number;
  speaker: 'user' | 'model';
}
