import React from 'react';
import Layout from '@/components/Layout';

export default function Dashboard() {
  return (
    <Layout>
      <div className="dashboard-content">
        {/* Market Indices - From your Artha blueprint */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="idx-card bg-[#13191f] border border-[#1e2d3d] rounded-xl p-5">
            <div className="text-[0.7rem] text-[#64748b] uppercase tracking-widest mb-1">NIFTY 50</div>
            <div className="text-xl font-mono font-medium text-white">22,847.55</div>
            <div className="text-sm text-[#22c55e]">▲ 123.45 (+0.54%)</div>
          </div>
          
          <div className="idx-card bg-[#13191f] border border-[#1e2d3d] rounded-xl p-5">
            <div className="text-[0.7rem] text-[#64748b] uppercase tracking-widest mb-1">SENSEX</div>
            <div className="text-xl font-mono font-medium text-white">75,418.04</div>
            <div className="text-sm text-[#22c55e]">▲ 400.80 (+0.53%)</div>
          </div>

          <div className="idx-card bg-[#13191f] border border-[#1e2d3d] rounded-xl p-5">
            <div className="text-[0.7rem] text-[#64748b] uppercase tracking-widest mb-1">NIFTY BANK</div>
            <div className="text-xl font-mono font-medium text-white">49,281.65</div>
            <div className="text-sm text-[#ef4444]">▼ 50.20 (-0.10%)</div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="card bg-[#13191f] border border-[#1e2d3d] rounded-xl p-8 text-center">
          <h2 className="text-2xl font-serif font-bold text-[#c9a84c] mb-2">Welcome to Artha</h2>
          <p className="text-[#94a3b8]">Select a tool from the sidebar to begin your financial research.</p>
        </div>
      </div>
    </Layout>
  );
}