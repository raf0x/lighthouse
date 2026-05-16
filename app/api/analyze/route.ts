import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { calculateHealthScore, accounts } from '@/app/lib/lighthouse';
import type { Account, AnalysisType } from '@/app/components/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const { account, type }: { account: Account; type: AnalysisType } = await request.json();
    const health = calculateHealthScore(account);

    const avgHealth = accounts.reduce((sum, acc) => sum + calculateHealthScore(acc), 0) / accounts.length;
    const percentile = (accounts.filter(acc => calculateHealthScore(acc) < health).length / accounts.length) * 100;
    const isOutlier = health < (avgHealth - 20) || health > (avgHealth + 20);

    const portfolioContext = `
Portfolio Context:
- Account health: ${health}/100
- Portfolio average: ${Math.round(avgHealth)}/100
- Account rank: ${Math.round(percentile)}th percentile
${isOutlier ? '⚠️ OUTLIER: Significant deviation from portfolio norm' : ''}
`;

    const prompts: Record<AnalysisType, string> = {
      health: `You are a Customer Success analyst. Analyze this account and return ONLY valid JSON with NO preamble, NO markdown code fences, NO explanatory text.

Account: ${account.name}
Industry: ${account.industry}
ARR: $${account.arr}
Seats: ${account.seats_active}/${account.seats_total} (${Math.round((account.seats_active/account.seats_total)*100)}% utilized)
MAU Trend (5 months): ${account.mau.join(' → ')} (${((account.mau[4]-account.mau[0])/account.mau[0]*100).toFixed(0)}% change)
Support Tickets (30d): ${account.tickets_30d}
NPS: ${account.nps}
Last QBR: ${account.last_qbr}
Executive Contact: ${account.exec}

${portfolioContext}

Return ONLY this JSON structure with NO additional text:
{
  "summary": "2-3 sentence executive summary identifying the most critical patterns",
  "risks": [
    {"title": "Risk title", "description": "Detailed explanation with specific metrics", "severity": "Critical|High|Medium"}
  ],
  "positives": [
    {"title": "Positive signal", "description": "What's working well"}
  ],
  "recommendation": {
    "title": "Primary recommended action",
    "description": "Detailed rationale for this action with expected outcomes",
    "cta": "Action button text"
  }
}

Include 2-4 risks if health is below 70. Include 1-3 positives if health is above 40.`,

      expansion: `Identify concrete expansion opportunities for this SaaS account. Return ONLY valid JSON with NO preamble or markdown.

Account: ${account.name}
Industry: ${account.industry}
ARR: $${account.arr}
Seats: ${account.seats_active}/${account.seats_total}
MAU: ${account.mau[4]}
NPS: ${account.nps}

${portfolioContext}

Return ONLY this JSON:
{
  "summary": "1-2 sentence expansion potential assessment",
  "opportunities": [
    {
      "title": "Expansion play name",
      "business_case": "Why this opportunity exists based on usage data",
      "arr_lift": "Estimated ARR increase (e.g., +$45K)",
      "approach": "Specific tactical approach to pitch this"
    }
  ]
}

Provide 2-3 concrete opportunities with realistic ARR lift calculations.`,

      briefing: `Create executive briefing for this account. Return ONLY valid JSON with NO preamble.

Account: ${account.name}
Industry: ${account.industry}
ARR: $${account.arr}
Health Score: ${health}/100
MAU Trend: ${account.mau[4]} (${((account.mau[4]-account.mau[0])/account.mau[0]*100).toFixed(0)}% vs 5mo ago)
NPS: ${account.nps}

${portfolioContext}

Return ONLY this JSON:
{
  "summary": "Executive-level account status summary (2-3 sentences)",
  "risks": [{"title": "Risk name", "description": "Impact and timeline", "severity": "Critical|High|Medium"}],
  "opportunities": [{"title": "Growth opportunity", "description": "Business case and potential value"}],
  "next_actions": ["Specific action 1 with owner", "Specific action 2 with timeline", "Specific action 3 with outcome"]
}`,

      email: `Draft a professional email to ${account.exec} at ${account.name}.

Context:
- Last QBR: ${account.last_qbr}
- MAU: ${account.mau[4]} (${account.mau[4] < account.mau[0] ? 'declining' : 'growing'})
- Health Score: ${health}/100
- NPS: ${account.nps}
- Industry: ${account.industry}

Tone: ${health < 50 ? 'Concerned but constructive, focus on partnership' : 'Positive and forward-looking, focus on growth'}

Return ONLY this JSON:
{
  "subject": "Compelling subject line (under 60 chars)",
  "body": "Complete email with:\n- Warm greeting\n- Context/observation\n- Specific ask or proposal\n- Clear next steps\n- Professional sign-off\n\nKeep under 150 words, be specific with data points."
}`
    };

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompts[type] }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    const cleanedText = rawText.replace(/```json\n?|\n?```/g, '').trim();
    
    let analysisData;
    try {
      analysisData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw text:', rawText);
      return NextResponse.json({ 
        error: 'JSON parse error', 
        raw: rawText,
        cleaned: cleanedText 
      }, { status: 500 });
    }

    return NextResponse.json({
      analysis: analysisData,
      type: type,
      account: account.name
    });

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'API error', details: error.message }, { status: 500 });
  }
}
