'use client';

import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { apiClient } from '@/utils/api';

interface StockData {
  symbol: string;
  current_price: number;
  change: number;
  change_percent: number;
  timestamp: string;
}

interface AnalysisData {
  symbol: string;
  company_name: string;
  current_price: number;
  change_percent: number;
  technicals?: Array<{
    indicator: string;
    value: number;
    signal: string;
  }>;
  recommendation: string;
  confidence_score: number;
}

export default function StocksPage() {
  const [searchInput, setSearchInput] = useState('');
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [selectedStock, setSelectedStock] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch quote
      const quoteRes = await apiClient.getStockQuote(searchInput.toUpperCase());
      setStocks([quoteRes.data]);

      // Fetch analysis
      const analysisRes = await apiClient.analyzeStock({
        symbol: searchInput.toUpperCase(),
        include_sentiment: true,
        include_technicals: true,
        include_fundamentals: false,
      });
      setSelectedStock(analysisRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  }

  const popularStocks = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HDFC.NS'];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Stock Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Search and analyze Indian stocks with technical indicators
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Enter stock symbol (e.g., RELIANCE.NS)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary px-8"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Quick Access */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Popular Stocks
        </p>
        <div className="flex flex-wrap gap-2">
          {popularStocks.map((symbol) => (
            <button
              key={symbol}
              onClick={() => {
                setSearchInput(symbol);
                handleSearch({ preventDefault: () => {} } as any);
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium"
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error flex items-center gap-3">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Analyzing stock...</p>
          </div>
        </div>
      )}

      {/* Stock Analysis Results */}
      {!loading && selectedStock && (
        <div className="space-y-6">
          {/* Stock Header Card */}
          <div className="card">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {selectedStock.company_name}
                </p>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {selectedStock.symbol}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  ₹{selectedStock.current_price.toFixed(2)}
                </p>
                <p
                  className={`text-lg font-semibold ${
                    selectedStock.change_percent >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {selectedStock.change_percent >= 0 ? '+' : ''}
                  {selectedStock.change_percent.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Recommendation Badge */}
            <div className="flex items-center gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  AI Recommendation
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`badge ${
                      selectedStock.recommendation === 'BUY'
                        ? 'badge-success'
                        : selectedStock.recommendation === 'SELL'
                        ? 'badge-error'
                        : 'badge-warning'
                    }`}
                  >
                    {selectedStock.recommendation}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Confidence: {(selectedStock.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Indicators */}
          {selectedStock.technicals && selectedStock.technicals.length > 0 && (
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Technical Indicators
              </h3>
              <div className="space-y-3">
                {selectedStock.technicals.map((tech) => (
                  <div
                    key={tech.indicator}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {tech.indicator}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Value: {tech.value.toFixed(2)}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        tech.signal === 'BUY'
                          ? 'badge-success'
                          : tech.signal === 'SELL'
                          ? 'badge-error'
                          : 'badge-warning'
                      }`}
                    >
                      {tech.signal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart Placeholder */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Price Chart
            </h3>
            <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              <p className="text-gray-600 dark:text-gray-400">
                Chart visualization (Coming soon)
              </p>
            </div>
          </div>

          {/* Analysis Note */}
          <div className="alert alert-info flex items-center gap-3">
            <AlertCircle size={20} />
            <p>
              This analysis is for research purposes only. Always consult with a financial advisor
              before making investment decisions.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !selectedStock && searchInput === '' && (
        <div className="text-center py-12">
          <Search className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600 dark:text-gray-400">
            Search for a stock to get started
          </p>
        </div>
      )}
    </div>
  );
}
