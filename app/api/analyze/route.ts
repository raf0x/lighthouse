const prompts: Record<string, string> = {
  health: `You are a Customer Success analyst. Analyze this enterprise account with appropriate hedging and professional uncertainty where data is limited.

Account: ${account.name}
ARR: $${account.arr}
Seats: ${account.seats_active}/${account.seats_total}
MAU Trend (5 months): ${account.monthly_active_users}
Support Tickets (30d): ${account.support_tickets_30d}
NPS: ${account.nps_score}
Last QBR: ${account.last_qbr}

Health Score: ${health}/100

Provide:
1. **2-3 Sentence Summary** - Include hedging language where appropriate ("suggests", "indicates", "may require")
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

For each opportunity:
1. Title
2. Business case (include "if X is resolved" qualifiers where relevant)
3. Estimated ARR lift (provide ranges, not exact numbers)
4. Recommended approach (acknowledge potential obstacles)

Acknowledge adoption or engagement barriers where relevant. Real expansion analysis includes realistic qualifications.`,

  briefing: `Create an executive briefing with appropriate professional hedging.

Account: ${account.name}
Executive: ${account.executive_contact}
ARR: $${account.arr}
Health Score: ${health}/100
Seat Utilization: ${Math.round((account.seats_active/account.seats_total)*100)}%
MAU Trend: ${account.monthly_active_users[4]} current vs ${account.monthly_active_users[0]} (5 months ago)
NPS: ${account.nps_score}

Format:
**Executive Summary** (2-3 sentences with measured language)
**Key Risk Signals** (frame as signals, not certainties; note confidence levels)
**Growth Opportunities** (1-2 with realistic qualifications)
**Recommended Next Actions** (3-4 actions with timeframes and contingencies)

Use executive-appropriate hedging: "trajectory suggests", "data indicates", "recommend considering". Acknowledge data limitations where relevant.`,

  email: `Draft a personalized, consultative email to ${account.executive_contact} at ${account.name}.

Context:
- Last QBR: ${account.last_qbr}
- Current MAU: ${account.monthly_active_users[4]}
- Seat utilization: ${Math.round((account.seats_active/account.seats_total)*100)}%
- Support tickets: ${account.support_tickets_30d}

Tone: Professional, consultative, appropriately tentative. Reference specific signals without being presumptuous about internal dynamics.

Format: Subject + Body (under 150 words)

Real CS emails acknowledge that you're working with incomplete information. Use appropriate hedging.`,
};
