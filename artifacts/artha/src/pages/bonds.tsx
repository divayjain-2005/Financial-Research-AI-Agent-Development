import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any, dec = 2) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec }); }
function pctColor(n: any) { return n == null ? "var(--text-2)" : Number(n) >= 0 ? "var(--green)" : "var(--red)"; }

export default function Bonds() {
  const [tab, setTab] = useState<"rbi" | "yield" | "etfs" | "ytm">("rbi");
  const [rbiRates, setRbiRates] = useState<any>(null);
  const [yieldCurve, setYieldCurve] = useState<any>(null);
  const [etfs, setEtfs] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [ytm, setYtm] = useState({ face_value: 1000, coupon_rate: 7.1, current_price: 980, years_to_maturity: 10, frequency: 2 });
  const [ytmResult, setYtmResult] = useState<any>(null);
  const [ytmLoading, setYtmLoading] = useState(false);
  const [ytmError, setYtmError] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.rbiRates().catch(() => null),
      api.yieldCurve().catch(() => null),
      api.bondEtfs().catch(() => null),
    ]).then(([r, y, e]) => {
      setRbiRates(r);
      setYieldCurve(y);
      setEtfs(e);
    }).finally(() => setLoading(false));
  }, []);

  async function calcYtm() {
    setYtmLoading(true);
    setYtmError("");
    setYtmResult(null);
    try {
      const r = await api.bondYtm({
        face_value: Number(ytm.face_value),
        coupon_rate: Number(ytm.coupon_rate),
        current_price: Number(ytm.current_price),
        years_to_maturity: Number(ytm.years_to_maturity),
        frequency: Number(ytm.frequency),
      });
      setYtmResult(r);
    } catch (e: any) {
      setYtmError(e.message || "Calculation failed");
    }
    setYtmLoading(false);
  }

  const RATE_COLORS: Record<string, string> = {
    repo_rate: "var(--gold)",
    reverse_repo_rate: "var(--green)",
    crr: "#60a5fa",
    slr: "#a78bfa",
    msf_rate: "#fb923c",
    bank_rate: "#f472b6",
  };

  const RATE_LABELS: Record<string, string> = {
    repo_rate: "Repo Rate",
    reverse_repo_rate: "Reverse Repo Rate",
    crr: "CRR",
    slr: "SLR",
    msf_rate: "MSF Rate",
    bank_rate: "Bank Rate",
  };

  return (
    <Layout title="Bonds & Fixed Income">
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {(["rbi", "yield", "etfs", "ytm"] as const).map(t => (
          <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "rbi" ? "RBI Policy Rates" : t === "yield" ? "Yield Curve" : t === "etfs" ? "Bond ETFs" : "YTM Calculator"}
          </div>
        ))}
      </div>

      {loading && <div className="loading"><span className="spinner" /></div>}

      {!loading && tab === "rbi" && rbiRates && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {Object.entries(RATE_LABELS).map(([key, label]) => (
              <div key={key} className="card" style={{ padding: "18px 20px", borderLeft: `3px solid ${RATE_COLORS[key]}` }}>
                <div className="metric-label">{label}</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: RATE_COLORS[key], marginTop: 4 }}>
                  {(rbiRates as any)[key]}%
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="section-title" style={{ marginBottom: 14 }}>Policy Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Last Updated",     value: rbiRates.last_updated },
                { label: "Next MPC Meeting", value: rbiRates.next_mpc_meeting },
                { label: "Source",           value: rbiRates.source },
              ].map(r => (
                <div key={r.label} style={{ fontSize: "0.875rem" }}>
                  <span style={{ color: "var(--text-3)" }}>{r.label}: </span>
                  <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>Rate Definitions</div>
              {[
                { rate: "Repo Rate",         def: "Rate at which RBI lends money to commercial banks. Primary tool for controlling inflation." },
                { rate: "Reverse Repo Rate", def: "Rate at which RBI borrows from commercial banks. Used to absorb excess liquidity." },
                { rate: "CRR",               def: "Cash Reserve Ratio — % of deposits banks must keep with RBI as cash." },
                { rate: "SLR",               def: "Statutory Liquidity Ratio — % of deposits banks must invest in govt securities." },
                { rate: "MSF Rate",          def: "Marginal Standing Facility — emergency overnight lending rate for banks." },
                { rate: "Bank Rate",         def: "Rate at which RBI provides long-term loans to financial institutions." },
              ].map(r => (
                <div key={r.rate} style={{ marginBottom: 10, fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--gold)", fontWeight: 600 }}>{r.rate}: </span>
                  <span style={{ color: "var(--text-2)" }}>{r.def}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--text-3)" }}>
            ⚠️ {rbiRates.disclaimer}
          </div>
        </>
      )}

      {!loading && tab === "yield" && yieldCurve && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="section-title">Indian Government Securities Yield Curve</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>As of {yieldCurve.as_of}</div>
            </div>

            {/* Visual yield curve */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140, marginBottom: 18, padding: "0 4px" }}>
              {yieldCurve.yield_curve?.map((point: any, i: number) => {
                const maxY = Math.max(...yieldCurve.yield_curve.map((p: any) => p.yield_pct || 0));
                const minY = Math.min(...yieldCurve.yield_curve.map((p: any) => p.yield_pct || 0));
                const range = maxY - minY || 1;
                const heightPct = ((point.yield_pct - minY) / range * 70 + 25);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: "0.68rem", color: "var(--gold)", fontWeight: 700 }}>{point.yield_pct?.toFixed(2)}%</div>
                    <div style={{
                      width: "100%", background: point.data_source === "live" ? "var(--gold)" : "rgba(234,179,8,0.4)",
                      borderRadius: "3px 3px 0 0", height: `${heightPct}%`, transition: "height 0.5s",
                    }} />
                    <div style={{ fontSize: "0.6rem", color: "var(--text-3)", textAlign: "center", lineHeight: 1.2, marginTop: 4 }}>
                      {point.tenor.replace("-", "\n")}
                    </div>
                  </div>
                );
              })}
            </div>

            <table className="tbl">
              <thead>
                <tr>
                  <th>Tenor</th>
                  <th>Type</th>
                  <th style={{ textAlign: "right" }}>Yield %</th>
                  <th style={{ textAlign: "right" }}>Spread over Repo</th>
                  <th style={{ textAlign: "center" }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {yieldCurve.yield_curve?.map((point: any, i: number) => {
                  const spread = point.yield_pct ? (point.yield_pct - yieldCurve.rbi_repo_rate).toFixed(2) : null;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: "var(--text-1)" }}>{point.tenor}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{point.type?.replace("_", " ")}</td>
                      <td className="num" style={{ color: "var(--gold)", fontWeight: 700 }}>{point.yield_pct ? `${point.yield_pct}%` : "—"}</td>
                      <td className="num" style={{ color: spread && Number(spread) >= 0 ? "var(--green)" : "var(--red)" }}>
                        {spread ? `+${spread}%` : "—"}
                      </td>
                      <td style={{ textAlign: "center", fontSize: "0.75rem" }}>
                        <span style={{ color: point.data_source === "live" ? "var(--green)" : "var(--text-3)" }}>
                          {point.data_source === "live" ? "Live" : "Ref"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>⚠️ {yieldCurve.disclaimer}</div>
        </>
      )}

      {!loading && tab === "etfs" && etfs && (
        <>
          <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ETF Name</th>
                    <th>Symbol</th>
                    <th style={{ textAlign: "right" }}>Price (₹)</th>
                    <th style={{ textAlign: "right" }}>Change</th>
                    <th style={{ textAlign: "right" }}>Change %</th>
                  </tr>
                </thead>
                <tbody>
                  {etfs.bond_etfs?.map((e: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: "var(--text-1)" }}>{e.name}</td>
                      <td style={{ color: "var(--gold)", fontFamily: "monospace", fontSize: "0.85rem" }}>{e.symbol}</td>
                      <td className="num" style={{ fontWeight: 700 }}>₹{fmt(e.price, 4)}</td>
                      <td className="num" style={{ color: pctColor(e.change) }}>{e.change >= 0 ? "+" : ""}{fmt(e.change, 4)}</td>
                      <td className="num" style={{ color: pctColor(e.change_pct) }}>{e.change_pct >= 0 ? "+" : ""}{fmt(e.change_pct, 4)}%</td>
                    </tr>
                  ))}
                  {(!etfs.bond_etfs || etfs.bond_etfs.length === 0) && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", padding: 20 }}>No ETF data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>About Bond ETFs in India</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.7 }}>
              <p>Bond ETFs provide retail investors exposure to government and corporate bonds through the stock exchange.</p>
              <p style={{ marginTop: 8 }}><strong style={{ color: "var(--text-1)" }}>Liquid BeES</strong> tracks overnight/1-day MIBOR — near-zero risk, highly liquid.</p>
              <p style={{ marginTop: 8 }}><strong style={{ color: "var(--text-1)" }}>G-Sec ETFs</strong> track 10-year government securities — moderate duration risk, sovereign credit.</p>
            </div>
          </div>
        </>
      )}

      {tab === "ytm" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 22 }}>
            <div className="section-title" style={{ marginBottom: 16 }}>Bond YTM Calculator</div>
            {[
              { key: "face_value",        label: "Face Value (₹)",        step: "100" },
              { key: "coupon_rate",       label: "Coupon Rate % p.a.",    step: "0.1" },
              { key: "current_price",     label: "Current Market Price (₹)", step: "1" },
              { key: "years_to_maturity", label: "Years to Maturity",     step: "0.5" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.78rem", color: "var(--text-3)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input className="input" type="number" step={f.step}
                  value={(ytm as any)[f.key]}
                  onChange={e => setYtm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: "100%" }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "0.78rem", color: "var(--text-3)", display: "block", marginBottom: 4 }}>Coupon Frequency</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ label: "Semi-Annual", val: 2 }, { label: "Annual", val: 1 }, { label: "Quarterly", val: 4 }].map(f => (
                  <button key={f.val} className={`btn ${ytm.frequency === f.val ? "btn-gold" : "btn-ghost"}`} style={{ flex: 1, fontSize: "0.78rem" }}
                    onClick={() => setYtm(prev => ({ ...prev, frequency: f.val }))}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-gold" style={{ width: "100%" }} onClick={calcYtm} disabled={ytmLoading}>
              {ytmLoading ? <span className="spinner" /> : "Calculate YTM & Duration"}
            </button>
            {ytmError && <div style={{ marginTop: 10, color: "#fca5a5", fontSize: "0.8rem" }}>{ytmError}</div>}
          </div>

          <div>
            {ytmResult ? (
              <>
                <div className="card" style={{ padding: 20, marginBottom: 14 }}>
                  <div className="section-title" style={{ marginBottom: 14 }}>Results</div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <div className="metric-label">YTM</div>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--gold)" }}>{ytmResult.results?.ytm_pct}%</div>
                    </div>
                    <div>
                      <div className="metric-label">Trading</div>
                      <div style={{ fontSize: "1rem", fontWeight: 600, color: ytmResult.bond_trading === "at premium" ? "var(--green)" : ytmResult.bond_trading === "at discount" ? "var(--red)" : "var(--text-2)", marginTop: 8 }}>
                        {ytmResult.bond_trading}
                      </div>
                    </div>
                  </div>
                  {[
                    { label: "Macaulay Duration",  value: `${ytmResult.results?.macaulay_duration} years` },
                    { label: "Modified Duration",  value: `${ytmResult.results?.modified_duration} years` },
                    { label: "DV01 (₹/bp)",        value: `₹${ytmResult.results?.dv01}` },
                    { label: "Coupon/Period",       value: `₹${ytmResult.inputs?.coupon_per_period}` },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.875rem" }}>
                      <span style={{ color: "var(--text-3)" }}>{r.label}</span>
                      <span style={{ fontWeight: 600, color: "var(--text-1)", fontFamily: "monospace" }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="card" style={{ padding: 18 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Interpretation</div>
                  {Object.entries(ytmResult.interpretation || {}).map(([k, v]: any) => (
                    <div key={k} style={{ marginBottom: 10, fontSize: "0.83rem" }}>
                      <div style={{ color: "var(--gold)", fontWeight: 600, textTransform: "capitalize", marginBottom: 2 }}>{k.replace(/_/g, " ")}</div>
                      <div style={{ color: "var(--text-2)", lineHeight: 1.5 }}>{v}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, fontSize: "0.73rem", color: "var(--text-3)" }}>{ytmResult.disclaimer}</div>
                </div>
              </>
            ) : (
              <div className="card" style={{ padding: 24 }}>
                <div className="section-title" style={{ marginBottom: 10 }}>About YTM & Duration</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.7 }}>
                  <p><strong style={{ color: "var(--text-1)" }}>YTM (Yield to Maturity)</strong> is the annualised return you earn if you hold the bond until maturity and reinvest all coupons at the same rate.</p>
                  <p style={{ marginTop: 10 }}><strong style={{ color: "var(--text-1)" }}>Duration</strong> measures a bond's price sensitivity to interest rate changes. Higher duration = more risk.</p>
                  <p style={{ marginTop: 10 }}><strong style={{ color: "var(--text-1)" }}>DV01</strong> is the rupee change in bond price for a 1 basis point move in yield — key for hedging.</p>
                  <p style={{ marginTop: 10 }}>Try a 10-year G-Sec: Face ₹1000, Coupon 7.1%, Price ₹980, Maturity 10 years.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
