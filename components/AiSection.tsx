
import * as React from 'react';
import { AiAnalysis } from '../types';

interface AiSectionProps {
  analysis: AiAnalysis;
}

// Using standard function declaration to improve type compatibility and resolve JSX errors in some environments.
export default function AiSection({ analysis }: AiSectionProps) {
  return (
    <div className="mt-12 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-2xl p-8 border border-white/10">
      <div className="flex items-center mb-6">
        <div className="p-2 bg-indigo-600 rounded-lg mr-4">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">AI Content Strategy</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Suggested Catchy Titles</h3>
          <ul className="space-y-3">
            {analysis.suggestedTitles.map((title, idx) => (
              <li key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 text-gray-200">
                {title}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-4">Social Media Snippet</h3>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-gray-300 italic text-sm leading-relaxed">
              "{analysis.socialDescription}"
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-pink-400 uppercase tracking-widest mb-4">SEO Tags</h3>
            <div className="flex flex-wrap gap-2">
              {analysis.tags.map((tag, idx) => (
                <span key={idx} className="bg-white/5 px-3 py-1 rounded-full text-xs text-gray-400 border border-white/10">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
