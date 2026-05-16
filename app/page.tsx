'use client';

import { useState, useEffect } from 'react';
import { accounts } from '@/lib/data';
import { calculateHealthScore } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Bot, TrendingUp, FileText, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

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
    if (score >= 70) return { border: 'border-l-healthy-fg', bg: 'bg-healthy-bg', text: 'text-healthy-fg' };
    if (score >= 50) return { border: 'border-l-[#FFD166]', bg: 'bg-watch-bg', text: 'text-watch-fg' };
    return { border: 'border-l-critical-fg', bg: 'bg-critical-bg', text: 'text-critical-fg' };
  };

  const getHealthLabel = (score: number) => {
    if (score >= 70) return { text: 'Healthy', color: 'text-healthy-fg' };
    if (score >= 50) return { text: 'At Risk', color: 'text-watch-fg' };
    return { text: 'At Risk', color: 'text-critical-fg' };
  };

  return (
    <div 
      className="min-h-screen bg-ocean-canvas p-8"
      style={{
        backgroundImage: `radial-gradient(60% 40% at 80% 10%, rgba(91,168,255,0.10) 0%, transparent 60%),
                         radial-gradient(50% 50% at 10% 90%, rgba(34,185,122,0.05) 0%, transparent 60%)`
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center space-x-4">
            <Image 
              src="/lighthouse-logo.svg" 
              width={56} 
              height={56} 
              alt="Lighthouse" 
              className="shrink-0"
            />
            <div>
              <h1 className="text-4xl font-bold text-fg-1">Lighthouse</h1>
              <p className="text-beam-300 mt-1">AI-Powered Account Intelligence for Customer Success Teams</p>
            </div>
          </div>
          <div className="bg-ocean-1 border border-[#1A2640] rounded-lg px-4 py-3 shadow-card">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-healthy-fg rounded-full animate-pulse"></div>
                <span className="text-healthy-fg font-medium">Live</span>
              </div>
              <div className="h-4 w-px bg-[#1A2640]"></div>
              <div className="flex items-center space-x-2">
                <span className="text-fg-3">Portfolio:</span>
                <span className="font-semibold text-fg-1 tabular-nums">{accounts.length} accounts</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-fg-3">Total ARR:</span>
                <span className="font-semibold text-fg-1 tabular-nums">
                  ${(accounts.reduce((sum, acc) => sum + acc.arr, 0) / 1000000).toFixed(2)}M
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Portfolio Sidebar */}
          <div className="bg-ocean-1 border border-[#1A2640] rounded-lg p-5 shadow-card">
            <h2 className="font-semibold text-fg-1 mb-4">Portfolio Health</h2>
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
                          ? `${colors.bg} ${colors.border} shadow-md` 
                          : 'bg-ocean-inset border-l-[#1A2640] hover:bg-ocean-2'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-fg-1">{acc.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-semibold tabular-nums ${colors.text}`}>{acc.health}/100</span>
                        <span className="text-xs text-fg-3 tabular-nums">${(acc.arr / 1000).toFixed(0)}K</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Account Card */}
            <div className="bg-ocean-1 border border-[#1A2640] rounded-lg p-6 shadow-card">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-fg-1">{selectedAccount.name}</h2>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-md text-xs font-semibold ${
                    getHealthLabel(calculateHealthScore(selectedAccount)).color
                  } ${calculateHealthScore(selectedAccount) < 50 ? 'bg-critical-bg border border-critical-line' : 'bg-watch-bg border border-watch-line'}`}>
                    {getHealthLabel(calculateHealthScore(selectedAccount)).text}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-fg-3 mb-1">Health Score</p>
                  <p className={`text-4xl font-bold tabular-nums ${getHealthColor(calculateHealthScore(selectedAccount)).text}`}>
                    {calculateHealthScore(selectedAccount)}
                    <span className="text-lg text-fg-4">/100</span>
                  </p>
                  <p className="text-xs text-fg-4 mt-1">
                    {calculateHealthScore(selectedAccount) < 50 ? 'Critical Risk' : 'Monitor Closely'}
                  </p>
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-4">
                  <p className="text-xs text-fg-3 font-medium mb-1">ARR</p>
                  <p className="text-xl font-bold text-fg-1 tabular-nums">${selectedAccount.arr.toLocaleString()}</p>
                  <p className="text-xs text-critical-fg mt-1">↓ 18%</p>
                  <p className="text-xs text-fg-4">vs prior 90 days</p>
                </div>
                <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-4">
                  <p className="text-xs text-fg-3 font-medium mb-1">Seat Utilization</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-xl font-bold text-fg-1 tabular-nums">
                      {Math.round((selectedAccount.seats_active/selectedAccount.seats_total)*100)}%
                    </p>
                    <span className={`text-xs font-semibold ${
                      selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] 
                        ? 'text-healthy-fg' 
                        : 'text-critical-fg'
                    }`}>
                      {selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] ? '↑' : '↓'}
                      {Math.abs(Math.round(((selectedAccount.monthly_active_users[4] - selectedAccount.monthly_active_users[0]) / selectedAccount.monthly_active_users[0]) * 100))}%
                    </span>
                  </div>
                  <p className="text-xs text-fg-3 mt-1 tabular-nums">
                    {selectedAccount.seats_active}/{selectedAccount.seats_total} seats
                  </p>
                </div>
                <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-4">
                  <p className="text-xs text-fg-3 font-medium mb-1">NPS</p>
                  <p className="text-xl font-bold text-fg-1 tabular-nums">{selectedAccount.nps_score}</p>
                  <p className="text-xs text-critical-fg mt-1">↓ 30</p>
                  <p className="text-xs text-fg-4">vs company avg.</p>
                </div>
                <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-4">
                  <p className="text-xs text-fg-3 font-medium mb-1">Support Load</p>
                  <p className={`text-xl font-bold tabular-nums ${
                    selectedAccount.support_tickets_30d > 15 ? 'text-critical-fg' : 'text-fg-1'
                  }`}>
                    {selectedAccount.support_tickets_30d}
                  </p>
                  <p className="text-xs text-fg-3 mt-1">tickets (30d)</p>
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex items-center flex-wrap gap-3 text-xs pt-4 border-t border-[#1A2640]">
                <div className="flex items-center space-x-2 bg-ocean-inset px-3 py-1.5 rounded-md border border-[#1A2640]">
                  <span className="text-fg-3">Analysis Confidence:</span>
                  <span className="font-semibold text-healthy-fg">High</span>
                </div>
                <div className="flex items-center space-x-2 bg-ocean-inset px-3 py-1.5 rounded-md border border-[#1A2640]">
                  <span className="text-fg-3">Integration:</span>
                  <span className="font-semibold text-fg-1 flex items-center">
                    <span className="w-1.5 h-1.5 bg-healthy-fg rounded-full mr-1.5"></span>
                    Active
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-ocean-inset px-3 py-1.5 rounded-md border border-[#1A2640]">
                  <span className="text-fg-3">Last QBR:</span>
                  <span className="font-semibold text-fg-1">
                    {new Date(selectedAccount.last_qbr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Analysis Panel */}
            <div className="bg-ocean-1 border border-[#1A2640] rounded-lg p-6 shadow-card">
              <h3 className="font-semibold text-fg-1 mb-4">AI Intelligence Layer</h3>
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { type: 'health', icon: Bot, label: 'Health Analysis' },
                  { type: 'expansion', icon: TrendingUp, label: 'Expansion Plays' },
                  { type: 'briefing', icon: FileText, label: 'Executive Briefing' },
                  { type: 'email', icon: Mail, label: 'Draft Email' },
                ].map(({ type, icon: Icon, label }) => (
                  <button 
                    key={type}
                    onClick={() => handleAnalysis(type)} 
                    className="px-4 py-3 bg-beam-500 hover:bg-beam-400 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-beam"
                    disabled={loading}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Icon size={14} />
                      <span className="hidden xl:inline">{label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {loading && (
                <div className="text-center py-8 bg-ocean-inset border border-[#1A2640] rounded-lg">
                  <div className="inline-flex items-center space-x-3">
                    <div className="animate-spin h-5 w-5 border-2 border-beam-400 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-fg-2 font-medium">{thinkingMessage}</span>
                  </div>
                </div>
              )}

              {analysis && !loading && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-fg-1">AI Health Analysis</h4>
                    <button 
                      onClick={() => setAnalysis('')}
                      className="text-xs text-fg-3 hover:text-fg-1 px-2 py-1 rounded hover:bg-ocean-2 transition-colors"
                    >
                      Clear (ESC)
                    </button>
                  </div>

                  {/* Structured Cards */}
                  {typeof analysis === 'object' && analysis.summary && (
                    <>
                      {/* Summary Card */}
                      <div className="bg-[rgba(91,168,255,0.08)] border border-[rgba(91,168,255,0.30)] rounded-lg p-5">
                        <h5 className="text-base font-semibold text-beam-400 mb-2">Summary</h5>
                        <p className="text-sm text-fg-2 leading-relaxed font-display italic">{analysis.summary}</p>
                      </div>

                      {/* MAU Chart */}
                      {analysis.risks && selectedAccount && (
                        <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-5">
                          <h5 className="text-base font-semibold text-fg-1 mb-3">Monthly Active Users</h5>
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
                                tick={{ fill: '#8C99B5', fontSize: 12 }}
                                axisLine={{ stroke: '#1A2640' }}
                              />
                              <YAxis 
                                tick={{ fill: '#8C99B5', fontSize: 12 }}
                                axisLine={{ stroke: '#1A2640' }}
                                domain={['dataMin - 20', 'dataMax + 20']}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#101728', 
                                  border: '1px solid #1A2640', 
                                  borderRadius: '8px',
                                  color: '#F4F6FB',
                                  fontSize: '12px'
                                }}
                                formatter={(value: any) => [`${value} users`, 'MAU']}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="users" 
                                stroke={selectedAccount.monthly_active_users[4] < selectedAccount.monthly_active_users[0] ? '#FF6B6B' : '#3DDC97'}
                                strokeWidth={3}
                                dot={{ fill: selectedAccount.monthly_active_users[4] < selectedAccount.monthly_active_users[0] ? '#FF6B6B' : '#3DDC97', r: 5 }}
                                activeDot={{ r: 7 }}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Risks Section */}
                      {analysis.risks && analysis.risks.length > 0 && (
                        <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-5">
                          <h5 className="text-base font-semibold text-fg-1 mb-3 flex items-center">
                            <AlertTriangle size={16} className="text-critical-fg mr-2" />
                            Risks
                          </h5>
                          <div className="space-y-4">
                            {analysis.risks.map((risk: any, i: number) => (
                              <div key={i} className="border-l-4 border-critical-fg pl-3 bg-critical-bg py-3 rounded-r">
                                <div className="flex items-start justify-between mb-1">
                                  <span className="text-base font-semibold text-fg-1">{risk.title}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    risk.severity === 'Critical' ? 'bg-critical-line text-critical-fg' :
                                    risk.severity === 'High' ? 'bg-high-line text-high-fg' :
                                    'bg-watch-line text-watch-fg'
                                  }`}>
                                    {risk.severity}
                                  </span>
                                </div>
                                <p className="text-sm text-fg-3">{risk.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Positive Indicators */}
                      {analysis.positives && analysis.positives.length > 0 && (
                        <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-5">
                          <h5 className="text-base font-semibold text-fg-1 mb-3 flex items-center">
                            <CheckCircle2 size={16} className="text-healthy-fg mr-2" />
                            Positive Indicators
                          </h5>
                          <div className="space-y-4">
                            {analysis.positives.map((positive: any, i: number) => (
                              <div key={i} className="border-l-4 border-healthy-fg pl-3 bg-healthy-bg py-3 rounded-r">
                                <span className="text-base font-semibold text-fg-1 block mb-1">{positive.title}</span>
                                <p className="text-sm text-fg-3">{positive.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommended Action */}
                      {analysis.recommendation && (
                        <div className="bg-[rgba(91,168,255,0.08)] border-2 border-[rgba(91,168,255,0.30)] rounded-lg p-5 shadow-beam">
                          <h5 className="text-base font-semibold text-fg-1 mb-2 font-display italic">
                            {analysis.recommendation.title || 'AI Recommended Action'}
                          </h5>
                          <p className="text-sm text-fg-2 mb-3">{analysis.recommendation.description}</p>
                          <button className="px-4 py-2 bg-critical-solid hover:bg-[#d93939] text-white text-sm font-semibold rounded-lg transition-colors shadow-critical">
                            {analysis.recommendation.cta || 'View Action Plan'} →
                          </button>
                        </div>
                      )}

                      {/* Email rendering */}
                      {analysis.subject && analysis.body && (
                        <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-5">
                          <div className="mb-3 pb-3 border-b border-[#1A2640]">
                            <span className="text-xs text-fg-3 font-medium">Subject:</span>
                            <p className="text-sm font-semibold text-fg-1 mt-1">{analysis.subject}</p>
                          </div>
                          <div>
                            <span className="text-xs text-fg-3 font-medium">Body:</span>
                            <p className="text-sm text-fg-2 mt-2 whitespace-pre-wrap leading-relaxed">{analysis.body}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Fallback for non-structured text */}
                  {typeof analysis === 'string' && (
                    <div className="bg-ocean-inset border border-[#1A2640] rounded-lg p-5">
                      <pre className="whitespace-pre-wrap text-sm text-fg-2 leading-relaxed font-mono">{analysis}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Keyboard Hint */}
        <div className="fixed bottom-4 right-4 text-xs text-fg-3 bg-ocean-1 border border-[#1A2640] px-3 py-2 rounded-lg shadow-card">
          Press <span className="font-mono bg-ocean-inset px-1.5 py-0.5 rounded font-semibold text-fg-1">ESC</span> to clear analysis
        </div>
      </div>
    </div>
  );
}
