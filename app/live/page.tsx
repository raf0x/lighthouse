'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown,
  Clock3, Moon, Pause, Play, Sun,
  AudioLines, Compass, FilePenLine, Radar, ScanSearch, ShieldAlert, ShieldCheck, Network as NetworkIcon, Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { accounts, calculateHealthScore } from '@/app/lib/lighthouse';
import styles from './live.module.css';

type AgentId = 'beacon' | 'undertow' | 'waypoint' | 'current' | 'relay' | 'aperture' | 'dispatch' | 'harbor';
type ScenarioId = 'risk' | 'growth';
type Event = { agent: AgentId; title: string; description: string; account: string; type: 'signal' | 'analysis' | 'draft' | 'review' };
type Agent = { id: AgentId; name: string; role: string; color: string; x: number; y: number; icon: LucideIcon };

const agents: Agent[] = [
  { id: 'beacon', name: 'Beacon', role: 'Health', color: '#15a99e', x: 20, y: 20, icon: Radar },
  { id: 'undertow', name: 'Undertow', role: 'Risk', color: '#e67c5b', x: 50, y: 11, icon: ShieldAlert },
  { id: 'waypoint', name: 'Waypoint', role: 'Portfolio', color: '#578ee9', x: 80, y: 20, icon: Compass },
  { id: 'current', name: 'Current', role: 'Engagement', color: '#60a557', x: 91, y: 53, icon: AudioLines },
  { id: 'relay', name: 'Relay', role: 'Relationships', color: '#9664d9', x: 79, y: 85, icon: NetworkIcon },
  { id: 'aperture', name: 'Aperture', role: 'Expansion', color: '#ce9a3a', x: 49, y: 91, icon: ScanSearch },
  { id: 'dispatch', name: 'Dispatch', role: 'Briefings', color: '#cf70ae', x: 19, y: 84, icon: FilePenLine },
  { id: 'harbor', name: 'Harbor', role: 'Approval', color: '#5897c9', x: 8, y: 52, icon: ShieldCheck },
];

const scenarios: Record<ScenarioId, { label: string; kicker: string; events: Event[] }> = {
  risk: {
    label: 'Renewal watch',
    kicker: 'A declining account is surfaced before the next conversation.',
    events: [
      { agent: 'current', title: 'Engagement shift detected', description: 'Horizon Retail usage trend fell across the sample period.', account: 'Horizon Retail', type: 'signal' },
      { agent: 'beacon', title: 'Account health recalculated', description: 'Utilization, support and satisfaction signals were reviewed.', account: 'Horizon Retail', type: 'analysis' },
      { agent: 'undertow', title: 'Renewal exposure flagged', description: 'Risk context was assembled for the account owner.', account: 'Horizon Retail', type: 'analysis' },
      { agent: 'waypoint', title: 'Portfolio priority updated', description: 'Horizon Retail moved into the simulated attention queue.', account: 'Portfolio', type: 'signal' },
      { agent: 'dispatch', title: 'Executive briefing drafted', description: 'A suggested outreach brief is ready for inspection.', account: 'Horizon Retail', type: 'draft' },
      { agent: 'harbor', title: 'Human review required', description: 'No customer-facing action occurs without a reviewer.', account: 'Horizon Retail', type: 'review' },
    ],
  },
  growth: {
    label: 'Expansion opportunity',
    kicker: 'Promising account signals become a reviewable opportunity.',
    events: [
      { agent: 'current', title: 'Adoption trend strengthened', description: 'Cascade Energy shows encouraging engagement in sample data.', account: 'Cascade Energy', type: 'signal' },
      { agent: 'beacon', title: 'Account health inspected', description: 'Positive usage and support signals were summarized.', account: 'Cascade Energy', type: 'analysis' },
      { agent: 'waypoint', title: 'Portfolio comparison prepared', description: 'Signals were compared with the fictional account portfolio.', account: 'Portfolio', type: 'analysis' },
      { agent: 'aperture', title: 'Expansion hypothesis formed', description: 'Potential next steps were proposed, not forecast as revenue.', account: 'Cascade Energy', type: 'signal' },
      { agent: 'relay', title: 'Stakeholder context surfaced', description: 'Executive relationship context was added to the recommendation.', account: 'Cascade Energy', type: 'analysis' },
      { agent: 'harbor', title: 'Opportunity queued for review', description: 'The proposal awaits a Customer Success manager.', account: 'Cascade Energy', type: 'review' },
    ],
  },
};

