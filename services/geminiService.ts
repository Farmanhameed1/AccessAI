
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { UserPreferences } from "../types";

/**
 * Creates a fresh GoogleGenAI instance using the API key from environment variables.
 * Guidelines require using process.env.API_KEY directly in the named parameter.
 */
export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const describeImage = async (
  base64Image: string, 
  preferences: UserPreferences,
  mode: 'read' | 'summarize' | 'explain'
): Promise<string> => {
  const ai = getAI();
  const promptMap = {
    read: "Read all the text visible in this image verbatim. If there are signs or labels, read them clearly.",
    summarize: "Provide a high-level summary of what is happening in this image or what this document says.",
    explain: "Explain the content of this image or document in detail. If it is a contract or medical form, explain the key terms in plain language."
  };

  // Use recommended model names. Flash-lite is optimized for low-latency 'read' tasks.
  const model = mode === 'read' ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview';

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: `${promptMap[mode]}. Output the response in ${preferences.language}.` }
      ]
    }
  });

  return response.text || "I couldn't identify the content.";
};

export const generateSpeech = async (text: string, voiceName: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio generation failed");
  return base64Audio;
};

export const chatWithGemini = async (
  message: string,
  options: { 
    isThinking?: boolean, 
    isMaps?: boolean, 
    location?: { latitude: number, longitude: number },
    file?: { data: string, mimeType: string }
  }
) => {
  const ai = getAI();
  const parts: any[] = [{ text: message }];
  
  if (options.file) {
    parts.unshift({ inlineData: options.file });
  }

  // Maps grounding is only supported in Gemini 2.5 series.
  const model = options.isMaps ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';
  
  const config: any = {};
  if (options.isThinking && !options.isMaps) {
    // thinkingBudget config for Gemini 3 models.
    config.thinkingConfig = { thinkingBudget: 32768 };
  }
  
  if (options.isMaps) {
    config.tools = [{ googleMaps: {} }];
    if (options.location) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: options.location
        }
      };
    }
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config
  });

  const urls = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter((c: any) => c.maps?.uri)
    .map((c: any) => c.maps.uri);

  return {
    text: response.text || "No response received.",
    urls: urls || []
  };
};

export const generateImage = async (prompt: string, aspectRatio: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio,
        imageSize: "1K"
      }
    }
  });

  let imageUrl = '';
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }
  return imageUrl;
};

/**
 * Connects to the Gemini Live API for real-time translation and transcription.
 * Enables both input and output audio transcription.
 */
export const startLiveSession = (
  callbacks: {
    onopen: () => void;
    onmessage: (message: any) => void;
    onerror: (error: any) => void;
    onclose: (event: any) => void;
  },
  systemInstruction: string,
  voiceName: string
) => {
  const ai = getAI();
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
      systemInstruction,
    },
  });
};
