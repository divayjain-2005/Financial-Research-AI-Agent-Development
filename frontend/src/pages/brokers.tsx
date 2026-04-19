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
    color: "#387ed1", icon: "Z",
    apiName: "Kite Connect",
    docsUrl: "https://kite.trade/docs/connect/v3/",
    fields: [
      { key: "client_id",    label: "Client ID",    placeholder: "Your Zerodha client ID",   required: true },
      { key: "api_key",      label: "API Key",      placeholder: "Kite Connect API key",     required: true },
      { key: "api_secret",   label: "API Secret",   placeholder: "Kite Connect API secret",  secret: true, required: true },
      { key: "redirect_url", label: "Redirect URL", placeholder: "https://yourapp.com/callback" },
    ],
  },
  {
    name: "Upstox",
    color: "#7b2fff", icon: "U",
    apiName: "Upstox API v2",
    docsUrl: "https://upstox.com/developer/api-documentation/",
    fields: [
      { key: "client_id",    label: "Client ID",    placeholder: "Upstox client ID",          required: true },
      { key: "api_key",      label: "API Key",      placeholder: "Upstox API key",            required: true },
      { key: "api_secret",   label: "API Secret",   placeholder: "Upstox API secret",         secret: true, required: true },
      { key: "redirect_url", label: "Redirect URL", placeholder: "https://yourapp.com/callback", required: true },
    ],
  },
  {
    name: "Angel One",
    color: "#e94b3c", icon: "A",
    apiName: "SmartAPI",
    docsUrl: "https://smartapi.angelbroking.com/docs",
    fields: [
      { key: "client_id",   label: "Client ID",       placeholder: "Angel One client ID",     required: true },
      { key: "api_key",     label: "API Key",         placeholder: "SmartAPI key",            required: true },
      { key: "api_secret",  label: "MPIN / Password", placeholder: "Trading password",        secret: true, required: true },
      { key: "totp_secret", label: "TOTP Secret",     placeholder: "Base32 TOTP secret key",  secret: true },
    ],
  },
  {
    name: "ICICI Direct",
    color: "#f47920", icon: "I",
    apiName: "Breeze API",
    docsUrl: "https://api.icicidirect.com/apiuser/login",
    fields: [
      { key: "client_id",  label: "User ID",    placeholder: "ICICI Direct user ID",  required: true },
      { key: "api_key",    label: "API Key",    placeholder: "Breeze API key",        required: true },
      { key: "api_secret", label: "API Secret", placeholder: "Breeze API secret",     secret: true, required: true },
    ],
  },
  {
    name: "HDFC Securities",
    color: "#004c8f", icon: "H",
    apiName: "Sky API",
    docsUrl: "https://www.hdfcsec.com/",
    fields: [
      { key: "client_id",  label: "Client ID",  placeholder: "HDFC Sec client ID",  required: true },
      { key: "api_key",    label: "API Key",    placeholder: "Sky API key",         required: true },
      { key: "api_secret", label: "API Secret", placeholder: "Sky API secret",      secret: true, required: true },
    ],
  },
  {
    name: "Kotak Neo",
    color: "#dc143c", icon: "K",
    apiName: "Kotak Neo API",
    docsUrl: "https://developers.kotakneo.com/",
    fields: [
      { key: "client_id",  label: "Mobile / User ID", placeholder: "Registered mobile",    required: true },
      { key: "api_key",    label: "Consumer Key",     placeholder: "Neo consumer key",     required: true },
      { key: "api_secret", label: "Consumer Secret",  placeholder: "Neo consumer secret",  secret: true, required: true },
    ],
  },
  {
    name: "5paisa",
    color: "#1bb55c", icon: "5",
    apiName: "5paisa API",
    docsUrl: "https://dev-openapi.5paisa.com/",
    fields: [
      { key: "client_id",  label: "Client Code",   placeholder: "5paisa client code",  required: true },
      { key: "api_key",    label: "App Name / Key", placeholder: "5paisa app key",     required: true },
      { key: "api_secret", label: "App Secret",    placeholder: "5paisa app secret",   secret: true, required: true },
    ],
  },
  {
    name: "Fyers",
    color: "#ff6b35", icon: "F",
    apiName: "Fyers API v3",
    docsUrl: "https://myapi.fyers.in/docs/",
    fields: [
      { key: "client_id",    label: "Fyers ID",     placeholder: "Your Fyers ID",                       required: true },
      { key: "api_key",      label: "App ID",       placeholder: "Fyers app ID",                        required: true },
      { key: "api_secret",   label: "Secret Key",   placeholder: "Fyers secret key",    secret: true,   required: true },
      { key: "redirect_url", label: "Redirect URL", placeholder: "https://yourapp.com/callback",        required: true },
    ],
  },
  {
    name: "Binance",
    color: "#f0b90b", icon: "B",
    apiName: "Binance API",
    docsUrl: "https://binance-docs.github.io/apidocs/",
    fields: [
      { key: "client_id",  label: "Account / UID", placeholder: "Binance account UID",   required: true },
      { key: "api_key",    label: "API Key",       placeholder: "Binance API key",       required: true },
      { key: "api_secret", label: "Secret Key",    placeholder: "Binance secret key",    secret: true, required: true },
    ],
  },
  {
    name: "WazirX",
    color: "#1a5cff", icon: "W",
    apiName: "WazirX API",
    docsUrl: "https://docs.wazirx.com/",
    fields: [
      { key: "client_id",  label: "Account Email / ID", placeholder: "WazirX email",       required: true },
      { key: "api_key",    label: "API Key",            placeholder: "WazirX API key",     required: true },
      { key: "api_secret", label: "Secret Key",         placeholder: "WazirX secret key",  secret: true, required: true },
    ],
  },
  {
    name: "Delta Exchange",
    color: "#00d4aa", icon: "D",
    apiName: "Delta Exchange API",
    docsUrl: "https://docs.delta.exchange/",
    fields: [
      { key: "client_id",  label: "Account Email / ID", placeholder: "Delta account email",       required: true },
      { key: "api_key",    label: "API Key",            placeholder: "Delta Exchange API key",    required: true },
      { key: "api_secret", label: "API Secret",         placeholder: "Delta Exchange API secret", secret: true, required: true },
    ],
  },
  {
    name: "Vantage",
    color: "#e63946", icon: "V",
    apiName: "Vantage Markets API",
    docsUrl: "https://www.vantagemarkets.com/",
    fields: [
      { key: "client_id",  label: "Account ID",   placeholder: "Vantage account ID",  required: true },
      { key: "api_key",    label: "API Key",      placeholder: "Vantage API key",     required: true },
      { key: "api_secret", label: "API Secret",   placeholder: "Vantage API secret",  secret: true, required: true },
    ],
  },
  {
    name: "Exness",
    color: "#ff6600", icon: "E",
    apiName: "Exness Partner API",
    docsUrl: "https://www.exness.com/",
    fields: [
      { key: "client_id",  label: "Account ID / Login", placeholder: "Exness account login", required: true },
      { key: "api_key",    label: "API Key",            placeholder: "Exness API key",       required: true },
      { key: "api_secret", label: "API Secret",         placeholder: "Exness API secret",    secret: true, required: true },
    ],
  },
  {
    name: "XM",
    color: "#e30613", icon: "X",
    apiName: "XM API",
    docsUrl: "https://www.xm.com/",
    fields: [
      { key: "client_id",  label: "Account ID / Login", placeholder: "XM account login", required: true },
      { key: "api_key",    label: "API Key",            placeholder: "XM API key",       required: true },
      { key: "api_secret", label: "API Secret",         placeholder: "XM API secret",    secret: true, required: true },
    ],
  },
];

