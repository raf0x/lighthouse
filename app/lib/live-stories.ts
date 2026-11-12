import { accounts, calculateHealthScore } from './lighthouse';

export type AgentId = 'beacon' | 'undertow' | 'waypoint' | 'current' | 'relay' | 'aperture' | 'dispatch' | 'harbor';
export const caseIds = ['ACC003', 'ACC007', 'ACC008'] as const;
export type CaseId = typeof caseIds[number];
export type StoryEvent = { agent: AgentId; title: string; description: string; input: string; output: string };
export function isCaseId(value: string | null): value is CaseId {
  return caseIds.some(id => id === value);
}

export function getStory(id: CaseId) {
  const account = accounts.find(item => item.id === id)!;
  const score = calculateHealthScore(account);
  const utilization = Math.round(account.seats_active / account.seats_total * 100);
  const change = Math.round((account.mau.at(-1)! / account.mau[0] - 1) * 100);
  const evidence = `${account.seats_active}/${account.seats_total} seats active (${utilization}%), NPS ${account.nps}, ${account.tickets_30d} tickets in the sample 30 days.`;
  const usage = `Monthly active users: ${account.mau.join(' → ')}. ${change > 0 ? '+' : ''}${change}% across five sample periods.`;
  const growth = id === 'ACC008';
  const label = growth ? 'Capacity opportunity' : id === 'ACC003' ? 'Adoption recovery' : 'Value recovery';
  const recommendation = growth
    ? `Ask ${account.exec} which teams need more capacity. Validate demand before proposing an expansion; this is not a revenue forecast.`
    : id === 'ACC003'
      ? `Ask ${account.exec} to identify adoption blockers and triage the ${account.tickets_30d} support tickets. Agree on one recovery milestone before discussing commercial terms.`
      : `Review the ${account.seats_total - account.seats_active} inactive seats with ${account.exec}. Identify a team to re-engage, then validate usage recovery before making a commercial recommendation.`;
  const events: StoryEvent[] = [
    { agent: 'current', title: growth ? 'Adoption trend strengthens' : 'Adoption decline surfaced', description: usage, input: 'Five fictional monthly active-user observations', output: usage },
    { agent: 'beacon', title: 'Health signals explained', description: `Health ${score}/100. ${evidence}`, input: evidence, output: `Calculated sample health: ${score}/100. A decision aid, not a validated prediction.` },
  ];
  if (growth) events.push(
    { agent: 'waypoint', title: 'Capacity context compared', description: `${utilization}% seat utilization; check need before proposing more seats.`, input: `Health ${score}/100 and ${account.seats_active} active seats`, output: 'Route this account to opportunity discovery, not a guaranteed upsell.' },
    { agent: 'aperture', title: 'Capacity hypothesis prepared', description: 'Explore whether additional teams have unmet demand.', input: usage + ' ' + evidence, output: 'Hypothesis: a capacity conversation may be useful. Confirm demand, budget and timing first.' },
    { agent: 'relay', title: 'Stakeholder question drafted', description: `Ask ${account.exec} about team capacity and demand.`, input: 'Capacity hypothesis and the fictional executive contact', output: recommendation },
  );
  else events.push(
    { agent: 'undertow', title: 'Recovery rationale assembled', description: id === 'ACC003' ? 'Declining adoption and high support load need a recovery conversation.' : 'Inactive seats and declining usage weaken the value story.', input: usage + ' ' + evidence, output: id === 'ACC003' ? 'Investigate support friction and adoption barriers; do not assume a churn outcome.' : 'Investigate unused capacity and value realization; the historical contract date is not a future deadline.' },
    { agent: 'waypoint', title: 'Attention priority explained', description: `Health ${score}/100; prioritize a fact-finding conversation.`, input: 'Health assessment and recovery rationale', output: 'Prepare a recovery brief, with an account owner responsible for the next decision.' },
    { agent: 'dispatch', title: 'Recovery briefing drafted', description: recommendation, input: 'Account evidence and recovery rationale', output: recommendation },
  );
  events.push({ agent: 'harbor', title: 'Human review requested', description: 'Review this fictional recommendation locally. Nothing is sent or saved to a CRM.', input: recommendation, output: 'A person decides whether to act. Demo review is local and resets on each loop.' });
  return { account, score, utilization, change, evidence, usage, growth, label, recommendation, events };
}
