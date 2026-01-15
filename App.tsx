
import * as React from 'react';
import { VideoThumbnail, AppStatus, AiAnalysis, AppTab, ChatMessage, AspectRatio, ImageSize } from './types';
import { createThumbnailObject, downloadImage } from './utils/youtubeUtils';
import { analyzeContentBatch, generateImage, generateVideo, generateSpeech, transcribeAudio, sendChatMessage, getAi, decodeAudioData, decodeBase64, encodeBase64 } from './services/geminiService';
import ThumbnailCard from './components/ThumbnailCard';
import AiSection from './components/AiSection';
import { Modality } from '@google/genai';

export default function App() {
  const [activeTab, setActiveTab] = React.useState<AppTab>('DOWNLOADER');
  
  // Downloader State with Persistence
  const [urls, setUrls] = React.useState<string>(() => localStorage.getItem('yt_urls') || '');
  const [thumbnails, setThumbnails] = React.useState<VideoThumbnail[]>(() => {
    const saved = localStorage.getItem('yt_thumbnails');
    return saved ? JSON.parse(saved) : [];
  });
  const [status, setStatus] = React.useState<AppStatus>(AppStatus.IDLE);
  const [aiAnalysis, setAiAnalysis] = React.useState<AiAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = React.useState(false);

  // Persistence Effects
  React.useEffect(() => {
    localStorage.setItem('yt_urls', urls);
    localStorage.setItem('yt_thumbnails', JSON.stringify(thumbnails));
  }, [urls, thumbnails]);

  // Creative Lab State
  const [creativePrompt, setCreativePrompt] = React.useState('');
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>('16:9');
  const [imgSize, setImgSize] = React.useState<ImageSize>('1K');
  const [generatedResult, setGeneratedResult] = React.useState<string | null>(null);
  const [creativeType, setCreativeType] = React.useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [veoProgress, setVeoProgress] = React.useState('');

  // Voice State
  const [isLiveActive, setIsLiveActive] = React.useState(false);

  // Chat State
  const [chatInput, setChatInput] = React.useState('');
  const [chatHistory, setChatHistory] = React.useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [isChatLoading, setIsChatLoading] = React.useState(false);

  const sessionRef = React.useRef<any>(null);

  const handleFetch = React.useCallback(async () => {
    if (!urls.trim()) return;
    setStatus(AppStatus.LOADING);
    const results = urls.split('\n')
      .map(u => u.trim())
      .filter(u => u !== '')
      .map(u => createThumbnailObject(u))
      .filter((v): v is VideoThumbnail => v !== null);
    
    setThumbnails(results);
    
    if (results.length > 0) {
      setStatus(AppStatus.SUCCESS);
      setIsAiLoading(true);
      try {
        const analysis = await analyzeContentBatch(results.map(r => r.id));
        setAiAnalysis(analysis);
      } catch (err) {
        console.error('AI Analysis failed:', err);
      } finally {
        setIsAiLoading(false);
      }
    } else {
      setStatus(AppStatus.ERROR);
    }
  }, [urls]);

  const handleClear = () => {
    setUrls('');
    setThumbnails([]);
    setAiAnalysis(null);
    setStatus(AppStatus.IDLE);
    localStorage.removeItem('yt_urls');
    localStorage.removeItem('yt_thumbnails');
  };

  const handleDownloadAll = async () => {
    for (const thumb of thumbnails) {
      await downloadImage(thumb.resolutions.max, `yt-thumb-${thumb.id}.jpg`);
      await new Promise(r => setTimeout(r, 400));
    }
  };

  const startLiveSession = async () => {
    if (isLiveActive && sessionRef.current) {
      sessionRef.current.then((s: any) => s.close());
      setIsLiveActive(false);
      return;
    }

    try {
      const ai = getAi();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      let nextStartTime = 0;
      const sources = new Set<AudioBufferSourceNode>();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            const interrupted = msg.serverContent?.interrupted;
            if (interrupted) {
              sources.forEach(s => s.stop());
              sources.clear();
              nextStartTime = 0;
            }
            const audioStr = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioStr) {
              nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(audioStr), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => sources.delete(source));
              source.start(nextStartTime);
              nextStartTime += buffer.duration;
              sources.add(source);
            }
          },
          onclose: () => setIsLiveActive(false)
        },
        config: { 
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err) { console.error(err); }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await sendChatMessage(chatInput, chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })), isThinking, true);
      setChatHistory(prev => [...prev, { 
        role: 'model', 
        text: response.text, 
        isThinking,
        groundingUrls: response.grounding.map((g: any) => ({ title: (g.web || g.maps)?.title || 'Source', uri: (g.web || g.maps)?.uri || '#' }))
      }]);
    } catch (err) { console.error(err); }
    finally { setIsChatLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row font-sans selection:bg-red-500 selection:text-white">
      {/* Sidebar */}
      <aside className="hidden md:flex w-24 flex-col items-center py-10 bg-[#111111] border-r border-white/5 space-y-8 sticky top-0 h-screen">
        <div className="w-12 h-12 bg-gradient-to-tr from-red-600 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20 mb-10">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M10 15l5.19-3L10 9v6zM22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z"/></svg>
        </div>
        {[
          { id: 'DOWNLOADER', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
          { id: 'CREATIVE', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
          { id: 'VOICE', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
          { id: 'CHAT', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' }
        ].map(item => (
          <button 
            key={item.id} 
            onClick={() => setActiveTab(item.id as AppTab)}
            className={`group relative p-4 rounded-2xl transition-all duration-300 ${activeTab === item.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
            {activeTab === item.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-500 rounded-r-full" />}
          </button>
        ))}
      </aside>

      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md px-8 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center space-x-3">
             <span className="text-xl font-black tracking-tighter uppercase">{activeTab}</span>
             <div className="h-4 w-[1px] bg-white/10" />
             <span className="text-xs text-gray-500 font-mono tracking-widest uppercase">Project Studio v2.1</span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Workspace Status</p>
              <p className="text-xs font-mono">{thumbnails.length} Videos Loaded</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border border-white/10 shadow-lg flex items-center justify-center font-bold">G</div>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto p-6 md:p-10 custom-scrollbar pb-24 md:pb-10">
          
          {activeTab === 'DOWNLOADER' && (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 shadow-2xl">
                    <h2 className="text-lg font-bold mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Command Center
                    </h2>
                    <textarea 
                      className="w-full h-64 bg-black/40 p-5 rounded-2xl border border-white/5 focus:ring-1 focus:ring-red-500/50 transition-all font-mono text-xs leading-relaxed resize-none mb-4 placeholder:text-gray-700"
                      placeholder="Paste YouTube Links here (one per line)... Max 50 links recommended for best results."
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                    />
                    <p className="text-[10px] text-gray-600 font-bold mb-6 italic">* Tip: Batches of 20-30 URLs work fastest.</p>
                    <div className="space-y-3">
                      <button 
                        onClick={handleFetch} 
                        disabled={status === AppStatus.LOADING || !urls.trim()}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-800 h-14 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-900/10 active:scale-95 flex items-center justify-center"
                      >
                        {status === AppStatus.LOADING ? (
                          <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : 'Analyze & Process'}
                      </button>
                      <button onClick={handleClear} className="w-full bg-white/5 hover:bg-white/10 hover:text-red-400 active:bg-red-900/20 h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-400 transition-all border border-white/5">
                        Clear Workspace
                      </button>
                    </div>
                  </div>
                  
                  {thumbnails.length > 0 && (
                    <div className="bg-gradient-to-br from-emerald-900/20 to-green-900/10 p-6 rounded-3xl border border-emerald-500/20 shadow-2xl">
                       <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Batch Actions</p>
                       <button onClick={handleDownloadAll} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold text-xs uppercase transition-all flex items-center justify-center space-x-2">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         <span>Download All</span>
                       </button>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8">
                  {thumbnails.length === 0 ? (
                    <div className="h-[500px] rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center p-10 bg-white/5">
                       <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                         <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       </div>
                       <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter text-white/40">Workspace Empty</h3>
                       <p className="text-gray-600 max-w-xs text-sm">Input your YouTube links and click "Analyze" to generate high-res downloads and AI metadata.</p>
                    </div>
                  ) : (
                    <div className="space-y-10">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                         {thumbnails.map(v => <ThumbnailCard key={v.id} video={v} />)}
                       </div>
                       {isAiLoading && <div className="p-20 flex flex-col items-center justify-center bg-white/5 rounded-3xl animate-pulse"><p className="text-xs font-bold uppercase tracking-widest text-gray-600">Deep Content Analysis in Progress...</p></div>}
                       {aiAnalysis && !isAiLoading && <AiSection analysis={aiAnalysis} />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CREATIVE' && (
             <div className="max-w-4xl mx-auto animate-in fade-in duration-700 space-y-10">
                <div className="bg-[#111111] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                   <div className="flex justify-between items-center mb-10">
                     <h2 className="text-3xl font-black tracking-tighter uppercase italic">Creative Studio</h2>
                     <div className="flex bg-black p-1 rounded-xl">
                       <button onClick={() => setCreativeType('IMAGE')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${creativeType === 'IMAGE' ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-white'}`}>IMAGES</button>
                       <button onClick={() => setCreativeType('VIDEO')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${creativeType === 'VIDEO' ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-white'}`}>VIDEOS</button>
                     </div>
                   </div>
                   
                   <textarea 
                     className="w-full h-32 bg-black/50 p-6 rounded-2xl border border-white/5 mb-8 focus:ring-1 focus:ring-indigo-500 text-lg placeholder:text-gray-800"
                     placeholder="Unleash your imagination... Describe anything."
                     value={creativePrompt}
                     onChange={(e) => setCreativePrompt(e.target.value)}
                   />
                   
                   <div className="grid grid-cols-2 gap-4 mb-8">
                     <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Aspect Ratio</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as any)} className="w-full bg-transparent font-bold">
                          {['1:1', '4:3', '16:9', '9:16'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                     </div>
                     <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Output Res</label>
                        <select value={imgSize} onChange={(e) => setImgSize(e.target.value as any)} className="w-full bg-transparent font-bold">
                          {['1K', '2K', '4K'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                   </div>

                   <button 
                     onClick={async () => {
                       if (typeof (window as any).aistudio !== 'undefined') {
                         if (!(await (window as any).aistudio.hasSelectedApiKey())) {
                           await (window as any).aistudio.openSelectKey();
                         }
                       }
                       setIsGenerating(true);
                       try {
                         if (creativeType === 'IMAGE') setGeneratedResult(await generateImage(creativePrompt, aspectRatio, imgSize));
                         else {
                           setVeoProgress('Spinning up Veo 3 engine...');
                           setGeneratedResult(await generateVideo(creativePrompt, aspectRatio === '9:16' ? '9:16' : '16:9'));
                         }
                       } catch (e) { console.error(e); }
                       finally { setIsGenerating(false); setVeoProgress(''); }
                     }} 
                     className="w-full bg-indigo-600 hover:bg-indigo-700 h-16 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-3"
                   >
                     {isGenerating ? (
                       <span className="flex items-center space-x-3">
                         <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         <span>{veoProgress || 'Dreaming...'}</span>
                       </span>
                     ) : (
                       <span>Magic Generate</span>
                     )}
                   </button>
                </div>

                {generatedResult && (
                  <div className="rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl bg-[#111111] animate-in zoom-in duration-500">
                    {creativeType === 'IMAGE' ? <img src={generatedResult} className="w-full" /> : <video src={generatedResult} controls autoPlay className="w-full" />}
                    <div className="p-8 flex justify-between items-center bg-black/40">
                      <div><p className="font-bold text-sm tracking-tight">AI Generated Asset</p><p className="text-[10px] text-gray-500 font-mono">ID: {Math.random().toString(36).substr(2, 9)}</p></div>
                      <a href={generatedResult} download className="bg-white text-black px-6 py-2 rounded-xl font-bold text-xs uppercase transition-all hover:bg-gray-200">Export Raw</a>
                    </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'VOICE' && (
             <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-700">
               <div className="relative mb-20">
                  <div className={`absolute -inset-20 bg-purple-600/10 blur-[100px] rounded-full transition-all duration-1000 ${isLiveActive ? 'scale-150 opacity-100' : 'scale-50 opacity-0'}`}></div>
                  <button 
                    onClick={startLiveSession}
                    className={`relative w-64 h-64 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-2xl ${isLiveActive ? 'border-purple-500 bg-purple-600 scale-110 shadow-purple-500/30' : 'border-white/10 bg-[#111111] hover:border-purple-500/50 group'}`}
                  >
                    <svg className={`w-24 h-24 ${isLiveActive ? 'text-white' : 'text-purple-500 group-hover:scale-110 transition-transform'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  </button>
               </div>
               <h2 className={`text-4xl font-black tracking-tighter uppercase mb-2 ${isLiveActive ? 'text-purple-400' : 'text-white'}`}>
                 {isLiveActive ? 'Live Audio Session' : 'Voice Studio'}
               </h2>
               <p className="text-gray-500 font-mono tracking-widest text-[10px] uppercase">Low Latency Real-time Interactions</p>
             </div>
          )}

          {activeTab === 'CHAT' && (
            <div className="max-w-4xl mx-auto h-full flex flex-col animate-in slide-in-from-right-2 duration-500">
               <div className="flex-grow overflow-y-auto space-y-6 pb-10 px-2 scroll-smooth">
                 {chatHistory.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-gray-700 italic">
                     <p className="text-xl font-light">Ask Gemini for Scripting, SEO, or Insights...</p>
                   </div>
                 )}
                 {chatHistory.map((m, i) => (
                   <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-5 rounded-3xl shadow-xl ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-[#111111] border border-white/5'}`}>
                        {m.isThinking && <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-2">3.0 PRO Reasoning</p>}
                        <p className="text-sm leading-relaxed">{m.text}</p>
                        {m.groundingUrls && m.groundingUrls.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Linked Sources</p>
                             {m.groundingUrls.map((g, gi) => <a key={gi} href={g.uri} target="_blank" className="text-[11px] text-blue-400 hover:underline block truncate">• {g.title}</a>)}
                          </div>
                        )}
                      </div>
                   </div>
                 ))}
                 {isChatLoading && <div className="flex justify-start"><div className="bg-[#111111] px-6 py-4 rounded-full border border-white/5 animate-pulse"><div className="flex space-x-1"><div className="w-1 h-1 bg-white/40 rounded-full animate-bounce"></div><div className="w-1 h-1 bg-white/40 rounded-full animate-bounce delay-100"></div><div className="w-1 h-1 bg-white/40 rounded-full animate-bounce delay-200"></div></div></div></div>}
               </div>
               
               <div className="bg-[#111111] p-2 rounded-3xl border border-white/10 flex items-center shadow-2xl mb-10">
                 <button onClick={() => setIsThinking(!isThinking)} className={`p-4 rounded-2xl transition-all ${isThinking ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 </button>
                 <input 
                    className="flex-grow bg-transparent px-4 py-4 focus:outline-none font-medium placeholder:text-gray-700" 
                    placeholder="Ask Gemini anything about your project..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                 />
                 <button onClick={handleChat} disabled={isChatLoading || !chatInput} className="bg-white text-black p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7" /></svg>
                 </button>
               </div>
            </div>
          )}

        </div>

        {/* Bottom Navigation for Mobile */}
        <nav className="md:hidden h-20 bg-[#111111] border-t border-white/5 flex items-center justify-around px-4 sticky bottom-0 z-50">
          {[
            { id: 'DOWNLOADER', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
            { id: 'CREATIVE', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
            { id: 'VOICE', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
            { id: 'CHAT', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as AppTab)} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === item.id ? 'text-red-500' : 'text-gray-500'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
              <span className="text-[8px] font-black uppercase mt-1 tracking-tighter">{item.id}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
