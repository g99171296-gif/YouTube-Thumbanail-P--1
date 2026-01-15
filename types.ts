
export interface VideoThumbnail {
  id: string;
  url: string;
  title: string;
  thumbnailUrl: string;
  resolutions: {
    max: string;
    hq: string;
    mq: string;
    sd: string;
  };
}

export interface AiAnalysis {
  suggestedTitles: string[];
  socialDescription: string;
  tags: string[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type AppTab = 'DOWNLOADER' | 'CREATIVE' | 'VOICE' | 'CHAT';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
  groundingUrls?: { title: string; uri: string }[];
}

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';
export type ImageSize = '1K' | '2K' | '4K';
