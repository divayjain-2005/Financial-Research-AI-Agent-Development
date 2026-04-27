import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

const INDICES = [
  { label: "NIFTY 50",       symbol: "^NSEI" },
  { label: "BANK NIFTY",     symbol: "^NSEBANK" },
  { label: "SENSEX",         symbol: "^BSESN" },
  { label: "GIFT NIFTY",     symbol: "GIFTNIFTY" },
  { label: "MIDCAP NIFTY",   symbol: "^NSEMDCP50" },
  { label: "FIN NIFTY",      symbol: "^CNXFIN" },
  { label: "INDIA VIX",      symbol: "^INDIAVIX" },
];

const QUICK_STOCKS = ["RELIANCE.NS","TCS.NS","INFY.NS","HDFCBANK.NS","ICICIBANK.NS","WIPRO.NS"];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function pctColor(n: number | undefined) {
  if (n == null) return "var(--text-2)";
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

function ReturnsModal({
  index, onClose,
}: { index: { label: string; symbol: string }; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api.returns(index.symbol)
      .then(setData)
      .catch((e: any) => setError(e?.message || "Unable to load returns."));
  }, [index.symbol]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 80,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 520, padding: "22px 24px" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-1)" }}>{index.label}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: 2 }}>{index.symbol}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--text-2)", borderRadius: 8, padding: "4px 10px",
              fontSize: "0.8rem", cursor: "pointer",
            }}
          >Close</button>
        </div>

        {!data && !error && (
          <div className="loading" style={{ padding: "30px 0", justifyContent: "center", display: "flex" }}>
            <span className="spinner" style={{ marginRight: 10 }} />Loading returns…
          </div>
        )}
        {error && <DataUnavailable />}

        {data && (
          <>
            <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: 14 }}>Current price</div>
            <div style={{ fontSize: "1.7rem", fontWeight: 700, color: "var(--text-1)" }}>
              {fmt(data.current_price)}
            </div>

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.returns?.map((r: any) => (
                <div
                  key={r.period}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-base)",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.9rem", width: 60 }}>
                    {r.period}
                  </div>
                  {r.available ? (
                    <>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-3)", flex: 1, textAlign: "center" }}>
                        {r.from_date} → {r.to_date}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: pctColor(r.change_percent), fontSize: "0.95rem" }}>
                          {r.change_percent >= 0 ? "+" : ""}{r.change_percent.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: "0.7rem", color: pctColor(r.change) }}>
                          {r.change >= 0 ? "+" : ""}{fmt(r.change)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ flex: 1, textAlign: "right", fontSize: "0.78rem", color: "var(--text-3)" }}>
                      Not enough history
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
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
  const [openIdx, setOpenIdx] = useState<{ label: string; symbol: string } | null>(null);

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
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 12, marginBottom: 22,
      }}>
        {INDICES.map((idx) => {
          const d = indices.find(i => i.label === idx.label)?.data;
          const unavailable = !loading && !d;
          return (
            <div
              key={idx.label}
              className="card-hover"
              onClick={() => setOpenIdx(idx)}
              style={{
                padding: "16px 18px", cursor: "pointer", position: "relative",
                opacity: unavailable ? 0.65 : 1,
              }}
            >
              <div className="metric-label">{idx.label}</div>
              <div className="metric-val" style={{ marginTop: 6, fontSize: "1.5rem" }}>
                {loading ? <span className="spinner" /> : d ? fmt(d.current_price) : "—"}
              </div>
              {d && (
                <div style={{ fontSize: "0.78rem", marginTop: 4, color: pctColor(d.change_percent) }}>
                  {d.change >= 0 ? "▲" : "▼"} {fmt(Math.abs(d.change))} ({d.change_percent > 0 ? "+" : ""}{d.change_percent?.toFixed(2)}%)
                </div>
              )}
              {unavailable && <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 4 }}>Unavailable</div>}
              <div style={{
                position: "absolute", top: 10, right: 12,
                fontSize: "0.65rem", color: "var(--text-3)",
              }}>↗</div>
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

      {openIdx && <ReturnsModal index={openIdx} onClose={() => setOpenIdx(null)} />}
    </Layout>
  );
}
