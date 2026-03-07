'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';
import { apiClient } from '@/utils/api';

interface StockQuote {
  symbol: string;
  current_price: number;
  change: number;
  change_percent: number;
  timestamp: string;
}

interface MarketStatus {
  market_open: boolean;
  market_hours: string;
  trading_days: string;
  timestamp: string;
}

export default function DashboardPage() {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch market status
        const statusRes = await apiClient.getMarketStatus();
        setMarketStatus(statusRes.data);

        // Fetch quotes for popular stocks
        const stocks = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'WIPRO.NS'];
        const quotePromises = stocks.map((symbol) =>
          apiClient.getStockQuote(symbol).catch(() => null)
        );
        const results = await Promise.all(quotePromises);
        const validQuotes = results.filter((r) => r !== null) as typeof quotes;
        setQuotes(validQuotes.map((r) => r.data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Market overview and investment insights
        </p>
      </div>

      {/* Market Status Alert */}
      {marketStatus && (
        <div
          className={`alert ${
            marketStatus.market_open ? 'alert-success' : 'alert-warning'
          } flex items-center gap-3`}
        >
          <Activity size={20} />
          <div className="flex-1">
            <p className="font-medium">
              {marketStatus.market_open ? '📈 Market is OPEN' : '📉 Market is CLOSED'}
            </p>
            <p className="text-sm">
              {marketStatus.market_hours} | {marketStatus.trading_days}
            </p>
          </div>
        </div>
      )}

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
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading market data...</p>
          </div>
        </div>
      )}

      {/* Top Stocks Grid */}
      {!loading && quotes.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Top Stocks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quotes.map((quote) => (
              <StockCard key={quote.symbol} quote={quote} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            title="Stock Analysis"
            description="Analyze any Indian stock with AI"
            icon={<TrendingUp size={24} />}
            href="/stocks"
          />
          <QuickActionCard
            title="Chat Assistant"
            description="Ask AI about markets & investments"
            icon={<Activity size={24} />}
            href="/chat"
          />
          <QuickActionCard
            title="My Portfolio"
            description="Track and optimize your portfolio"
            icon={<TrendingDown size={24} />}
            href="/portfolio"
          />
        </div>
      </div>

      {/* Information Card */}
      <div className="card bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-800">
        <h3 className="text-lg font-bold text-primary-900 dark:text-primary-100 mb-2">
          ℹ️ About This Tool
        </h3>
        <p className="text-primary-800 dark:text-primary-200 mb-3">
          This is an AI-powered financial research assistant for the Indian stock market. It provides:
        </p>
        <ul className="space-y-2 text-primary-800 dark:text-primary-200">
          <li>✓ Real-time stock prices and technical analysis</li>
          <li>✓ AI-powered market insights and trends</li>
          <li>✓ Portfolio tracking and optimization</li>
          <li>✓ Investment goal planning and strategies</li>
          <li>⚠️ Research only - not financial advice</li>
        </ul>
      </div>
    </div>
  );
}

interface StockCardProps {
  quote: StockQuote;
}

function StockCard({ quote }: StockCardProps) {
  const isPositive = quote.change >= 0;

  return (
    <a href={`/stocks/${quote.symbol}`}>
      <div className="card-hover bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {quote.symbol}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ₹{quote.current_price.toFixed(2)}
            </p>
          </div>
          <div
            className={`p-2 rounded-lg ${
              isPositive
                ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
            }`}
          >
            {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-semibold ${
              isPositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isPositive ? '+' : ''}
            {quote.change.toFixed(2)}
          </span>
          <span
            className={`text-sm ${
              isPositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            ({quote.change_percent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </a>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}

function QuickActionCard({ title, description, icon, href }: QuickActionCardProps) {
  return (
    <a href={href}>
      <div className="card-hover p-6 flex flex-col items-center text-center">
        <div className="p-3 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-lg mb-4">
          {icon}
        </div>
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </a>
  );
}
