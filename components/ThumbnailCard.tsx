
import * as React from 'react';
import { VideoThumbnail } from '../types';
import { downloadImage } from '../utils/youtubeUtils';

interface ThumbnailCardProps {
  video: VideoThumbnail;
  // Fix: Adding optional key to the interface to resolve TS assignability issues in certain environments
  key?: React.Key;
}

export default function ThumbnailCard({ video }: ThumbnailCardProps) {
  const [imgError, setImgError] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleDownload = (res: keyof VideoThumbnail['resolutions']) => {
    downloadImage(video.resolutions[res], `yt-${video.id}-${res}.jpg`);
  };

  const copyId = () => {
    navigator.clipboard.writeText(video.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group bg-[#111111] rounded-[2rem] overflow-hidden border border-white/5 transition-all hover:border-red-500/30 hover:shadow-2xl hover:shadow-red-900/10 flex flex-col h-full">
      <div className="relative aspect-video overflow-hidden bg-black">
        <img
          src={imgError ? video.resolutions.hq : video.resolutions.max}
          alt={video.id}
          className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
        
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
           <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
              <p className="text-[10px] font-black font-mono text-red-500 uppercase tracking-widest">{video.id}</p>
           </div>
           <button 
             onClick={() => handleDownload('max')}
             className="bg-white text-black p-2.5 rounded-xl shadow-xl hover:scale-110 active:scale-90 transition-all"
           >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
           </button>
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-grow bg-grid-pattern">
        <div className="flex space-x-2 mb-4">
           <button onClick={() => handleDownload('hq')} className="flex-grow bg-white/5 hover:bg-white/10 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-white/5">HD 720p</button>
           <button onClick={() => handleDownload('mq')} className="flex-grow bg-white/5 hover:bg-white/10 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-white/5">SD 480p</button>
        </div>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
           <a href={video.url} target="_blank" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-500 transition-colors italic">View Source</a>
           <button onClick={copyId} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors">
             {copied ? 'ID Copied!' : 'Copy ID'}
           </button>
        </div>
      </div>
    </div>
  );
}
