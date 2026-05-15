import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { calculateHealthScore } from '@/lib/utils';

export async function POST(request: Request) {
  console.log('API route called');
  console.log('API key exists:', !!process.env.ANTHROPIC_API_KEY);
  
  try {
    const { account, type } = await request.json();
    const health = calculateHealthScore(account);

    const client = new Anthropic({ 
      apiKey: process.env.ANTHROPIC_API_KEY || '' 
    });

    const prompts: Record<string, string> = {
      health: `Analyze this account (health: ${health}/100). Account: ${account.name}, ARR: $${account.arr}, Seats: ${account.seats_active}/${account.seats_total}, MAU: ${account.monthly_active_users}, Tickets: ${account.support_tickets_30d}, NPS: ${account.nps_score}. Give: 2-sentence summary, top 3 risks, top 2 positives.`,
      expansion: `Find 2-3 expansion opportunities for ${account.name} (${account.industry}, $${account.arr} ARR, ${account.seats_active}/${account.seats_total} seats). For each: title, business case, ARR lift estimate, approach.`,
      briefing: `Executive briefing for ${account.name}. Health: ${health}/100, ARR: $${account.arr}, Exec: ${account.executive_contact}. Provide: Summary (2-3 sentences), Key Risks, Growth Opportunities, Next 90 Days (3-4 actions).`,
      email: `Draft email to ${account.executive_contact} at ${account.name}. Context: Last QBR ${account.last_qbr}, MAU ${account.monthly_active_users[4]}, ${Math.round((account.seats_active/account.seats_total)*100)}% seats, ${account.support_tickets_30d} tickets. Proactive check-in, consultative tone, <150 words. Subject + body.`,
    };

    console.log('Making Anthropic API call...');
    
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompts[type] }],
    });

    console.log('API call successful');

    return NextResponse.json({
      analysis: message.content[0].type === 'text' ? message.content[0].text : '',
    });
  } catch (error: any) {
    console.error('API Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json({ 
      error: 'API error', 
      details: error.message 
    }, { status: 500 });
  }
}
