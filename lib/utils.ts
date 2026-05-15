export function calculateHealthScore(account: any): number {
  let score = 70;
  const util = account.seats_active / account.seats_total;
  if (util > 0.85) score += 10;
  else if (util < 0.50) score -= 15;
  const mau = account.monthly_active_users;
  if (mau[4] > mau[0]) score += 10;
  else if (mau[4] < mau[0] * 0.9) score -= 20;
  if (account.support_tickets_30d > 15) score -= 10;
  if (account.nps_score > 50) score += 10;
  else if (account.nps_score < 30) score -= 15;
  return Math.max(0, Math.min(100, score));
}
