import React, { useEffect, useState, useRef } from "react";
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

const NEWS_PRESETS = [
  { label: "NIFTY",     sym: "^NSEI" },
  { label: "RELIANCE",  sym: "RELIANCE.NS" },
  { label: "TCS",       sym: "TCS.NS" },
  { label: "HDFCBANK",  sym: "HDFCBANK.NS" },
  { label: "INFY",      sym: "INFY.NS" },
];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function pctColor(n: number | undefined) {
  if (n == null) return "var(--text-2)";
  return n >= 0 ? "var(--green)" : "var(--red)";
}

const SENTIMENT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  POSITIVE: { color: "#4ade80", bg: "rgba(74,222,128,0.12)", icon: "▲" },
  NEGATIVE: { color: "#f87171", bg: "rgba(248,113,113,0.12)", icon: "▼" },
  NEUTRAL:  { color: "#facc15", bg: "rgba(250,204,21,0.10)",  icon: "◆" },
};

function SentimentPill({ label, score }: { label: string; score: number }) {
  const cfg = SENTIMENT_CONFIG[label] || SENTIMENT_CONFIG.NEUTRAL;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      borderRadius: 999, padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700,
      whiteSpace: "nowrap",
    }}>
      {cfg.icon} {label === "POSITIVE" ? "Bullish" : label === "NEGATIVE" ? "Bearish" : "Neutral"}
      <span style={{ opacity: 0.75, fontWeight: 400 }}>({score > 0 ? "+" : ""}{score.toFixed(2)})</span>
    </span>
  );
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
    setData(null); setError(null);
    api.returns(index.symbol)
      .then(setData)
      .catch((e: any) => setError(e?.message || "Unable to load returns."));
  }, [index.symbol]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 80,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card"
        style={{ width: "100%", maxWidth: 520, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-1)" }}>{index.label}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: 2 }}>{index.symbol}</div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--text-2)", borderRadius: 8, padding: "4px 10px",
            fontSize: "0.8rem", cursor: "pointer",
          }}>Close</button>
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
            <div style={{ fontSize: "1.7rem", fontWeight: 700, color: "var(--text-1)" }}>{fmt(data.current_price)}</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.returns?.map((r: any) => (
                <div key={r.period} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)",
                }}>
                  <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.9rem", width: 60 }}>{r.period}</div>
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

