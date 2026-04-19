import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

type Field = { key: string; label: string; placeholder?: string; secret?: boolean; required?: boolean };

type BrokerConfig = {
  name: string;
  color: string;
  icon: string;
  apiName: string;
  docsUrl: string;
  fields: Field[];
};

const BROKERS: BrokerConfig[] = [
  {
    name: "Zerodha",
    color: "#387ed1",
    icon: "Z",
    apiName: "Kite Connect",
    docsUrl: "https://kite.trade/docs/connect/v3/",
    fields: [
      { key: "client_id",   label: "Client ID",   placeholder: "Your Zerodha client ID",  required: true },
      { key: "api_key",     label: "API Key",     placeholder: "Kite Connect API key",     required: true },
      { key: "api_secret",  label: "API Secret",  placeholder: "Kite Connect API secret",  secret: true, required: true },
      { key: "redirect_url",label: "Redirect URL",placeholder: "https://yourapp.com/callback" },
    ],
  },
  {
    name: "Upstox",
    color: "#7b2fff",
    icon: "U",
    apiName: "Upstox API v2",
    docsUrl: "https://upstox.com/developer/api-documentation/",
    fields: [
      { key: "client_id",   label: "Client ID",   placeholder: "Upstox client ID",         required: true },
      { key: "api_key",     label: "API Key",     placeholder: "Upstox API key",            required: true },
      { key: "api_secret",  label: "API Secret",  placeholder: "Upstox API secret",         secret: true, required: true },
      { key: "redirect_url",label: "Redirect URL",placeholder: "https://yourapp.com/callback", required: true },
    ],
  },
  {
    name: "Angel One",
    color: "#e94b3c",
    icon: "A",
    apiName: "SmartAPI",
    docsUrl: "https://smartapi.angelbroking.com/docs",
    fields: [
      { key: "client_id",   label: "Client ID",    placeholder: "Angel One client ID",      required: true },
      { key: "api_key",     label: "API Key",      placeholder: "SmartAPI key",             required: true },
      { key: "api_secret",  label: "MPIN / Password", placeholder: "Trading password",      secret: true, required: true },
      { key: "totp_secret", label: "TOTP Secret",  placeholder: "Base32 TOTP secret key",   secret: true },
    ],
  },
  {
    name: "ICICI Direct",
    color: "#f47920",
    icon: "I",
    apiName: "Breeze API",
    docsUrl: "https://api.icicidirect.com/apiuser/login",
    fields: [
      { key: "client_id",   label: "User ID",     placeholder: "ICICI Direct user ID",     required: true },
      { key: "api_key",     label: "API Key",     placeholder: "Breeze API key",           required: true },
      { key: "api_secret",  label: "API Secret",  placeholder: "Breeze API secret",        secret: true, required: true },
    ],
  },
  {
    name: "HDFC Securities",
    color: "#004c8f",
    icon: "H",
    apiName: "Sky API",
    docsUrl: "https://www.hdfcsec.com/",
    fields: [
      { key: "client_id",   label: "Client ID",   placeholder: "HDFC Sec client ID",      required: true },
      { key: "api_key",     label: "API Key",     placeholder: "Sky API key",             required: true },
      { key: "api_secret",  label: "API Secret",  placeholder: "Sky API secret",          secret: true, required: true },
    ],
  },
  {
    name: "Kotak Neo",
    color: "#dc143c",
    icon: "K",
    apiName: "Kotak Neo API",
    docsUrl: "https://developers.kotakneo.com/",
    fields: [
      { key: "client_id",   label: "Mobile / User ID", placeholder: "Registered mobile",  required: true },
      { key: "api_key",     label: "Consumer Key",     placeholder: "Neo consumer key",   required: true },
      { key: "api_secret",  label: "Consumer Secret",  placeholder: "Neo consumer secret",secret: true, required: true },
    ],
  },
  {
    name: "5paisa",
    color: "#1bb55c",
    icon: "5",
    apiName: "5paisa API",
    docsUrl: "https://dev-openapi.5paisa.com/",
    fields: [
      { key: "client_id",   label: "Client Code",  placeholder: "5paisa client code",    required: true },
      { key: "api_key",     label: "App Name / Key",placeholder: "5paisa app key",       required: true },
      { key: "api_secret",  label: "App Secret",   placeholder: "5paisa app secret",    secret: true, required: true },
    ],
  },
  {
    name: "Fyers",
    color: "#ff6b35",
    icon: "F",
    apiName: "Fyers API v3",
    docsUrl: "https://myapi.fyers.in/docs/",
    fields: [
      { key: "client_id",   label: "Fyers ID",    placeholder: "Your Fyers ID",          required: true },
      { key: "api_key",     label: "App ID",      placeholder: "Fyers app ID",           required: true },
      { key: "api_secret",  label: "Secret Key",  placeholder: "Fyers secret key",       secret: true, required: true },
      { key: "redirect_url",label: "Redirect URL",placeholder: "https://yourapp.com/callback", required: true },
    ],
  },
];

function mask(s: string) {
  if (!s || s === "••••••••") return "••••••••";
  return s.slice(0, 4) + "••••" + s.slice(-2);
}

