"use client";

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  History, 
  Settings, 
  RefreshCcw, 
  CodeXml,
  LogOut,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import StandupGenerator from '@/components/StandupGenerator';
import Auth from '@/components/Auth';
import AnalyticsCards from '@/components/AnalyticsCards';

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [standupsCount, setStandupsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchStats = async () => {
    if (!session?.user?.id) return;
    const { count } = await supabase
      .from('history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);
    
    if (count !== null) setStandupsCount(count);
  };

  useEffect(() => {
    if (session) fetchStats();
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-950 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <CodeXml size={20} />
          </div>
          <span className="text-xl font-black tracking-tighter">Shadow</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <a href="/" className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl text-blue-400 group transition-all">
            <LayoutDashboard size={20} />
            <span className="font-bold">Dashboard</span>
          </a>
          <a href="/history" className="flex items-center gap-3 p-3 hover:bg-gray-900 rounded-xl text-gray-400 hover:text-white transition-all">
            <History size={20} />
            <span className="font-bold">History</span>
          </a>
          <a href="/settings" className="flex items-center gap-3 p-3 hover:bg-gray-900 rounded-xl text-gray-400 hover:text-white transition-all">
            <Settings size={20} />
            <span className="font-bold">Settings</span>
          </a>
        </nav>

        <div className="p-4 border-t border-gray-900 bg-gray-950/50 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-2xl border border-gray-800/50">
            <img 
              src={session.user.user_metadata.avatar_url} 
              className="w-10 h-10 rounded-full border border-gray-700 shadow-sm" 
              alt="Avatar"
            />
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-black text-white truncate">{session.user.user_metadata.full_name || 'User'}</span>
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest truncate">{session.user.email}</span>
            </div>
          </div>
          
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 p-3 text-xs font-black text-red-400 uppercase tracking-widest hover:bg-red-500/10 rounded-2xl transition-all border border-transparent hover:border-red-500/20 active:scale-[0.98]"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 border-b border-gray-200 px-8 py-6 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter">Welcome, {session.user.user_metadata.full_name?.split(' ')[0]}</h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Auth session active • Shadowing {session.user.user_metadata.user_name}</p>
          </div>
          
          <button 
            onClick={fetchStats}
            className="p-3 text-gray-400 hover:text-blue-600 transition-all rounded-2xl hover:bg-blue-50 border border-transparent hover:border-blue-100 shadow-sm"
          >
            <RefreshCcw size={20} />
          </button>
        </header>

        <div className="p-8 space-y-8 max-w-7xl mx-auto">
          <AnalyticsCards />

          <div className="bg-white rounded-[32px] border-2 border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 animate-pulse">
                  <Sparkles size={20} />
                </div>
                <h2 className="text-xl font-black text-gray-900 tracking-tighter">AI Standup Generator</h2>
              </div>
            </div>
            
            <div className="p-8">
              <StandupGenerator onGenerated={fetchStats} userId={session.user.id} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
