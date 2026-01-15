
import { VideoThumbnail } from '../types';

export const extractVideoId = (url: string): string | null => {
  if (!url) return null;
  
  // Clean the string from common bulk copy-paste artifacts
  const cleanUrl = url.trim().replace(/[<>"\s]/g, '');

  // Standard, Mobile, Embed, and Attribution links
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = cleanUrl.match(regExp);
  
  if (match && match[7].length === 11) {
    return match[7];
  }

  // Shorts links
  const shortsRegExp = /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/;
  const shortsMatch = cleanUrl.match(shortsRegExp);
  if (shortsMatch) {
    return shortsMatch[1];
  }

  // Handle direct ID entry (if user just pastes IDs)
  if (cleanUrl.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
};

export const createThumbnailObject = (url: string): VideoThumbnail | null => {
  const id = extractVideoId(url);
  if (!id) return null;

  return {
    id,
    url: url.trim(),
    title: `Video ${id}`,
    thumbnailUrl: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    resolutions: {
      max: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      hq: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      mq: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      sd: `https://img.youtube.com/vi/${id}/sddefault.jpg`,
    }
  };
};

export const downloadImage = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error');
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.warn('Direct download failed, opening in new tab', error);
    window.open(url, '_blank');
  }
};
