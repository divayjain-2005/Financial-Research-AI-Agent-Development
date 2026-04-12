import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });

function fmtLakh(n: any): string {
  if (n == null || n === 0) return "0";
  const abs = Math.abs(Number(n));
  if (abs >= 1e7) return `${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${(abs / 1e5).toFixed(2)} L`;
  return abs.toLocaleString("en-IN");
}
function fmt2(n: any) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function pctStr(n: any) {
  if (n == null) return "";
  const v = Number(n);
  return `(${v >= 0 ? "+" : ""}${v.toFixed(2)}%)`;
}

const CHAIN_SYMBOLS = [
  { label: "NIFTY", sym: "^NSEI" },
  { label: "BANKNIFTY", sym: "^NSEBANK" },
  { label: "RELIANCE", sym: "RELIANCE.NS" },
  { label: "TCS", sym: "TCS.NS" },
  { label: "INFY", sym: "INFY.NS" },
  { label: "HDFCBANK", sym: "HDFCBANK.NS" },
  { label: "SBIN", sym: "SBIN.NS" },
];

function symToTV(s: string): string {
  if (s.endsWith(".NS")) return `NSE:${s.replace(".NS", "")}`;
  if (s.endsWith(".BO")) return `BSE:${s.replace(".BO", "")}`;
  if (s === "^NSEI") return "NSE:NIFTY";
  if (s === "^NSEBANK") return "NSE:BANKNIFTY";
  if (s === "^BSESN") return "BSE:SENSEX";
  return s;
}

