'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { TrendingUp, MessageCircle, BarChart3, Settings } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <html lang="en">
      <head>
        <title>Financial Research AI Agent</title>
        <meta name="description" content="AI-powered financial research assistant" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50 dark:bg-gray-950">
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <Link href="/" className="flex items-center gap-2">
                <div className="p-2 bg-primary-600 text-white rounded-lg">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h1 className="font-bold text-lg">FinAI</h1>
                  <p className="text-xs text-gray-500">Research Assistant</p>
                </div>
              </Link>
            </div>

            <nav className="p-4 space-y-2">
              <NavLink href="/" icon={<BarChart3 size={20} />} label="Dashboard" />
              <NavLink href="/stocks" icon={<TrendingUp size={20} />} label="Stocks" />
              <NavLink href="/chat" icon={<MessageCircle size={20} />} label="AI Chat" />
              <NavLink href="/portfolio" icon={<BarChart3 size={20} />} label="Portfolio" />
              <NavLink href="/settings" icon={<Settings size={20} />} label="Settings" />
            </nav>

            <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="card p-4 bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-800">
                <p className="text-sm font-medium text-primary-900 dark:text-primary-100">
                  💡 Disclaimer
                </p>
                <p className="text-xs text-primary-700 dark:text-primary-300 mt-2">
                  For research only. Not financial advice.
                </p>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between px-8 py-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Financial Research AI Agent
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Indian Stock Market Analysis & Investment Insights
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <svg
                      className="w-6 h-6 text-gray-600 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-full flex items-center justify-center text-white font-bold">
                    AI
                  </div>
                </div>
              </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
              <div className="p-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

function NavLink({ href, icon, label }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors"
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
}
