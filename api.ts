import axios, { AxiosInstance, AxiosError } from 'axios';

interface ApiConfig {
  baseURL: string;
  timeout: number;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

class ApiClient {
  private client: AxiosInstance;
  private config: ApiConfig;

  constructor(config: ApiConfig = {
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'),
  }) {
    this.config = config;
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add any auth tokens here if needed
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Stock API methods
  async getStockQuote(symbol: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.get(`/api/v1/stocks/quote/${symbol}`);
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getHistoricalData(symbol: string, limit: number = 100): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.get(`/api/v1/stocks/historical/${symbol}`, {
        params: { limit },
      });
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getIntradayData(
    symbol: string,
    interval: string = '5min'
  ): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.get(`/api/v1/stocks/intraday/${symbol}`, {
        params: { interval },
      });
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async analyzeStock(request: {
    symbol: string;
    include_sentiment?: boolean;
    include_technicals?: boolean;
    include_fundamentals?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.post('/api/v1/stocks/analyze', request);
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async compareStocks(symbols: string[]): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.get('/api/v1/stocks/compare', {
        params: { symbols: symbols.join(',') },
      });
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getMarketStatus(): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.get('/api/v1/stocks/market-status');
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Chat API methods
  async queryChatAssistant(request: {
    message: string;
    history?: Array<{ role: string; content: string }>;
    context?: Record<string, any>;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.post('/api/v1/chat/query', request);
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async analyzeStockChat(symbol: string, query: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.post('/api/v1/chat/stock-analysis', {
        symbol,
        query,
      });
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPortfolioAdvice(
    portfolio_symbols: string[],
    query: string
  ): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.post('/api/v1/chat/portfolio-advice', {
        portfolio_symbols,
        query,
      });
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getMarketSentiment(sector?: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.post('/api/v1/chat/market-sentiment', { sector });
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getEconomicUpdate(indicator?: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.post('/api/v1/chat/economic-update', { indicator });
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getInvestmentStrategy(
    risk_profile: string,
    investment_amount: number,
    time_horizon_months: number
  ): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.post('/api/v1/chat/investment-strategy', {
        risk_profile,
        investment_amount,
        time_horizon_months,
      });
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    try {
      const response = await this.client.get('/health');
      return { data: response.data, status: response.status };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Error handling
  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.detail || error.message;
      return new Error(message);
    }
    return new Error('An unknown error occurred');
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

export type { ApiResponse };
