import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import TradingViewChart from "@/components/TradingViewChart";
import { api } from "@/utils/api";

function fmt(n: any, dec = 2) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec }); }
function pctColor(n: any) { return n == null ? "var(--text-2)" : Number(n) >= 0 ? "var(--green)" : "var(--red)"; }

const CHAIN_SYMBOLS = ["^NSEI", "^NSEBANK", "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "SBIN.NS", "WIPRO.NS"];

export default function Options() {
  const [tab, setTab] = useState<"chain" | "pricer">("chain");

  const [chainSym, setChainSym] = useState("^NSEI");
  const [chainData, setChainData] = useState<any>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState("");
  const [chainType, setChainType] = useState<"calls" | "puts">("calls");
  const [showGreeks, setShowGreeks] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [expiryIdx, setExpiryIdx] = useState(0);

  const [bs, setBs] = useState({ spot_price: 24000, strike_price: 24000, time_to_expiry_days: 30, risk_free_rate: 6.5, volatility: 18, option_type: "call" });
  const [bsResult, setBsResult] = useState<any>(null);
  const [bsLoading, setBsLoading] = useState(false);
  const [bsError, setBsError] = useState("");

  async function loadChain(sym?: string, eidx?: number) {
    const s = (sym || chainSym).trim().toUpperCase();
    const idx = eidx ?? expiryIdx;
    setChainSym(s);
    setChainLoading(true);
    setChainError("");
    setChainData(null);
    try {
      const data = await api.optionsChain(s, idx);
      setChainData(data);
    } catch (e: any) {
      setChainError(e.message || "Failed to load options chain.");
    }
    setChainLoading(false);
  }

  async function calcBS() {
    setBsLoading(true);
    setBsError("");
    setBsResult(null);
    try {
      const res = await api.blackScholes({
        spot_price: Number(bs.spot_price),
        strike_price: Number(bs.strike_price),
        time_to_expiry_days: Number(bs.time_to_expiry_days),
        risk_free_rate: Number(bs.risk_free_rate),
        volatility: Number(bs.volatility),
        option_type: bs.option_type,
      });
      setBsResult(res);
    } catch (e: any) {
      setBsError(e.message || "Calculation failed");
    }
    setBsLoading(false);
  }

  useEffect(() => { loadChain(); }, []);

  const contracts = chainData?.[chainType] || [];

  return (
    <Layout title="Options">
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {(["chain", "pricer"] as const).map(t => (
          <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "chain" ? "Options Chain" : "Black-Scholes Pricer"}
          </div>
        ))}
      </div>

      {tab === "chain" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Symbol e.g. ^NSEI, RELIANCE.NS, WIPRO.NS"
              value={chainSym}
              onChange={e => setChainSym(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && loadChain()}
              style={{ maxWidth: 300 }}
            />
            <button className="btn btn-gold" onClick={() => loadChain()} disabled={chainLoading}>
              {chainLoading ? <span className="spinner" /> : "Load Chain"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {CHAIN_SYMBOLS.map(s => (
              <button key={s} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                onClick={() => loadChain(s)}>
                {s.replace("^", "").replace(".NS", "")}
              </button>
            ))}
          </div>

          {chainError && (
            <div style={{ background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", color: "#fca5a5", marginBottom: 16, fontSize: "0.875rem" }}>
              {chainError}
            </div>
          )}

          {chainData && (
            <>
              {/* Summary row */}
              <div className="card" style={{ padding: "14px 20px", marginBottom: 14, display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div className="metric-label">Underlying</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-1)" }}>{chainData.symbol} {chainData.company && `· ${chainData.company}`}</div>
                </div>
                <div>
                  <div className="metric-label">Spot Price</div>
                  <div style={{ fontWeight: 700, fontSize: "1.3rem", color: "var(--text-1)" }}>{fmt(chainData.underlying_price)}</div>
                </div>
                <div>
                  <div className="metric-label">Historical Vol (30d)</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--gold)" }}>{chainData.historical_vol_pct}%</div>
                </div>
                <div>
                  <div className="metric-label">Days to Expiry</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-1)" }}>{chainData.days_to_expiry}</div>
                </div>
                <div>
                  <div className="metric-label">Expiry</div>
                  <div style={{ fontWeight: 600, color: "var(--gold)" }}>{chainData.expiry}</div>
                </div>
              </div>

              {/* Expiry selector */}
              {chainData.expiration_dates?.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-3)", alignSelf: "center", marginRight: 4 }}>Expiry:</span>
                  {chainData.expiration_dates.map((d: string, i: number) => (
                    <button key={d} className={`btn ${expiryIdx === i ? "btn-gold" : "btn-ghost"}`}
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                      onClick={() => { setExpiryIdx(i); loadChain(chainSym, i); }}>
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {/* Info banner */}
              <div style={{ marginBottom: 14, padding: "10px 14px", background: "#0f2a3a", border: "1px solid #1d4a5a", borderRadius: 8, fontSize: "0.78rem", color: "#67c2e0", lineHeight: 1.6 }}>
                ℹ️ {chainData.data_note}
              </div>

              {/* TradingView chart toggle */}
              <div style={{ marginBottom: 14 }}>
                <button className={`btn ${showChart ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: "0.82rem" }}
                  onClick={() => setShowChart(c => !c)}>
                  📈 {showChart ? "Hide" : "Show"} Underlying Chart
                </button>
              </div>
              {showChart && (
                <div style={{ marginBottom: 18 }}>
                  <TradingViewChart symbol={chainSym} height={440} />
                </div>
              )}

              {/* Calls / Puts toggle + Greeks toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                {(["calls", "puts"] as const).map(ct => (
                  <button key={ct} className={`btn ${chainType === ct ? "btn-gold" : "btn-ghost"}`}
                    onClick={() => setChainType(ct)}>
                    {ct.toUpperCase()} ({chainData[ct]?.length || 0})
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button className={`btn ${showGreeks ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                  onClick={() => setShowGreeks(g => !g)}>
                  {showGreeks ? "Hide Greeks" : "Show Greeks"}
                </button>
              </div>

              {/* Chain table */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "center" }}>ITM</th>
                        <th style={{ textAlign: "right" }}>Strike</th>
                        <th style={{ textAlign: "right" }}>Last</th>
                        <th style={{ textAlign: "right" }}>Bid</th>
                        <th style={{ textAlign: "right" }}>Ask</th>
                        <th style={{ textAlign: "right" }}>IV %</th>
                        <th style={{ textAlign: "right" }}>Volume</th>
                        <th style={{ textAlign: "right" }}>OI</th>
                        {showGreeks && <>
                          <th style={{ textAlign: "right" }}>Δ Delta</th>
                          <th style={{ textAlign: "right" }}>Γ Gamma</th>
                          <th style={{ textAlign: "right" }}>Θ Theta</th>
                          <th style={{ textAlign: "right" }}>ν Vega</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c: any, i: number) => (
                        <tr key={i} style={{
                          background: c.in_the_money ? "rgba(234,179,8,0.07)" : "transparent",
                          fontWeight: c.in_the_money ? 600 : 400,
                        }}>
                          <td style={{ textAlign: "center" }}>
                            {c.in_the_money
                              ? <span style={{ color: "var(--green)", fontSize: "0.8rem" }}>ITM</span>
                              : <span style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>OTM</span>}
                          </td>
                          <td className="num" style={{ color: "var(--gold)", fontWeight: 700, fontSize: "0.95rem" }}>{fmt(c.strike)}</td>
                          <td className="num" style={{ color: "var(--text-1)" }}>{fmt(c.last_price)}</td>
                          <td className="num" style={{ color: "var(--text-3)" }}>{fmt(c.bid)}</td>
                          <td className="num" style={{ color: "var(--text-3)" }}>{fmt(c.ask)}</td>
                          <td className="num" style={{ color: "#60a5fa" }}>{c.implied_vol_pct ? `${c.implied_vol_pct}%` : "—"}</td>
                          <td className="num">{c.volume?.toLocaleString("en-IN") || "—"}</td>
                          <td className="num">{c.open_interest?.toLocaleString("en-IN") || "—"}</td>
                          {showGreeks && <>
                            <td className="num" style={{ color: "#a78bfa" }}>{fmt(c.delta, 4)}</td>
                            <td className="num" style={{ color: "#60a5fa" }}>{fmt(c.gamma, 5)}</td>
                            <td className="num" style={{ color: "#fb923c" }}>{fmt(c.theta, 4)}</td>
                            <td className="num" style={{ color: "#34d399" }}>{fmt(c.vega, 4)}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: "0.73rem", color: "var(--text-3)" }}>
                ⚠️ Prices are theoretical (Black-Scholes model). OI/Volume are illustrative. Not financial advice.
              </div>
            </>
          )}

          {!chainData && !chainLoading && !chainError && (
            <div className="empty">Enter any Indian or global stock symbol to generate its options chain</div>
          )}
        </>
      )}

      {tab === "pricer" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 22 }}>
            <div className="section-title" style={{ marginBottom: 16 }}>Black-Scholes Inputs</div>
            {[
              { key: "spot_price",          label: "Spot Price (S)" },
              { key: "strike_price",        label: "Strike Price (K)" },
              { key: "time_to_expiry_days", label: "Days to Expiry (T)" },
              { key: "risk_free_rate",      label: "Risk-Free Rate % (r)", step: "0.1" },
              { key: "volatility",          label: "Annual Volatility % (σ)", step: "0.5" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.78rem", color: "var(--text-3)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input className="input" type="number" step={(f as any).step || "1"}
                  value={(bs as any)[f.key]}
                  onChange={e => setBs(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: "100%" }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "0.78rem", color: "var(--text-3)", display: "block", marginBottom: 4 }}>Option Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["call", "put"].map(t => (
                  <button key={t} className={`btn ${bs.option_type === t ? "btn-gold" : "btn-ghost"}`} style={{ flex: 1 }}
                    onClick={() => setBs(prev => ({ ...prev, option_type: t }))}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-gold" style={{ width: "100%" }} onClick={calcBS} disabled={bsLoading}>
              {bsLoading ? <span className="spinner" /> : "Calculate Price & Greeks"}
            </button>
            {bsError && <div style={{ marginTop: 10, color: "#fca5a5", fontSize: "0.8rem" }}>{bsError}</div>}
          </div>

          <div>
            {bsResult ? (
              <>
                <div className="card" style={{ padding: 20, marginBottom: 14 }}>
                  <div className="section-title" style={{ marginBottom: 14 }}>Option Price</div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 4 }}>
                    <div>
                      <div className="metric-label">Theoretical Price</div>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--gold)" }}>{fmt(bsResult.pricing?.price)}</div>
                    </div>
                    <div>
                      <div className="metric-label">Intrinsic Value</div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-1)" }}>{fmt(bsResult.intrinsic_value)}</div>
                    </div>
                    <div>
                      <div className="metric-label">Time Value</div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-2)" }}>{fmt(bsResult.time_value)}</div>
                    </div>
                    <div>
                      <div className="metric-label">Moneyness</div>
                      <div style={{ marginTop: 8, fontWeight: 700, color: bsResult.moneyness === "ITM" ? "var(--green)" : bsResult.moneyness === "OTM" ? "var(--red)" : "var(--gold)" }}>
                        {bsResult.moneyness}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <div className="section-title" style={{ marginBottom: 14 }}>Greeks</div>
                  {[
                    { label: "Delta (Δ)", value: bsResult.pricing?.delta, color: "#a78bfa", desc: "₹ change per ₹1 spot move" },
                    { label: "Gamma (Γ)", value: bsResult.pricing?.gamma, color: "#60a5fa", desc: "Delta change per ₹1 spot move" },
                    { label: "Theta (Θ)", value: bsResult.pricing?.theta, color: "#fb923c", desc: "Daily time decay (₹/day)" },
                    { label: "Vega (ν)",  value: bsResult.pricing?.vega,  color: "#34d399", desc: "₹ change per 1% IV change" },
                    { label: "Rho (ρ)",   value: bsResult.pricing?.rho,   color: "#f472b6", desc: "₹ change per 1% rate change" },
                  ].map(g => (
                    <div key={g.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <span style={{ fontWeight: 600, color: g.color }}>{g.label}</span>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 2 }}>{g.desc}</div>
                      </div>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: g.color, fontSize: "1rem" }}>{fmt(g.value, 4)}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 4 }}>
                    ⚠️ Black-Scholes assumes constant volatility & European exercise. Not financial advice.
                  </div>
                </div>
              </>
            ) : (
              <div className="card" style={{ padding: 24 }}>
                <div className="section-title" style={{ marginBottom: 10 }}>About Black-Scholes</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.7 }}>
                  <p>The Black-Scholes model prices European options using 5 inputs: spot price, strike, time to expiry, risk-free rate, and volatility.</p>
                  <p style={{ marginTop: 10 }}><strong style={{ color: "var(--text-1)" }}>Greeks</strong> measure sensitivity to market factors — essential for risk management and hedging.</p>
                  <p style={{ marginTop: 10 }}>Typical Indian values: Risk-free rate ≈ 6.5% (RBI Repo), Nifty IV ≈ 14–22%.</p>
                  <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-hover)", borderRadius: 8 }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginBottom: 6 }}>Quick example:</div>
                    <div style={{ fontSize: "0.82rem" }}>Nifty at 24,000 · Strike 24,000 · 30 days · 6.5% rate · 18% vol</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
