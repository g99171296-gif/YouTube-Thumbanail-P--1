
import { VideoThumbnail } from '../types';

export const extractVideoId = (url: string): string | null => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  
  // Handle shorts specifically
  if (!match) {
    const shortsRegExp = /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/;
    const shortsMatch = url.match(shortsRegExp);
    return (shortsMatch && shortsMatch[1].length === 11) ? shortsMatch[1] : null;
  }

  return (match && match[7].length === 11) ? match[7] : null;
};

export const createThumbnailObject = (url: string): VideoThumbnail | null => {
  const id = extractVideoId(url);
  if (!id) return null;

  return {
    id,
    url,
    title: `Video ${id}`, // In a real app we'd fetch the OEmbed title
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
    console.error('Download failed', error);
    // Fallback if CORS prevents blob download
    window.open(url, '_blank');
  }
};
