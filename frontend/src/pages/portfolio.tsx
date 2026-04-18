import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function pctColor(n: any) { return Number(n) >= 0 ? "var(--green)" : "var(--red)"; }

function parseSymbol(raw: string): string {
  const parts = raw.trim().toUpperCase().split(/\s+/);
  if (parts.length >= 2) {
    const ex = parts[parts.length - 1];
    const ticker = parts.slice(0, -1).join("");
    if (ex === "NSE") return `${ticker}.NS`;
    if (ex === "BSE") return `${ticker}.BO`;
  }
  const ticker = parts[0];
  if (ticker.endsWith(".NS") || ticker.endsWith(".BO")) return ticker;
  return `${ticker}.NS`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date();
  const [d, setD] = useState(() => value ? value.split("-")[2] : String(today.getDate()).padStart(2,"0"));
  const [m, setM] = useState(() => value ? value.split("-")[1] : String(today.getMonth()+1).padStart(2,"0"));
  const [y, setY] = useState(() => value ? value.split("-")[0] : String(today.getFullYear()));

  useEffect(() => {
    if (value) {
      const [yy, mm, dd] = value.split("-");
      setY(yy); setM(mm); setD(dd);
    }
  }, [value]);

  function emit(dd: string, mm: string, yy: string) {
    const maxDay = new Date(Number(yy), Number(mm), 0).getDate();
    const safeDay = Math.min(Number(dd), maxDay);
    const safe = String(safeDay).padStart(2,"0");
    setD(safe);
    onChange(`${yy}-${mm}-${safe}`);
  }

  const years = Array.from({ length: 30 }, (_, i) => today.getFullYear() - i);
  const days = Array.from({ length: new Date(Number(y), Number(m), 0).getDate() }, (_, i) => String(i+1).padStart(2,"0"));

  const sel: React.CSSProperties = {
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
    color: "var(--text-1)", padding: "8px 10px", fontSize: "0.875rem", cursor: "pointer", flex: 1,
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select style={sel} value={d} onChange={e => { setD(e.target.value); emit(e.target.value, m, y); }}>
        {days.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <select style={sel} value={m} onChange={e => { setM(e.target.value); emit(d, e.target.value, y); }}>
        {MONTHS.map((name, i) => {
          const val = String(i+1).padStart(2,"0");
          return <option key={val} value={val}>{name}</option>;
        })}
      </select>
      <select style={sel} value={y} onChange={e => { setY(e.target.value); emit(d, m, e.target.value); }}>
        {years.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}

export default function Portfolio() {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"holdings"|"add">("holdings");
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const [form, setForm] = useState({ symbol: "", quantity: "", buy_price: "", buy_date: todayIso });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");
  const [removing, setRemoving] = useState<number|null>(null);

  async function load() {
    setLoading(true);
    try {
      const port = await api.portfolioGet();
      setHoldings(port.holdings || []);
      setSummary(port.summary || {});
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true); setMsg("");
    const apiSym = parseSymbol(form.symbol);
    try {
      const quote = await api.quote(apiSym).catch(() => null);
      if (!quote || !quote.current_price) {
        setMsg(`❌ "${form.symbol.trim().toUpperCase()}" is not a valid stock symbol. Please check and try again.`);
        setAdding(false);
        return;
      }
      await api.portfolioAdd({
        symbol: apiSym,
        quantity: Number(form.quantity),
        buy_price: Number(form.buy_price),
        buy_date: form.buy_date,
      });
      setMsg("✅ Holding added successfully");
      setForm({ symbol: "", quantity: "", buy_price: "", buy_date: todayIso });
      await load();
      setTab("holdings");
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
    setAdding(false);
  }

  async function removeHolding(id: number, symbol: string) {
    if (!confirm(`Remove ${symbol?.split(".")[0]} from holdings?`)) return;
    setRemoving(id);
    try {
      await api.portfolioRemove(id);
      await load();
    } catch {}
    setRemoving(null);
  }

  const totalPnl = summary?.total_pnl || 0;

  return (
    <Layout title="Portfolio Tracker">
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
        {(["holdings","add"] as const).map(t => (
          <div key={t} className={`tab ${tab===t?"active":""}`} onClick={() => setTab(t)}>
            {t === "add" ? "Add Holding" : "Holdings"}
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h: any) => (
                  <tr key={h.id}>
                    <td>
                      <span style={{color:"var(--gold)",fontWeight:600}}>{h.symbol?.split(".")[0]}</span>
                      <br/>
                      <span style={{fontSize:"0.7rem",color:"var(--text-3)"}}>{fmtDate(h.buy_date)}</span>
                    </td>
                    <td className="num">{h.quantity}</td>
                    <td className="num">₹{fmt(h.buy_price)}</td>
                    <td className="num" style={{color:"var(--text-1)",fontWeight:600}}>₹{fmt(h.current_price)}</td>
                    <td className="num">₹{fmt(h.invested)}</td>
                    <td className="num">₹{fmt(h.current_value)}</td>
                    <td className="num" style={{color:pctColor(h.pnl),fontWeight:600}}>{h.pnl >= 0 ? "+" : ""}₹{fmt(Math.abs(h.pnl))}</td>
                    <td className="num" style={{color:pctColor(h.pnl_pct),fontWeight:600}}>{h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct?.toFixed(2)}%</td>
                    <td style={{textAlign:"center"}}>
                      <button
                        onClick={() => removeHolding(h.id, h.symbol)}
                        disabled={removing === h.id}
                        title="Remove holding"
                        style={{
                          background: "none", border: "1px solid #7f1d1d", borderRadius: 6,
                          color: "#fca5a5", cursor: "pointer", width: 26, height: 26,
                          fontSize: "0.85rem", lineHeight: 1, padding: 0,
                          opacity: removing === h.id ? 0.5 : 1,
                        }}
                      >
                        {removing === h.id ? "…" : "×"}
                      </button>
                    </td>
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
              <input className="input" placeholder="e.g. RELIANCE NSE" value={form.symbol} onChange={e => setForm({...form,symbol:e.target.value.toUpperCase()})} required />
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
              <DatePicker value={form.buy_date} onChange={v => setForm({...form, buy_date: v})} />
            </div>
            {msg && <div style={{ fontSize:"0.85rem", color: msg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{msg}</div>}
            <button className="btn btn-gold" type="submit" disabled={adding}>{adding ? <span className="spinner" /> : "Add Holding"}</button>
          </form>
        </div>
      )}
    </Layout>
  );
}
