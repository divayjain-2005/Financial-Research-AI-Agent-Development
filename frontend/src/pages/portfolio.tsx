import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function pctColor(n: any) { return Number(n) >= 0 ? "var(--green)" : "var(--red)"; }

export default function Portfolio() {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"holdings"|"add"|"transactions">("holdings");
  const [form, setForm] = useState({ symbol: "", quantity: "", buy_price: "", buy_date: new Date().toISOString().split("T")[0] });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [port, txns] = await Promise.all([api.portfolioGet(), api.transactions()]);
      setHoldings(port.holdings || []);
      setSummary(port.summary || {});
      setTransactions(txns.transactions || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true); setMsg("");
    try {
      await api.portfolioAdd({
        symbol: form.symbol.trim().toUpperCase(),
        quantity: Number(form.quantity),
        buy_price: Number(form.buy_price),
        buy_date: form.buy_date,
      });
      setMsg("✅ Holding added successfully");
      setForm({ symbol: "", quantity: "", buy_price: "", buy_date: new Date().toISOString().split("T")[0] });
      await load();
      setTab("holdings");
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
    setAdding(false);
  }

  const totalPnl = summary?.total_pnl || 0;

  return (
    <Layout title="Portfolio Tracker">
      {/* Summary cards */}
      {summary && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
          {[
            { l:"Total Invested",  v:`₹${fmt(summary.total_invested)}`,  c:"var(--text-1)" },
            { l:"Current Value",   v:`₹${fmt(summary.current_value)}`,   c:"var(--text-1)" },
            { l:"Total P&L",       v:`₹${fmt(summary.total_pnl)}`,       c: pctColor(totalPnl) },
            { l:"Return %",        v:`${totalPnl >= 0 ? "+" : ""}${summary.total_pnl_pct?.toFixed(2)}%`, c: pctColor(totalPnl) },
          ].map(item => (
            <div key={item.l} className="card" style={{ padding:"16px 18px" }}>
              <div className="metric-label">{item.l}</div>
              <div style={{ fontSize:"1.4rem", fontWeight:700, color: item.c, marginTop:4 }}>{item.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="tab-bar">
        {(["holdings","add","transactions"] as const).map(t => (
          <div key={t} className={`tab ${tab===t?"active":""}`} onClick={() => setTab(t)}>
            {t === "add" ? "Add Holding" : t.charAt(0).toUpperCase()+t.slice(1)}
          </div>
        ))}
      </div>

      {tab === "holdings" && (
        loading ? <div className="loading"><span className="spinner" style={{marginRight:10}}/>Loading portfolio…</div> :
        holdings.length === 0 ? (
          <div className="empty">
            No holdings yet.&nbsp;
            <span style={{ color:"var(--gold)", cursor:"pointer" }} onClick={() => setTab("add")}>Add your first holding →</span>
          </div>
        ) : (
          <div className="card" style={{ padding:20 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th style={{textAlign:"right"}}>Qty</th>
                  <th style={{textAlign:"right"}}>Buy Price</th>
                  <th style={{textAlign:"right"}}>Current</th>
                  <th style={{textAlign:"right"}}>Invested</th>
                  <th style={{textAlign:"right"}}>Value</th>
                  <th style={{textAlign:"right"}}>P&L</th>
                  <th style={{textAlign:"right"}}>Return</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h: any) => (
                  <tr key={h.id}>
                    <td><span style={{color:"var(--gold)",fontWeight:600}}>{h.symbol?.split(".")[0]}</span><br/><span style={{fontSize:"0.7rem",color:"var(--text-3)"}}>{h.buy_date}</span></td>
                    <td className="num">{h.quantity}</td>
                    <td className="num">₹{fmt(h.buy_price)}</td>
                    <td className="num" style={{color:"var(--text-1)",fontWeight:600}}>₹{fmt(h.current_price)}</td>
                    <td className="num">₹{fmt(h.invested)}</td>
                    <td className="num">₹{fmt(h.current_value)}</td>
                    <td className="num" style={{color:pctColor(h.pnl),fontWeight:600}}>{h.pnl >= 0 ? "+" : ""}₹{fmt(Math.abs(h.pnl))}</td>
                    <td className="num" style={{color:pctColor(h.pnl_pct),fontWeight:600}}>{h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct?.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "add" && (
        <div className="card" style={{ padding:24, maxWidth:460 }}>
          <div className="section-title">Add a Holding</div>
          <form onSubmit={addHolding} style={{ display:"flex", flexDirection:"column", gap:14, marginTop:12 }}>
            <div>
              <label className="label">Stock Symbol</label>
              <input className="input" placeholder="e.g. RELIANCE.NS" value={form.symbol} onChange={e => setForm({...form,symbol:e.target.value.toUpperCase()})} required />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label className="label">Quantity</label>
                <input className="input" type="number" min="0.01" step="0.01" placeholder="10" value={form.quantity} onChange={e => setForm({...form,quantity:e.target.value})} required />
              </div>
              <div>
                <label className="label">Buy Price (₹)</label>
                <input className="input" type="number" min="0.01" step="0.01" placeholder="2500" value={form.buy_price} onChange={e => setForm({...form,buy_price:e.target.value})} required />
              </div>
            </div>
            <div>
              <label className="label">Buy Date</label>
              <input className="input" type="date" value={form.buy_date} onChange={e => setForm({...form,buy_date:e.target.value})} required />
            </div>
            {msg && <div style={{ fontSize:"0.85rem", color: msg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{msg}</div>}
            <button className="btn btn-gold" type="submit" disabled={adding}>{adding ? <span className="spinner" /> : "Add Holding"}</button>
          </form>
        </div>
      )}

      {tab === "transactions" && (
        <div className="card" style={{ padding:20 }}>
          <div className="section-title">Transaction History</div>
          {transactions.length === 0 ? <div className="empty">No transactions yet</div> : (
            <table className="tbl">
              <thead><tr><th>Date</th><th>Symbol</th><th>Type</th><th style={{textAlign:"right"}}>Qty</th><th style={{textAlign:"right"}}>Price</th><th style={{textAlign:"right"}}>Value</th></tr></thead>
              <tbody>
                {transactions.map((t: any) => (
                  <tr key={t.id}>
                    <td style={{color:"var(--text-3)"}}>{t.txn_date}</td>
                    <td><span style={{color:"var(--gold)",fontWeight:600}}>{t.symbol?.split(".")[0]}</span></td>
                    <td><span className={t.txn_type === "BUY" ? "badge-green badge" : "badge-red badge"}>{t.txn_type}</span></td>
                    <td className="num">{t.quantity}</td>
                    <td className="num">₹{fmt(t.price)}</td>
                    <td className="num">₹{fmt(t.quantity * t.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Layout>
  );
}
