import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

function fmt(n: any) { return n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function pctColor(n: any) { return Number(n) >= 0 ? "var(--green)" : "var(--red)"; }

function parseSymbol(raw: string): { apiSym: string; exchange: string } {
  const parts = raw.trim().toUpperCase().split(/\s+/);
  if (parts.length >= 2) {
    const ex = parts[parts.length - 1];
    const ticker = parts.slice(0, -1).join("");
    if (ex === "NSE") return { apiSym: `${ticker}.NS`, exchange: "NSE" };
    if (ex === "BSE") return { apiSym: `${ticker}.BO`, exchange: "BSE" };
  }
  const ticker = parts[0];
  if (ticker.endsWith(".NS")) return { apiSym: ticker, exchange: "NSE" };
  if (ticker.endsWith(".BO")) return { apiSym: ticker, exchange: "BSE" };
  return { apiSym: `${ticker}.NS`, exchange: "NSE" };
}

export default function Watchlist() {
  const [list, setList] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<Record<string, any>>({});
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const wl = await api.watchlistGet();
      setList(wl.watchlist || []);
      const symbols = (wl.watchlist || []).map((w: any) => w.symbol);
      const results = await Promise.all(symbols.map((s: string) => api.quote(s).catch(() => null)));
      const map: Record<string, any> = {};
      symbols.forEach((s: string, i: number) => { map[s] = results[i]; });
      setQuotes(map);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addSymbol(e: React.FormEvent) {
    e.preventDefault();
    const raw = symbol.trim();
    if (!raw) return;
    const { apiSym, exchange } = parseSymbol(raw);
    setAdding(true); setMsg("");
    try {
      const quote = await api.quote(apiSym).catch(() => null);
      if (!quote || !quote.current_price) {
        setMsg(`❌ "${raw}" is not a valid stock symbol. Please check and try again.`);
        setAdding(false);
        return;
      }
      await api.watchlistAdd(apiSym, exchange);
      setMsg(`✅ ${apiSym.split(".")[0]} added to watchlist`);
      setSymbol("");
      await load();
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setAdding(false);
  }

  async function remove(sym: string) {
    try {
      await api.watchlistRemove(sym);
      await load();
    } catch {}
  }

  return (
    <Layout title="Watchlist">
      <form onSubmit={addSymbol} style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <input
          className="input"
          value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g. RELIANCE NSE  or  TCS BSE"
          style={{ maxWidth:300 }}
          required
        />
        <button className="btn btn-gold" type="submit" disabled={adding}>
          {adding ? <span className="spinner" /> : "+ Add"}
        </button>
        {msg && <div style={{ fontSize:"0.82rem", color: msg.startsWith("✅") ? "var(--green)" : "var(--red)", alignSelf:"center" }}>{msg}</div>}
      </form>

      {loading ? (
        <div className="loading"><span className="spinner" style={{marginRight:10}}/>Loading watchlist…</div>
      ) : list.length === 0 ? (
        <div className="empty">Your watchlist is empty. Add some stocks to track!</div>
      ) : (
        <div className="card" style={{ padding:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div className="section-title" style={{marginBottom:0}}>{list.length} stocks tracked</div>
            <button className="btn btn-ghost" style={{fontSize:"0.75rem"}} onClick={load}>⟳ Refresh</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Exchange</th>
                <th style={{textAlign:"right"}}>Price (₹)</th>
                <th style={{textAlign:"right"}}>Change</th>
                <th style={{textAlign:"right"}}>Change %</th>
                <th style={{textAlign:"right"}}>52W High</th>
                <th style={{textAlign:"right"}}>52W Low</th>
                <th style={{textAlign:"right"}}>Volume</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((item: any) => {
                const q = quotes[item.symbol];
                return (
                  <tr key={item.id}>
                    <td>
                      <span style={{color:"var(--gold)",fontWeight:700}}>{item.symbol?.split(".")[0]}</span><br/>
                      <span style={{fontSize:"0.7rem",color:"var(--text-3)"}}>{q?.company_name || ""}</span>
                    </td>
                    <td><span className="badge badge-blue">{item.exchange}</span></td>
                    <td className="num" style={{color:"var(--text-1)",fontWeight:600}}>{q ? `₹${fmt(q.current_price)}` : <span className="spinner" />}</td>
                    <td className="num" style={{color: q ? pctColor(q.change) : "var(--text-3)"}}>
                      {q ? `${q.change >= 0 ? "+" : ""}${fmt(q.change)}` : "—"}
                    </td>
                    <td className="num" style={{color: q ? pctColor(q.change_percent) : "var(--text-3)", fontWeight:600}}>
                      {q ? `${q.change_percent >= 0 ? "+" : ""}${q.change_percent?.toFixed(2)}%` : "—"}
                    </td>
                    <td className="num">{q?.fifty_two_week_high ? `₹${fmt(q.fifty_two_week_high)}` : "—"}</td>
                    <td className="num">{q?.fifty_two_week_low  ? `₹${fmt(q.fifty_two_week_low)}`  : "—"}</td>
                    <td className="num">{q?.volume?.toLocaleString("en-IN") || "—"}</td>
                    <td>
                      <button className="btn btn-red" style={{padding:"2px 8px",fontSize:"0.7rem"}} onClick={() => remove(item.symbol)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
