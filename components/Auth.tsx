"use client";

import React from 'react';
import { supabase } from '@/lib/supabase';
import { CodeXml, Sparkles } from 'lucide-react';

export default function Auth() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'repo',
        redirectTo: window.location.origin
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative">
        <div className="mb-12 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/20 animate-pulse">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">Shadow Standup</h1>
          <p className="text-gray-400 font-medium">Automated developer documentation agent.</p>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl shadow-2xl">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-sm text-gray-500">Sign in with your GitHub account to continue.</p>
            </div>

            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-950 font-bold py-4 px-6 rounded-2xl hover:bg-gray-100 transition-all active:scale-[0.98] shadow-lg shadow-white/5"
            >
              <CodeXml size={20} />
              Sign in with GitHub
            </button>

            <p className="text-[10px] text-gray-600 text-center uppercase tracking-widest font-bold">
              Secure authentication via Supabase
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to allow Shadow to read repository activity for standup generation.
          </p>
        </div>
      </div>
    </div>
  );
}
