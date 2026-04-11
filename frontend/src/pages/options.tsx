import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any, dec = 2) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec }); }
function pctColor(n: any) { return n == null ? "var(--text-2)" : Number(n) >= 0 ? "var(--green)" : "var(--red)"; }
function pct(n: any) { return n == null ? "—" : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`; }

const CHAIN_SYMBOLS = ["^NSEI", "^NSEBANK", "RELIANCE.NS", "TCS.NS", "INFY.NS", "AAPL", "MSFT", "SPY"];

export default function Options() {
  const [tab, setTab] = useState<"chain" | "pricer">("chain");

  const [chainSym, setChainSym] = useState("^NSEI");
  const [chainData, setChainData] = useState<any>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState("");
  const [chainType, setChainType] = useState<"calls" | "puts">("calls");

  const [bs, setBs] = useState({ spot_price: 24000, strike_price: 24000, time_to_expiry_days: 30, risk_free_rate: 6.5, volatility: 18, option_type: "call" });
  const [bsResult, setBsResult] = useState<any>(null);
  const [bsLoading, setBsLoading] = useState(false);
  const [bsError, setBsError] = useState("");

  async function loadChain(sym?: string) {
    const s = (sym || chainSym).trim().toUpperCase();
    setChainSym(s);
    setChainLoading(true);
    setChainError("");
    setChainData(null);
    try {
      const data = await api.optionsChain(s);
      setChainData(data);
    } catch (e: any) {
      setChainError(e.message || "Options chain not available for this symbol.");
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
              placeholder="Symbol e.g. ^NSEI, RELIANCE.NS, AAPL"
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
              <button key={s} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.75rem" }} onClick={() => loadChain(s)}>
                {s.replace("^", "").replace(".NS", "")}
              </button>
            ))}
          </div>

          {chainError && (
            <div style={{ background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", color: "#fca5a5", marginBottom: 16, fontSize: "0.875rem" }}>
              {chainError}
              <div style={{ marginTop: 6, fontSize: "0.8rem", color: "#f87171" }}>
                Tip: Global symbols (AAPL, MSFT, SPY) and major indices (^NSEI) usually have options data.
              </div>
            </div>
          )}

          {chainData && (
            <>
              <div className="card" style={{ padding: "14px 20px", marginBottom: 14, display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div className="metric-label">Underlying</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-1)" }}>{chainData.symbol}</div>
                </div>
                <div>
                  <div className="metric-label">Spot Price</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-1)" }}>{fmt(chainData.underlying_price)}</div>
                </div>
                <div>
                  <div className="metric-label">Expiry</div>
                  <div style={{ fontWeight: 600, color: "var(--gold)" }}>{chainData.expiry}</div>
                </div>
                <div>
                  <div className="metric-label">Available Expiries</div>
                  <div style={{ fontWeight: 600, color: "var(--text-2)", fontSize: "0.8rem" }}>{chainData.expiration_dates?.slice(0, 4).join(" · ")}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {(["calls", "puts"] as const).map(ct => (
                  <button key={ct} className={`btn ${chainType === ct ? "btn-gold" : "btn-ghost"}`} onClick={() => setChainType(ct)}>
                    {ct.toUpperCase()} ({chainData[ct]?.length || 0})
                  </button>
                ))}
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Strike</th>
                        <th style={{ textAlign: "right" }}>Last</th>
                        <th style={{ textAlign: "right" }}>Bid</th>
                        <th style={{ textAlign: "right" }}>Ask</th>
                        <th style={{ textAlign: "right" }}>Change</th>
                        <th style={{ textAlign: "right" }}>Volume</th>
                        <th style={{ textAlign: "right" }}>OI</th>
                        <th style={{ textAlign: "right" }}>IV %</th>
                        <th style={{ textAlign: "center" }}>ITM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.slice(0, 30).map((c: any, i: number) => (
                        <tr key={i} style={{ background: c.in_the_money ? "rgba(234,179,8,0.06)" : "transparent" }}>
                          <td style={{ fontWeight: 700, color: "var(--gold)" }}>{fmt(c.strike)}</td>
                          <td className="num">{fmt(c.last_price)}</td>
                          <td className="num" style={{ color: "var(--text-3)" }}>{fmt(c.bid)}</td>
                          <td className="num" style={{ color: "var(--text-3)" }}>{fmt(c.ask)}</td>
                          <td className="num" style={{ color: pctColor(c.change) }}>{c.change >= 0 ? "+" : ""}{fmt(c.change)}</td>
                          <td className="num">{c.volume?.toLocaleString("en-IN") || "—"}</td>
                          <td className="num">{c.open_interest?.toLocaleString("en-IN") || "—"}</td>
                          <td className="num">{c.implied_vol_pct ? `${c.implied_vol_pct}%` : "—"}</td>
                          <td style={{ textAlign: "center", fontSize: "0.8rem" }}>{c.in_the_money ? <span style={{ color: "var(--green)" }}>✓</span> : <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--text-3)" }}>
                ⚠️ Options data via Yahoo Finance. Not all Indian F&O symbols are available. Verify on NSE/BSE directly.
              </div>
            </>
          )}

          {!chainData && !chainLoading && !chainError && (
            <div className="empty">Enter a symbol to load its options chain</div>
          )}
        </>
      )}

      {tab === "pricer" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 22 }}>
            <div className="section-title" style={{ marginBottom: 16 }}>Black-Scholes Inputs</div>
            {[
              { key: "spot_price",          label: "Spot Price (S)",           type: "number" },
              { key: "strike_price",        label: "Strike Price (K)",         type: "number" },
              { key: "time_to_expiry_days", label: "Days to Expiry (T)",       type: "number" },
              { key: "risk_free_rate",      label: "Risk-Free Rate % (r)",     type: "number", step: "0.1" },
              { key: "volatility",          label: "Annual Volatility % (σ)",  type: "number", step: "0.5" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.78rem", color: "var(--text-3)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  className="input"
                  type={f.type}
                  step={(f as any).step || "1"}
                  value={(bs as any)[f.key]}
                  onChange={e => setBs(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "0.78rem", color: "var(--text-3)", display: "block", marginBottom: 4 }}>Option Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["call", "put"].map(t => (
                  <button key={t} className={`btn ${bs.option_type === t ? "btn-gold" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setBs(prev => ({ ...prev, option_type: t }))}>
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
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
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
                      <span className={`rec-${bsResult.moneyness?.toLowerCase()?.replace(" ", "")}`} style={{ fontSize: "1rem" }}>{bsResult.moneyness}</span>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                  <div className="section-title" style={{ marginBottom: 14 }}>Greeks</div>
                  {[
                    { label: "Delta (Δ)", value: bsResult.pricing?.delta, desc: "Price change per ₹1 move in spot" },
                    { label: "Gamma (Γ)", value: bsResult.pricing?.gamma, desc: "Delta change per ₹1 move in spot" },
                    { label: "Theta (Θ)", value: bsResult.pricing?.theta, desc: "Daily time decay (₹/day)" },
                    { label: "Vega (ν)",  value: bsResult.pricing?.vega,  desc: "Price change per 1% IV change" },
                    { label: "Rho (ρ)",   value: bsResult.pricing?.rho,   desc: "Price change per 1% rate change" },
                  ].map(g => (
                    <div key={g.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.9rem" }}>{g.label}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 2 }}>{g.desc}</div>
                      </div>
                      <div style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--gold)", fontSize: "1rem" }}>{fmt(g.value, 4)}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 6 }}>
                    ⚠️ B-S assumes constant volatility & European exercise. Not financial advice.
                  </div>
                </div>
              </>
            ) : (
              <div className="card" style={{ padding: 30 }}>
                <div className="section-title" style={{ marginBottom: 10 }}>About Black-Scholes</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.7 }}>
                  <p>The Black-Scholes model prices European options using 5 inputs: spot price, strike, time to expiry, risk-free rate, and implied volatility.</p>
                  <p style={{ marginTop: 10 }}>
                    <strong style={{ color: "var(--text-1)" }}>Greeks</strong> measure an option's sensitivity to market factors —
                    essential for risk management and hedging strategies.
                  </p>
                  <p style={{ marginTop: 10 }}>Typical Indian market values: Risk-free rate ≈ 6.5% (RBI Repo), IV for Nifty ≈ 14-22%.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
