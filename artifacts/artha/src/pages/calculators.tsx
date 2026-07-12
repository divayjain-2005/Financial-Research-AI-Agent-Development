import React, { useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

export default function Calculators() {
  const [tab, setTab] = useState<"sip"|"tax"|"emi">("sip");
  return (
    <Layout title="Financial Calculators">
      <div className="tab-bar">
        {(["sip","tax","emi"] as const).map(t => (
          <div key={t} className={`tab ${tab===t?"active":""}`} onClick={() => setTab(t)}>
            {t === "sip" ? "SIP Calculator" : t === "tax" ? "LTCG / STCG Tax" : "EMI / Debt"}
          </div>
        ))}
      </div>
      {tab === "sip" && <SIPCalc />}
      {tab === "tax" && <TaxCalc />}
      {tab === "emi" && <EMICalc />}
    </Layout>
  );
}

function SIPCalc() {
  const [form, setForm] = useState({ monthly_amount: 10000, annual_return: 12, years: 10, step_up_percent: 0 });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function calc(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try { setResult(await api.sip(form)); } catch {}
    setLoading(false);
  }

  function f(key: string) { return (e: any) => setForm({ ...form, [key]: Number(e.target.value) }); }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:18, alignItems:"start" }}>
      <form onSubmit={calc} className="card" style={{ padding:22, display:"flex", flexDirection:"column", gap:14 }}>
        <div className="section-title">SIP Calculator</div>
        <div>
          <label className="label">Monthly SIP Amount (₹)</label>
          <input className="input" type="number" min="100" value={form.monthly_amount} onChange={f("monthly_amount")} required />
        </div>
        <div>
          <label className="label">Expected Annual Return (%)</label>
          <input className="input" type="number" min="1" max="50" step="0.1" value={form.annual_return} onChange={f("annual_return")} required />
        </div>
        <div>
          <label className="label">Investment Period (Years)</label>
          <input className="input" type="number" min="1" max="40" value={form.years} onChange={f("years")} required />
        </div>
        <div>
          <label className="label">Annual Step-Up (%) — optional</label>
          <input className="input" type="number" min="0" max="50" value={form.step_up_percent} onChange={f("step_up_percent")} />
          <div style={{ fontSize:"0.7rem", color:"var(--text-3)", marginTop:3 }}>Increase SIP by this % every year</div>
        </div>
        <button className="btn btn-gold" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : "Calculate"}</button>
      </form>

      {result && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Summary */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            {[
              { l:"Total Invested",   v:`₹${fmt(result.total_invested)}`,   c:"var(--text-1)" },
              { l:"Expected Corpus",  v:`₹${fmt(result.expected_corpus)}`,  c:"var(--gold)" },
              { l:"Total Gains",      v:`₹${fmt(result.total_gains)}`,      c:"var(--green)" },
            ].map(item => (
              <div key={item.l} className="card" style={{ padding:"16px 18px" }}>
                <div className="metric-label">{item.l}</div>
                <div style={{ fontSize:"1.3rem", fontWeight:700, color:item.c, marginTop:4 }}>{item.v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:"12px 18px" }}>
            <span style={{ color:"var(--text-3)", fontSize:"0.875rem" }}>Wealth Multiplier: </span>
            <span style={{ color:"var(--gold)", fontWeight:700, fontSize:"1.1rem" }}>{result.wealth_gained_pct?.toFixed(1)}% returns on investment</span>
          </div>
          {/* Year-wise table */}
          <div className="card" style={{ padding:18 }}>
            <div className="section-title">Year-Wise Breakdown</div>
            <table className="tbl">
              <thead><tr><th>Year</th><th style={{textAlign:"right"}}>Monthly SIP</th><th style={{textAlign:"right"}}>Total Invested</th><th style={{textAlign:"right"}}>Corpus</th><th style={{textAlign:"right"}}>Gains</th></tr></thead>
              <tbody>
                {result.yearly_breakdown?.map((row: any) => (
                  <tr key={row.year}>
                    <td style={{color:"var(--gold)",fontWeight:600}}>Year {row.year}</td>
                    <td className="num">₹{fmt(row.sip_amount)}</td>
                    <td className="num">₹{fmt(row.invested_so_far)}</td>
                    <td className="num" style={{color:"var(--text-1)",fontWeight:600}}>₹{fmt(row.corpus)}</td>
                    <td className="num" style={{color:"var(--green)"}}>₹{fmt(row.gains)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!result && !loading && <div className="empty">Fill in the form and click Calculate</div>}
    </div>
  );
}

function TaxCalc() {
  const [form, setForm] = useState({ buy_price: 1000, sell_price: 1500, quantity: 100, holding_days: 400, asset_type: "equity" });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function calc(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try { setResult(await api.tax(form)); } catch {}
    setLoading(false);
  }
  function f(key: string) { return (e: any) => setForm({ ...form, [key]: key === "asset_type" ? e.target.value : Number(e.target.value) }); }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:18, alignItems:"start" }}>
      <form onSubmit={calc} className="card" style={{ padding:22, display:"flex", flexDirection:"column", gap:14 }}>
        <div className="section-title">LTCG / STCG Tax Calculator</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label className="label">Buy Price (₹)</label>
            <input className="input" type="number" min="0.01" step="0.01" value={form.buy_price} onChange={f("buy_price")} required />
          </div>
          <div>
            <label className="label">Sell Price (₹)</label>
            <input className="input" type="number" min="0.01" step="0.01" value={form.sell_price} onChange={f("sell_price")} required />
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label className="label">Quantity</label>
            <input className="input" type="number" min="1" value={form.quantity} onChange={f("quantity")} required />
          </div>
          <div>
            <label className="label">Holding (Days)</label>
            <input className="input" type="number" min="1" value={form.holding_days} onChange={f("holding_days")} required />
          </div>
        </div>
        <div>
          <label className="label">Asset Type</label>
          <select className="input" value={form.asset_type} onChange={f("asset_type")}>
            <option value="equity">Equity (Stocks / Equity MF)</option>
            <option value="debt_mf">Debt Mutual Fund</option>
            <option value="debt_bond">Listed Bond</option>
            <option value="gold">Gold</option>
          </select>
        </div>
        <button className="btn btn-gold" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : "Calculate Tax"}</button>
      </form>

      {result && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            {[
              { l:"Total Gain / Loss",  v: `${result.total_gain_loss >= 0 ? "+" : ""}₹${fmt(Math.abs(result.total_gain_loss))}`, c: result.total_gain_loss >= 0 ? "var(--green)" : "var(--red)" },
              { l:"Estimated Tax",      v:`₹${fmt(result.estimated_tax)}`,       c:"var(--red)" },
              { l:"Net Profit After Tax",v:`₹${fmt(result.net_profit_after_tax)}`,c:"var(--gold)" },
            ].map(item => (
              <div key={item.l} className="card" style={{ padding:"16px 18px" }}>
                <div className="metric-label">{item.l}</div>
                <div style={{ fontSize:"1.25rem", fontWeight:700, color:item.c, marginTop:4 }}>{item.v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:18 }}>
            {[
              ["Tax Type",    result.tax_type],
              ["Rate Applied", result.rate_applied],
              ["Holding Period",`${result.holding_days} days (${result.holding_months} months)`],
              ["Buy Value",  `₹${fmt(result.total_buy_value)}`],
              ["Sell Value", `₹${fmt(result.total_sell_value)}`],
            ].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:"0.875rem" }}>
                <span style={{color:"var(--text-3)"}}>{k}</span>
                <span style={{color:"var(--text-1)",fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"#78350f22", border:"1px solid #78350f", borderRadius:8, padding:"10px 14px", fontSize:"0.78rem", color:"#fcd34d" }}>
            ⚠️ {result.note}
          </div>
        </div>
      )}
      {!result && !loading && <div className="empty">Fill in the form and click Calculate Tax</div>}
    </div>
  );
}

