const BASE = "/backend";

async function req<T = any>(path: string, method = "GET", body?: any): Promise<T> {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => req("/health"),

  // Stocks (Weeks 1-4)
  quote: (symbol: string) => req(`/api/v1/stocks/quote/${encodeURIComponent(symbol)}`),
  historical: (symbol: string, period = "3mo", interval = "1d") =>
    req(`/api/v1/stocks/historical/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`),
  analyze: (symbol: string) => req(`/api/v1/stocks/analyze/${encodeURIComponent(symbol)}`),
  compare: (symbols: string) => req(`/api/v1/stocks/compare?symbols=${encodeURIComponent(symbols)}`),
  marketStatus: () => req("/api/v1/stocks/market-status"),
  sentiment: (text: string) => req("/api/v1/stocks/sentiment", "POST", { text }),
  fundamentals: (symbol: string) => req(`/api/v1/stocks/fundamentals/${encodeURIComponent(symbol)}`),

  // Sectors (Week 5-6)
  sectorList: () => req("/api/v1/sectors/list"),
  sectorCompare: (sector: string) => req(`/api/v1/sectors/compare?sector=${sector}`),

  // Watchlist (Week 5-6)
  watchlistGet: () => req("/api/v1/watchlist"),
  watchlistAdd: (symbol: string, exchange = "NSE") =>
    req("/api/v1/watchlist/add", "POST", { symbol, exchange }),
  watchlistRemove: (symbol: string) =>
    req(`/api/v1/watchlist/${encodeURIComponent(symbol)}`, "DELETE"),

  // Portfolio (Week 5-6)
  portfolioGet: () => req("/api/v1/portfolio"),
  portfolioAdd: (item: { symbol: string; quantity: number; buy_price: number; buy_date: string }) =>
    req("/api/v1/portfolio/add", "POST", item),
  transactions: () => req("/api/v1/portfolio/transactions"),

  // Calculators (Week 5-6)
  sip: (data: { monthly_amount: number; annual_return: number; years: number; step_up_percent?: number }) =>
    req("/api/v1/calculators/sip", "POST", data),
  tax: (data: { buy_price: number; sell_price: number; quantity: number; holding_days: number; asset_type?: string }) =>
    req("/api/v1/calculators/tax", "POST", data),

  // Personal Finance
  addExpense: (data: any) => req("/api/v1/expenses/add", "POST", data),
  getExpenses: () => req("/api/v1/expenses"),
  setBudget: (category: string, monthly_limit: number) =>
    req("/api/v1/budget/set", "POST", { category, monthly_limit }),
  getBudget: () => req("/api/v1/budget/summary"),
  calcEmi: (data: any) => req("/api/v1/debt/calculate-emi", "POST", data),
  insuranceNeeds: (data: any) => req("/api/v1/insurance/needs-analysis", "POST", data),
  retirementCorpus: (data: any) => req("/api/v1/retirement/corpus-calculation", "POST", data),
  emergencyFund: (monthly_expenses: number, months = 6) =>
    req("/api/v1/emergency-fund/calculate", "POST", { monthly_expenses, months }),

  // Wellness (Week 7-8)
  wellnessScore: (params: Record<string, string | number | boolean>) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    return req(`/api/v1/wellness/financial-score?${qs}`);
  },

  // Chat (Week 6-8)
  chat: (message: string, context?: string) =>
    req("/api/v1/chat/query", "POST", { message, context }),

  // Monitoring
  monitoring: () => req("/api/v1/monitoring/summary"),
};
