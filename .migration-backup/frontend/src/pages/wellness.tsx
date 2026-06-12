import React, { useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

export default function Wellness() {
  const [form, setForm] = useState({
    monthly_income: 100000, monthly_expenses: 60000,
    monthly_savings: 20000, has_emergency_fund: false,
    has_insurance: false, has_investment: false, debt_emi: 0,
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  function f(key: string) {
    return (e: any) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : Number(e.target.value) });
  }

  async function calc(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try { setResult(await api.wellnessScore(form as any)); } catch {}
    setLoading(false);
  }

  const gradeColor = (g: string) =>
    g === "A" ? "var(--green)" : g === "B" ? "var(--gold)" : g === "C" ? "#fb923c" : "var(--red)";

  return (
    <Layout title="Financial Wellness Score">
      <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:18, alignItems:"start" }}>
        <form onSubmit={calc} className="card" style={{ padding:22, display:"flex", flexDirection:"column", gap:14 }}>
          <div className="section-title">Your Financial Profile</div>
          {[
            { l:"Monthly Income (₹)",   k:"monthly_income",   t:"number" },
            { l:"Monthly Expenses (₹)", k:"monthly_expenses", t:"number" },
            { l:"Monthly Savings (₹)",  k:"monthly_savings",  t:"number" },
            { l:"Monthly EMI / Debt (₹)",k:"debt_emi",        t:"number" },
          ].map(item => (
            <div key={item.k}>
              <label className="label">{item.l}</label>
              <input className="input" type="number" min="0" value={(form as any)[item.k]} onChange={f(item.k)} required />
            </div>
          ))}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { l:"I have an Emergency Fund (6 months expenses)", k:"has_emergency_fund" },
              { l:"I have Life & Health Insurance coverage",      k:"has_insurance" },
              { l:"I invest regularly (MF / stocks / PPF / NPS)", k:"has_investment" },
            ].map(item => (
              <label key={item.k} style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", fontSize:"0.875rem", color:"var(--text-2)" }}>
                <input type="checkbox" checked={(form as any)[item.k]} onChange={f(item.k)} style={{ marginTop:2, accentColor:"var(--gold)", width:16, height:16 }} />
                {item.l}
              </label>
            ))}
          </div>
          <button className="btn btn-gold" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : "Calculate Score"}</button>
        </form>

        {result ? (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Score card */}
            <div className="card" style={{ padding:28, textAlign:"center" }}>
              <div style={{ fontSize:"0.75rem", color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Financial Wellness Score</div>
              <div style={{ fontSize:"5rem", fontWeight:900, color: gradeColor(result.grade), lineHeight:1 }}>{result.financial_wellness_score}</div>
              <div style={{ fontSize:"1rem", color:"var(--text-3)", marginTop:4 }}>out of 100</div>
              <div style={{ marginTop:12 }}>
                <span style={{ fontSize:"2.5rem", fontWeight:800, color: gradeColor(result.grade) }}>Grade {result.grade}</span>
                <span style={{ marginLeft:12, fontSize:"1rem", color:"var(--text-2)" }}>{result.status}</span>
              </div>
              {/* Overall progress bar */}
              <div style={{ marginTop:18, textAlign:"left" }}>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width:`${result.financial_wellness_score}%`, background: gradeColor(result.grade) }} />
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="card" style={{ padding:20 }}>
              <div className="section-title">Score Breakdown</div>
              {Object.entries(result.breakdown || {}).map(([key, val]: any) => {
                const maxes: Record<string, number> = { savings_rate:25, debt_burden:20, emergency_fund:20, insurance:15, investment:20 };
                const max = maxes[key] || 25;
                const pct = val / max * 100;
                return (
                  <div key={key} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, fontSize:"0.82rem" }}>
                      <span style={{ color:"var(--text-2)", textTransform:"capitalize" }}>{key.replace(/_/g," ")}</span>
                      <span style={{ color:"var(--text-1)", fontWeight:600 }}>{val.toFixed(1)} / {max}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width:`${pct}%`, background: pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--gold)" : "var(--red)" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Key metrics */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div className="card" style={{ padding:16 }}>
                <div className="metric-label">Savings Rate</div>
                <div style={{ fontSize:"1.5rem", fontWeight:700, color: result.savings_rate_pct >= 20 ? "var(--green)" : "var(--red)", marginTop:4 }}>{result.savings_rate_pct}%</div>
                <div style={{ fontSize:"0.75rem", color:"var(--text-3)", marginTop:2 }}>Target: 20%+</div>
              </div>
              <div className="card" style={{ padding:16 }}>
                <div className="metric-label">EMI / Income Ratio</div>
                <div style={{ fontSize:"1.5rem", fontWeight:700, color: result.emi_to_income_pct <= 30 ? "var(--green)" : "var(--red)", marginTop:4 }}>{result.emi_to_income_pct}%</div>
                <div style={{ fontSize:"0.75rem", color:"var(--text-3)", marginTop:2 }}>Target: ≤30%</div>
              </div>
            </div>

            {/* Suggestions */}
            {result.suggestions?.length > 0 && (
              <div className="card" style={{ padding:20 }}>
                <div className="section-title">Improvement Suggestions</div>
                {result.suggestions.map((s: string, i: number) => (
                  <div key={i} style={{ display:"flex", gap:10, marginBottom:10, fontSize:"0.875rem", color:"var(--text-2)", lineHeight:1.5 }}>
                    <span style={{ color:"var(--gold)", flexShrink:0, marginTop:1 }}>→</span>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", gap:16, padding:"60px 40px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:12 }}>
            <div style={{ fontSize:"4rem" }}>💯</div>
            <div style={{ fontSize:"1rem", color:"var(--text-2)", textAlign:"center", maxWidth:300, lineHeight:1.6 }}>
              Answer a few questions about your finances to get a personalised wellness score from 0–100.
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