function EMICalc() {
  const [form, setForm] = useState({ debt_type: "Home Loan", principal: 3000000, interest_rate: 8.5, tenure_months: 240 });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function calc(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try { setResult(await api.calcEmi(form)); } catch {}
    setLoading(false);
  }
  function f(key: string) { return (e: any) => setForm({ ...form, [key]: key === "debt_type" ? e.target.value : Number(e.target.value) }); }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:18, alignItems:"start" }}>
      <form onSubmit={calc} className="card" style={{ padding:22, display:"flex", flexDirection:"column", gap:14 }}>
        <div className="section-title">EMI Calculator</div>
        <div>
          <label className="label">Loan Type</label>
          <select className="input" value={form.debt_type} onChange={f("debt_type")}>
            {["Home Loan","Car Loan","Personal Loan","Education Loan","Business Loan"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Principal Amount (₹)</label>
          <input className="input" type="number" min="1000" value={form.principal} onChange={f("principal")} required />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label className="label">Interest Rate (% p.a.)</label>
            <input className="input" type="number" min="0.1" max="40" step="0.1" value={form.interest_rate} onChange={f("interest_rate")} required />
          </div>
          <div>
            <label className="label">Tenure (Months)</label>
            <input className="input" type="number" min="1" max="360" value={form.tenure_months} onChange={f("tenure_months")} required />
          </div>
        </div>
        <button className="btn btn-gold" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : "Calculate EMI"}</button>
      </form>

      {result && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[
              { l:"Monthly EMI",    v:`₹${fmt(result.monthly_emi)}`,    c:"var(--gold)" },
              { l:"Total Interest", v:`₹${fmt(result.total_interest)}`, c:"var(--red)" },
              { l:"Total Payment",  v:`₹${fmt(result.total_amount)}`,   c:"var(--text-1)" },
            ].map(item => (
              <div key={item.l} className="card" style={{ padding:"16px 18px" }}>
                <div className="metric-label">{item.l}</div>
                <div style={{ fontSize:"1.3rem", fontWeight:700, color:item.c, marginTop:4 }}>{item.v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:18 }}>
            {[
              ["Loan Type",     result.debt_type],
              ["Principal",     `₹${fmt(result.principal)}`],
              ["Interest Rate", `${result.interest_rate}% p.a.`],
              ["Tenure",        `${result.tenure_months} months (${(result.tenure_months/12).toFixed(1)} years)`],
              ["Payoff Date",   result.payoff_date],
            ].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:"0.875rem" }}>
                <span style={{color:"var(--text-3)"}}>{k}</span>
                <span style={{color:"var(--text-1)",fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
          {/* Breakdown bar */}
          <div className="card" style={{ padding:18 }}>
            <div className="section-title">Principal vs Interest</div>
            <div style={{ display:"flex", height:20, borderRadius:8, overflow:"hidden", marginTop:8 }}>
              <div style={{ width:`${result.principal/result.total_amount*100}%`, background:"var(--gold)" }} />
              <div style={{ flex:1, background:"var(--red)" }} />
            </div>
            <div style={{ display:"flex", gap:20, marginTop:8, fontSize:"0.78rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{width:10,height:10,borderRadius:2,background:"var(--gold)",display:"inline-block"}}/>Principal ({(result.principal/result.total_amount*100).toFixed(0)}%)</div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{width:10,height:10,borderRadius:2,background:"var(--red)",display:"inline-block"}}/>Interest ({(result.total_interest/result.total_amount*100).toFixed(0)}%)</div>
            </div>
          </div>
        </div>
      )}
      {!result && !loading && <div className="empty">Fill in the form and click Calculate EMI</div>}
    </div>
  );
}
