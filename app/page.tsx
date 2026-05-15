'use client';

import { useState, useEffect } from 'react';
import { accounts } from '@/lib/data';
import { calculateHealthScore } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Home() {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]);
  const [analysis, setAnalysis] = useState<any>('');
  const [loading, setLoading] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAnalysis('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setAnalysis('');
  }, [selectedAccount]);

  const handleAnalysis = async (type: string) => {
    setLoading(true);
    
    const thinkingMessages: Record<string, string> = {
      health: 'Analyzing account health signals across usage, support, and engagement patterns...',
      expansion: 'Identifying expansion opportunities and calculating ARR lift potential...',
      briefing: 'Synthesizing executive summary with risk assessment and strategic recommendations...',
      email: 'Composing personalized outreach based on recent account activity...',
    };
    setThinkingMessage(thinkingMessages[type]);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: selectedAccount, type }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        setAnalysis(`ERROR: ${data.error}\nDetails: ${data.details || 'No details'}`);
      } else {
        setAnalysis(data.analysis || 'No analysis returned');
      }
    } catch (error: any) {
      setAnalysis(`ERROR: ${error.message}`);
    }
    setLoading(false);
  };

  const getHealthColor = (score: number) => {
    if (score >= 70) return { border: 'border-l-green-500', bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' };
    if (score >= 50) return { border: 'border-l-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-500' };
    return { border: 'border-l-red-500', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' };
  };

  const getHealthLabel = (score: number) => {
    if (score >= 70) return { text: 'Healthy', color: 'text-green-400' };
    if (score >= 50) return { text: 'At Risk', color: 'text-yellow-400' };
    return { text: 'At Risk', color: 'text-red-400' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center space-x-4">
            {/* Lighthouse SVG Logo */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4L20 16H28L24 4Z" fill="#3b82f6" />
              <rect x="22" y="16" width="4" height="8" fill="#60a5fa" />
              <path d="M18 24L16 28H32L30 24H18Z" fill="#3b82f6" />
              <path d="M16 28L14 32H34L32 28H16Z" fill="#60a5fa" />
              <path d="M14 32L12 36H36L34 32H14Z" fill="#3b82f6" />
              <rect x="10" y="36" width="28" height="8" rx="1" fill="#1e40af" />
              <circle cx="24" cy="12" r="2" fill="#fbbf24" className="animate-pulse" />
            </svg>
            <div>
              <h1 className="text-4xl font-bold text-white">Lighthouse</h1>
              <p className="text-blue-300 mt-1">AI-Powered Account Intelligence for Customer Success Teams</p>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-3">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                <span className="text-green-400 font-medium">Live</span>
              </div>
              <div className="h-4 w-px bg-slate-700"></div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Portfolio:</span>
                <span className="font-semibold text-white">{accounts.length} accounts</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Total ARR:</span>
                <span className="font-semibold text-white">
                  ${(accounts.reduce((sum, acc) => sum + acc.arr, 0) / 1000000).toFixed(2)}M
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Portfolio Sidebar */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-5">
            <h2 className="font-semibold text-white mb-4">Portfolio Health</h2>
            <div className="space-y-2">
              {accounts
                .map(acc => ({ ...acc, health: calculateHealthScore(acc) }))
                .sort((a, b) => a.health - b.health)
                .map(acc => {
                  const colors = getHealthColor(acc.health);
                  return (
                    <button
                      key={acc.id}
                      onClick={() => setSelectedAccount(acc)}
                      className={`w-full text-left p-3 rounded-lg transition-all border-l-4 ${
                        selectedAccount.id === acc.id 
                          ? `${colors.bg} ${colors.border} shadow-lg` 
                          : 'bg-slate-900/50 border-l-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-white">{acc.name}</span>
                        <div className={`w-2 h-2 rounded-full ${colors.dot}`}></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-semibold ${colors.text}`}>{acc.health}/100</span>
                        <span className="text-xs text-slate-400">${(acc.arr / 1000).toFixed(0)}K</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Account Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedAccount.name}</h2>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-md text-xs font-semibold ${
                    getHealthLabel(calculateHealthScore(selectedAccount)).color
                  } bg-red-500/10 border border-red-500/30`}>
                    {getHealthLabel(calculateHealthScore(selectedAccount)).text}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Health Score</p>
                  <p className={`text-4xl font-bold ${getHealthColor(calculateHealthScore(selectedAccount)).text}`}>
                    {calculateHealthScore(selectedAccount)}
                    <span className="text-lg text-slate-500">/100</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Critical Risk</p>
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-400 font-medium mb-1">ARR</p>
                  <p className="text-xl font-bold text-white">${selectedAccount.arr.toLocaleString()}</p>
                  <p className="text-xs text-red-400 mt-1">
                    ↓ 18%
                  </p>
                  <p className="text-xs text-slate-500">vs prior 90 days</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-400 font-medium mb-1">Seat Utilization</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-xl font-bold text-white">
                      {Math.round((selectedAccount.seats_active/selectedAccount.seats_total)*100)}%
                    </p>
                    <span className={`text-xs font-semibold ${
                      selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] ? '↑' : '↓'}
                      {Math.abs(Math.round(((selectedAccount.monthly_active_users[4] - selectedAccount.monthly_active_users[0]) / selectedAccount.monthly_active_users[0]) * 100))}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedAccount.seats_active}/{selectedAccount.seats_total} seats
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-400 font-medium mb-1">NPS</p>
                  <p className="text-xl font-bold text-white">{selectedAccount.nps_score}</p>
                  <p className="text-xs text-red-400 mt-1">↓ 30</p>
                  <p className="text-xs text-slate-500">vs company avg.</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-400 font-medium mb-1">Support Load</p>
                  <p className={`text-xl font-bold ${
                    selectedAccount.support_tickets_30d > 15 ? 'text-red-400' : 'text-white'
                  }`}>
                    {selectedAccount.support_tickets_30d}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">tickets (30d)</p>
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex items-center flex-wrap gap-3 text-xs pt-4 border-t border-slate-700">
                <div className="flex items-center space-x-2 bg-slate-900/50 px-3 py-1.5 rounded-md border border-slate-700">
                  <span className="text-slate-400">Analysis Confidence:</span>
                  <span className="font-semibold text-green-400">High</span>
                </div>
                <div className="flex items-center space-x-2 bg-slate-900/50 px-3 py-1.5 rounded-md border border-slate-700">
                  <span className="text-slate-400">Data Quality:</span>
                  <span className="font-semibold text-green-400">Complete</span>
                </div>
                <div className="flex items-center space-x-2 bg-slate-900/50 px-3 py-1.5 rounded-md border border-slate-700">
                  <span className="text-slate-400">Last Updated:</span>
                  <span className="font-semibold text-white">2m ago</span>
                </div>
              </div>
            </div>

            {/* AI Analysis Panel */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">AI Intelligence Layer</h3>
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { type: 'health', icon: '🤖', label: 'AI Health Analysis' },
                  { type: 'expansion', icon: '⚙️', label: 'Expansion Plays' },
                  { type: 'briefing', icon: '📋', label: 'Executive Briefing' },
                  { type: 'email', icon: '✉️', label: 'Draft Email' },
                ].map(btn => (
                  <button 
                    key={btn.type}
                    onClick={() => handleAnalysis(btn.type)} 
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <span>{btn.icon}</span>
                      <span className="hidden xl:inline">{btn.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {loading && (
                <div className="text-center py-8 bg-slate-900/50 border border-slate-700 rounded-lg">
                  <div className="inline-flex items-center space-x-3">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-slate-300 font-medium">{thinkingMessage}</span>
                  </div>
                </div>
              )}

              {analysis && !loading && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-white">AI Health Analysis</h4>
                    <button 
                      onClick={() => setAnalysis('')}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                    >
                      Clear (ESC)
                    </button>
                  </div>

                  {/* Structured Cards - Dark Theme */}
                  {typeof analysis === 'object' && analysis.summary && (
                    <>
                      {/* Summary Card */}
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h5 className="text-sm font-semibold text-blue-400 mb-2">2-Sentence Summary</h5>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
                      </div>

                      {/* MAU Chart */}
                      {analysis.risks && selectedAccount && (
                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-white mb-3">Monthly Active Users</h5>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart
                              data={selectedAccount.monthly_active_users.map((value, i) => ({
                                month: ['Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
                                users: value
                              }))}
                              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                            >
                              <XAxis 
                                dataKey="month" 
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                axisLine={{ stroke: '#334155' }}
                              />
                              <YAxis 
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                axisLine={{ stroke: '#334155' }}
                                domain={['dataMin - 20', 'dataMax + 20']}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1e293b', 
                                  border: '1px solid #334155', 
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '12px'
                                }}
                                formatter={(value: any) => [`${value} users`, 'MAU']}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="users" 
                                stroke={selectedAccount.monthly_active_users[4] < selectedAccount.monthly_active_users[0] ? '#ef4444' : '#10b981'}
                                strokeWidth={3}
                                dot={{ fill: selectedAccount.monthly_active_users[4] < selectedAccount.monthly_active_users[0] ? '#ef4444' : '#10b981', r: 5 }}
                                activeDot={{ r: 7 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Risks Section */}
                      {analysis.risks && analysis.risks.length > 0 && (
                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-white mb-3 flex items-center">
                            <span className="text-red-400 mr-2">⚠️</span>
                            Risks
                          </h5>
                          <div className="space-y-3">
                            {analysis.risks.map((risk: any, i: number) => (
                              <div key={i} className="border-l-4 border-red-500 pl-3 bg-red-500/5 py-2">
                                <div className="flex items-start justify-between mb-1">
                                  <span className="text-sm font-semibold text-white">{risk.title}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    risk.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                                    risk.severity === 'High' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {risk.severity}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-300">{risk.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommended Action */}
                      {analysis.recommendation && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-white mb-2 flex items-center">
                            <span className="text-blue-400 mr-2">⚡</span>
                            AI Recommended Action
                          </h5>
                          <p className="text-sm text-slate-300 mb-3">{analysis.recommendation.description}</p>
                          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
                            {analysis.recommendation.cta || 'View Action Plan'} →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Keyboard Hint */}
        <div className="fixed bottom-4 right-4 text-xs text-slate-400 bg-slate-800/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700">
          Press <span className="font-mono bg-slate-700 px-1.5 py-0.5 rounded font-semibold text-white">ESC</span> to clear analysis
        </div>
      </div>
    </div>
  );
}