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

  // Add this new useEffect:
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
    if (score >= 70) return { border: 'border-l-green-500', bg: 'bg-green-50', text: 'text-green-700' };
    if (score >= 50) return { border: 'border-l-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' };
    return { border: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-700' };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">🏠 Lighthouse</h1>
            <p className="text-gray-600 mt-1">AI-powered account intelligence for Enterprise Customer Success teams</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm px-4 py-3 border border-gray-200">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700 font-medium">Claude Haiku 4.5</span>
              </div>
              <div className="h-4 w-px bg-gray-200"></div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">Portfolio:</span>
                <span className="font-semibold text-gray-900">{accounts.length} accounts</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">Total ARR:</span>
                <span className="font-semibold text-gray-900">
                  ${(accounts.reduce((sum, acc) => sum + acc.arr, 0) / 1000000).toFixed(2)}M
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Portfolio Sidebar */}
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4">Portfolio Health</h2>
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
                          ? `${colors.bg} ${colors.border} shadow-sm` 
                          : 'bg-gray-50 border-l-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900">{acc.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-semibold ${colors.text}`}>{acc.health}/100</span>
                        <span className="text-xs text-gray-500">${(acc.arr / 1000).toFixed(0)}K</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Account Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex justify-between items-start mb-5">
                <h2 className="text-2xl font-bold text-gray-900">{selectedAccount.name}</h2>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  getHealthColor(calculateHealthScore(selectedAccount)).bg
                } ${getHealthColor(calculateHealthScore(selectedAccount)).text} border ${
                  calculateHealthScore(selectedAccount) >= 70 ? 'border-green-200' :
                  calculateHealthScore(selectedAccount) >= 50 ? 'border-yellow-200' : 'border-red-200'
                }`}>
                  Health: {calculateHealthScore(selectedAccount)}/100
                </div>
              </div>
              
              {/* Metrics - All Neutral */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-1">ARR</p>
                  <p className="text-xl font-bold text-gray-900">${selectedAccount.arr.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    +${Math.round(selectedAccount.arr * 0.12).toLocaleString()} YTD
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-1">Seat Utilization</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-xl font-bold text-gray-900">
                      {Math.round((selectedAccount.seats_active/selectedAccount.seats_total)*100)}%
                    </p>
                    <span className={`text-xs font-semibold ${
                      selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] ? '↑' : '↓'}
                      {Math.abs(Math.round(((selectedAccount.monthly_active_users[4] - selectedAccount.monthly_active_users[0]) / selectedAccount.monthly_active_users[0]) * 100))}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedAccount.seats_active}/{selectedAccount.seats_total} seats
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-1">NPS</p>
                  <p className="text-xl font-bold text-gray-900">{selectedAccount.nps_score}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedAccount.nps_score >= 50 ? 'Promoter' : 
                     selectedAccount.nps_score >= 30 ? 'Passive' : 'Detractor'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-1">Support Load</p>
                  <p className={`text-xl font-bold ${
                    selectedAccount.support_tickets_30d > 15 ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {selectedAccount.support_tickets_30d}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">tickets (30d)</p>
                </div>
              </div>

              {/* MAU Trend - Green/Red Only */}
              <div className="mt-5 pt-5 border-t border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-3 flex items-center justify-between">
                  <span>Monthly Active Users (Last 5 Months)</span>
                  <span className={`text-xs font-semibold ${
                    selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] ? '↑' : '↓'}
                    {Math.abs(selectedAccount.monthly_active_users[4] - selectedAccount.monthly_active_users[0])} users
                  </span>
                </p>
                
                <div className="relative h-24 flex items-end justify-between gap-2">
                  {selectedAccount.monthly_active_users.map((mau, i) => {
                    const prevMau = i > 0 ? selectedAccount.monthly_active_users[i - 1] : mau;
                    const isGrowth = mau >= prevMau;
                    const maxMau = Math.max(...selectedAccount.monthly_active_users);
                    const heightPercent = (mau / maxMau) * 100;
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                          {mau} users
                        </div>
                        <div 
                          className={`w-full rounded-t cursor-pointer transition-all ${
                            isGrowth 
                              ? 'bg-green-500 hover:bg-green-600' 
                              : 'bg-red-500 hover:bg-red-600'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex justify-between gap-2 mt-1">
                  {selectedAccount.monthly_active_users.map((_, i) => (
                    <div key={i} className="flex-1 text-center text-xs text-gray-400 font-medium">M{i + 1}</div>
                  ))}
                </div>
              </div>

              {/* Status - Calm Pills */}
              <div className="mt-5 pt-5 border-t border-gray-200 flex items-center flex-wrap gap-3 text-xs">
                <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
                  <span className="text-gray-500">Confidence:</span>
                  <span className="font-semibold text-gray-900">
                    {calculateHealthScore(selectedAccount) >= 70 ? 'High' : 
                     calculateHealthScore(selectedAccount) >= 50 ? 'Medium' : 'Elevated Risk'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
                  <span className="text-gray-500">Integration:</span>
                  <span className="font-semibold text-gray-900 flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                    Active
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
                  <span className="text-gray-500">Last QBR:</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(selectedAccount.last_qbr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Analysis Panel */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">AI Intelligence Layer</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { type: 'health', icon: '🤖', label: 'Health Analysis' },
                  { type: 'expansion', icon: '📈', label: 'Expansion Plays' },
                  { type: 'briefing', icon: '📄', label: 'Executive Briefing' },
                  { type: 'email', icon: '✉️', label: 'Draft Email' },
                ].map(btn => (
                  <button 
                    key={btn.type}
                    onClick={() => handleAnalysis(btn.type)} 
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {btn.icon} {btn.label}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="inline-flex items-center space-x-3">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-gray-700 font-medium">{thinkingMessage}</span>
                  </div>
                </div>
              )}

              {analysis && !loading && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-gray-900">Analysis Results</h4>
                    <button 
                      onClick={() => setAnalysis('')}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      Clear (ESC)
                    </button>
                  </div>

                  {/* Structured Cards */}
                  {typeof analysis === 'object' && analysis.summary && (
                    <>
                      {/* Summary Card */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="text-sm font-semibold text-blue-900 mb-2">Summary</h5>
                        <p className="text-sm text-blue-800 leading-relaxed">{analysis.summary}</p>
                      </div>
                      
{/* MAU Trend Chart (for health analysis only) */}
                      {analysis.risks && selectedAccount && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3">Monthly Active Users</h5>
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
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                axisLine={{ stroke: '#e5e7eb' }}
                              />
                              <YAxis 
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                axisLine={{ stroke: '#e5e7eb' }}
                                domain={['dataMin - 20', 'dataMax + 20']}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1f2937', 
                                  border: 'none', 
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
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs">
                            <span className="text-gray-500">
                              Start: <span className="font-semibold text-gray-900">{selectedAccount.monthly_active_users[0]}</span>
                            </span>
                            <span className={`font-semibold ${
                              selectedAccount.monthly_active_users[4] < selectedAccount.monthly_active_users[0] 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>
                              Current: {selectedAccount.monthly_active_users[4]} 
                              {selectedAccount.monthly_active_users[4] < selectedAccount.monthly_active_users[0] ? ' ↓' : ' ↑'}
                              {Math.abs(selectedAccount.monthly_active_users[4] - selectedAccount.monthly_active_users[0])}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Risks Section */}
                      {analysis.risks && analysis.risks.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <span className="text-red-500 mr-2">⚠️</span>
                            Risk Signals
                          </h5>
                          <div className="space-y-3">
                            {analysis.risks.map((risk: any, i: number) => (
                              <div key={i} className="border-l-4 border-red-500 pl-3">
                                <div className="flex items-start justify-between mb-1">
                                  <span className="text-sm font-semibold text-gray-900">{risk.title}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    risk.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                                    risk.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {risk.severity}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{risk.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Positive Indicators */}
                      {analysis.positives && analysis.positives.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <span className="text-green-500 mr-2">✅</span>
                            Positive Indicators
                          </h5>
                          <div className="space-y-3">
                            {analysis.positives.map((positive: any, i: number) => (
                              <div key={i} className="border-l-4 border-green-500 pl-3">
                                <span className="text-sm font-semibold text-gray-900 block mb-1">{positive.title}</span>
                                <p className="text-sm text-gray-600">{positive.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Opportunities (for expansion/briefing) */}
                      {analysis.opportunities && analysis.opportunities.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <span className="text-blue-500 mr-2">💡</span>
                            Opportunities
                          </h5>
                          <div className="space-y-3">
                            {analysis.opportunities.map((opp: any, i: number) => (
                              <div key={i} className="border-l-4 border-blue-500 pl-3">
                                <span className="text-sm font-semibold text-gray-900 block mb-1">{opp.title}</span>
                                <p className="text-sm text-gray-600 mb-2">{opp.description || opp.business_case}</p>
                                {opp.arr_lift && <p className="text-xs text-blue-600 font-semibold">Est. ARR Lift: {opp.arr_lift}</p>}
                                {opp.approach && <p className="text-xs text-gray-500 mt-1">Approach: {opp.approach}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommended Action */}
                      {analysis.recommendation && (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                            <span className="text-blue-600 mr-2">⚡</span>
                            {analysis.recommendation.title || 'Recommended Action'}
                          </h5>
                          <p className="text-sm text-gray-700 mb-3">{analysis.recommendation.description}</p>
                          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                            {analysis.recommendation.cta || 'Take Action'} →
                          </button>
                        </div>
                      )}

                      {/* Email rendering */}
                      {analysis.subject && analysis.body && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="mb-3 pb-3 border-b border-gray-200">
                            <span className="text-xs text-gray-500 font-medium">Subject:</span>
                            <p className="text-sm font-semibold text-gray-900 mt-1">{analysis.subject}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 font-medium">Body:</span>
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">{analysis.body}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Fallback for non-structured text */}
                  {typeof analysis === 'string' && (
                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{analysis}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Keyboard Hint */}
        <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
          Press <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded font-semibold">ESC</span> to clear analysis
        </div>
      </div>
    </div>
  );
}
