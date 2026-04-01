"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Sparkles, 
  ChevronDown, 
  GitCommit, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle,
  Clock,
  CheckSquare,
  Square
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function StandupGenerator({ 
  onGenerated, 
  userId 
}: { 
  onGenerated?: () => void;
  userId?: string;
}) {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedShas, setSelectedShas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCommits, setFetchingCommits] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
      setToken(savedToken);
      fetchRepos(savedToken);
    }
    setCheckingAuth(false);
  }, []);

  const fetchRepos = async (authToken: string) => {
    try {
      const res = await fetch('/api/github-all-repos', {
        headers: { 'x-github-token': authToken }
      });
      const data = await res.json();
      if (data.success) {
        setRepos(data.repos);
      } else {
        setError(data.error || 'Failed to load repositories.');
      }
    } catch (err) {
      setError('Failed to load repositories.');
    }
  };

  const handleRepoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fullRepo = e.target.value;
    setSelectedRepo(fullRepo);
    setSelectedShas([]);
    setCommits([]);

    if (fullRepo && token) {
      const [owner, repo] = fullRepo.split('/');
      setFetchingCommits(true);
      try {
        const res = await fetch(`/api/commits?owner=${owner}&repo=${repo}`, {
          headers: { 'x-github-token': token }
        });
        const data = await res.json();
        if (data.success) setCommits(data.commits);
      } catch (err) {
        setError('Failed to fetch commits.');
      } finally {
        setFetchingCommits(false);
      }
    }
  };

  const toggleSha = (sha: string) => {
    setSelectedShas(prev => 
      prev.includes(sha) ? prev.filter(s => s !== sha) : [...prev, sha]
    );
  };

  const selectLast24Hours = () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const shas = commits
      .filter(c => new Date(c.date) > yesterday)
      .map(c => c.sha);
    setSelectedShas(shas);
  };

  const generateStandup = async () => {
    if (!selectedRepo || !token) return;
    setLoading(true);
    setError('');
    
    const [owner, repo] = selectedRepo.split('/');
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-github-token': token
        },
        body: JSON.stringify({ owner, repo, commitShas: selectedShas, userId }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.summary);
        if (onGenerated) onGenerated();
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch (err) {
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-widest">Checking Authentication...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="bg-white rounded-[40px] border-2 border-gray-100 p-12 text-center space-y-8 shadow-sm">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center mx-auto shadow-inner">
          <ShieldCheck size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Welcome to Shadow Standup!</h2>
          <p className="text-gray-500 font-medium max-w-sm mx-auto leading-relaxed text-sm">
            To generate reports from your GitHub activity, you need to configure your Personal Access Token (PAT).
          </p>
        </div>
        <a 
          href="/settings"
          className="inline-flex items-center gap-3 bg-gray-950 text-white font-black py-4 px-10 rounded-2xl hover:bg-blue-600 transition-all active:scale-[0.98] shadow-xl shadow-gray-500/10 uppercase tracking-widest text-xs"
        >
          <Plus size={18} />
          Configure GitHub Token
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: Config */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Repository</label>
            <div className="relative group">
              <select 
                value={selectedRepo}
                onChange={handleRepoChange}
                className="w-full bg-white border-2 border-gray-100 rounded-2xl p-4 pl-12 appearance-none focus:border-blue-500 transition-all font-bold text-gray-800 outline-none hover:border-gray-200 cursor-pointer shadow-sm"
              >
                <option value="">Choose a repo...</option>
                {repos.map((r) => (
                  <option key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                    {r.owner}/{r.name}
                  </option>
                ))}
              </select>
              <GitCommit className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>

          {selectedRepo && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Recent Activity</label>
                <button 
                  onClick={selectLast24Hours}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 flex items-center gap-1.5 transition-colors"
                >
                  <Clock size={12} />
                  Select Last 24 Hours
                </button>
              </div>

              <div className="bg-gray-50/50 rounded-3xl border border-gray-100 overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {fetchingCommits ? (
                    <div className="p-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold uppercase tracking-widest">Fetching...</span>
                    </div>
                  ) : commits.length > 0 ? (
                    commits.map((c) => (
                      <div 
                        key={c.sha}
                        onClick={() => toggleSha(c.sha)}
                        className={`flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer group ${
                          selectedShas.includes(c.sha) 
                            ? 'bg-white border border-blue-100 shadow-sm' 
                            : 'hover:bg-white/80 border border-transparent'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {selectedShas.includes(c.sha) ? (
                            <CheckSquare size={18} className="text-blue-600" />
                          ) : (
                            <Square size={18} className="text-gray-300 group-hover:text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${selectedShas.includes(c.sha) ? 'text-gray-900' : 'text-gray-700'}`}>
                            {c.message}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
                            {new Date(c.date).toLocaleTimeString()} • {c.author}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">No commits found.</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={generateStandup}
                disabled={loading || selectedShas.length === 0}
                className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-6 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-blue-500/20 group uppercase tracking-widest text-sm"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Shadowing Diffs...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                    Generate AI Standup ({selectedShas.length})
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in zoom-in duration-300">
              <AlertCircle size={20} />
              <p className="text-sm font-bold italic">{error}</p>
            </div>
          )}
        </div>

        {/* Right Side: Preview */}
        <div className="relative">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className={`bg-white rounded-3xl border-2 transition-all duration-700 overflow-hidden ${
            result ? 'border-blue-100 shadow-2xl' : 'border-gray-100 bg-gray-50/30'
          }`}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Output Preview</span>
              {result && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full">
                  <CheckCircle2 size={12} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Draft Ready</span>
                </div>
              )}
            </div>
            
            <div className="p-8 max-h-[500px] overflow-y-auto custom-scrollbar prose prose-sm prose-blue max-w-none">
              {result ? (
                <div className="animate-in fade-in duration-1000">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                  <ShieldCheck size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-bold italic text-center px-8">
                    Select repositories and commits to see the AI magic here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
