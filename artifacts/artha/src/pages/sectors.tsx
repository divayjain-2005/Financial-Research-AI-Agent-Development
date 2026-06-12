import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

const SECTORS = ["IT","Banking","Energy","FMCG","Pharma","Auto"];
function fmt(n: any) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function pctColor(n: any) { return Number(n) >= 0 ? "var(--green)" : "var(--red)"; }
function pctFmt(n: any) { return n == null ? "—" : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`; }

export default function Sectors() {
  const [sector, setSector] = useState("IT");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function load(s: string) {
    setSector(s); setData(null); setUnavailable(false); setLoading(true);
    try {
      setData(await api.sectorCompare(s));
    } catch {
      setUnavailable(true);
    }
    setLoading(false);
  }

  useEffect(() => { load("IT"); }, []);

  return (
    <Layout title="Sector Analysis">
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        {SECTORS.map(s => (
          <button
            key={s}
            onClick={() => load(s)}
            style={{
              padding:"6px 18px", borderRadius:8, fontSize:"0.875rem", fontWeight:600, cursor:"pointer",
              border: `1px solid ${sector === s ? "var(--gold)" : "var(--border)"}`,
              background: sector === s ? "#78350f44" : "var(--bg-card)",
              color: sector === s ? "var(--gold)" : "var(--text-2)",
              transition:"all 0.15s",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <div className="loading"><span className="spinner" style={{marginRight:10}}/>Loading {sector} sector data…</div>}

      {unavailable && !loading && (
        <div style={{
          textAlign: "center", padding: "40px 20px",
          color: "var(--text-3)", fontSize: "0.9rem",
          border: "1px dashed var(--border)", borderRadius: 12,
        }}>
          Live market data is currently unavailable.
          <br />
          <a href="/chat" style={{ color: "var(--gold)", textDecoration: "none", marginTop: 8, display: "inline-block" }}>
            Ask the AI Assistant about {sector} sector stocks →
          </a>
        </div>
      )}

      {data && !loading && (
        <>
          {data.top_performer && (
            <div style={{ background:"#14532d22", border:"1px solid #14532d", borderRadius:10, padding:"12px 16px", marginBottom:16, color:"var(--green)", fontSize:"0.875rem" }}>
              🏆 Top Performer in {sector}: <strong>{data.top_performer?.split(".")[0]}</strong>
            </div>
          )}

          <div className="card" style={{ padding:20, marginBottom:14 }}>
            <div className="section-title">3-Month Returns — {sector} Sector</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:10 }}>
              {[...data.data].sort((a: any, b: any) => (b.return_3m_pct || 0) - (a.return_3m_pct || 0)).map((stock: any) => {
                const pct = stock.return_3m_pct || 0;
                const maxAbs = Math.max(...data.data.map((x: any) => Math.abs(x.return_3m_pct || 0)));
                const barW = maxAbs > 0 ? Math.abs(pct) / maxAbs * 100 : 0;
                return (
                  <div key={stock.symbol} style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:80, fontSize:"0.8rem", color:"var(--gold)", fontWeight:600, flexShrink:0 }}>{stock.symbol?.split(".")[0]}</div>
                    <div style={{ flex:1, background:"var(--bg-deep)", borderRadius:6, height:20, overflow:"hidden" }}>
                      <div style={{ width:`${barW}%`, height:"100%", background: pct >= 0 ? "var(--green)" : "var(--red)", borderRadius:6, minWidth:2 }} />
                    </div>
                    <div style={{ width:70, textAlign:"right", fontSize:"0.82rem", color:pctColor(pct), fontWeight:600 }}>{pctFmt(pct)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding:20 }}>
            <div className="section-title">{sector} Stocks Detail ({data.stocks_analysed} stocks)</div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Company</th>
                  <th style={{textAlign:"right"}}>Price (₹)</th>
                  <th style={{textAlign:"right"}}>3M Return</th>
                  <th style={{textAlign:"right"}}>P/E Ratio</th>
                  <th style={{textAlign:"right"}}>Market Cap</th>
                  <th style={{textAlign:"right"}}>Signal</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((stock: any) => (
                  <tr key={stock.symbol}>
                    <td>
                      <div style={{color:"var(--gold)",fontWeight:600}}>{stock.symbol?.split(".")[0]}</div>
                      <div style={{fontSize:"0.75rem",color:"var(--text-3)"}}>{stock.company}</div>
                    </td>
                    <td className="num" style={{color:"var(--text-1)",fontWeight:600}}>₹{fmt(stock.price)}</td>
                    <td className="num" style={{color:pctColor(stock.return_3m_pct),fontWeight:600}}>{pctFmt(stock.return_3m_pct)}</td>
                    <td className="num">{stock.pe_ratio ? stock.pe_ratio.toFixed(1) : "—"}</td>
                    <td className="num">{stock.market_cap ? `₹${(stock.market_cap/1e9).toFixed(1)} B` : "—"}</td>
                    <td style={{textAlign:"right"}}>{stock.recommendation && <span className={`rec-${stock.recommendation.toLowerCase()}`}>{stock.recommendation}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}
