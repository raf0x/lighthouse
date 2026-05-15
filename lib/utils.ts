export function getPortfolioContext(account: any, allAccounts: any[]) {
  const avgHealth = allAccounts.reduce((sum, acc) => 
    sum + calculateHealthScore(acc), 0) / allAccounts.length;
  
  const accountHealth = calculateHealthScore(account);
  const percentile = (allAccounts.filter(acc => 
    calculateHealthScore(acc) < accountHealth).length / allAccounts.length) * 100;
  
  return {
    portfolioAvg: Math.round(avgHealth),
    accountRank: Math.round(percentile),
    isOutlier: accountHealth < (avgHealth - 20) || accountHealth > (avgHealth + 20),
  };
}
