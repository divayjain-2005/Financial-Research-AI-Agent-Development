import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

const POPULAR_BROKERS = [
  {
    name: "Zerodha",
    type: "Discount",
    delivery: "Free",
    intraday: "₹20 or 0.03%",
    demat: "₹300/yr",
    highlights: ["Kite platform", "Coin for MF", "Streak algos", "Varsity education"],
    website: "https://zerodha.com",
    color: "#387ed1",
  },
  {
    name: "Groww",
    type: "Discount",
    delivery: "Free",
    intraday: "₹20 or 0.05%",
    demat: "Free",
    highlights: ["Beginner-friendly", "MF & stocks", "UPI payments", "Goal planning"],
    website: "https://groww.in",
    color: "#00d09c",
  },
  {
    name: "Upstox",
    type: "Discount",
    delivery: "Free",
    intraday: "₹20 or 0.05%",
    demat: "Free",
    highlights: ["Pro web & app", "Options analytics", "API access", "Research reports"],
    website: "https://upstox.com",
    color: "#7b2fff",
  },
  {
    name: "Angel One",
    type: "Discount",
    delivery: "Free",
    intraday: "₹20 or 0.25%",
    demat: "₹240/yr",
    highlights: ["SmartAPI", "Research reports", "ARQ Prime advisory", "Angel BEE MF"],
    website: "https://angelone.in",
    color: "#e94b3c",
  },
  {
    name: "ICICI Direct",
    type: "Full Service",
    delivery: "0.55%",
    intraday: "0.275%",
    demat: "₹700/yr",
    highlights: ["3-in-1 account", "Bank integration", "IPO access", "NRI services"],
    website: "https://icicidirect.com",
    color: "#f47920",
  },
  {
    name: "HDFC Securities",
    type: "Full Service",
    delivery: "0.50%",
    intraday: "0.05%",
    demat: "₹750/yr",
    highlights: ["Bank integration", "NRI trading", "Research desk", "Portfolio advisory"],
    website: "https://hdfcsec.com",
    color: "#004c8f",
  },
  {
    name: "Kotak Securities",
    type: "Full Service",
    delivery: "0.49%",
    intraday: "0.049%",
    demat: "₹600/yr",
    highlights: ["Trinity account", "Trade Free plan", "Research reports", "PMS services"],
    website: "https://kotaksecurities.com",
    color: "#dc143c",
  },
  {
    name: "5paisa",
    type: "Discount",
    delivery: "₹20",
    intraday: "₹20",
    demat: "Free",
    highlights: ["Low cost plans", "Research reports", "Robo advisory", "Insurance products"],
    website: "https://5paisa.com",
    color: "#1bb55c",
  },
];

const BROKER_NAMES = POPULAR_BROKERS.map(b => b.name).concat([
  "Motilal Oswal", "SBI Securities", "Sharekhan", "Edelweiss", "Paytm Money", "Other"
]);

