
import * as React from 'react';
import { VideoThumbnail } from '../types';
import { downloadImage } from '../utils/youtubeUtils';

interface ThumbnailCardProps {
  video: VideoThumbnail;
  // Adding optional key prop to resolve strict TypeScript errors when components are rendered in a loop
  key?: React.Key;
}

export default function ThumbnailCard({ video }: ThumbnailCardProps) {
  const [imgError, setImgError] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleDownload = (res: keyof VideoThumbnail['resolutions']) => {
    downloadImage(video.resolutions[res], `youtube-thumb-${video.id}-${res}.jpg`);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(video.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-xl border border-white/5 transition-all hover:border-red-500/30 group flex flex-col h-full">
      <div className="relative aspect-video overflow-hidden bg-black">
        <img
          src={imgError ? video.resolutions.hq : video.resolutions.max}
          alt={video.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
          <button
            onClick={() => handleDownload('max')}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Max Res
          </button>
        </div>
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        {/* URL Display - High Visibility for Workspace Context */}
        <div className="mb-5">
          <div className="bg-red-600/10 border-2 border-red-500/40 p-4 rounded-xl shadow-lg shadow-red-900/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                YouTube Link
              </p>
            </div>
            <p className="text-base font-bold text-white break-all leading-tight selection:bg-red-500 selection:text-white">
              {video.url}
            </p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-400 truncate mb-3">Video ID: {video.id}</h3>
        
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => handleDownload('hq')}
            className="text-xs bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 py-2 rounded-lg text-center transition-colors font-semibold"
          >
            High Quality
          </button>
          <button
            onClick={() => handleDownload('mq')}
            className="text-xs bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 py-2 rounded-lg text-center transition-colors font-semibold"
          >
            Medium Res
          </button>
        </div>
        
        <div className="mt-auto pt-3 border-t border-white/5 flex justify-between items-center">
          <div className="flex space-x-4">
            <a 
              href={video.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[11px] text-red-500 hover:text-red-400 uppercase tracking-widest font-black transition-colors"
            >
              Watch Now
            </a>
            <button
              onClick={handleShare}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 uppercase tracking-widest font-black transition-colors flex items-center"
            >
              {copied ? (
                <span className="flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                  Copied
                </span>
              ) : 'Share'}
            </button>
          </div>
          <span className="text-[10px] text-gray-600 font-mono tracking-tighter">{video.id}</span>
        </div>
      </div>
    </div>
  );
}
