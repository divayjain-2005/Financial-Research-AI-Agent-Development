import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

const DEMO_INDICES = [
  { label: "NIFTY 50",   price: 22847.55, change: 123.45,  pct: 0.54 },
  { label: "SENSEX",     price: 75418.04, change: 400.80,  pct: 0.53 },
  { label: "NIFTY BANK", price: 49281.65, change: -50.20,  pct: -0.10 },
];

const DEMO_STOCKS = [
  { symbol:"RELIANCE.NS", company_name:"Reliance Industries", current_price:2938.50, change:18.25,  change_percent:0.63,  volume:5842310, pe_ratio:27.4 },
  { symbol:"TCS.NS",      company_name:"Tata Consultancy Services", current_price:4102.80, change:-12.30, change_percent:-0.30, volume:1234567, pe_ratio:31.2 },
  { symbol:"INFY.NS",     company_name:"Infosys Ltd",    current_price:1756.40, change:8.90,   change_percent:0.51,  volume:2341234, pe_ratio:24.8 },
  { symbol:"HDFCBANK.NS", company_name:"HDFC Bank Ltd",  current_price:1678.25, change:22.10,  change_percent:1.33,  volume:4521234, pe_ratio:18.6 },
  { symbol:"ICICIBANK.NS",company_name:"ICICI Bank Ltd", current_price:1245.60, change:-5.40,  change_percent:-0.43, volume:3214567, pe_ratio:20.1 },
  { symbol:"WIPRO.NS",    company_name:"Wipro Ltd",      current_price:543.80,  change:3.20,   change_percent:0.59,  volume:1876543, pe_ratio:22.3 },
];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function pctColor(n: number | undefined) {
  if (!n) return "var(--text-2)";
  return n >= 0 ? "var(--green)" : "var(--red)";
}

export default function Dashboard() {
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [monitoring, setMonitoring] = useState<any>(null);

  useEffect(() => {
    api.marketStatus().then(setMarketStatus).catch(() => {});
    api.monitoring().then(setMonitoring).catch(() => {});
  }, []);

  return (
    <Layout title="Market Dashboard">
      {/* Market status banner */}
      {marketStatus && (
        <div style={{
          background: marketStatus.market_open ? "#14532d22" : "#7f1d1d22",
          border: `1px solid ${marketStatus.market_open ? "#14532d" : "#7f1d1d"}`,
          borderRadius: 10, padding: "10px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: marketStatus.market_open ? "var(--green)" : "var(--red)" }} />
          <span style={{ fontSize: "0.85rem", color: "var(--text-1)", fontWeight: 600 }}>
            NSE/BSE {marketStatus.market_open ? "Market Open" : "Market Closed"} · {marketStatus.current_ist}
          </span>
          <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-3)" }}>
            Trading: {marketStatus.market_hours} IST, Mon–Fri
          </span>
        </div>
      )}

      {/* Index cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
        {DEMO_INDICES.map((idx) => (
          <div key={idx.label} className="card" style={{ padding: "18px 20px" }}>
            <div className="metric-label">{idx.label}</div>
            <div className="metric-val" style={{ marginTop: 6 }}>{fmt(idx.price)}</div>
            <div style={{ fontSize: "0.82rem", marginTop: 4, color: pctColor(idx.pct) }}>
              {idx.change >= 0 ? "▲" : "▼"} {fmt(Math.abs(idx.change))} ({idx.pct > 0 ? "+" : ""}{idx.pct.toFixed(2)}%)
            </div>
          </div>
        ))}
      </div>

      {/* Stats from monitoring */}
      {monitoring && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Watchlist Entries",  val: monitoring.database.watchlist_entries },
            { label: "Portfolio Holdings", val: monitoring.database.portfolio_entries },
            { label: "Transactions",       val: monitoring.database.transactions },
            { label: "Cached Quotes",      val: monitoring.cache.live_entries },
          ].map(item => (
            <div key={item.label} className="card" style={{ padding: "14px 16px" }}>
              <div className="metric-label">{item.label}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--gold)", marginTop: 4 }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top stocks table */}
      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Top Indian Stocks</div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-3)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px" }}>Demo Data</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th style={{ textAlign: "right" }}>Price (₹)</th>
              <th style={{ textAlign: "right" }}>Change</th>
              <th style={{ textAlign: "right" }}>Change %</th>
              <th style={{ textAlign: "right" }}>Volume</th>
              <th style={{ textAlign: "right" }}>P/E</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_STOCKS.map((s) => (
              <tr key={s.symbol}>
                <td><span style={{ color: "var(--gold)", fontWeight: 600 }}>{s.symbol.split(".")[0]}</span></td>
                <td style={{ color: "var(--text-2)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.company_name}</td>
                <td className="num" style={{ color: "var(--text-1)", fontWeight: 600 }}>₹{fmt(s.current_price)}</td>
                <td className="num" style={{ color: pctColor(s.change) }}>{s.change >= 0 ? "+" : ""}{fmt(s.change)}</td>
                <td className="num" style={{ color: pctColor(s.change_percent) }}>{s.change_percent >= 0 ? "+" : ""}{s.change_percent.toFixed(2)}%</td>
                <td className="num">{s.volume.toLocaleString("en-IN")}</td>
                <td className="num">{s.pe_ratio.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Features overview */}
      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Stock Analysis",   desc: "Technical + fundamental deep dive on any NSE/BSE stock",  href: "/stocks",      icon: "📈" },
          { label: "Portfolio Tracker",desc: "Track holdings, cost basis, live P&L",                    href: "/portfolio",    icon: "💼" },
          { label: "SIP & Tax Calc",   desc: "SIP projections with step-up, LTCG/STCG tax estimates",  href: "/calculators",  icon: "🧮" },
          { label: "Sector Compare",   desc: "IT, Banking, Energy, FMCG, Pharma, Auto",                href: "/sectors",      icon: "🏭" },
          { label: "Financial Wellness",desc: "Score your personal finance health",                     href: "/wellness",     icon: "💯" },
          { label: "AI Assistant",     desc: "Ask Artha any market or planning question",              href: "/chat",         icon: "🤖" },
        ].map(item => (
          <a key={item.label} href={item.href} style={{ textDecoration: "none" }}>
            <div className="card-hover" style={{ padding: "16px 18px", cursor: "pointer" }}>
              <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          </a>
        ))}
      </div>
    </Layout>
  );
}