const sampleAccountNames = ['Horizon Retail', 'Velocity Healthcare', 'Meridian Financial', 'Cascade Energy'];
const positions = Object.fromEntries(agents.map(a => [a.id, a])) as Record<AgentId, Agent>;
const totalArr = accounts.reduce((sum, account) => sum + account.arr, 0);

function fmtClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function Network({ active, visited, selected, onSelect, reduced }: {
  active: AgentId; visited: AgentId[]; selected: AgentId | null; onSelect: (agent: AgentId | null) => void; reduced: boolean;
}) {
  const selectedAgent = selected ? positions[selected] : positions[active];
  return (
    <>
    <div className={styles.network}>
      <div className={styles.networkGrid} aria-hidden="true" />
      <svg className={styles.wires} viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="wire" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#65a5e8" stopOpacity=".10" />
            <stop offset=".55" stopColor="#83b4f5" stopOpacity=".39" />
            <stop offset="1" stopColor="#65a5e8" stopOpacity=".09" />
          </linearGradient>
        </defs>
        {agents.map(agent => {
          const x = agent.x * 10; const y = agent.y * 6.2;
          const isActive = active === agent.id;
          return <g key={agent.id}>
            <path d={`M500 310 Q${(500 + x) / 2} ${(310 + y) / 2 - 30} ${x} ${y}`}
              fill="none" stroke={isActive ? agent.color : 'url(#wire)'} strokeWidth={isActive ? 2.6 : 1.2}
              strokeDasharray={isActive ? 'none' : '3 8'} opacity={isActive ? .9 : .7} />
            {isActive && !reduced && <circle r="5" fill={agent.color} className={styles.packet}>
              <animateMotion dur="2.1s" repeatCount="indefinite" path={`M${x} ${y} Q${(500 + x) / 2} ${(310 + y) / 2 - 30} 500 310`} />
            </circle>}
          </g>;
        })}
        <circle cx="500" cy="310" r="86" fill="none" stroke="#93b8ff" strokeOpacity=".12" strokeDasharray="2 8" />
        <circle cx="500" cy="310" r="116" fill="none" stroke="#93b8ff" strokeOpacity=".08" />
      </svg>
      <div className={styles.centerHub} aria-label="Lighthouse coordinator">
        <div className={styles.hubOrbit} />
        <div className={styles.hubGlyph}><span>✳</span></div>
        <strong>LIGHTHOUSE</strong>
        <small>INTELLIGENCE CORE</small>
      </div>
      {agents.map(agent => {
        const isActive = agent.id === active;
        const isVisited = visited.includes(agent.id);
        const AgentIcon = agent.icon;
        return <button
          key={agent.id}
          type="button"
          className={`${styles.agent} ${isActive ? styles.agentActive : ''} ${selected === agent.id ? styles.agentSelected : ''}`}
          style={{ left: `clamp(80px, ${agent.x}%, calc(100% - 80px))`, top: `${agent.y}%`, ['--agent-color' as string]: agent.color } as React.CSSProperties}
          aria-pressed={selected === agent.id} onClick={() => onSelect(selected === agent.id ? null : agent.id)}
          aria-label={`${agent.name}, ${agent.role}, ${isActive ? 'processing' : isVisited ? 'completed' : 'standby'}. View details`}
        >
          <span className={styles.agentSymbol} aria-hidden="true"><span className={styles.agentGlyphAura} /><AgentIcon size={28} strokeWidth={1.9} /></span>
          <span className={styles.agentText}><strong>{agent.name}</strong><small>{agent.role}</small></span>
          <span className={styles.agentStatus} aria-hidden="true">{isActive ? <span className={styles.statusPulse} /> : isVisited ? '✓' : '·'}</span>
        </button>;
      })}
      <div className={styles.networkLabel}>NETWORK / 08 NODES</div>
    </div>
      <div className={styles.networkDetail} aria-live="polite">
        <span className={styles.detailDot} style={{ background: selectedAgent.color }} />
        <span><strong>{selectedAgent.name}</strong><small>{selectedAgent.role} · {active === selectedAgent.id ? 'Processing simulation event' : visited.includes(selectedAgent.id) ? 'Step completed' : 'Standby'}</small></span>
        {selected && <button onClick={() => onSelect(null)} aria-label="Close agent details">×</button>}
      </div>
    </>
  );
}

