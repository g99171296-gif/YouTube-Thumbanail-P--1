
import * as React from 'react';
import { VideoThumbnail, AppStatus, AiAnalysis, AppTab } from './types.ts';
import { createThumbnailObject, downloadImage } from './utils/youtubeUtils.ts';
import { analyzeContentBatch } from './services/geminiService.ts';
import ThumbnailCard from './components/ThumbnailCard.tsx';

export default function App() {
  const [activeTab, setActiveTab] = React.useState<AppTab>('DOWNLOADER');
  const [urls, setUrls] = React.useState<string>(() => localStorage.getItem('yt_urls') || '');
  const [thumbnails, setThumbnails] = React.useState<VideoThumbnail[]>(() => {
    const saved = localStorage.getItem('yt_thumbnails');
    return saved ? JSON.parse(saved) : [];
  });
  const [status, setStatus] = React.useState<AppStatus>(AppStatus.IDLE);

  const isStandalone = React.useMemo(() => {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  }, []);

  const stats = React.useMemo(() => {
    const rawLines = urls.split(/[\n,\s|]+/).filter(l => l.trim().length > 0);
    const valid = rawLines.map(l => createThumbnailObject(l)).filter(t => t !== null);
    return { validDetected: valid.length };
  }, [urls]);

  React.useEffect(() => {
    localStorage.setItem('yt_urls', urls);
    localStorage.setItem('yt_thumbnails', JSON.stringify(thumbnails));
  }, [urls, thumbnails]);

  const handleFetch = React.useCallback(async () => {
    if (!urls.trim()) return;
    setStatus(AppStatus.LOADING);
    const results = urls.split(/[\n,\s|]+/)
      .map(u => createThumbnailObject(u))
      .filter((v): v is VideoThumbnail => v !== null);
    
    const uniqueResults = Array.from(new Map<string, VideoThumbnail>(results.map(item => [item.id, item])).values());
    setThumbnails(uniqueResults);
    setStatus(uniqueResults.length > 0 ? AppStatus.SUCCESS : AppStatus.ERROR);
  }, [urls]);

  const handleDownloadAll = async () => {
    for (let i = 0; i < thumbnails.length; i++) {
      await downloadImage(thumbnails[i].resolutions.max, `yt-${thumbnails[i].id}.jpg`);
      await new Promise(r => setTimeout(r, 400));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden">
      <header className={`border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0 ${isStandalone ? 'h-24 pt-6' : 'h-20'}`}>
        <span className="text-lg font-black tracking-tighter uppercase italic">STUDIO PRO</span>
        {thumbnails.length > 0 && (
          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-bold">
            {thumbnails.length} READY
          </div>
        )}
      </header>

      <main className="flex-grow overflow-y-auto p-4 md:p-10 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#111111] p-6 rounded-[2rem] border border-white/5 shadow-2xl">
              <textarea 
                className="w-full h-48 bg-black/50 p-4 rounded-xl border border-white/5 focus:ring-1 focus:ring-red-500/30 transition-all font-mono text-[11px] leading-relaxed resize-none mb-4 outline-none"
                placeholder="Paste YouTube links..."
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
              />
              <button 
                onClick={handleFetch} 
                disabled={status === AppStatus.LOADING || !urls.trim()}
                className="w-full bg-red-600 hover:bg-red-700 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
              >
                {status === AppStatus.LOADING ? 'Analyzing...' : 'Fetch Thumbnails'}
              </button>
            </div>
            {thumbnails.length > 0 && (
              <button 
                onClick={handleDownloadAll} 
                className="w-full bg-white text-black h-12 rounded-xl font-black text-[10px] uppercase tracking-widest"
              >
                Download All
              </button>
            )}
          </div>

          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {thumbnails.map(v => <ThumbnailCard key={v.id} video={v} />)}
            </div>
          </div>
        </div>
      </main>

      <nav className={`bg-[#111111] border-t border-white/5 flex items-center justify-around sticky bottom-0 z-50 ${isStandalone ? 'h-24 pb-6' : 'h-20'}`}>
        <button className="flex flex-col items-center text-red-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          <span className="text-[8px] font-black uppercase mt-1">Downloader</span>
        </button>
        <button className="flex flex-col items-center text-gray-500 opacity-50">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          <span className="text-[8px] font-black uppercase mt-1">AI Chat</span>
        </button>
      </nav>
    </div>
  );
}
