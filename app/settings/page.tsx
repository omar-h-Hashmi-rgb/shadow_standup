"use client";

import React, { useState } from 'react';
import { 
  Settings, 
  CodeXml, 
  Bell, 
  Clock, 
  Save, 
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [githubToken, setGithubToken] = useState('');

  React.useEffect(() => {
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) setGithubToken(savedToken);
  }, []);

  const handleSave = () => {
    localStorage.setItem('github_token', githubToken);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
              <ArrowLeft size={20} />
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
              <p className="text-sm text-gray-500 font-medium">Manage your GitHub integration and preferences.</p>
            </div>
          </div>
          <div className="p-2 bg-gray-100 text-gray-600 rounded-xl">
            <Settings size={24} />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-8">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8 space-y-10">
            {/* GitHub Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gray-950 text-white rounded-lg">
                  <CodeXml size={20} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">GitHub Configuration</h2>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Personal Access Token (Fallback)</label>
                <input 
                  type="password" 
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 focus:bg-white focus:border-blue-500 transition-all font-mono text-sm outline-none"
                />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                  Ensures the app works even if the Supabase session token expires.
                </p>
              </div>
            </section>

            {/* Notifications Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Bell size={20} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Notifications & Delivery</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Preferred Generation Time</label>
                  <div className="relative">
                    <select className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 appearance-none focus:bg-white focus:border-blue-500 transition-all font-bold text-sm outline-none cursor-pointer">
                      <option>5:00 PM</option>
                      <option>6:00 PM</option>
                      <option>9:00 AM</option>
                    </select>
                    <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Slack Webhook URL</label>
                  <input 
                    type="text" 
                    placeholder="https://hooks.slack.com/..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 focus:bg-white focus:border-blue-500 transition-all text-sm outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Save Button */}
            <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium italic">Changes are saved to your local profile.</p>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-blue-600 text-white font-black py-4 px-8 rounded-2xl hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-200 tracking-widest uppercase text-xs"
              >
                {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                {saved ? 'Saved' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