function Sparkline({ values, color = '#64ddc5' }: { values: number[]; color?: string }) {
  const low = Math.min(...values) - 2; const high = Math.max(...values) + 2;
  const coords = values.map((v, i) => `${(i / (values.length - 1)) * 100},${44 - ((v - low) / (high - low || 1)) * 37}`).join(' ');
  return <svg viewBox="0 0 100 48" preserveAspectRatio="none" className={styles.spark} aria-hidden="true">
    <polyline points={coords} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export default function LiveDashboard() {
  const [scenario, setScenario] = React.useState<ScenarioId>('risk');
  const [tick, setTick] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [speed, setSpeed] = React.useState(3);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [selectedAgent, setSelectedAgent] = React.useState<AgentId | null>(null);
  const [approved, setApproved] = React.useState(false);
  const [motionReduced, setMotionReduced] = React.useState(false);
  const cycleLength = 24;
  const cycle = Math.floor(tick / cycleLength);
  const cycleTick = tick % cycleLength;
  const stage = Math.floor(cycleTick / 4);
  const activeScenario: ScenarioId = cycle % 2 === 0 ? scenario : scenario === 'risk' ? 'growth' : 'risk';
  const scene = scenarios[activeScenario];
  const current = scene.events[stage];
  const visible = Array.from({length: Math.min(6, Math.floor(tick / 4) + 1)}, (_, offset) => {
    const sequence = Math.floor(tick / 4) - offset;
    const pastScenario: ScenarioId = Math.floor(sequence / 6) % 2 === 0 ? scenario : scenario === 'risk' ? 'growth' : 'risk';
    return {event: scenarios[pastScenario].events[sequence % 6], sequence};
  });
  const visited = scene.events.slice(0, stage + 1).map(e => e.agent);
  const active = current.agent;

  React.useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function switchTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem('lighthouse-theme', next); } catch { /* storage optional */ }
  }

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setMotionReduced(media.matches); if (media.matches) setPlaying(false); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTick(previous => previous + 1), 850 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  function changeScenario(next: ScenarioId) {
    setScenario(next); setTick(0); setApproved(false); setSelectedAgent(null); setPlaying(!motionReduced);
  }
  React.useEffect(() => { setApproved(false); }, [cycle]);
  const healthScore = calculateHealthScore(accounts.find(a => a.name === (activeScenario === 'risk' ? 'Horizon Retail' : 'Cascade Energy'))!);
  const healthValue = activeScenario === 'risk' ? Math.max(0, healthScore + 7 - stage * 2) : Math.min(100, healthScore - 4 + stage);
  const queueCount = stage >= 4 && !approved ? 2 : 1;
  const chartValues = activeScenario === 'risk'
    ? [76, 74, 72, 73, 69, 68 - stage, 66 - stage, 66 - stage * 1.5]
    : [65, 66, 66, 68, 69, 70 + stage, 71 + stage, 73 + stage];
  return (
    <main className={styles.shell} data-mode={theme}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.frame}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand} aria-label="Lighthouse home"><span className={styles.brandIcon}>✳</span><span>LIGHTHOUSE<small>ACCOUNT INTELLIGENCE</small></span></Link>
          <nav className={styles.nav} aria-label="Dashboard navigation">
            <Link href="/">Accounts</Link><Link href="/portfolio">Portfolio</Link><Link href="/live" aria-current="page">Dashboard</Link>
          </nav>
          <div className={styles.topRight}>
            <div className={styles.topStatus}><span className={styles.liveDot} /> SIMULATION ONLINE <span className={styles.dividerText}>/</span> 08 NODES</div>
            <button type="button" className={styles.themeButton} onClick={switchTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
              <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </header>
        <div className={styles.intro}>
          <div><div className={styles.eyebrow}><span className={styles.eyebrowLine} /> THE INTELLIGENCE ROOM <span> / 001</span></div>
            <h1>See the signals.<br/><em>Before they become surprises.</em></h1>
            <p>A living view of customer health, opportunities and decisions. Eight simulated specialists, one connected picture.</p>
          </div>
          <div className={styles.introRight}><span className={styles.previewTag}>INTERACTIVE PRODUCT DEMO</span><span>Fictional accounts. Scripted intelligence.</span></div>
        </div>
        <section className={styles.dashboard} aria-label="Live intelligence simulation">
          <div className={styles.dashboardTop}>
            <div className={styles.titleGroup}><span className={styles.sectionIndex}>01 / CONTROL ROOM</span><h2>Portfolio command</h2></div>
            <div className={styles.controls}>
              <label className={styles.selectWrap}>Start with <ChevronDown size={12} aria-hidden="true" /><select value={scenario} onChange={e => changeScenario(e.target.value as ScenarioId)} aria-label="Choose simulation scenario"><option value="risk">Renewal watch</option><option value="growth">Expansion</option></select></label>
              <button type="button" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pause simulation' : 'Play simulation'} className={styles.controlButton}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}<span>{playing ? 'Pause' : 'Play'}</span></button>
              
              <label className={styles.speedControl}>Speed<select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Simulation speed"><option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option><option value={4}>4×</option></select></label>
            </div>
          </div>
          <div className={styles.metrics} aria-label="Simulated portfolio metrics">
            <div className={styles.metric}><span>PORTFOLIO ARR</span><div><strong>${(totalArr / 1_000_000).toFixed(2)}M</strong><span className={styles.metricTiny}>FICTIONAL</span></div><Sparkline values={[55, 57, 56, 62, 67, 66, 71, 75]}/></div>
            <div className={styles.metric}><span>SIGNALS REVIEWED</span><div><strong>{(128 + tick * 11).toLocaleString('en-US')}</strong><span className={styles.metricUp}><ArrowUpRight size={13}/> {playing ? 'PROCESSING' : 'PAUSED'}</span></div><Sparkline values={[25, 28, 34, 36, 39, 43, 53 + stage, 65 + stage]}/></div>
            <div className={styles.metric}><span>ACCOUNTS UNDER WATCH</span><div><strong>{activeScenario === 'risk' ? 2 + (stage >= 3 ? 1 : 0) : 2}</strong><span className={styles.metricOrange}><Activity size={13}/> PRIORITIZED</span></div><Sparkline values={[30, 30, 30, 35, 33, 32, 40 + stage, 40 + stage]} color="#ffab7e"/></div>
            <div className={styles.metric}><span>ACTIONS TO REVIEW</span><div><strong>{queueCount}</strong><span className={styles.metricBlue}><ShieldCheck size={13}/> HUMAN GATE</span></div><Sparkline values={[20, 24, 25, 27, 29, 29 + stage, 30 + stage, 35 + stage]} color="#a5b7ff"/></div>
          </div>
          <div className={styles.mainGrid}>
            <section className={styles.networkPanel} aria-labelledby="networkTitle">
              <div className={styles.panelHeading}><div><span className={styles.panelOverline}>ORCHESTRATION / 08 SIMULATED ROLES</span><h3 id="networkTitle">Intelligence network</h3></div><span className={styles.activeTag}><span className={styles.liveDot}/> {playing ? 'ALWAYS ON' : 'PAUSED'}</span></div>
              <Network active={active} visited={visited} selected={selectedAgent} onSelect={setSelectedAgent} reduced={motionReduced} />
              <div className={styles.networkFooter}><span><span className={styles.legendDot} style={{background:'#5adbc4'}}/> Active handoff</span><span><span className={styles.legendDot} style={{background:'#7084a5'}}/> Standby</span><span className={styles.nowProcessing}>NOW / {positions[active].name.toUpperCase()} · {current.title}</span></div>
            </section>
            <aside className={styles.sidePanel}>
              <section className={styles.feed} aria-labelledby="feedTitle"><div className={styles.panelHeading}><div><span className={styles.panelOverline}>REALTIME / SCRIPTED</span><h3 id="feedTitle">Signal activity</h3></div><span className={styles.smallCount}>{String(visible.length).padStart(2,'0')} / 06</span></div>
                <div className={styles.scenarioNote}><Zap size={14}/><span>{scene.kicker}</span></div>
                <ol className={styles.feedList}>{visible.map((entry, reverseIndex) => {
                  const event = entry.event; const i = entry.sequence; const agent = positions[event.agent];
                  return <li key={i} className={reverseIndex === 0 ? styles.feedCurrent : ''}><span className={styles.feedTrack}><span style={{background:agent.color}}/></span><div><div className={styles.feedTop}><strong>{agent.name}</strong><time>{fmtClock(i * 4)}</time></div><p>{event.title}</p><small>{event.description}</small></div></li>;
                })}</ol>
              </section>
              <section className={styles.review} aria-labelledby="reviewTitle"><div className={styles.panelHeading}><div><span className={styles.panelOverline}>HUMAN IN THE LOOP</span><h3 id="reviewTitle">Decision gate</h3></div><ShieldCheck size={17} color="#94b8ff"/></div><div className={styles.reviewContent}><span className={styles.reviewIcon}>{approved ? <Check size={18}/> : <Clock3 size={18}/>}</span><div><strong>{approved ? 'Marked reviewed' : stage >= 4 ? 'Recommendation ready' : 'Awaiting briefing'}</strong><p>{activeScenario === 'risk' ? 'Horizon Retail' : 'Cascade Energy'} · {approved ? 'Demo item reviewed locally' : 'No outreach sent'}</p></div></div><button className={styles.reviewButton} onClick={() => setApproved(true)} disabled={approved || stage < 4}>{approved ? 'Reviewed in demo' : stage < 4 ? 'Available after analysis' : 'Mark as reviewed'} <ArrowRight size={14}/></button></section>
            </aside>
          </div>
          <div className={styles.bottomGrid}>
            <section className={styles.bottomPanel} aria-labelledby="healthTitle"><div className={styles.panelHeading}><div><span className={styles.panelOverline}>PORTFOLIO / SIGNAL TREND</span><h3 id="healthTitle">Health trajectory</h3></div><span className={styles.chartDelta}>{activeScenario === 'risk' ? <ArrowDownRight size={16}/> : <ArrowUpRight size={16}/>} {activeScenario === 'risk' ? 'Watch signals' : 'Positive momentum'}</span></div><div className={styles.chartWrap}><div className={styles.chartAxis}><span>100</span><span>75</span><span>50</span><span>25</span></div><svg className={styles.chart} viewBox="0 0 640 170" preserveAspectRatio="none" role="img" aria-label={`Simulated health trend for ${activeScenario === 'risk' ? 'Horizon Retail' : 'Cascade Energy'}`}><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={activeScenario==='risk'?'#ffab7e':'#60ddc7'} stopOpacity=".23"/><stop offset="1" stopColor="#60ddc7" stopOpacity="0"/></linearGradient></defs>{[16,62,108,154].map(y=><path key={y} d={`M0 ${y} H640`} stroke="#526781" strokeOpacity=".23" strokeDasharray="3 6"/>)}<polygon points={`0,170 ${chartValues.map((v,i)=>`${i*640/7},${170-v*1.72}`).join(' ')} 640,170`} fill="url(#chartFill)"/><polyline points={chartValues.map((v,i)=>`${i*640/7},${170-v*1.72}`).join(' ')} fill="none" stroke={activeScenario==='risk'?'#ffab7e':'#60ddc7'} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/><circle cx="640" cy={170-chartValues[7]*1.72} r="5" fill={activeScenario==='risk'?'#ffab7e':'#60ddc7'}/></svg></div><div className={styles.chartBottom}><span>EARLIER</span><span>{activeScenario === 'risk' ? 'HORIZON RETAIL' : 'CASCADE ENERGY'} / SAMPLE TREND</span><span>NOW</span></div></section>
            <section className={styles.bottomPanel} aria-labelledby="priorityTitle"><div className={styles.panelHeading}><div><span className={styles.panelOverline}>SORTED / PRIORITY SIGNALS</span><h3 id="priorityTitle">Accounts to watch</h3></div><Link href="/portfolio" className={styles.openPortfolio}>OPEN PORTFOLIO <ArrowRight size={14}/></Link></div><div className={styles.accountsList}>{sampleAccountNames.map((name,i)=>{const account=accounts.find(a=>a.name===name)!;const score=name===(activeScenario==='risk'?'Horizon Retail':'Cascade Energy')?healthValue:calculateHealthScore(account);return <div className={styles.accountRow} key={name}><span className={styles.accountRank}>{String(i+1).padStart(2,'0')}</span><span className={styles.accountName}>{name}<small>${Math.round(account.arr/1000)}K ARR</small></span><span className={styles.healthTrack}><span style={{width:`${score}%`,background:score<55?'#ff9d7d':score<70?'#ffcb7f':'#6ee1c2'}}/></span><strong>{score}</strong></div>})}</div></section>
          </div>
          <div className={styles.timeline}><div className={styles.timelineTop}><span><span className={styles.liveDot}/> {playing ? 'CONTINUOUS SIMULATION' : 'SIMULATION PAUSED'}</span><span>AUTO-ROTATING / {scene.label.toUpperCase()}</span><span>{fmtClock(cycleTick)} / {fmtClock(cycleLength)} · LOOP {cycle + 1}</span></div><div className={styles.timelineTrack} role="progressbar" aria-label="Simulation progress" aria-valuemin={0} aria-valuemax={cycleLength} aria-valuenow={cycleTick}><span style={{width:`${cycleTick/cycleLength*100}%`}}/></div></div>
        </section>
        <footer className={styles.footer}><p><span>✳</span> LIGHTHOUSE / INDEPENDENT PRODUCT EXPERIMENT</p><p>All activity is a scripted demonstration using fictional data. The agents shown are visual roles, not independently running AI services. No CRM connection, real-time monitoring or customer outreach.</p></footer>
      </div>
    </main>
  );
}
