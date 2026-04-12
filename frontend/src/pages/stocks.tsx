import React, { useState } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });

function fmt(n: any) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function pct(n: any) { return n == null ? "—" : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`; }
function pctColor(n: any) { return n == null ? "var(--text-2)" : Number(n) >= 0 ? "var(--green)" : "var(--red)"; }

const POPULAR = ["RELIANCE.NS","TCS.NS","INFY.NS","HDFCBANK.NS","ICICIBANK.NS","WIPRO.NS","SBIN.NS","MARUTI.NS","SUNPHARMA.NS","TATAMOTORS.NS"];

export default function Stocks() {
  const [symbol, setSymbol] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [period, setPeriod] = useState("3mo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview"|"technicals"|"fundamentals"|"history"|"chart">("overview");

  function parseStockSym(raw: string): string {
    const parts = raw.trim().toUpperCase().split(/\s+/);
    if (parts.length >= 2) {
      const exchange = parts[parts.length - 1];
      const ticker = parts.slice(0, -1).join("");
      if (exchange === "NSE") return `${ticker}.NS`;
      if (exchange === "BSE") return `${ticker}.BO`;
    }
    return parts[0];
  }

  async function load(sym?: string) {
    const raw = sym || symbol;
    const s = parseStockSym(raw);
    if (!s) return;
    setSymbol(s);
    setLoading(true);
    setError("");
    setQuote(null); setAnalysis(null); setHistory([]);
    try {
      const [q, a, h] = await Promise.all([
        api.quote(s),
        api.analyze(s),
        api.historical(s, period),
      ]);
      setQuote(q);
      setAnalysis(a);
      setHistory(h.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to fetch data");
    }
    setLoading(false);
  }

  const rec = analysis?.technicals?.recommendation;

  return (
    <Layout title="Stock Analysis">
      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          className="input"
          placeholder="e.g. RELIANCE NSE  or  TCS NSE  or  RELIANCE.NS"
          value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && load()}
          style={{ maxWidth: 360 }}
        />
        <select className="input" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 100 }}>
          {["1mo","3mo","6mo","1y","2y","5y"].map(p => <option key={p}>{p}</option>)}
        </select>
        <button className="btn btn-gold" onClick={() => load()} disabled={loading}>
          {loading ? <span className="spinner" /> : "Analyse"}
        </button>
      </div>

      {/* Quick picks */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {POPULAR.map(s => (
          <button key={s} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.75rem" }} onClick={() => load(s)}>
            {s.split(".")[0]}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background:"#7f1d1d22", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", marginBottom:16, fontSize:"0.875rem" }}>
          {error}
        </div>
      )}

      {quote && (
        <>
          {/* Quote header */}
          <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)" }}>{quote.company_name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: 2 }}>{symbol} · {quote.exchange} · {quote.currency}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-1)" }}>₹{fmt(quote.current_price)}</div>
                <div style={{ fontSize: "1rem", color: pctColor(quote.change_percent), fontWeight: 600 }}>
                  {quote.change >= 0 ? "▲" : "▼"} {fmt(Math.abs(quote.change))} ({pct(quote.change_percent)})
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 18 }}>
              {[
                { l: "Open",        v: `₹${fmt(quote.open)}` },
                { l: "High",        v: `₹${fmt(quote.high)}` },
                { l: "Low",         v: `₹${fmt(quote.low)}` },
                { l: "Prev Close",  v: `₹${fmt(quote.previous_close)}` },
                { l: "52W High",    v: quote.fifty_two_week_high ? `₹${fmt(quote.fifty_two_week_high)}` : "—" },
                { l: "52W Low",     v: quote.fifty_two_week_low  ? `₹${fmt(quote.fifty_two_week_low)}`  : "—" },
                { l: "P/E Ratio",   v: quote.pe_ratio ? quote.pe_ratio.toFixed(2) : "—" },
                { l: "Volume",      v: quote.volume?.toLocaleString("en-IN") || "—" },
              ].map(item => (
                <div key={item.l}>
                  <div className="metric-label">{item.l}</div>
                  <div style={{ fontWeight: 600, color: "var(--text-1)", marginTop: 2 }}>{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-bar">
            {(["overview","technicals","fundamentals","history","chart"] as const).map(t => (
              <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {/* Overview tab */}
          {tab === "overview" && analysis && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="card" style={{ padding: 18 }}>
                <div className="section-title">Recommendation</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <span className={`rec-${rec?.toLowerCase()}`}>{rec}</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
                    Confidence: {((analysis.technicals?.confidence || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ marginTop: 14, fontSize: "0.82rem", color: "var(--text-3)", lineHeight: 1.7 }}>
                  <div>Sector: <span style={{ color: "var(--text-1)" }}>{analysis.sector || "—"}</span></div>
                  <div>Industry: <span style={{ color: "var(--text-1)" }}>{analysis.industry || "—"}</span></div>
                  <div>Market Cap: <span style={{ color: "var(--text-1)" }}>{analysis.market_cap ? `₹${(analysis.market_cap/1e7).toFixed(1)} Cr` : "—"}</span></div>
                  <div>Div Yield: <span style={{ color: "var(--text-1)" }}>{analysis.dividend_yield ? `${(analysis.dividend_yield*100).toFixed(2)}%` : "—"}</span></div>
                </div>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="section-title">Key Signals</div>
                {analysis.technicals?.indicators?.slice(0,5).map((ind: any) => (
                  <div key={ind.indicator} style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:"0.85rem" }}>
                    <span style={{ color:"var(--text-2)" }}>{ind.indicator}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"var(--text-1)", fontFamily:"monospace" }}>{typeof ind.value === "number" ? ind.value.toFixed(2) : "—"}</span>
                      <span className={`rec-${ind.signal?.toLowerCase()}`}>{ind.signal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technicals tab */}
          {tab === "technicals" && analysis && (
            <div className="card" style={{ padding: 20 }}>
              <div className="section-title">Technical Indicators</div>
              <table className="tbl">
                <thead><tr><th>Indicator</th><th style={{textAlign:"right"}}>Value</th><th style={{textAlign:"right"}}>Signal</th></tr></thead>
                <tbody>
                  {analysis.technicals?.indicators?.map((ind: any) => (
                    <tr key={ind.indicator}>
                      <td style={{ color:"var(--text-1)", fontWeight:600 }}>{ind.indicator}</td>
                      <td className="num">{typeof ind.value === "number" ? ind.value.toFixed(2) : "—"}</td>
                      <td style={{ textAlign:"right" }}><span className={`rec-${ind.signal?.toLowerCase()}`}>{ind.signal}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop:14, padding:"10px 14px", background:"#78350f22", borderRadius:8, fontSize:"0.8rem", color:"#fcd34d", border:"1px solid #78350f" }}>
                ⚠️ Technical analysis is not financial advice. Past signals do not guarantee future performance.
              </div>
            </div>
          )}

          {/* Fundamentals tab */}
          {tab === "fundamentals" && (
            <FundamentalsTab symbol={symbol} />
          )}

          {/* Chart tab */}
          {tab === "chart" && (
            <div style={{ marginTop: 4 }}>
              <TradingViewChart
                key={symbol}
                symbol={symbol}
                height={560}
                showToolbar
              />
            </div>
          )}

          {/* History tab */}
          {tab === "history" && (
            <div className="card" style={{ padding: 20 }}>
              <div className="section-title">Price History ({period})</div>
              <table className="tbl">
                <thead><tr><th>Date</th><th style={{textAlign:"right"}}>Open</th><th style={{textAlign:"right"}}>High</th><th style={{textAlign:"right"}}>Low</th><th style={{textAlign:"right"}}>Close</th><th style={{textAlign:"right"}}>Volume</th></tr></thead>
                <tbody>
                  {[...history].reverse().slice(0,50).map((row: any) => (
                    <tr key={row.date}>
                      <td style={{color:"var(--text-2)"}}>{row.date}</td>
                      <td className="num">₹{fmt(row.open)}</td>
                      <td className="num" style={{color:"var(--green)"}}>₹{fmt(row.high)}</td>
                      <td className="num" style={{color:"var(--red)"}}>₹{fmt(row.low)}</td>
                      <td className="num" style={{color:"var(--text-1)",fontWeight:600}}>₹{fmt(row.close)}</td>
                      <td className="num">{row.volume?.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!quote && !loading && (
        <div className="empty">Search for any Indian stock symbol to begin analysis</div>
      )}
    </Layout>
  );
}

function FundamentalsTab({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.fundamentals(symbol).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return <div className="loading"><span className="spinner" /></div>;
  if (!data) return <div className="empty">No fundamental data available</div>;

  const sections = [
    { title: "Valuation",    data: data.valuation },
    { title: "Profitability",data: data.profitability },
    { title: "Leverage",     data: data.leverage },
    { title: "Growth",       data: data.growth },
    { title: "Dividends",    data: data.dividends },
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {sections.map(sec => (
        <div key={sec.title} className="card" style={{ padding:18 }}>
          <div className="section-title">{sec.title}</div>
          {Object.entries(sec.data || {}).map(([k,v]: any) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:"0.85rem" }}>
              <span style={{color:"var(--text-3)"}}>{k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</span>
              <span style={{color:"var(--text-1)",fontWeight:500}}>{v == null ? "—" : typeof v === "number" ? v.toLocaleString("en-IN",{maximumFractionDigits:3}) : String(v)}</span>
            </div>
          ))}
        </div>
      ))}
      {data.qualitative_flags?.length > 0 && (
        <div className="card" style={{ padding:18, gridColumn:"1/-1" }}>
          <div className="section-title">Qualitative Flags</div>
          {data.qualitative_flags.map((f: string) => (
            <div key={f} style={{ fontSize:"0.85rem", color:"var(--text-1)", marginBottom:6 }}>{f}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// small hook workaround
function useEffect(fn: any, deps: any[]) { React.useEffect(fn, deps); }