function mask(s: string) {
  if (!s || s === "••••••••") return "••••••••";
  return s.slice(0, 4) + "••••" + s.slice(-2);
}

export default function Brokers() {
  const [connected, setConnected] = useState<any[]>([]);
  const [selectedBroker, setSelectedBroker] = useState("");
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

  function handleBrokerSelect(name: string) {
    setSelectedBroker(name);
    setForm({});
    setError("");
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const cfg = BROKERS.find(b => b.name === selectedBroker);
    if (!cfg) return;
    const missing = cfg.fields.filter(f => f.required && !form[f.key]?.trim());
    if (missing.length) { setError(`Required: ${missing.map(f => f.label).join(", ")}`); return; }
    setSaving(true); setError("");
    try {
      await api.brokerAdd({ broker: cfg.name, ...form });
      setSelectedBroker("");
      setForm({});
      await fetchConnected();
    } catch (err: any) { setError(err.message || "Failed to connect"); }
    setSaving(false);
  }

  async function disconnect(id: number) {
    try { await api.brokerRemove(id); await fetchConnected(); } catch {}
  }

  const cfg = BROKERS.find(b => b.name === selectedBroker) ?? null;

  return (
    <Layout title="My Brokers">
      <div style={{ maxWidth: 860 }}>

        {/* Connected accounts */}
        {!loading && connected.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Connected Accounts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {connected.map(acc => {
                const b = BROKERS.find(x => x.name === acc.broker);
                return (
                  <div key={acc.id} className="card" style={{
                    padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
                    borderLeft: `3px solid ${b?.color || "var(--gold)"}`,
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                      background: b?.color || "var(--gold)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: "1rem", color: "#fff",
                    }}>
                      {b?.icon || acc.broker[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{acc.broker}</span>
                        <span style={{
                          fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: "#14532d44", color: "var(--green)", border: "1px solid #14532d",
                        }}>● CONNECTED</span>
                      </div>
                      <div style={{ fontSize: "0.77rem", color: "var(--text-3)", marginTop: 3, display: "flex", gap: 14, flexWrap: "wrap" }}>
                        {acc.client_id && <span>Client ID: <strong style={{ color: "var(--text-2)", fontFamily: "monospace" }}>{acc.client_id}</strong></span>}
                        {acc.api_key   && <span>API Key: <strong style={{ color: "var(--text-2)", fontFamily: "monospace" }}>{mask(acc.api_key)}</strong></span>}
                        {b && <span>{b.apiName}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => disconnect(acc.id)}
                      className="btn"
                      style={{ padding: "5px 14px", fontSize: "0.78rem", background: "#7f1d1d22", color: "#fca5a5", border: "1px solid #7f1d1d", borderRadius: 6, flexShrink: 0 }}
                    >
                      Disconnect
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add broker panel */}
        <div className="card" style={{ padding: 24 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Connect a Broker</div>

          {/* Dropdown */}
          <div style={{ marginBottom: cfg ? 20 : 0 }}>
            <label className="label">Select Broker</label>
            <select
              className="input"
              value={selectedBroker}
              onChange={e => handleBrokerSelect(e.target.value)}
              style={{ maxWidth: 340 }}
            >
              <option value="">— Choose a broker —</option>
              {BROKERS.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Dynamic credential form */}
          {cfg && (
            <>
              {/* Broker header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: cfg.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "1rem", color: "#fff",
                }}>
                  {cfg.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-1)" }}>{cfg.name}</div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-3)" }}>
                    {cfg.apiName} ·{" "}
                    <a href={cfg.docsUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--gold)", textDecoration: "none" }}>
                      API docs ↗
                    </a>
                  </div>
                </div>
              </div>

              <form onSubmit={handleConnect}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                  {cfg.fields.map(field => (
                    <div key={field.key}>
                      <label className="label">
                        {field.label}{field.required && <span style={{ color: "var(--red)", marginLeft: 3 }}>*</span>}
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

                {error && <div style={{ color: "var(--red)", fontSize: "0.8rem", marginBottom: 12 }}>{error}</div>}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button className="btn btn-gold" type="submit" disabled={saving} style={{ padding: "8px 28px" }}>
                    {saving ? <span className="spinner" /> : `Connect ${cfg.name}`}
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: "8px 18px" }}
                    onClick={() => { setSelectedBroker(""); setForm({}); setError(""); }}>
                    Cancel
                  </button>
                </div>
              </form>

              <div style={{ marginTop: 16, padding: "9px 13px", background: "#78350f22", borderRadius: 7, fontSize: "0.73rem", color: "#fcd34d", border: "1px solid #78350f44" }}>
                🔒 Credentials are stored locally on this server and never shared externally. Secrets are masked on display.
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
