import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any, dec = 2) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec }); }
function pct(n: any) { return n == null ? "—" : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`; }
function pctColor(n: any) { return n == null ? "var(--text-2)" : Number(n) >= 0 ? "var(--green)" : "var(--red)"; }

export default function EconomicIndicators() {
  const [tab, setTab] = useState<"macro" | "currency" | "commodities">("macro");
  const [macro, setMacro] = useState<any>(null);
  const [currency, setCurrency] = useState<any>(null);
  const [commodities, setCommodities] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.economicIndicators().catch(() => null),
      api.economicCurrency().catch(() => null),
      api.economicCommodities().catch(() => null),
    ]).then(([m, c, cm]) => {
      setMacro(m);
      setCurrency(c);
      setCommodities(cm);
    }).catch(e => setError(e.message || "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const macroData = macro?.macro_indicators;
  const rbiRates  = macro?.rbi_rates;

  const MACRO_CARDS = macroData ? [
    { label: "GDP Growth",      value: `${macroData.gdp_growth_rate_pct}%`,   color: "var(--green)",   desc: macroData.gdp_growth_description },
    { label: "CPI Inflation",   value: `${macroData.cpi_inflation_pct}%`,     color: "#fb923c",        desc: macroData.cpi_description },
    { label: "WPI Inflation",   value: `${macroData.wpi_inflation_pct}%`,     color: "#fb923c",        desc: macroData.wpi_description },
    { label: "Repo Rate",       value: `${rbiRates?.repo_rate}%`,             color: "var(--gold)",    desc: "RBI Monetary Policy Rate" },
    { label: "IIP Growth",      value: `${macroData.iip_growth_pct}%`,        color: "#60a5fa",        desc: macroData.iip_description },
    { label: "Fiscal Deficit",  value: `${macroData.fiscal_deficit_gdp_pct}% of GDP`, color: "#f472b6", desc: macroData.fiscal_deficit_description },
    { label: "Forex Reserves",  value: `$${macroData.forex_reserves_bn_usd}B`, color: "var(--green)", desc: macroData.forex_description },
    { label: "Unemployment",    value: `${macroData.unemployment_rate_pct}%`, color: "#a78bfa",        desc: "CMIE Unemployment Rate" },
  ] : [];

  return (
    <Layout title="Economic Indicators">
      {loading && <div className="loading"><span className="spinner" /></div>}
      {error && <div style={{ background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 8, padding: 16, color: "#fca5a5" }}>{error}</div>}

      {!loading && !error && (
        <>
          <div className="tab-bar" style={{ marginBottom: 20 }}>
            {(["macro", "currency", "commodities"] as const).map(t => (
              <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t === "macro" ? "Macro Indicators" : t === "currency" ? "Currency (INR)" : "Commodities"}
              </div>
            ))}
          </div>

          {tab === "macro" && macroData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                {MACRO_CARDS.map(c => (
                  <div key={c.label} className="card" style={{ padding: "16px 18px", borderTop: `3px solid ${c.color}` }}>
                    <div className="metric-label">{c.label}</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: c.color, marginTop: 4, lineHeight: 1 }}>{c.value}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-3)", marginTop: 6, lineHeight: 1.4 }}>{c.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div className="section-title" style={{ marginBottom: 14 }}>RBI Key Rates</div>
                  {rbiRates && Object.entries({
                    "Repo Rate": rbiRates.repo_rate,
                    "Reverse Repo Rate": rbiRates.reverse_repo_rate,
                    "CRR": rbiRates.crr,
                    "SLR": rbiRates.slr,
                    "MSF Rate": rbiRates.msf_rate,
                    "Bank Rate": rbiRates.bank_rate,
                  }).map(([k, v]: any) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.875rem", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                      <span style={{ color: "var(--text-3)" }}>{k}</span>
                      <span style={{ fontWeight: 700, color: "var(--gold)", fontFamily: "monospace" }}>{v}%</span>
                    </div>
                  ))}
                  <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 8 }}>Last updated: {rbiRates?.last_updated}</div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                  <div className="section-title" style={{ marginBottom: 14 }}>Current Account & Fiscal</div>
                  {[
                    { label: "Fiscal Deficit (% GDP)",     value: `${macroData.fiscal_deficit_gdp_pct}%` },
                    { label: "Current Account (% GDP)",    value: `${macroData.current_account_deficit_gdp}%` },
                    { label: "Forex Reserves",             value: `$${macroData.forex_reserves_bn_usd} Billion` },
                    { label: "GDP Growth (FY24)",          value: `${macroData.gdp_growth_rate_pct}%` },
                    { label: "CPI Inflation",              value: `${macroData.cpi_inflation_pct}%` },
                    { label: "WPI Inflation",              value: `${macroData.wpi_inflation_pct}%` },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.875rem", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                      <span style={{ color: "var(--text-3)" }}>{r.label}</span>
                      <span style={{ fontWeight: 600, color: "var(--text-1)", fontFamily: "monospace" }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 8 }}>As of {macroData.as_of}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: "0.78rem", color: "var(--text-3)", lineHeight: 1.7 }}>
                  📊 <strong style={{ color: "var(--text-2)" }}>Data Sources:</strong> {macroData.source} &nbsp;|&nbsp; {macroData.disclaimer}
                </div>
              </div>
            </>
          )}

          {tab === "currency" && currency && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                {currency.currency_rates?.slice(0, 3).map((c: any) => (
                  <div key={c.pair} className="card" style={{ padding: "16px 20px" }}>
                    <div className="metric-label">{c.pair}</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-1)", marginTop: 4 }}>₹{fmt(c.rate, 4)}</div>
                    <div style={{ color: pctColor(c.change_pct), fontWeight: 600, marginTop: 4, fontSize: "0.9rem" }}>
                      {pct(c.change_pct)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Currency Pair</th>
                        <th style={{ textAlign: "right" }}>Rate (INR)</th>
                        <th style={{ textAlign: "right" }}>Change</th>
                        <th style={{ textAlign: "right" }}>Change %</th>
                        <th style={{ textAlign: "right" }}>Week High</th>
                        <th style={{ textAlign: "right" }}>Week Low</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currency.currency_rates?.map((c: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: "var(--gold)" }}>{c.pair}</td>
                          <td className="num" style={{ fontWeight: 700, fontSize: "1rem" }}>₹{fmt(c.rate, 4)}</td>
                          <td className="num" style={{ color: pctColor(c.change) }}>{c.change >= 0 ? "+" : ""}{fmt(c.change, 4)}</td>
                          <td className="num" style={{ color: pctColor(c.change_pct) }}>{pct(c.change_pct)}</td>
                          <td className="num" style={{ color: "var(--green)" }}>₹{fmt(c.week_high, 4)}</td>
                          <td className="num" style={{ color: "var(--red)" }}>₹{fmt(c.week_low, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="card" style={{ padding: 18 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Key Factors Affecting INR</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.83rem" }}>
                    {[
                      { factor: "RBI Intervention",   impact: "RBI buys/sells USD to stabilise INR. Key tool during volatility." },
                      { factor: "Crude Oil Prices",   impact: "India imports ~85% of crude. Rising crude = INR weakness." },
                      { factor: "FII/FPI Flows",       impact: "Foreign inflows strengthen INR; outflows weaken it." },
                      { factor: "Trade Deficit",       impact: "Persistent trade deficit creates INR supply pressure." },
                      { factor: "Inflation Differential", impact: "Higher Indian inflation vs trading partners weakens INR." },
                      { factor: "US Fed Policy",       impact: "Fed rate hikes strengthen USD, putting pressure on INR." },
                    ].map(f => (
                      <div key={f.factor} style={{ padding: "10px 12px", background: "var(--bg-hover)", borderRadius: 8 }}>
                        <div style={{ color: "var(--gold)", fontWeight: 600, marginBottom: 4 }}>{f.factor}</div>
                        <div style={{ color: "var(--text-3)", lineHeight: 1.5 }}>{f.impact}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "commodities" && commodities && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                {commodities.commodities?.slice(0, 3).map((c: any) => (
                  <div key={c.symbol} className="card" style={{ padding: "16px 20px" }}>
                    <div className="metric-label">{c.name}</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-1)", marginTop: 4 }}>{fmt(c.price)}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>{c.unit}</div>
                    <div style={{ color: pctColor(c.change_pct), fontWeight: 600, marginTop: 4 }}>{pct(c.change_pct)}</div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Commodity</th>
                        <th style={{ textAlign: "right" }}>Price</th>
                        <th>Unit</th>
                        <th style={{ textAlign: "right" }}>Change</th>
                        <th style={{ textAlign: "right" }}>Change %</th>
                        <th style={{ textAlign: "right" }}>Week High</th>
                        <th style={{ textAlign: "right" }}>Week Low</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commodities.commodities?.map((c: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: "var(--text-1)" }}>{c.name}</td>
                          <td className="num" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--gold)" }}>{fmt(c.price)}</td>
                          <td style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{c.unit}</td>
                          <td className="num" style={{ color: pctColor(c.change) }}>{c.change >= 0 ? "+" : ""}{fmt(c.change, 3)}</td>
                          <td className="num" style={{ color: pctColor(c.change_pct) }}>{pct(c.change_pct)}</td>
                          <td className="num" style={{ color: "var(--green)" }}>{fmt(c.week_high)}</td>
                          <td className="num" style={{ color: "var(--red)" }}>{fmt(c.week_low)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ padding: 18 }}>
                <div className="section-title" style={{ marginBottom: 10 }}>Commodity Relevance to India</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.83rem" }}>
                  {[
                    { comm: "Crude Oil",    rel: "India is world's 3rd largest importer. ~$130B/year. Direct impact on trade deficit and inflation." },
                    { comm: "Gold",         rel: "India is world's 2nd largest consumer. Major import, cultural significance, alternative investment." },
                    { comm: "Natural Gas",  rel: "Used in fertilizers, power generation. India imports LNG from Qatar, US, Australia." },
                    { comm: "Copper",       rel: "Industrial bellwether. Key input for EV, renewable energy, and infrastructure sectors." },
                    { comm: "Silver",       rel: "Industrial use in solar panels & electronics. India is a major importer." },
                    { comm: "Aluminium",    rel: "Key for auto, aviation, packaging. Impacted by energy prices (smelting is energy-intensive)." },
                  ].map(c => (
                    <div key={c.comm} style={{ padding: "10px 12px", background: "var(--bg-hover)", borderRadius: 8 }}>
                      <div style={{ color: "var(--gold)", fontWeight: 600, marginBottom: 4 }}>{c.comm}</div>
                      <div style={{ color: "var(--text-3)", lineHeight: 1.5 }}>{c.rel}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  );
}
