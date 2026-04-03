// This is where your FastAPI server is running
const API_BASE_URL = 'http://localhost:8000';

export async function api(path: string, method: string = 'GET', body: any = null) {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) options.body = JSON.stringify(body);

  try {
    // This sends the actual request to your Python backend
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    return await response.json();
  } catch (error) {
    console.error("Connection to backend failed:", error);
    return null;
  }
}

export async function getStockPrice(symbol: string) {
  return await api(`/api/v1/stocks/quote/${symbol}`);
}

export async function askAI(message: string) {
  return await api('/api/v1/chat/query', 'POST', { message });
}

export function calculateSIP(amount: number, rate: number, years: number) {
  let corpus = 0;
  let invested = 0;
  const monthlyRate = rate / 12 / 100;
  for (let y = 1; y <= years; y++) {
    for (let i = 0; i < 12; i++) {
      invested += amount;
      corpus = (corpus + amount) * (1 + monthlyRate);
    }
  }
  return { 
    totalInvested: Math.round(invested), 
    expectedCorpus: Math.round(corpus) 
  };
}