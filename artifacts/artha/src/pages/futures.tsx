import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any, dec = 2) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec }); }
function pct(n: any) { return n == null ? "—" : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`; }
function pctColor(n: any) { return n == null ? "var(--text-2)" : Number(n) >= 0 ? "var(--green)" : "var(--red)"; }

const INDEX_MAP: Record<string, string> = {
  "NIFTY": "^NSEI",
  "NIFTY NSE": "^NSEI",
  "BANKNIFTY": "^NSEBANK",
  "BANKNIFTY NSE": "^NSEBANK",
  "SENSEX": "^BSESN",
  "SENSEX BSE": "^BSESN",
};

function userToApiSym(input: string): string {
  const s = input.trim().toUpperCase();
  if (INDEX_MAP[s]) return INDEX_MAP[s];
  if (s.endsWith(" NSE")) return s.replace(" NSE", ".NS");
  if (s.endsWith(" BSE")) return s.replace(" BSE", ".BO");
  return s;
}

function apiToDisplaySym(s: string): string {
  if (s === "^NSEI")    return "NIFTY NSE";
  if (s === "^NSEBANK") return "BANKNIFTY NSE";
  if (s === "^BSESN")   return "SENSEX BSE";
  if (s.endsWith(".NS")) return s.replace(".NS", " NSE");
  if (s.endsWith(".BO")) return s.replace(".BO", " BSE");
  return s;
}

const CONTRACT_TENORS = [
  { label: "Near Month", days: 30 },
  { label: "Mid Month",  days: 60 },
  { label: "Far Month",  days: 90 },
];

function ContractCards({ contracts }: { contracts: any[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {contracts.map((c, i) => (
        <div key={i} className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: "var(--gold)", fontSize: "0.88rem" }}>{c.tenor}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-3)", background: "var(--bg-hover)", padding: "2px 7px", borderRadius: 4 }}>
              ~{c.expiry_days}d
            </span>
          </div>
          {[
            { label: "Spot Price",           value: `₹${fmt(c.spot_price)}` },
            { label: "Theor. Futures Price", value: `₹${fmt(c.theoretical_futures_price)}`, gold: true },
            { label: "Basis (F - S)",        value: `${c.basis >= 0 ? "+" : ""}₹${fmt(c.basis)}`, colored: true, val: c.basis },
            { label: "Risk-Free Rate",       value: `${c.risk_free_rate_pct}%` },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: "0.8rem" }}>
              <span style={{ color: "var(--text-3)" }}>{row.label}</span>
              <span style={{
                fontWeight: 600, fontFamily: "monospace",
                color: (row as any).gold
                  ? "var(--gold)"
                  : (row as any).colored
                    ? ((row as any).val >= 0 ? "var(--green)" : "var(--red)")
                    : "var(--text-1)"
              }}>
                {row.value}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 8, padding: "5px 9px", background: "var(--bg-hover)", borderRadius: 6, fontSize: "0.68rem", color: "var(--text-3)" }}>
            F = S × e<sup>r×T</sup>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Futures() {
  const [quotes, setQuotes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"commodities" | "indices" | "currency" | "lookup" | "calculator">("commodities");

  const [indexContracts, setIndexContracts] = useState<Record<string, any[]>>({});
  const [indexContractsLoading, setIndexContractsLoading] = useState(false);

  const [calcSym, setCalcSym] = useState("");
  const [calcExpiry, setCalcExpiry] = useState(30);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");

  const [lookupInput, setLookupInput] = useState("");
  const [lookupContracts, setLookupContracts] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupSym, setLookupSym] = useState("");

  useEffect(() => {
    api.futuresQuotes()
      .then(setQuotes)
      .catch(e => setError(e.message || "Failed to load futures data"))
      .finally(() => setLoading(false));
  }, []);

  // Fetch 3-contract data for all indices when the indices tab is selected
  useEffect(() => {
    if (tab !== "indices" || !quotes) return;
    const idxRows = (quotes.futures || []).filter((f: any) => ["NSE", "BSE"].includes(f.exchange));
    if (idxRows.length === 0 || Object.keys(indexContracts).length > 0) return;
    setIndexContractsLoading(true);
    Promise.all(
      idxRows.map((row: any) =>
        Promise.all(
          CONTRACT_TENORS.map(t => api.futuresQuote(row.symbol, t.days).then(r => ({ ...r, tenor: t.label })))
        ).then(contracts => ({ sym: row.symbol, contracts }))
      )
    )
      .then(results => {
        const map: Record<string, any[]> = {};
        results.forEach(({ sym, contracts }) => { map[sym] = contracts; });
        setIndexContracts(map);
      })
      .catch(() => {})
      .finally(() => setIndexContractsLoading(false));
  }, [tab, quotes]);

  async function calcFuture() {
    if (!calcSym.trim()) return;
    setCalcLoading(true); setCalcError(""); setCalcResult(null);
    try {
      const r = await api.futuresQuote(userToApiSym(calcSym), calcExpiry);
      setCalcResult(r);
    } catch (e: any) { setCalcError(e.message || "Calculation failed"); }
    setCalcLoading(false);
  }

  async function lookupFutures() {
    if (!lookupInput.trim()) return;
    const apiSym = userToApiSym(lookupInput.trim());
    setLookupLoading(true); setLookupError(""); setLookupContracts([]); setLookupSym(apiSym);
    try {
      const results = await Promise.all(
        CONTRACT_TENORS.map(t => api.futuresQuote(apiSym, t.days).then(r => ({ ...r, tenor: t.label })))
      );
      setLookupContracts(results);
    } catch (e: any) { setLookupError(e.message || "Failed to load futures data. Check the symbol."); }
    setLookupLoading(false);
  }

  const futures: any[] = quotes?.futures || [];
  const commodities = futures.filter((f: any) => !["NSE", "BSE", "Forex"].includes(f.exchange));
  const indices     = futures.filter((f: any) => ["NSE", "BSE"].includes(f.exchange));
  const currency    = futures.filter((f: any) => f.exchange === "Forex");

  function FuturesTable({ rows }: { rows: any[] }) {
    return (
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Exchange</th>
                <th style={{ textAlign: "right" }}>Spot Price</th>
                <th style={{ textAlign: "right" }}>Change</th>
                <th style={{ textAlign: "right" }}>Change %</th>
                <th style={{ textAlign: "right" }}>Theor. Futures</th>
                <th style={{ textAlign: "right" }}>Basis</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, i: number) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: "var(--text-1)" }}>{r.name}</td>
                  <td style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>{r.exchange}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmt(r.spot_price)}</td>
                  <td className="num" style={{ color: pctColor(r.change) }}>{r.change >= 0 ? "+" : ""}{fmt(r.change)}</td>
                  <td className="num" style={{ color: pctColor(r.change_pct) }}>{pct(r.change_pct)}</td>
                  <td className="num" style={{ color: "var(--gold)", fontWeight: 600 }}>{r.theoretical_futures ? fmt(r.theoretical_futures) : "—"}</td>
                  <td className="num" style={{ color: r.basis > 0 ? "var(--green)" : r.basis < 0 ? "var(--red)" : "var(--text-3)" }}>
                    {r.basis != null ? `${r.basis >= 0 ? "+" : ""}${fmt(r.basis)}` : "—"}
                  </td>
                  <td style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{r.unit}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-3)", padding: 20 }}>No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <Layout title="Futures">
      {loading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : error ? (
        <div style={{ background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 8, padding: 16, color: "#fca5a5" }}>{error}</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Commodities Tracked", value: commodities.length },
              { label: "Index Futures", value: indices.length },
              { label: "Risk-Free Rate", value: `${quotes?.risk_free_rate_pct ?? "—"}%` },
            ].map(c => (
              <div key={c.label} className="card" style={{ padding: "14px 18px" }}>
                <div className="metric-label">{c.label}</div>
                <div style={{ fontWeight: 700, fontSize: "1.4rem", color: "var(--gold)", marginTop: 4 }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="tab-bar" style={{ marginBottom: 16 }}>
            {(["commodities", "indices", "currency", "lookup", "calculator"] as const).map(t => (
              <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t === "calculator" ? "Cost-of-Carry Calc" : t === "lookup" ? "Futures Lookup" : t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {tab === "commodities" && (
            <>
              <FuturesTable rows={commodities} />
              <div style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--text-3)" }}>
                Commodity futures prices from global exchanges (COMEX/NYMEX). Theoretical futures not computed for commodity futures.
              </div>
            </>
          )}

          {tab === "indices" && (
            <>
              <div className="card" style={{ padding: "12px 16px", marginBottom: 14, background: "#1a2730", borderColor: "var(--gold)" }}>
                <div style={{ fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--gold)" }}>Cost-of-Carry Model:</strong> F = S × e<sup>r×T</sup>
                  &nbsp;|&nbsp; Basis = F − S &nbsp;|&nbsp;
                  Rate: {quotes?.risk_free_rate_pct}% (India risk-free) &nbsp;|&nbsp; Expiry: ~30 days
                </div>
              </div>

              {/* Each index: table row + 3 contract cards */}
              {indices.map((r: any, i: number) => (
                <div key={i} style={{ marginBottom: 24 }}>
                  {/* Row header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "12px 18px", marginBottom: 12,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-1)", minWidth: 140 }}>{r.name}</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-3)", background: "var(--bg-hover)", padding: "2px 8px", borderRadius: 4 }}>{r.exchange}</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>Spot</span>
                      <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)" }}>{fmt(r.spot_price)}</span>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem", color: pctColor(r.change_pct) }}>{pct(r.change_pct)}</span>
                    {r.theoretical_futures && (
                      <>
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>Theor. Futures</span>
                          <span style={{ fontWeight: 700, color: "var(--gold)" }}>{fmt(r.theoretical_futures)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>Basis</span>
                          <span style={{ fontWeight: 600, color: r.basis >= 0 ? "var(--green)" : "var(--red)" }}>
                            {r.basis >= 0 ? "+" : ""}{fmt(r.basis)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 3 contract cards */}
                  {indexContractsLoading && !indexContracts[r.symbol] ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 0", color: "var(--text-3)", fontSize: "0.8rem" }}>
                      <span className="spinner" style={{ width: 16, height: 16 }} /> Loading contracts…
                    </div>
                  ) : indexContracts[r.symbol] ? (
                    <ContractCards contracts={indexContracts[r.symbol]} />
                  ) : null}
                </div>
              ))}

              <div style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--text-3)" }}>
                ⚠️ Theoretical futures computed via cost-of-carry model. Actual NSE/BSE F&O prices may differ due to demand, dividends, and market microstructure.
              </div>
            </>
          )}

          {tab === "currency" && (
            <>
              <FuturesTable rows={currency} />
              <div style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--text-3)" }}>
                USD/INR and major INR pairs. Currency futures on NSE are actively traded.
              </div>
            </>
          )}

          {tab === "lookup" && (
            <div>
              <div className="card" style={{ padding: 22, marginBottom: 16 }}>
                <div className="section-title" style={{ marginBottom: 12 }}>Futures Lookup — Next 3 Active Contracts</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    className="input"
                    placeholder="e.g. TCS NSE, RELIANCE NSE, NIFTY NSE"
                    value={lookupInput}
                    onChange={e => setLookupInput(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter") lookupFutures(); }}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-gold" onClick={lookupFutures} disabled={lookupLoading || !lookupInput.trim()}>
                    {lookupLoading ? <span className="spinner" /> : "Search"}
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--text-3)" }}>
                  Enter stock name followed by exchange. Examples:&nbsp;
                  {["TCS NSE", "RELIANCE NSE", "NIFTY NSE", "BANKNIFTY NSE"].map(ex => (
                    <span key={ex}
                      style={{ color: "var(--gold)", cursor: "pointer", marginRight: 10 }}
                      onClick={() => { setLookupInput(ex); }}
                    >{ex}</span>
                  ))}
                </div>
              </div>

              {lookupError && (
                <div style={{ background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", color: "#fca5a5", marginBottom: 16 }}>
                  {lookupError}
                </div>
              )}

              {lookupContracts.length > 0 && (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    background: "var(--bg-card)", borderRadius: 10, padding: "12px 18px",
                    marginBottom: 14, border: "1px solid var(--border)",
                  }}>
                    <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-1)" }}>
                      {apiToDisplaySym(lookupContracts[0]?.symbol || lookupSym)}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>Spot</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)" }}>
                      {fmt(lookupContracts[0]?.spot_price)}
                    </span>
                    <span style={{ fontWeight: 600, color: pctColor(lookupContracts[0]?.change_pct) }}>
                      {pct(lookupContracts[0]?.change_pct)}
                    </span>
                  </div>
                  <ContractCards contracts={lookupContracts} />
                  <div style={{ marginTop: 12, fontSize: "0.72rem", color: "var(--text-3)" }}>
                    ⚠️ Theoretical prices only via cost-of-carry model. Actual F&O prices may differ. Not financial advice.
                  </div>
                </>
              )}

              {!lookupLoading && lookupContracts.length === 0 && !lookupError && (
                <div className="empty">Search for any stock, index, commodity or currency to view its next 3 futures contracts</div>
              )}
            </div>
          )}

          {tab === "calculator" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="card" style={{ padding: 22 }}>
                <div className="section-title" style={{ marginBottom: 16 }}>Cost-of-Carry Calculator</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: "0.78rem", color: "var(--text-3)", display: "block", marginBottom: 4 }}>Symbol</label>
                  <input className="input" placeholder="e.g. TCS NSE" value={calcSym}
                    onChange={e => setCalcSym(e.target.value.toUpperCase())} style={{ width: "100%" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: "0.78rem", color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                    Days to Expiry: <strong>{calcExpiry}</strong>
                  </label>
                  <input type="range" min={1} max={365} value={calcExpiry} onChange={e => setCalcExpiry(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--gold)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-3)" }}>
                    <span>1 day</span><span>1 year</span>
                  </div>
                </div>
                <button className="btn btn-gold" style={{ width: "100%" }} onClick={calcFuture} disabled={calcLoading || !calcSym.trim()}>
                  {calcLoading ? <span className="spinner" /> : "Calculate Theoretical Futures"}
                </button>
                {calcError && <div style={{ marginTop: 10, color: "#fca5a5", fontSize: "0.8rem" }}>{calcError}</div>}
              </div>

              <div>
                {calcResult ? (
                  <div className="card" style={{ padding: 22 }}>
                    <div className="section-title" style={{ marginBottom: 16 }}>Results for {apiToDisplaySym(calcResult.symbol)}</div>
                    {[
                      { label: "Spot Price",          value: fmt(calcResult.spot_price) },
                      { label: "Theoretical Futures", value: fmt(calcResult.theoretical_futures_price), gold: true },
                      { label: "Basis (F - S)",       value: `${calcResult.basis >= 0 ? "+" : ""}${fmt(calcResult.basis)}` },
                      { label: "Days to Expiry",      value: `${calcResult.expiry_days} days` },
                      { label: "Risk-Free Rate",      value: `${calcResult.risk_free_rate_pct}%` },
                      { label: "Formula Used",        value: calcResult.cost_of_carry_formula },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: "0.875rem" }}>
                        <span style={{ color: "var(--text-3)" }}>{r.label}</span>
                        <span style={{ fontWeight: 600, color: (r as any).gold ? "var(--gold)" : "var(--text-1)", fontFamily: "monospace" }}>{r.value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "#1a2730", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-2)", lineHeight: 1.6 }}>
                      {calcResult.disclaimer}
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ padding: 24 }}>
                    <div className="section-title" style={{ marginBottom: 10 }}>About Cost-of-Carry</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.7 }}>
                      <p>The theoretical futures price is calculated as:</p>
                      <p style={{ fontFamily: "monospace", background: "#0d1b22", padding: "8px 12px", borderRadius: 6, marginTop: 8, color: "var(--gold)", fontSize: "1rem" }}>
                        F = S × e<sup>r×T</sup>
                      </p>
                      <p style={{ marginTop: 10 }}>Where S = spot price, r = risk-free rate, T = time to expiry in years.</p>
                      <p style={{ marginTop: 10 }}>
                        <strong style={{ color: "var(--text-1)" }}>Basis</strong> = F − S. Positive basis (contango) means futures trade above spot. Negative (backwardation) means below.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