export default function Brokers() {
  const [connected, setConnected] = useState<any[]>([]);
  const [activeConnect, setActiveConnect] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchConnected(); }, []);

  async function fetchConnected() {
    setLoading(true);
    try { setConnected(await api.brokersGet()); } catch {}
    setLoading(false);
  }

  function openForm(brokerName: string) {
    setActiveConnect(brokerName);
    setForm({});
    setError("");
  }

  function closeForm() {
    setActiveConnect(null);
    setForm({});
    setError("");
  }

  async function handleConnect(cfg: BrokerConfig, e: React.FormEvent) {
    e.preventDefault();
    const missing = cfg.fields.filter(f => f.required && !form[f.key]?.trim());
    if (missing.length) { setError(`Required: ${missing.map(f => f.label).join(", ")}`); return; }
    setSaving(true); setError("");
    try {
      await api.brokerAdd({ broker: cfg.name, ...form });
      closeForm();
      await fetchConnected();
    } catch (err: any) { setError(err.message || "Failed to connect"); }
    setSaving(false);
  }

  async function disconnect(id: number) {
    try { await api.brokerRemove(id); await fetchConnected(); } catch {}
  }

  const connectedNames = new Set(connected.map(c => c.broker));

  return (
    <Layout title="My Brokers">
      <div style={{ maxWidth: 920 }}>

        {/* Connected accounts */}
        {!loading && connected.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div className="section-title" style={{ marginBottom: 14 }}>Connected Accounts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {connected.map(acc => {
                const cfg = BROKERS.find(b => b.name === acc.broker);
                return (
                  <div key={acc.id} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                    {/* Icon */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, background: cfg?.color || "var(--gold)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: "1.1rem", color: "#fff", flexShrink: 0,
                    }}>
                      {cfg?.icon || acc.broker[0]}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, color: "var(--text-1)", fontSize: "0.95rem" }}>{acc.broker}</span>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: "#14532d44", color: "var(--green)", border: "1px solid #14532d",
                          letterSpacing: "0.05em",
                        }}>● CONNECTED</span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 3, display: "flex", gap: 16 }}>
                        {acc.client_id && <span>Client ID: <strong style={{ color: "var(--text-2)", fontFamily: "monospace" }}>{acc.client_id}</strong></span>}
                        {acc.api_key   && <span>API Key: <strong style={{ color: "var(--text-2)", fontFamily: "monospace" }}>{mask(acc.api_key)}</strong></span>}
                        {cfg && <span style={{ color: "var(--text-3)" }}>{cfg.apiName}</span>}
                      </div>
                    </div>
                    {/* Disconnect */}
                    <button
                      onClick={() => disconnect(acc.id)}
                      className="btn"
                      style={{ padding: "5px 14px", fontSize: "0.78rem", background: "#7f1d1d22", color: "#fca5a5", border: "1px solid #7f1d1d", borderRadius: 6 }}
                    >
                      Disconnect
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Broker tiles */}
        <div className="section-title" style={{ marginBottom: 14 }}>
          {connected.length === 0 ? "Connect Your Demat Account" : "Add Another Broker"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
          {BROKERS.map(cfg => {
            const isConnected = connectedNames.has(cfg.name);
            const isOpen = activeConnect === cfg.name;
            return (
              <div
                key={cfg.name}
                onClick={() => !isConnected && (isOpen ? closeForm() : openForm(cfg.name))}
                className="card"
                style={{
                  padding: "18px 16px", cursor: isConnected ? "default" : "pointer",
                  borderTop: `3px solid ${cfg.color}`,
                  opacity: isConnected ? 0.6 : 1,
                  outline: isOpen ? `2px solid ${cfg.color}` : "none",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: cfg.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "1rem", color: "#fff",
                  }}>
                    {cfg.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)" }}>{cfg.name}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-3)" }}>{cfg.apiName}</div>
                  </div>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginBottom: 10 }}>
                  {cfg.fields.filter(f => f.required).map(f => f.label).join(" · ")}
                </div>
                {isConnected ? (
                  <div style={{ fontSize: "0.72rem", color: "var(--green)", fontWeight: 600 }}>● Connected</div>
                ) : (
                  <div style={{
                    fontSize: "0.75rem", fontWeight: 600,
                    color: isOpen ? cfg.color : "var(--gold)",
                  }}>
                    {isOpen ? "▲ Close" : "Connect →"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Connection form */}
        {activeConnect && (() => {
          const cfg = BROKERS.find(b => b.name === activeConnect)!;
          return (
            <div className="card" style={{ padding: 24, borderTop: `3px solid ${cfg.color}`, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: cfg.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "1.1rem", color: "#fff",
                }}>
                  {cfg.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-1)" }}>Connect {cfg.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                    Uses {cfg.apiName} ·{" "}
                    <a href={cfg.docsUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--gold)", textDecoration: "none" }}>
                      View API docs ↗
                    </a>
                  </div>
                </div>
              </div>

              <form onSubmit={e => handleConnect(cfg, e)}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                  {cfg.fields.map(field => (
                    <div key={field.key}>
                      <label className="label">
                        {field.label} {field.required && <span style={{ color: "var(--red)" }}>*</span>}
                      </label>
                      <input
                        className="input"
                        type={field.secret ? "password" : "text"}
                        placeholder={field.placeholder || ""}
                        value={form[field.key] || ""}
                        onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  ))}
                </div>

                {error && (
                  <div style={{ color: "var(--red)", fontSize: "0.8rem", marginBottom: 12 }}>{error}</div>
                )}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button className="btn btn-gold" type="submit" disabled={saving} style={{ padding: "8px 28px" }}>
                    {saving ? <span className="spinner" /> : `Connect ${cfg.name}`}
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: "8px 18px" }} onClick={closeForm}>
                    Cancel
                  </button>
                </div>
              </form>

              <div style={{ marginTop: 16, padding: "10px 14px", background: "#78350f22", borderRadius: 8, fontSize: "0.75rem", color: "#fcd34d", border: "1px solid #78350f44" }}>
                🔒 Credentials are stored locally on this server only and never shared externally. API secrets are masked on display.
              </div>
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}
