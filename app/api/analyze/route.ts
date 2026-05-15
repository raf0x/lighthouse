import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { calculateHealthScore } from '@/lib/utils';
import { accounts } from '@/lib/data';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const { account, type } = await request.json();
    const health = calculateHealthScore(account);

    // Calculate portfolio context
    const avgHealth = accounts.reduce((sum, acc) => 
      sum + calculateHealthScore(acc), 0) / accounts.length;
    const accountHealth = calculateHealthScore(account);
    const percentile = (accounts.filter(acc => 
      calculateHealthScore(acc) < accountHealth).length / accounts.length) * 100;
    const isOutlier = accountHealth < (avgHealth - 20) || accountHealth > (avgHealth + 20);

    const portfolioContext = `
Portfolio Context:
- Account health: ${health}/100
- Portfolio average: ${Math.round(avgHealth)}/100
- Account rank: ${Math.round(percentile)}th percentile
${isOutlier ? '⚠️ OUTLIER: Significant deviation from portfolio norm' : ''}`;

    const prompts: Record<string, string> = {
      health: `You are a Customer Success analyst. Analyze this enterprise account with appropriate hedging and professional uncertainty where data is limited.

Account: ${account.name}
ARR: $${account.arr}
Seats: ${account.seats_active}/${account.seats_total}
MAU Trend (5 months): ${account.monthly_active_users}
Support Tickets (30d): ${account.support_tickets_30d}
NPS: ${account.nps_score}
Last QBR: ${account.last_qbr}

${portfolioContext}

Provide:
1. **2-3 Sentence Summary** - Include hedging language where appropriate ("suggests", "indicates", "may require"). Reference portfolio context.
2. **Top 3 Risk Signals** - Frame as "signals" not certainties. Note data limitations.
3. **Top 2 Positive Indicators** - Acknowledge what's working
4. **Recommended Action** - Use measured language ("consider", "recommend review", "may benefit from")

Use professional hedging. Real CS analysis acknowledges uncertainty.`,

      expansion: `You are a Customer Success expansion strategist. Identify 2-3 expansion opportunities with realistic qualifications.

Account: ${account.name}
Industry: ${account.industry}
ARR: $${account.arr}
Seats: ${account.seats_active}/${account.seats_total} active
MAU Trend: ${account.monthly_active_users}

${portfolioContext}

For each opportunity:
1. Title
2. Business case (include "if X is resolved" qualifiers where relevant)
3. Estimated ARR lift (provide ranges, not exact numbers)
4. Recommended approach (acknowledge potential obstacles)

Consider portfolio benchmarks when evaluating expansion readiness. Acknowledge adoption or engagement barriers where relevant.`,

      briefing: `Create an executive briefing with appropriate professional hedging.

Account: ${account.name}
Executive: ${account.executive_contact}
ARR: $${account.arr}
Health Score: ${health}/100
Seat Utilization: ${Math.round((account.seats_active/account.seats_total)*100)}%
MAU Trend: ${account.monthly_active_users[4]} current vs ${account.monthly_active_users[0]} (5 months ago)
NPS: ${account.nps_score}

${portfolioContext}

Format:
**Executive Summary** (2-3 sentences with measured language, reference portfolio position)
**Key Risk Signals** (frame as signals, not certainties; note confidence levels)
**Growth Opportunities** (1-2 with realistic qualifications)
**Recommended Next Actions** (3-4 actions with timeframes and contingencies)

Use executive-appropriate hedging. Consider portfolio context in recommendations.`,

      email: `Draft a personalized, consultative email to ${account.executive_contact} at ${account.name}.

Context:
- Last QBR: ${account.last_qbr}
- Current MAU: ${account.monthly_active_users[4]}
- Seat utilization: ${Math.round((account.seats_active/account.seats_total)*100)}%
- Support tickets: ${account.support_tickets_30d}
- Account health: ${health}/100
- Portfolio average: ${Math.round(avgHealth)}/100

Tone: Professional, consultative, appropriately tentative. Reference specific signals without being presumptuous about internal dynamics.

Format: Subject + Body (under 150 words)

Real CS emails acknowledge that you're working with incomplete information. Use appropriate hedging.`,
    };

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompts[type] }],
    });

    return NextResponse.json({
      analysis: message.content[0].type === 'text' ? message.content[0].text : '',
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ 
      error: 'API error', 
      details: error.message 
    }, { status: 500 });
  }
}
