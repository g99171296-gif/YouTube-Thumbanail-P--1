
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AiAnalysis, AspectRatio, ImageSize } from "../types";

// Always use a function to get a fresh instance of GoogleGenAI to ensure the latest API key is used
export const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Thumbnail content analysis using Gemini 3 Pro
export const analyzeContentBatch = async (videoIds: string[]): Promise<AiAnalysis> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze YouTube IDs: ${videoIds.join(', ')}. Provide catchy titles, social desc, and SEO tags.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
          socialDescription: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["suggestedTitles", "socialDescription", "tags"]
      }
    }
  });
  // response.text is a property, not a method
  return JSON.parse(response.text || '{}');
};

// Image Generation using gemini-3-pro-image-preview
export const generateImage = async (prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    // Correcting content structure to use parts array as per SDK guidelines
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: { aspectRatio, imageSize }
    }
  });
  // Iterate through parts to find the image data
  const part = response.candidates[0].content.parts.find(p => p.inlineData);
  return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
};

// Image Editing using gemini-2.5-flash-image
export const editImage = async (base64Image: string, prompt: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
        { text: prompt }
      ]
    }
  });
  const part = response.candidates[0].content.parts.find(p => p.inlineData);
  return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
};

// Video Generation using Veo 3.1 Fast
export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16', imageBase64?: string) => {
  const ai = getAi();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt,
    ...(imageBase64 && {
      image: {
        imageBytes: imageBase64.split(',')[1],
        mimeType: 'image/png'
      }
    }),
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
  });

  // Long-running operation polling
  while (!operation.done) {
    await new Promise(r => setTimeout(r, 8000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const link = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!link) return null;
  // Append API key for fetching the video bytes
  const res = await fetch(`${link}&key=${process.env.API_KEY}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

// Text to Speech using Gemini 2.5 Flash TTS
export const generateSpeech = async (text: string): Promise<string | null> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
    }
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
};

// Transcription using Gemini 3 Flash
export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Audio, mimeType: 'audio/wav' } },
        { text: "Transcribe this audio accurately." }
      ]
    }
  });
  return response.text || '';
};

// Chat with Grounding and Thinking capabilities
export const sendChatMessage = async (
  message: string, 
  history: {role: string, parts: {text: string}[]}[],
  useThinking: boolean = false,
  useSearch: boolean = false,
  useMaps: boolean = false
) => {
  const ai = getAi();
  const model = useThinking ? 'gemini-3-pro-preview' : (useMaps ? 'gemini-2.5-flash' : 'gemini-3-flash-preview');
  
  const response = await ai.models.generateContent({
    model,
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config: {
      ...(useThinking && { thinkingConfig: { thinkingBudget: 32768 } }),
      tools: [
        ...(useSearch ? [{ googleSearch: {} }] : []),
        ...(useMaps ? [{ googleMaps: {} }] : [])
      ]
    }
  });
  
  return {
    text: response.text || '',
    grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};

// Encoding/Decoding Utilities for binary data handling
export const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

export const encodeBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

// Raw PCM audio decoding for Live API / TTS output
export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}