function NewsFeed() {
  const [activeSym, setActiveSym] = useState("^NSEI");
  const [activeLabel, setActiveLabel] = useState("NIFTY");
  const [newsData, setNewsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function loadNews(sym: string, label?: string) {
    setActiveSym(sym);
    setActiveLabel(label || sym);
    setLoading(true);
    setNewsData(null);
    api.newsAndSentiment(sym, 8)
      .then(setNewsData)
      .catch(() => setNewsData(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadNews("^NSEI", "NIFTY"); }, []);

  function handleCustomSearch() {
    const val = customInput.trim().toUpperCase();
    if (!val) return;
    // Convert "TCS NSE" → "TCS.NS" etc.
    let apiSym = val;
    if (val === "NIFTY" || val === "NIFTY NSE") apiSym = "^NSEI";
    else if (val === "BANKNIFTY" || val === "BANKNIFTY NSE") apiSym = "^NSEBANK";
    else if (val === "SENSEX") apiSym = "^BSESN";
    else if (val.endsWith(" NSE")) apiSym = val.replace(" NSE", ".NS");
    else if (val.endsWith(" BSE")) apiSym = val.replace(" BSE", ".BO");
    loadNews(apiSym, val);
    setCustomInput("");
  }

  const overall = newsData?.overall_sentiment;
  const overallCfg = overall ? (SENTIMENT_CONFIG[overall.label] || SENTIMENT_CONFIG.NEUTRAL) : null;

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-1)", marginRight: 4 }}>
          News & Sentiment
        </div>

        {/* Preset pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {NEWS_PRESETS.map(p => (
            <button key={p.sym}
              className={`btn ${activeSym === p.sym ? "btn-gold" : "btn-ghost"}`}
              style={{ padding: "3px 11px", fontSize: "0.75rem" }}
              onClick={() => loadNews(p.sym, p.label)}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom search */}
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <input
            ref={inputRef}
            className="input"
            placeholder="e.g. WIPRO NSE"
            value={customInput}
            onChange={e => setCustomInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") handleCustomSearch(); }}
            style={{ width: 150, fontSize: "0.78rem" }}
          />
          <button className="btn btn-ghost" style={{ fontSize: "0.78rem", padding: "4px 10px" }}
            onClick={handleCustomSearch} disabled={loading}>
            Search
          </button>
        </div>
      </div>

      {/* Overall sentiment bar */}
      {overall && overallCfg && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: overallCfg.bg, border: `1px solid ${overallCfg.color}44`,
          borderRadius: 8, padding: "8px 14px", marginBottom: 14,
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Overall sentiment for</span>
          <span style={{ fontWeight: 700, color: "var(--text-1)", fontSize: "0.82rem" }}>{activeLabel}</span>
          <SentimentPill label={overall.label} score={overall.score} />
          <span style={{ fontSize: "0.7rem", color: "var(--text-3)", marginLeft: "auto" }}>
            based on {newsData?.count} headlines
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0", color: "var(--text-3)", fontSize: "0.85rem" }}>
          <span className="spinner" /> Fetching headlines…
        </div>
      )}

      {/* Articles */}
      {!loading && newsData?.articles && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {newsData.articles.map((a: any, i: number) => {
            const cfg = SENTIMENT_CONFIG[a.sentiment?.label] || SENTIMENT_CONFIG.NEUTRAL;
            return (
              <div key={i} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "11px 0",
                borderBottom: i < newsData.articles.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                {/* Sentiment bar */}
                <div style={{
                  width: 3, borderRadius: 2, flexShrink: 0, alignSelf: "stretch",
                  background: cfg.color, opacity: 0.7, minHeight: 18,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                    <div style={{
                      flex: 1, minWidth: 0,
                      fontSize: "0.85rem", fontWeight: 600, color: "var(--text-1)", lineHeight: 1.45,
                    }}>
                      {a.link ? (
                        <a href={a.link} target="_blank" rel="noopener noreferrer"
                          style={{ color: "inherit", textDecoration: "none" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "var(--gold)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-1)")}
                        >
                          {a.title}
                        </a>
                      ) : a.title}
                    </div>
                    <SentimentPill label={a.sentiment?.label} score={a.sentiment?.score ?? 0} />
                  </div>
                  {a.summary && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: 3, lineHeight: 1.5 }}>
                      {a.summary}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: "0.68rem", color: "var(--text-3)" }}>
                    {a.publisher && <span>{a.publisher}</span>}
                    {a.published && <span>· {a.published}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !newsData && (
        <div style={{ color: "var(--text-3)", fontSize: "0.82rem", padding: "12px 0" }}>
          No headlines found. Try a different symbol.
        </div>
      )}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, marginBottom: 22 }}>
        {INDICES.map((idx) => {
          const d = indices.find(i => i.label === idx.label)?.data;
          const unavailable = !loading && !d;
          return (
            <div key={idx.label} className="card-hover" onClick={() => setOpenIdx(idx)}
              style={{ padding: "16px 18px", cursor: "pointer", position: "relative", opacity: unavailable ? 0.65 : 1 }}>
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
              <div style={{ position: "absolute", top: 10, right: 12, fontSize: "0.65rem", color: "var(--text-3)" }}>↗</div>
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

      {/* Two-column layout: Top Stocks + News Feed */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22, alignItems: "start" }}>
        {/* Top stocks */}
        <div className="card" style={{ padding: "20px" }}>
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
                  <th style={{ textAlign: "right" }}>Change %</th>
                  <th style={{ textAlign: "right" }}>P/E</th>
                </tr>
              </thead>
              <tbody>
                {topStocks.map((s: any) => (
                  <tr key={s.symbol}>
                    <td><span style={{ color: "var(--gold)", fontWeight: 600 }}>{s.symbol?.split(".")[0]}</span></td>
                    <td style={{ color: "var(--text-2)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.company_name}</td>
                    <td className="num" style={{ color: "var(--text-1)", fontWeight: 600 }}>₹{fmt(s.current_price)}</td>
                    <td className="num" style={{ color: pctColor(s.change_percent) }}>{s.change_percent >= 0 ? "+" : ""}{s.change_percent?.toFixed(2)}%</td>
                    <td className="num">{s.pe_ratio ? s.pe_ratio.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* News & Sentiment */}
        <NewsFeed />
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