export default function Options() {
  const [tab, setTab] = useState<"chain" | "pricer">("chain");
  const [chainSym, setChainSym] = useState("^NSEI");
  const [chainData, setChainData] = useState<any>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState("");
  const [expiryIdx, setExpiryIdx] = useState(0);
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<"call" | "put" | null>(null);
  const [searchStrike, setSearchStrike] = useState("");

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
    setSelectedStrike(null);
    setSelectedSide(null);
    try {
      const data = await api.optionsChain(s, idx);
      setChainData(data);
    } catch (e: any) {
      setChainError(e.message || "Failed to load options chain.");
    }
    setChainLoading(false);
  }

  async function calcBS() {
    setBsLoading(true); setBsError(""); setBsResult(null);
    try {
      const res = await api.blackScholes({
        spot_price: Number(bs.spot_price), strike_price: Number(bs.strike_price),
        time_to_expiry_days: Number(bs.time_to_expiry_days), risk_free_rate: Number(bs.risk_free_rate),
        volatility: Number(bs.volatility), option_type: bs.option_type,
      });
      setBsResult(res);
    } catch (e: any) { setBsError(e.message || "Calculation failed"); }
    setBsLoading(false);
  }

  useEffect(() => { loadChain(); }, []);

  const strikeRows = useMemo(() => {
    if (!chainData) return [];
    const callMap: Record<number, any> = {};
    const putMap: Record<number, any> = {};
    chainData.calls?.forEach((c: any) => { callMap[c.strike] = c; });
    chainData.puts?.forEach((p: any)  => { putMap[p.strike]  = p; });
    const all = Array.from(new Set([
      ...(chainData.calls || []).map((c: any) => c.strike),
      ...(chainData.puts  || []).map((p: any) => p.strike),
    ])).sort((a, b) => a - b);
    return all.map(s => ({ strike: s, call: callMap[s], put: putMap[s] }));
  }, [chainData]);

  const filteredRows = useMemo(() => {
    if (!searchStrike) return strikeRows;
    return strikeRows.filter(r => String(r.strike).includes(searchStrike));
  }, [strikeRows, searchStrike]);

  const spotPrice = chainData?.underlying_price;
  const atm = useMemo(() => {
    if (!spotPrice || !strikeRows.length) return null;
    return strikeRows.reduce((best, r) =>
      Math.abs(r.strike - spotPrice) < Math.abs((best?.strike ?? Infinity) - spotPrice) ? r : best
    , null as any)?.strike;
  }, [strikeRows, spotPrice]);

  const sym = chainData?.symbol || chainSym;
  const tvSym = symToTV(chainSym);
  const chartContract = selectedStrike
    ? `${sym} ${selectedSide === "call" ? "CE" : "PE"} ${selectedStrike}`
    : null;

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
          {/* Symbol selector row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            {CHAIN_SYMBOLS.map(s => (
              <button
                key={s.sym}
                className={`btn ${chainSym === s.sym ? "btn-gold" : "btn-ghost"}`}
                style={{ padding: "5px 14px", fontSize: "0.8rem" }}
                onClick={() => loadChain(s.sym)}
                disabled={chainLoading}
              >
                {s.label}
              </button>
            ))}
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <input
                className="input"
                placeholder="Custom symbol e.g. WIPRO.NS"
                style={{ width: 200, fontSize: "0.8rem" }}
                onKeyDown={e => { if (e.key === "Enter") loadChain((e.target as HTMLInputElement).value); }}
              />
            </div>
          </div>

          {chainError && (
            <div style={{ background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", color: "#fca5a5", marginBottom: 16, fontSize: "0.875rem" }}>
              {chainError}
            </div>
          )}

          {chainLoading && (
            <div className="loading"><span className="spinner" /></div>
          )}

          {chainData && (
            <>
              {/* Header bar – NSE style */}
              <div style={{
                display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                background: "var(--bg-card)", borderRadius: 10, padding: "12px 18px",
                marginBottom: 14, border: "1px solid var(--border)",
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-1)" }}>{sym}</span>
                  <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--text-3)" }}>NSE</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-1)" }}>{fmt2(spotPrice)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Spot</span>
                </div>
                {chainData.historical_vol_pct && (
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>HV30d </span>
                    <span style={{ fontWeight: 600, color: "var(--gold)" }}>{chainData.historical_vol_pct}%</span>
                  </div>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>Expiry:</span>
                  {chainData.expiration_dates?.map((d: string, i: number) => (
                    <button key={d}
                      className={`btn ${expiryIdx === i ? "btn-gold" : "btn-ghost"}`}
                      style={{ padding: "3px 9px", fontSize: "0.72rem" }}
                      onClick={() => { setExpiryIdx(i); loadChain(chainSym, i); }}>
                      {d}
                    </button>
                  ))}
                </div>
                <input
                  className="input"
                  placeholder="Search Strike"
                  value={searchStrike}
                  onChange={e => setSearchStrike(e.target.value)}
                  style={{ width: 140, fontSize: "0.78rem" }}
                />
              </div>

              {/* Info note */}
              {chainData.data_note && (
                <div style={{ marginBottom: 10, padding: "8px 14px", background: "#0f2a3a", border: "1px solid #1d4a5a", borderRadius: 8, fontSize: "0.75rem", color: "#67c2e0" }}>
                  ℹ️ {chainData.data_note}
                </div>
              )}

              {/* Combined CALL | Strike | PUT table */}
              <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                        <th colSpan={4} style={{ textAlign: "center", padding: "10px 0", color: "#4ade80", fontWeight: 700, letterSpacing: "0.1em", borderBottom: "2px solid rgba(74,222,128,0.3)" }}>
                          CALL
                        </th>
                        <th style={{ textAlign: "center", padding: "10px 14px", color: "var(--gold)", fontWeight: 700, borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", borderBottom: "2px solid var(--gold)", minWidth: 72 }}>
                          Strike
                        </th>
                        <th colSpan={4} style={{ textAlign: "center", padding: "10px 0", color: "#f87171", fontWeight: 700, letterSpacing: "0.1em", borderBottom: "2px solid rgba(248,113,113,0.3)" }}>
                          PUT
                        </th>
                      </tr>
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        <th style={{ textAlign: "right", padding: "7px 12px", color: "var(--text-3)", fontWeight: 500 }}>Volume</th>
                        <th style={{ textAlign: "right", padding: "7px 12px", color: "var(--text-3)", fontWeight: 500 }}>OI</th>
                        <th style={{ textAlign: "right", padding: "7px 12px", color: "var(--text-3)", fontWeight: 500 }}>IV%</th>
                        <th style={{ textAlign: "right", padding: "7px 14px", color: "#4ade80", fontWeight: 600 }}>LTP</th>
                        <th style={{ textAlign: "center", padding: "7px 14px", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}></th>
                        <th style={{ textAlign: "left", padding: "7px 14px", color: "#f87171", fontWeight: 600 }}>LTP</th>
                        <th style={{ textAlign: "right", padding: "7px 12px", color: "var(--text-3)", fontWeight: 500 }}>IV%</th>
                        <th style={{ textAlign: "right", padding: "7px 12px", color: "var(--text-3)", fontWeight: 500 }}>OI</th>
                        <th style={{ textAlign: "right", padding: "7px 12px", color: "var(--text-3)", fontWeight: 500 }}>Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map(({ strike, call, put }) => {
                        const isAtm = strike === atm;
                        const callItm = call?.in_the_money;
                        const putItm  = put?.in_the_money;
                        const selected = selectedStrike === strike;

                        return (
                          <tr
                            key={strike}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              background: isAtm
                                ? "rgba(234,179,8,0.08)"
                                : selected ? "rgba(255,255,255,0.06)" : "transparent",
                              outline: isAtm ? "1px solid rgba(234,179,8,0.3)" : "none",
                            }}
                          >
                            {/* CALL side */}
                            <td
                              onClick={() => { setSelectedStrike(strike); setSelectedSide("call"); }}
                              style={{
                                textAlign: "right", padding: "9px 12px",
                                color: callItm ? "#4ade80" : "var(--text-2)",
                                cursor: "pointer", transition: "background 0.1s",
                                background: selectedStrike === strike && selectedSide === "call" ? "rgba(74,222,128,0.08)" : "transparent",
                              }}
                            >
                              {fmtLakh(call?.volume)}
                            </td>
                            <td
                              onClick={() => { setSelectedStrike(strike); setSelectedSide("call"); }}
                              style={{ textAlign: "right", padding: "9px 12px", color: callItm ? "#4ade80" : "var(--text-2)", cursor: "pointer" }}
                            >
                              {fmtLakh(call?.open_interest)}
                            </td>
                            <td
                              onClick={() => { setSelectedStrike(strike); setSelectedSide("call"); }}
                              style={{ textAlign: "right", padding: "9px 12px", color: "#60a5fa", cursor: "pointer" }}
                            >
                              {call?.implied_vol_pct ? `${call.implied_vol_pct}%` : "—"}
                            </td>
                            <td
                              onClick={() => { setSelectedStrike(strike); setSelectedSide("call"); }}
                              style={{
                                textAlign: "right", padding: "9px 14px", cursor: "pointer",
                                fontWeight: callItm ? 700 : 600,
                                color: callItm ? "#4ade80" : "var(--text-1)",
                              }}
                            >
                              {call ? `₹${fmt2(call.last_price)}` : "—"}
                            </td>

                            {/* Strike center */}
                            <td style={{
                              textAlign: "center", padding: "9px 14px", fontWeight: 700, fontSize: "0.88rem",
                              color: isAtm ? "var(--gold)" : "var(--text-1)",
                              borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)",
                              background: isAtm ? "rgba(234,179,8,0.05)" : "transparent",
                            }}>
                              {strike.toLocaleString("en-IN")}
                              {isAtm && (
                                <div style={{ fontSize: "0.6rem", color: "var(--gold)", fontWeight: 400, opacity: 0.8 }}>ATM</div>
                              )}
                            </td>

                            {/* PUT side */}
                            <td
                              onClick={() => { setSelectedStrike(strike); setSelectedSide("put"); }}
                              style={{
                                textAlign: "left", padding: "9px 14px", cursor: "pointer",
                                fontWeight: putItm ? 700 : 600,
                                color: putItm ? "#f87171" : "var(--text-1)",
                                background: selectedStrike === strike && selectedSide === "put" ? "rgba(248,113,113,0.08)" : "transparent",
                              }}
                            >
                              {put ? `₹${fmt2(put.last_price)}` : "—"}
                            </td>
                            <td
                              onClick={() => { setSelectedStrike(strike); setSelectedSide("put"); }}
                              style={{ textAlign: "right", padding: "9px 12px", color: "#60a5fa", cursor: "pointer" }}
                            >
                              {put?.implied_vol_pct ? `${put.implied_vol_pct}%` : "—"}
                            </td>
                            <td
                              onClick={() => { setSelectedStrike(strike); setSelectedSide("put"); }}
                              style={{ textAlign: "right", padding: "9px 12px", color: putItm ? "#f87171" : "var(--text-2)", cursor: "pointer" }}
                            >
                              {fmtLakh(put?.open_interest)}
                            </td>
                            <td
                              onClick={() => { setSelectedStrike(strike); setSelectedSide("put"); }}
                              style={{ textAlign: "right", padding: "9px 12px", color: putItm ? "#f87171" : "var(--text-2)", cursor: "pointer" }}
                            >
                              {fmtLakh(put?.volume)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginBottom: 8 }}>
                ⚠️ Prices are theoretical (Black-Scholes). Click any row to view the underlying chart. Not financial advice.
              </div>

              {/* Chart panel — shown when a row is clicked */}
              {selectedStrike !== null && (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 18px", borderBottom: "1px solid var(--border)",
                    background: "var(--bg-hover)",
                  }}>
                    <span style={{ fontWeight: 700, color: "var(--text-1)" }}>
                      {sym} — {selectedSide?.toUpperCase()} {selectedStrike}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                      (Showing underlying chart: {tvSym})
                    </span>
                    <button
                      className="btn btn-ghost"
                      style={{ marginLeft: "auto", padding: "4px 10px", fontSize: "0.75rem" }}
                      onClick={() => { setSelectedStrike(null); setSelectedSide(null); }}
                    >
                      ✕ Close
                    </button>
                  </div>
                  <TradingViewChart
                    key={`${tvSym}-${selectedStrike}-${selectedSide}`}
                    symbol={tvSym}
                    height={500}
                    showToolbar
                  />
                </div>
              )}
            </>
          )}

          {!chainData && !chainLoading && !chainError && (
            <div className="empty">Select a symbol above to load the options chain</div>
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
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <div>
                      <div className="metric-label">Theoretical Price</div>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--gold)" }}>{fmt2(bsResult.pricing?.price)}</div>
                    </div>
                    <div>
                      <div className="metric-label">Intrinsic Value</div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-1)" }}>{fmt2(bsResult.intrinsic_value)}</div>
                    </div>
                    <div>
                      <div className="metric-label">Time Value</div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-2)" }}>{fmt2(bsResult.time_value)}</div>
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
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: g.color, fontSize: "1rem" }}>
                        {g.value == null ? "—" : Number(g.value).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="card" style={{ padding: 24 }}>
                <div className="section-title" style={{ marginBottom: 10 }}>About Black-Scholes</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.7 }}>
                  <p>The Black-Scholes model prices European options using 5 inputs: spot price, strike, time to expiry, risk-free rate, and volatility.</p>
                  <p style={{ marginTop: 10 }}><strong style={{ color: "var(--text-1)" }}>Greeks</strong> measure sensitivity to market factors — essential for risk management and hedging.</p>
                  <p style={{ marginTop: 10 }}>Typical Indian values: Risk-free rate ≈ 6.5% (RBI Repo), Nifty IV ≈ 14–22%.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
