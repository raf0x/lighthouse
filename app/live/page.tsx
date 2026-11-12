'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown,
  Clock3, Moon, Pause, Play, Sun,
  AudioLines, Compass, FilePenLine, Radar, ScanSearch, ShieldAlert, ShieldCheck, Network as NetworkIcon, Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { accounts, bandColor, bandLabel, healthBand } from '@/app/lib/lighthouse';
import styles from './live.module.css';
import { caseIds, getStory, isCaseId, accountIdentity, isPreviousReviewPass, type CaseId, type AgentId } from '@/app/lib/live-stories';

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

const roleDetails: Record<AgentId, { purpose: string; input: string; output: string; handoff: string }> = {
  beacon: { purpose: 'Explain account health', input: 'Sample usage, support and satisfaction signals', output: 'A health assessment with supporting context', handoff: 'Undertow for risk or Waypoint for comparison' },
  undertow: { purpose: 'Surface renewal exposure', input: 'Beacon’s assessment and fictional renewal context', output: 'Risk rationale for the account owner', handoff: 'Waypoint to prioritize attention' },
  waypoint: { purpose: 'Prioritize the portfolio', input: 'Account signals and the sample portfolio', output: 'An attention priority or opportunity comparison', handoff: 'Dispatch for a brief or Aperture for growth' },
  current: { purpose: 'Spot engagement changes', input: 'Fictional product adoption trends', output: 'A declining or strengthening usage signal', handoff: 'Beacon to assess account health' },
  relay: { purpose: 'Connect relationship context', input: 'Fictional stakeholder and executive context', output: 'People and relationships to consider next', handoff: 'Harbor for a person to review' },
  aperture: { purpose: 'Explore expansion potential', input: 'Positive health and portfolio comparison', output: 'An expansion hypothesis, not a revenue forecast', handoff: 'Relay to add stakeholder context' },
  dispatch: { purpose: 'Prepare the next conversation', input: 'Prioritized risk and its supporting rationale', output: 'A suggested executive outreach brief', handoff: 'Harbor for a person to review' },
  harbor: { purpose: 'Keep the decision human', input: 'The suggested brief or opportunity', output: 'A local demo review acknowledgement only', handoff: 'A Customer Success manager decides; nothing is sent' },
};

function roleLabel(agent: Agent) {
  return agent.id === 'harbor' ? 'Human gate' : agent.role;
}

const positions = Object.fromEntries(agents.map(a => [a.id, a])) as Record<AgentId, Agent>;
const totalArr = accounts.reduce((sum, account) => sum + account.arr, 0);

function fmtClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function Network({ active, visited, selected, onSelect, reduced, paused, caseAgents, reviewed, story, inspecting }: {
  active: AgentId; visited: AgentId[]; selected: AgentId | null; onSelect: (agent: AgentId | null) => void; reduced: boolean; paused: boolean; caseAgents: AgentId[]; reviewed: boolean; story: ReturnType<typeof getStory>; inspecting: boolean;
}) {
  const selectedAgent = selected ? positions[selected] : positions[active];
  const eventIndex = story.events.findIndex(event => event.agent === selectedAgent.id);
  const detail = story.events[eventIndex];
  const nextRole = story.events[eventIndex + 1];
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
          if (!isActive) return null;
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
      <div className={styles.beaconSweep} aria-hidden="true"><span className={styles.beaconBeam} /></div>
      <div className={styles.centerHub} aria-label="Lighthouse intelligence core">
        <div className={styles.hubOrbit} aria-hidden="true" />
        <div className={styles.hubGlyph} aria-hidden="true">
          <span className={styles.logoHalo} />
          <Image src="/lighthouse-logo.svg" alt="" width={68} height={68} priority className={styles.lighthouseMark} />
          <span className={styles.logoGlint} />
        </div>
        <strong>LIGHTHOUSE</strong>
        <small>INTELLIGENCE CORE</small>
      </div>
      {agents.map(agent => {
        const isActive = agent.id === active;
        const isVisited = visited.includes(agent.id);
        const inCase = caseAgents.includes(agent.id);
        const AgentIcon = agent.icon;
        return <button
          key={agent.id}
          type="button"
          className={`${styles.agent} ${isActive ? styles.agentActive : ''} ${!inCase ? styles.agentOutsideCase : ''} ${selected === agent.id ? styles.agentSelected : ''}`}
          style={{ left: `clamp(92px, ${agent.x}%, calc(100% - 92px))`, top: `clamp(60px, ${agent.y}%, calc(100% - 60px))`, ['--agent-color' as string]: agent.color } as React.CSSProperties}
          aria-pressed={selected === agent.id} onClick={() => onSelect(selected === agent.id ? null : agent.id)}
          aria-label={`${agent.name}, ${roleLabel(agent)}, ${isActive ? (agent.id === 'harbor' ? (reviewed ? 'reviewed locally' : 'awaiting human review') : paused ? 'paused on this step' : 'simulating') : isVisited ? 'completed' : (caseAgents.includes(agent.id) ? 'up next in this case' : 'not used in this case')}. View details`}
        >
          <span className={styles.agentSymbol} aria-hidden="true"><span className={styles.agentGlyphAura} /><AgentIcon size={28} strokeWidth={1.9} /></span>
          <span className={styles.agentText}><strong>{agent.name}</strong><small>{roleLabel(agent)}</small></span>
          <span className={styles.agentStatus} aria-hidden="true">{isActive ? <span className={styles.statusPulse} /> : isVisited ? '✓' : '·'}</span>
        </button>;
      })}
    </div>
      {selected && <section className={styles.networkDetail} aria-label="Selected role details" onKeyDown={e => { if (e.key === 'Escape') onSelect(null); }}>
        <div className={styles.detailHeading}>
          <span className={styles.detailDot} style={{ background: selectedAgent.color }} />
          <span><small><span className={styles.inspectionBadge} style={{borderColor: accountIdentity[story.account.id as CaseId].color}}>{accountIdentity[story.account.id as CaseId].code}</span> {inspecting ? "INSPECTING" : "FOLLOWING CURRENT STAGE"} · {story.account.name}</small><strong>{selectedAgent.name} · {roleLabel(selectedAgent)}</strong><small>{roleDetails[selectedAgent.id].purpose} · {inspecting ? 'Pinned inspection; playback continues' : selectedAgent.id === 'harbor' ? (reviewed ? 'Reviewed locally' : 'Human review step') : paused ? 'Paused on this step' : 'Scripted stage'}</small></span>
          {selected && <button onClick={() => onSelect(null)} aria-label="Follow active role">×</button>}
        </div>
        <dl className={styles.roleFacts}>
          <div><dt>ACCOUNT EVIDENCE</dt><dd>{detail?.input ?? "This role is not used in this account’s story."}</dd></div>
          <div><dt>{inspecting ? "PREVIEW OF SCRIPTED OUTPUT" : "SCRIPTED OUTPUT"}</dt><dd>{detail?.output ?? roleDetails[selectedAgent.id].purpose}</dd></div>
          <div><dt>NEXT HANDOFF</dt><dd>{detail ? nextRole ? positions[nextRole.agent].name + " · " + nextRole.title : "Human decision only. Nothing sent." : "Not in this case."}</dd></div>
        </dl>
      </section>}
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
  const [pinnedAccount, setPinnedAccount] = React.useState<CaseId | null>(null);
  const [inspectionCase, setInspectionCase] = React.useState<CaseId | null>(null);
  const [embedded, setEmbedded] = React.useState(false);
  React.useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setEmbedded(params.get('embed') === '1');
      const id = params.get('account');
      setPinnedAccount(isCaseId(id) ? id : null);
      setTick(0); setPlaybackRun(previous => previous + 1); setSelectedAgent(null); setInspectionCase(null);
    };
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const [tick, setTick] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [speed, setSpeed] = React.useState(2);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [showFloatingControls, setShowFloatingControls] = React.useState(false);
  const controlsRef = React.useRef<HTMLDivElement>(null);
  const [selectedAgent, setSelectedAgent] = React.useState<AgentId | null>(null);
  const [readyCases, setReadyCases] = React.useState<Partial<Record<CaseId, string>>>({});
  const [playbackRun, setPlaybackRun] = React.useState(0);
  const [reviewedCases, setReviewedCases] = React.useState<Partial<Record<CaseId, boolean>>>({});
  const [motionReduced, setMotionReduced] = React.useState(false);
  const cycleLength = 24;
  const cycle = Math.floor(tick / cycleLength);
  const cycleTick = tick % cycleLength;
  const passKey = `${playbackRun}:${cycle}`;
  const stage = Math.floor(cycleTick / 4);
  const activeCase = pinnedAccount ?? caseIds[cycle % caseIds.length];
  const scene = getStory(activeCase);
  const account = scene.account;
  const identity = accountIdentity[activeCase];
  const current = scene.events[stage];
  const approved = Boolean(reviewedCases[activeCase]);
  const visible = scene.events.slice(0, stage + 1).map((event, sequence) => ({ event, sequence })).reverse();
  const visited = scene.events.slice(0, stage).map(e => e.agent);
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
    const element = controlsRef.current;
    if (!element || !('IntersectionObserver' in window)) return;
    // The dock replaces, rather than competes with, the inline controls.
    const observer = new IntersectionObserver(([entry]) => {
      setShowFloatingControls(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
    }, { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTick(previous => previous + 1), 850 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed]);
  React.useEffect(() => {
    if (stage === 5) setReadyCases(previous => previous[activeCase] === passKey ? previous : {...previous, [activeCase]: passKey});
  }, [stage, activeCase, passKey]);

  function chooseAccount(id: CaseId | null) {
    setPinnedAccount(id); setTick(0); setPlaybackRun(previous => previous + 1); setSelectedAgent(null); setInspectionCase(null);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('account', id); else url.searchParams.delete('account');
    window.history.pushState({}, '', url);
  }
  function inspectAgent(id: AgentId | null) {
    setSelectedAgent(id); setInspectionCase(id ? activeCase : null);
  }
  const pendingCases = caseIds.filter(id => readyCases[id] && !reviewedCases[id]);
  const reviewCase = pendingCases.includes(activeCase) ? activeCase : pendingCases[0] ?? activeCase;
  const reviewStory = getStory(reviewCase);
  const reviewReady = Boolean(readyCases[reviewCase]);
  const reviewDone = Boolean(reviewedCases[reviewCase]);
  const previousPass = isPreviousReviewPass(readyCases[reviewCase], passKey, reviewCase, activeCase);
  const queueCount = pendingCases.length;
  const chartValues = account.mau;
  return (
    <main className={styles.shell} style={{["--account-color" as string]: identity.color} as React.CSSProperties} data-paused={!playing} data-mode={theme} data-embed={embedded ? "true" : undefined}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.frame}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand} aria-label="Lighthouse home"><span className={styles.brandIcon}>✳</span><span>LIGHTHOUSE<small>ACCOUNT INTELLIGENCE</small></span></Link>
          <nav className={styles.nav} aria-label="Dashboard navigation">
            <Link href="/live" aria-current="page" className={styles.navDashboard}>Dashboard</Link><Link href="/" className={styles.navAccounts}>Accounts</Link><Link href="/portfolio" className={styles.navPortfolio}>Portfolio</Link>
          </nav>
          <div className={styles.topRight}>
            <div className={styles.topStatus}><span className={styles.liveDot} /> SCRIPTED DEMO <span className={styles.dividerText}>/</span> 7 AGENTS + HUMAN</div>
            <button type="button" className={styles.themeButton} onClick={switchTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
              <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </header>
        <section className={styles.instrumentHeader} aria-label="Dashboard introduction">
          <div>
            <h1>See the signals. <em>Before they become surprises.</em></h1>
            <p>Seven simulated specialists. One human decision. Fictional accounts, scripted handoffs.</p>
          </div>
          <span className={styles.instrumentDisclosure}>SAMPLE DATA · SCRIPTED DEMO</span>
        </section>
        <section className={styles.dashboard} aria-label="Live intelligence simulation">
          <div className={styles.dashboardTop}>
            <div className={styles.titleGroup}><h2>Intelligence network</h2><span className={styles.currentCaseTag}>{account.name} · {scene.label}</span></div>
            <div className={styles.controls} ref={controlsRef}>
              <label className={styles.selectWrap}>Account <ChevronDown size={12} aria-hidden="true" /><select value={pinnedAccount ?? "tour"} onChange={e => chooseAccount(isCaseId(e.target.value) ? e.target.value : null)} aria-label="Choose account or portfolio tour"><option value="tour">Portfolio tour</option>{caseIds.map(id => <option value={id} key={id}>{getStory(id).account.name}</option>)}</select></label>
              <button type="button" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pause simulation' : 'Play simulation'} className={styles.controlButton}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}<span>{playing ? 'Pause' : 'Play'}</span></button>
              <label className={styles.speedControl}>Speed<select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Simulation speed"><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
            </div>
          </div>
          <div className={styles.instrumentGrid}>
            <section className={styles.instrumentStage} aria-labelledby="networkTitle">
              <div className={styles.stageHeadline}>
                <div>
                  <span className={styles.stageMicro}>CURRENT CASE STEP <strong>{stage + 1}</strong> / 6</span>
                  <h3 id="networkTitle">{current.title}</h3>
                  <p>{account.name} · {positions[active].name} {active === 'harbor' ? 'awaits a person’s review' : 'is the active scripted specialist'}</p>
                </div>
                <span className={styles.stageStatus}><span className={styles.liveDot} />{playing ? 'Playing' : 'Paused'}</span>
              </div>
              <div className={styles.desktopNetwork}>
                <Network active={active} visited={visited} selected={selectedAgent} onSelect={inspectAgent} reduced={motionReduced || !playing} paused={!playing} caseAgents={scene.events.map(event => event.agent)} reviewed={approved} story={getStory(inspectionCase ?? activeCase)} inspecting={selectedAgent !== null} />
              </div>
              <div className={styles.mobileJourney} aria-label="Ordered account case stages">
                <ol className={styles.mobileSteps}>
                  {scene.events.map((event,index) => {
                    const agent = positions[event.agent];
                    const opened = selectedAgent ? selectedAgent === event.agent && inspectionCase === activeCase : stage === index;
                    const Icon = agent.icon;
                    return <li key={event.agent} className={styles.mobileStep} data-current={stage === index} data-open={opened} data-human={event.agent === 'harbor'}>
                      <button type="button" className={styles.mobileStepButton} onClick={() => inspectAgent(selectedAgent === event.agent ? null : event.agent)} aria-expanded={opened} aria-label={`Inspect step ${index + 1}, ${agent.name}: ${event.title}`}>
                        <span className={styles.mobileStepIndex}>{index + 1}</span>
                        <Icon size={18} aria-hidden="true" />
                        <span className={styles.mobileStepTitle}><strong>{agent.name}</strong><small>{event.title}</small></span>
                        {stage === index && <span className={styles.mobileNow}>NOW</span>}
                        <ChevronDown size={15} className={styles.mobileStepChevron} aria-hidden="true" />
                      </button>
                      {opened && <div className={styles.mobileStepBody}>
                        <p>{event.input}</p>
                        <small>{index === stage ? 'Scripted output' : 'Scripted stage preview'}</small>
                        <p>{event.output}</p>
                        {event.agent === 'harbor' && <p>Human decision only. Nothing is sent.</p>}
                      </div>}
                    </li>;
                  })}
                </ol>
                <details className={styles.offCaseDetails}><summary>Other specialists in the network</summary><p>{agents.filter(agent => !scene.events.some(event => event.agent === agent.id)).map(agent => agent.name).join(' · ') || 'Every specialist has a stage in this case.'}</p></details>
              </div>
              <div className={styles.stageFooter}>
                <span>{selectedAgent ? `Inspecting ${positions[selectedAgent].name} · ${getStory(inspectionCase ?? activeCase).account.name}` : `Following ${positions[active].name}`}</span>
                {selectedAgent && <button type="button" onClick={() => inspectAgent(null)}>Return to live stage</button>}
                <span className={styles.stageFootnote}>Tour now: {account.name}</span>
              </div>
            </section>
            <aside className={styles.instrumentRail} aria-label="Account and decision context">
              <div className={styles.railAccounts}>
                <div className={styles.railHeading}><strong>Accounts in tour</strong><small>Fictional sample health</small></div>
                {caseIds.map(id => {
                  const item = getStory(id);
                  return <button key={id} type="button" className={styles.railAccount} data-current={activeCase === id} aria-pressed={pinnedAccount === id} onClick={() => chooseAccount(id)}>
                    <span className={styles.railAccountName}>{item.account.name}<small>{item.label}</small></span>
                    <span className={styles.railScore} style={{color:bandColor(healthBand(item.score))}}><strong>{item.score}</strong><small>{bandLabel(item.score)}</small></span>
                  </button>;
                })}
                {pinnedAccount && <button type="button" className={styles.railResume} onClick={() => chooseAccount(null)}>Resume portfolio tour</button>}
              </div>
              <section className={styles.railSignals} aria-label="Current sample account signals">
                <div className={styles.railHeading}><strong>{account.name}</strong><Link href={`/?account=${account.id}`}>Account details</Link></div>
                <dl>
                  <div><dt>Seats in use</dt><dd>{scene.utilization}%</dd></div>
                  <div><dt>NPS</dt><dd>{account.nps}</dd></div>
                  <div><dt>Support tickets</dt><dd>{account.tickets_30d}</dd></div>
                </dl>
                <small>Static sample, including tickets over a fictional 30-day period.</small>
              </section>
              {reviewReady ? <section className={styles.railReview} aria-labelledby="reviewTitle">
                <div className={styles.railHeading}><strong id="reviewTitle">Human review</strong><small>{queueCount} awaiting</small></div>
                <p className={styles.reviewProvenance}>{reviewDone ? 'Reviewed locally' : previousPass ? 'Queued from a previous pass' : 'Ready from this pass'}</p>
                <p className={styles.reviewCaseName}>{reviewStory.account.name}</p>
                <p className={styles.reviewBrief}>{reviewStory.recommendation}</p>
                <button type="button" className={styles.reviewButton} onClick={() => setReviewedCases(previous => ({...previous,[reviewCase]:true}))} disabled={reviewDone}>{reviewDone ? 'Reviewed locally · nothing sent' : 'Mark reviewed · nothing sent'} <ArrowRight size={14}/></button>
              </section> : <div className={styles.railAwaiting}><ShieldCheck size={16} aria-hidden="true" /><span>A person reviews the case after its scripted brief. Nothing is sent.</span></div>}
            </aside>
          </div>
          <details className={styles.caseHistory}>
            <summary>Case history &amp; evidence <span>Explore all six stages and sample usage</span></summary>
            <div className={styles.historyContents}>
              <div><h3>Scripted case stages</h3><ol>{scene.events.map((event,index)=><li key={event.agent}><strong>{index+1}. {positions[event.agent].name}</strong> · {event.title}</li>)}</ol></div>
              <div><h3>Five sample usage periods</h3><div className={styles.usageChart}><Sparkline values={chartValues} color={scene.growth ? 'var(--healthy-fg)' : 'var(--high-fg)'} /></div><p>{account.mau[0]} → {account.mau.at(-1)} monthly active users; {scene.change > 0 ? '+' : ''}{scene.change}% across five fictional periods.</p><p>Historical sample contract field: {account.contract_end}. Not a live renewal deadline.</p></div>
            </div>
          </details>
          <p className={styles.instrumentEthics}>Seven simulated specialist roles and one human review gate. Fictional data, scripted stages, no autonomous monitoring, and no customer outreach.</p>
        </section>
        <footer className={styles.footer}><p><span>✳</span> LIGHTHOUSE / INDEPENDENT PRODUCT EXPERIMENT</p><p>All activity is a scripted demonstration using fictional data. The agents shown are visual roles, not independently running AI services. No CRM connection, real-time monitoring or customer outreach.</p></footer>
      </div>
      {!embedded && showFloatingControls && (
        <div className={styles.floatingControls} role="group" aria-label="Floating simulation controls">
          <label className={styles.floatingSelect}>
            <span className={styles.srOnly}>Account or portfolio tour</span>
            <select
              value={pinnedAccount ?? 'tour'}
              onChange={e => chooseAccount(isCaseId(e.target.value) ? e.target.value : null)}
              aria-label="Floating account or portfolio tour selection"
            >
              <option value="tour">Portfolio tour</option>
              {caseIds.map(id => <option key={id} value={id}>{getStory(id).account.name}</option>)}
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
          <button
            type="button"
            className={styles.floatingPlay}
            onClick={() => setPlaying(value => !value)}
            aria-label={playing ? 'Pause simulation' : 'Play simulation'}
            title={playing ? 'Pause simulation' : 'Play simulation'}
          >
            {playing ? <Pause size={17} fill="currentColor" aria-hidden="true" /> : <Play size={17} fill="currentColor" aria-hidden="true" />}
            <span className={styles.floatingPlayLabel}>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <label className={styles.floatingSpeed}>
            <span className={styles.srOnly}>Simulation speed</span>
            <select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Floating simulation speed">
              <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
            </select>
          </label>
          <span className={styles.floatingDivider} aria-hidden="true" />
          <button
            type="button"
            className={styles.floatingTheme}
            onClick={switchTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
          </button>
        </div>
      )}
    </main>
  );
}
