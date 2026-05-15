'use client';

import { useState, useEffect } from 'react';
import { accounts } from '@/lib/data';
import { calculateHealthScore } from '@/lib/utils';

export default function Home() {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]);
  const [analysis, setAnalysis] = useState('');
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
    if (score >= 70) return { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', dot: 'bg-green-500' };
    if (score >= 50) return { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-700', dot: 'bg-yellow-500' };
    return { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', dot: 'bg-red-500' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              🏠 Lighthouse
            </h1>
            <p className="text-gray-600 mt-1">AI-powered account intelligence for Enterprise Customer Success teams</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm px-4 py-3 border border-gray-100">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                <span className="text-gray-600 font-medium">Claude Sonnet 4.6</span>
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
          <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-1 h-4 bg-blue-600 rounded-full mr-2"></span>
              Portfolio Health
            </h2>
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
                      className={`w-full text-left p-3 rounded-lg transition-all duration-200 border-l-4 ${
                        selectedAccount.id === acc.id 
                          ? `${colors.bg} ${colors.border} shadow-md transform scale-[1.02]` 
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900">{acc.name}</span>
                        <div className={`w-2 h-2 rounded-full ${colors.dot}`}></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-semibold ${colors.text}`}>{acc.health}/100</span>
                        <span className="text-xs text-gray-400">${(acc.arr / 1000).toFixed(0)}K</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Account Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedAccount.name}</h2>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  getHealthColor(calculateHealthScore(selectedAccount)).bg
                } ${getHealthColor(calculateHealthScore(selectedAccount)).text} border ${
                  getHealthColor(calculateHealthScore(selectedAccount)).border
                }`}>
                  Health: {calculateHealthScore(selectedAccount)}/100
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-1">ARR</p>
                  <p className="text-xl font-bold text-blue-900">${selectedAccount.arr.toLocaleString()}</p>
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    +${Math.round(selectedAccount.arr * 0.12).toLocaleString()} YTD
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-4 border border-purple-200">
                  <p className="text-xs text-purple-600 font-medium mb-1">Seat Utilization</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-xl font-bold text-purple-900">
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
                  <p className="text-xs text-purple-600 mt-1">
                    {selectedAccount.seats_active}/{selectedAccount.seats_total} seats
                  </p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-lg p-4 border border-orange-200">
                  <p className="text-xs text-orange-600 font-medium mb-1">NPS</p>
                  <p className="text-xl font-bold text-orange-900">{selectedAccount.nps_score}</p>
                  <p className={`text-xs mt-1 font-semibold ${
                    selectedAccount.nps_score >= 50 ? 'text-green-600' : 
                    selectedAccount.nps_score >= 30 ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {selectedAccount.nps_score >= 50 ? 'Promoter' : 
                     selectedAccount.nps_score >= 30 ? 'Passive' : 'Detractor'}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-1">Support Load</p>
                  <p className={`text-xl font-bold ${
                    selectedAccount.support_tickets_30d > 15 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {selectedAccount.support_tickets_30d}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">tickets (30d)</p>
                </div>
              </div>

              {/* MAU Trend */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3 flex items-center justify-between">
                  <span className="font-medium">Monthly Active Users (Last 5 Months)</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
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
                        <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none shadow-lg">
                          {mau} users
                        </div>
                        <div 
                          className={`w-full rounded-t cursor-pointer transition-all ${
                            isGrowth 
                              ? 'bg-gradient-to-t from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 shadow-lg shadow-green-500/30' 
                              : 'bg-gradient-to-t from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 shadow-lg shadow-red-500/30'
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

              {/* Status Indicators */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center flex-wrap gap-3 text-xs">
                <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                  <span className="text-gray-500">Confidence:</span>
                  <span className={`font-semibold ${
                    calculateHealthScore(selectedAccount) >= 70 ? 'text-green-600' : 
                    calculateHealthScore(selectedAccount) >= 50 ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {calculateHealthScore(selectedAccount) >= 70 ? 'High' : 
                     calculateHealthScore(selectedAccount) >= 50 ? 'Medium' : 'Elevated Risk'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                  <span className="text-blue-600">Data Quality:</span>
                  <span className="font-semibold text-blue-700">Complete</span>
                </div>
                <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                  <span className="text-gray-500">Last QBR:</span>
                  <span className="font-semibold text-gray-700">
                    {new Date(selectedAccount.last_qbr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Analysis Panel */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-1 h-4 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full mr-2"></span>
                AI Intelligence Layer
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { type: 'health', icon: '🤖', label: 'Health Analysis', gradient: 'from-blue-600 to-blue-700' },
                  { type: 'expansion', icon: '📈', label: 'Expansion Plays', gradient: 'from-green-600 to-green-700' },
                  { type: 'briefing', icon: '📄', label: 'Executive Briefing', gradient: 'from-purple-600 to-purple-700' },
                  { type: 'email', icon: '✉️', label: 'Draft Email', gradient: 'from-orange-600 to-orange-700' },
                ].map(btn => (
                  <button 
                    key={btn.type}
                    onClick={() => handleAnalysis(btn.type)} 
                    className={`px-4 py-3 bg-gradient-to-r ${btn.gradient} text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0`}
                    disabled={loading}
                  >
                    {btn.icon} {btn.label}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                  <div className="inline-flex items-center space-x-3">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-gray-700 font-medium">{thinkingMessage}</span>
                  </div>
                </div>
              )}

              {analysis && !loading && (
                <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-lg p-5 border border-gray-200 shadow-inner">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-gray-900 flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      Analysis Results
                    </h4>
                    <button 
                      onClick={() => setAnalysis('')}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-white transition-colors"
                    >
                      Clear (ESC)
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{analysis}</pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Keyboard Hint */}
        <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
          Press <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded font-semibold">ESC</span> to clear analysis
        </div>
      </div>
    </div>
  );
}
