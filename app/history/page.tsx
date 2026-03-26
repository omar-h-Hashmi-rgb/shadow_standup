"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Calendar, 
  ChevronRight, 
  GitBranch, 
  History, 
  Loader2, 
  MessageSquare 
} from 'lucide-react';

export default function HistoryPage() {
  const [session, setSession] = useState<any>(null);
  const [standups, setStandups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStandup, setSelectedStandup] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session) {
      fetchHistory();
    }
  }, [session]);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (data) setStandups(data);
    setLoading(false);
  };

  if (!session && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <p className="text-gray-500">Please sign in to view your history.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white/80 border-b border-gray-200 px-8 py-6 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 hover:text-blue-600 border border-transparent hover:border-gray-200">
              <ArrowLeft size={20} />
            </a>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tighter">Generation History</h1>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">All your AI-generated standup drafts in one place.</p>
            </div>
          </div>
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
            <History size={20} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <Loader2 size={40} className="animate-spin mb-4" />
            <p className="font-bold uppercase tracking-widest text-xs">Syncing History...</p>
          </div>
        ) : standups.length > 0 ? (
          <div className="space-y-6">
            {standups.map((item) => (
              <div key={item.id} className="bg-white rounded-[32px] border-2 border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group overflow-hidden">
                <div className="p-8 flex flex-col md:flex-row gap-8 md:items-center justify-between">
                  <div className="flex items-start gap-6 flex-1">
                    <div className="p-4 bg-gray-50 text-gray-400 group-hover:bg-blue-600 group-hover:text-white rounded-2xl transition-all shrink-0 shadow-sm">
                      <GitBranch size={24} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tighter">
                        {item.owner}/{item.repo}
                        <ChevronRight size={16} className="text-gray-300" />
                      </h3>
                      <div className="flex items-center gap-6 text-xs text-gray-400 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full">
                          <Calendar size={14} className="text-gray-400" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">
                          <MessageSquare size={14} />
                          {item.commits_count || 0} Commit Info
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <button 
                      onClick={() => setSelectedStandup(item)}
                      className="px-8 py-3.5 text-sm font-black bg-gray-950 text-white rounded-2xl hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98] uppercase tracking-widest"
                    >
                      View Report
                    </button>
                  </div>
                </div>
                
                <div className="px-8 pb-8 pt-0 mt-[-8px]">
                  <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 text-sm font-medium text-gray-600 line-clamp-2 whitespace-pre-wrap leading-relaxed italic">
                    {item.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 space-y-6">
            <div className="w-24 h-24 bg-gray-100 rounded-[32px] flex items-center justify-center mx-auto text-gray-300">
              <History size={48} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 tracking-tighter">No history found</p>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Generate your first standup to see it here.</p>
            </div>
            <a href="/" className="inline-block px-10 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/30 transition-all active:scale-[0.98] uppercase tracking-widest">
              Go to Dashboard
            </a>
          </div>
        )}
      </main>

      {/* Report Modal */}
      {selectedStandup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-950/60 backdrop-blur-md transition-opacity" 
            onClick={() => setSelectedStandup(null)}
          />
          <div className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-[40px] shadow-2xl border-2 border-white/20 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tighter">{selectedStandup.owner}/{selectedStandup.repo}</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Generated on {new Date(selectedStandup.created_at).toLocaleString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStandup(null)}
                className="p-2.5 hover:bg-gray-200 rounded-xl transition-all text-gray-400 hover:text-gray-950"
              >
                <ChevronRight size={24} className="rotate-90 md:rotate-0" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar prose prose-sm prose-slate max-w-none">
              <div className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">
                {selectedStandup.content}
              </div>
            </div>

            <div className="p-8 bg-gray-50/80 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedStandup(null)}
                className="px-8 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(selectedStandup.content);
                  alert('Copied to clipboard!');
                }}
                className="px-10 py-4 bg-gray-950 text-white rounded-2xl font-black shadow-lg shadow-gray-500/20 hover:bg-gray-800 transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
              >
                Copy Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
