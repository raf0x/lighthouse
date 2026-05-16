import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { calculateHealthScore } from '@/lib/utils';
import { accounts } from '@/lib/data';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const { account, type } = await request.json();
    const health = calculateHealthScore(account);

    const avgHealth = accounts.reduce((sum, acc) => sum + calculateHealthScore(acc), 0) / accounts.length;
    const accountHealth = calculateHealthScore(account);
    const percentile = (accounts.filter(acc => calculateHealthScore(acc) < accountHealth).length / accounts.length) * 100;
    const isOutlier = accountHealth < (avgHealth - 20) || accountHealth > (avgHealth + 20);

    const portfolioContext = `
Portfolio Context:
- Account health: ${health}/100
- Portfolio average: ${Math.round(avgHealth)}/100
- Account rank: ${Math.round(percentile)}th percentile
${isOutlier ? '⚠️ OUTLIER: Significant deviation from portfolio norm' : ''}
`;

    const prompts: any = {
      health: `You are a Customer Success analyst. Analyze this account and return ONLY valid JSON with NO preamble, NO markdown code fences, NO explanatory text.

Account: ${account.name}
ARR: $${account.arr}
Seats: ${account.seats_active}/${account.seats_total}
MAU Trend: ${account.monthly_active_users.join(', ')}
Support Tickets (30d): ${account.support_tickets_30d}
NPS: ${account.nps_score}

${portfolioContext}

Return ONLY this JSON structure with NO additional text:
{
  "summary": "2-3 sentence executive summary with measured language",
  "risks": [
    {"title": "Risk title", "description": "Brief explanation", "severity": "Critical|High|Medium"}
  ],
  "positives": [
    {"title": "Positive signal", "description": "Brief explanation"}
  ],
  "recommendation": {
    "title": "Recommended action title",
    "description": "What to do and why",
    "cta": "Action button text"
  }
}`,

      expansion: `Identify expansion opportunities. Return ONLY valid JSON with NO preamble or markdown.

Account: ${account.name}
Industry: ${account.industry}
ARR: $${account.arr}
Seats: ${account.seats_active}/${account.seats_total}

${portfolioContext}

Return ONLY this JSON:
{
  "summary": "Brief expansion overview",
  "opportunities": [
    {"title": "Opportunity name", "business_case": "Why this matters", "arr_lift": "Estimated value", "approach": "How to pitch"}
  ]
}`,

      briefing: `Create executive briefing. Return ONLY valid JSON with NO preamble.

Account: ${account.name}
ARR: $${account.arr}
Health: ${health}/100

${portfolioContext}

Return ONLY this JSON:
{
  "summary": "Executive summary",
  "risks": [{"title": "Risk", "description": "Details", "severity": "Critical|High|Medium"}],
  "opportunities": [{"title": "Growth opportunity", "description": "Details"}],
  "next_actions": ["Action 1", "Action 2"]
}`,

      email: `Draft email to ${account.executive_contact} at ${account.name}.

Context: Last QBR ${account.last_qbr}, MAU ${account.monthly_active_users[4]}, Health ${health}/100

Return ONLY this JSON:
{
  "subject": "Email subject line",
  "body": "Email body (under 150 words, professional tone)"
}`
    };

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompts[type] }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Strip markdown code fences if present
    const cleanedText = rawText.replace(/```json\n?|\n?```/g, '').trim();
    
    // Parse JSON
    let analysisData;
    try {
      analysisData = JSON.parse(cleanedText);
    } catch (parseError) {
      return NextResponse.json({ 
        error: 'JSON parse error', 
        raw: rawText,
        cleaned: cleanedText 
      }, { status: 500 });
    }

    return NextResponse.json({
      analysis: analysisData,
      type: type,
      account: account
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'API error', details: error.message }, { status: 500 });
  }
}
