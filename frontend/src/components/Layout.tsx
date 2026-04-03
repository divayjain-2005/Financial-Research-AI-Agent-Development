import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app flex h-screen overflow-hidden">
      {/* SIDEBAR */}
      <nav className="sidebar w-[240px] bg-[#0f1318] border-r border-[#1e2d3d] flex flex-col flex-shrink-0">
        <div className="logo p-5 border-b border-[#1e2d3d]">
          <div className="logo-text text-2xl font-bold text-[#c9a84c]">Artha</div>
          <div className="logo-sub text-[0.6rem] text-[#64748b] uppercase tracking-widest">Financial Research</div>
        </div>
        <div className="nav p-4 flex-1">
          <div className="text-[#94a3b8] text-sm">Dashboard</div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="main flex-1 flex flex-col overflow-hidden">
        <header className="topbar h-[58px] bg-[#0f1318] border-b border-[#1e2d3d] flex items-center px-7">
          <div className="text-xl font-semibold text-white">Market Overview</div>
        </header>

        <main className="content flex-1 overflow-y-auto p-7">
          {children}
        </main>
      </div>
    </div>
  );
}