export default function Brokers() {
  const [myBrokers, setMyBrokers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", account_id: "", broker_type: "discount", notes: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetchBrokers(); }, []);

  async function fetchBrokers() {
    setLoading(true);
    try { setMyBrokers(await api.brokersGet()); } catch {}
    setLoading(false);
  }

  async function addBroker(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setError("Select a broker name"); return; }
    setSaving(true); setError("");
    try {
      await api.brokerAdd(form);
      setForm({ name: "", account_id: "", broker_type: "discount", notes: "" });
      setShowForm(false);
      await fetchBrokers();
    } catch (err: any) { setError(err.message || "Failed to add broker"); }
    setSaving(false);
  }

  async function removeBroker(id: number) {
    try { await api.brokerRemove(id); await fetchBrokers(); } catch {}
  }

  function f(key: string) { return (e: any) => setForm({ ...form, [key]: e.target.value }); }

  return (
    <Layout title="My Brokers">
      {/* My Brokers section */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>My Broker Accounts</div>
        <button className="btn btn-gold" style={{ padding: "6px 16px" }} onClick={() => { setShowForm(v => !v); setError(""); }}>
          {showForm ? "Cancel" : "+ Add Broker"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={addBroker} className="card" style={{ padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label className="label">Broker Name *</label>
            <select className="input" value={form.name} onChange={f("name")} required>
              <option value="">Select broker…</option>
              {BROKER_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Account / Client ID</label>
            <input className="input" placeholder="e.g. ZB12345" value={form.account_id} onChange={f("account_id")} />
          </div>
          <div>
            <label className="label">Broker Type</label>
            <select className="input" value={form.broker_type} onChange={f("broker_type")}>
              <option value="discount">Discount Broker</option>
              <option value="full_service">Full Service Broker</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Notes (optional)</label>
            <input className="input" placeholder="e.g. Primary trading account" value={form.notes} onChange={f("notes")} />
          </div>
          {error && <div style={{ gridColumn: "1/-1", color: "var(--red)", fontSize: "0.8rem" }}>{error}</div>}
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="btn btn-gold" type="submit" disabled={saving} style={{ padding: "8px 28px" }}>
              {saving ? <span className="spinner" /> : "Save Broker"}
            </button>
          </div>
        </form>
      )}

      {/* My brokers list */}
      {loading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : myBrokers.length === 0 ? (
        <div className="card" style={{ padding: 20, marginBottom: 24, color: "var(--text-3)", fontSize: "0.875rem" }}>
          No broker accounts added yet. Click <strong>+ Add Broker</strong> to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 24 }}>
          {myBrokers.map(b => {
            const info = POPULAR_BROKERS.find(p => p.name === b.name);
            return (
              <div key={b.id} className="card" style={{ padding: 18, borderLeft: `3px solid ${info?.color || "var(--gold)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-1)" }}>{b.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 2 }}>
                      {b.broker_type === "discount" ? "Discount Broker" : "Full Service Broker"}
                    </div>
                  </div>
                  <button
                    onClick={() => removeBroker(b.id)}
                    style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: "1rem", padding: 0 }}
                    title="Remove"
                  >×</button>
                </div>
                {b.account_id && (
                  <div style={{ marginTop: 8, fontSize: "0.8rem" }}>
                    <span style={{ color: "var(--text-3)" }}>Account ID: </span>
                    <span style={{ color: "var(--text-1)", fontFamily: "monospace" }}>{b.account_id}</span>
                  </div>
                )}
                {b.notes && (
                  <div style={{ marginTop: 4, fontSize: "0.78rem", color: "var(--text-3)", fontStyle: "italic" }}>{b.notes}</div>
                )}
                <div style={{ marginTop: 8, fontSize: "0.7rem", color: "var(--text-3)" }}>
                  Added {new Date(b.added_at).toLocaleDateString("en-IN")}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Popular Brokers directory */}
      <div className="section-title" style={{ marginBottom: 14 }}>Popular Indian Brokers</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {POPULAR_BROKERS.map(b => (
          <div key={b.name} className="card" style={{ padding: 18, borderTop: `3px solid ${b.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-1)" }}>{b.name}</div>
                <span style={{
                  display: "inline-block", marginTop: 3, fontSize: "0.65rem", fontWeight: 600,
                  padding: "2px 8px", borderRadius: 4,
                  background: b.type === "Discount" ? "#14532d44" : "#1e3a5f44",
                  color: b.type === "Discount" ? "var(--green)" : "#60a5fa",
                }}>
                  {b.type}
                </span>
              </div>
              <a
                href={b.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.75rem", color: "var(--gold)", textDecoration: "none", paddingTop: 4 }}
              >
                Visit ↗
              </a>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[
                { l: "Delivery", v: b.delivery },
                { l: "Intraday", v: b.intraday },
                { l: "Demat AMC", v: b.demat },
              ].map(item => (
                <div key={item.l} style={{ background: "var(--bg-deep)", borderRadius: 6, padding: "6px 8px" }}>
                  <div style={{ fontSize: "0.62rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.l}</div>
                  <div style={{ fontWeight: 600, fontSize: "0.78rem", color: "var(--text-1)", marginTop: 2 }}>{item.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {b.highlights.map(h => (
                <span key={h} style={{
                  fontSize: "0.68rem", padding: "2px 7px", borderRadius: 4,
                  background: "var(--bg-deep)", color: "var(--text-2)", border: "1px solid var(--border)",
                }}>{h}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
