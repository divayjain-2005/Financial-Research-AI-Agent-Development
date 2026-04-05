import React, { useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function pctColor(n: any) { return n == null ? "var(--text-2)" : Number(n) >= 0 ? "var(--green)" : "var(--red)"; }
function pctFmt(n: any) { return n == null ? "—" : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`; }

const PRESETS = [
  { label: "IT Giants",    syms: "TCS.NS,INFY.NS,WIPRO.NS,HCLTECH.NS" },
  { label: "HDFC vs ICICI",syms: "HDFCBANK.NS,ICICIBANK.NS" },
  { label: "Reliance vs ITC",syms: "RELIANCE.NS,ITC.NS" },
  { label: "Auto",         syms: "MARUTI.NS,TATAMOTORS.NS,M&M.NS" },
  { label: "Pharma",       syms: "SUNPHARMA.NS,DRREDDY.NS,CIPLA.NS" },
];

export default function Compare() {
  const [input, setInput] = useState("RELIANCE.NS,TCS.NS,INFY.NS");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(syms?: string) {
    const s = (syms || input).trim();
    if (!s) return;
    setInput(s);
    setLoading(true); setError("");
    try {
      const res = await api.compare(s);
      setResults(res.comparison || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  const best1y = results.reduce((best, r) => r.change_1y_pct != null && (best == null || r.change_1y_pct > best.change_1y_pct) ? r : best, null);

  return (
    <Layout title="Compare Stocks">
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && run()}
          placeholder="Comma-separated symbols e.g. TCS.NS,INFY.NS,WIPRO.NS"
        />
        <button className="btn btn-gold" onClick={() => run()} disabled={loading}>
          {loading ? <span className="spinner" /> : "Compare"}
        </button>
      </div>

      {/* Presets */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
        {PRESETS.map(p => (
          <button key={p.label} className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:"0.75rem" }} onClick={() => run(p.syms)}>
            {p.label}
          </button>
        ))}
      </div>

      {error && <div style={{ background:"#7f1d1d22", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", marginBottom:16, fontSize:"0.875rem" }}>{error}</div>}

      {results.length > 0 && (
        <>
          {/* Best performer */}
          {best1y && (
            <div style={{ background:"#14532d22", border:"1px solid #14532d", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:"0.875rem", color:"var(--green)" }}>
              🏆 Best 1-Year Performer: <strong>{best1y.company || best1y.symbol}</strong> — {pctFmt(best1y.change_1y_pct)}
            </div>
          )}

          {/* Comparison table */}
          <div className="card" style={{ padding: 20, marginBottom: 14 }}>
            <div className="section-title">Performance Comparison</div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th style={{textAlign:"right"}}>Price</th>
                  <th style={{textAlign:"right"}}>1W</th>
                  <th style={{textAlign:"right"}}>1M</th>
                  <th style={{textAlign:"right"}}>1Y</th>
                  <th style={{textAlign:"right"}}>P/E</th>
                  <th style={{textAlign:"right"}}>Market Cap</th>
                  <th style={{textAlign:"right"}}>RSI</th>
                  <th style={{textAlign:"right"}}>Signal</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.symbol}>
                    <td>
                      <div style={{ fontWeight:600, color:"var(--gold)" }}>{r.symbol?.split(".")[0]}</div>
                      <div style={{ fontSize:"0.75rem", color:"var(--text-3)" }}>{r.company}</div>
                    </td>
                    <td className="num" style={{ color:"var(--text-1)", fontWeight:600 }}>₹{fmt(r.price)}</td>
                    <td className="num" style={{ color: pctColor(r.change_1w_pct) }}>{pctFmt(r.change_1w_pct)}</td>
                    <td className="num" style={{ color: pctColor(r.change_1m_pct) }}>{pctFmt(r.change_1m_pct)}</td>
                    <td className="num" style={{ color: pctColor(r.change_1y_pct), fontWeight:600 }}>{pctFmt(r.change_1y_pct)}</td>
                    <td className="num">{r.pe_ratio ? r.pe_ratio.toFixed(1) : "—"}</td>
                    <td className="num">{r.market_cap ? `₹${(r.market_cap/1e7).toFixed(0)} Cr` : "—"}</td>
                    <td className="num" style={{ color: r.rsi > 70 ? "var(--red)" : r.rsi < 30 ? "var(--green)" : "var(--text-2)" }}>
                      {r.rsi ? r.rsi.toFixed(1) : "—"}
                    </td>
                    <td style={{ textAlign:"right" }}>
                      {r.recommendation && <span className={`rec-${r.recommendation.toLowerCase()}`}>{r.recommendation}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Visual return bars */}
          <div className="card" style={{ padding: 20 }}>
            <div className="section-title">1-Year Return Comparison</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:8 }}>
              {results
                .filter(r => r.change_1y_pct != null)
                .sort((a, b) => b.change_1y_pct - a.change_1y_pct)
                .map((r: any) => {
                  const pct = r.change_1y_pct || 0;
                  const maxAbs = Math.max(...results.map((x: any) => Math.abs(x.change_1y_pct || 0)));
                  const width = maxAbs > 0 ? Math.abs(pct) / maxAbs * 100 : 0;
                  return (
                    <div key={r.symbol} style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:70, fontSize:"0.8rem", color:"var(--gold)", fontWeight:600, flexShrink:0 }}>{r.symbol?.split(".")[0]}</div>
                      <div style={{ flex:1, background:"var(--bg-deep)", borderRadius:6, height:22, overflow:"hidden" }}>
                        <div style={{ width:`${width}%`, height:"100%", background: pct >= 0 ? "var(--green)" : "var(--red)", borderRadius:6, minWidth:2 }} />
                      </div>
                      <div style={{ width:70, textAlign:"right", fontSize:"0.85rem", color: pctColor(pct), fontWeight:600 }}>{pctFmt(pct)}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}

      {!loading && results.length === 0 && (
        <div className="empty">Enter comma-separated symbols and click Compare</div>
      )}
    </Layout>
  );
}
