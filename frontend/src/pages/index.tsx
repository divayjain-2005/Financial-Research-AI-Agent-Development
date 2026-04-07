import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

const INDICES = [
  { label: "NIFTY 50",   symbol: "^NSEI" },
  { label: "SENSEX",     symbol: "^BSESN" },
  { label: "NIFTY BANK", symbol: "^NSEBANK" },
];

const QUICK_STOCKS = ["RELIANCE.NS","TCS.NS","INFY.NS","HDFCBANK.NS","ICICIBANK.NS","WIPRO.NS"];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function pctColor(n: number | undefined) {
  if (!n) return "var(--text-2)";
  return n >= 0 ? "var(--green)" : "var(--red)";
}

function DataUnavailable() {
  return (
    <div style={{
      textAlign: "center", padding: "28px 20px",
      color: "var(--text-3)", fontSize: "0.85rem",
      border: "1px dashed var(--border)", borderRadius: 10,
    }}>
      Live market data is currently unavailable. Use the AI Assistant to ask about any stock.
    </div>
  );
}

export default function Dashboard() {
  const [indices, setIndices] = useState<any[]>([]);
  const [topStocks, setTopStocks] = useState<any[]>([]);
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [dataAvailable, setDataAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.marketStatus().then(setMarketStatus).catch(() => {});
    api.monitoring().then(setMonitoring).catch(() => {});

    Promise.all(INDICES.map(i => api.quote(i.symbol).catch(() => null)))
      .then(results => setIndices(results.map((r, i) => ({ label: INDICES[i].label, data: r }))));

    Promise.all(QUICK_STOCKS.map(s => api.quote(s).catch(() => null)))
      .then(results => {
        const live = results.filter(Boolean);
        setTopStocks(live);
        setDataAvailable(live.length > 0);
        setLoading(false);
      });
  }, []);

  return (
    <Layout title="Market Dashboard">
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
        {INDICES.map((idx) => {
          const d = indices.find(i => i.label === idx.label)?.data;
          return (
            <div key={idx.label} className="card" style={{ padding: "18px 20px" }}>
              <div className="metric-label">{idx.label}</div>
              <div className="metric-val" style={{ marginTop: 6 }}>
                {loading ? <span className="spinner" /> : d ? fmt(d.current_price) : "—"}
              </div>
              {d && (
                <div style={{ fontSize: "0.82rem", marginTop: 4, color: pctColor(d.change_percent) }}>
                  {d.change >= 0 ? "▲" : "▼"} {fmt(Math.abs(d.change))} ({d.change_percent > 0 ? "+" : ""}{d.change_percent?.toFixed(2)}%)
                </div>
              )}
              {!loading && !d && <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 4 }}>Unavailable</div>}
            </div>
          );
        })}
      </div>

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

      {/* Top stocks */}
      <div className="card" style={{ padding: "20px", marginBottom: 22 }}>
        <div className="section-title">Top Indian Stocks</div>
        {loading && <div className="loading"><span className="spinner" style={{ marginRight: 10 }} />Loading live data…</div>}
        {!loading && dataAvailable === false && <DataUnavailable />}
        {!loading && topStocks.length > 0 && (
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
              {topStocks.map((s: any) => (
                <tr key={s.symbol}>
                  <td><span style={{ color: "var(--gold)", fontWeight: 600 }}>{s.symbol?.split(".")[0]}</span></td>
                  <td style={{ color: "var(--text-2)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.company_name}</td>
                  <td className="num" style={{ color: "var(--text-1)", fontWeight: 600 }}>₹{fmt(s.current_price)}</td>
                  <td className="num" style={{ color: pctColor(s.change) }}>{s.change >= 0 ? "+" : ""}{fmt(s.change)}</td>
                  <td className="num" style={{ color: pctColor(s.change_percent) }}>{s.change_percent >= 0 ? "+" : ""}{s.change_percent?.toFixed(2)}%</td>
                  <td className="num">{s.volume?.toLocaleString("en-IN")}</td>
                  <td className="num">{s.pe_ratio ? s.pe_ratio.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Features overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Stock Analysis",    desc: "Technical + fundamental deep dive on any NSE/BSE stock", href: "/stocks",      icon: "📈" },
          { label: "Portfolio Tracker", desc: "Track holdings, cost basis, live P&L",                   href: "/portfolio",   icon: "💼" },
          { label: "SIP & Tax Calc",    desc: "SIP projections with step-up, LTCG/STCG tax estimates", href: "/calculators", icon: "🧮" },
          { label: "Sector Compare",    desc: "IT, Banking, Energy, FMCG, Pharma, Auto",               href: "/sectors",     icon: "🏭" },
          { label: "Financial Wellness",desc: "Score your personal finance health",                     href: "/wellness",    icon: "💯" },
          { label: "AI Assistant",      desc: "Ask Artha any market or planning question",             href: "/chat",        icon: "🤖" },
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
