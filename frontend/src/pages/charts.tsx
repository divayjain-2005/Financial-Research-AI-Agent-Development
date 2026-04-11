import React, { useState } from "react";
import Layout from "@/components/Layout";
import TradingViewChart from "@/components/TradingViewChart";

const GROUPS = [
  {
    label: "Indian Indices",
    symbols: [
      { label: "Nifty 50",    sym: "^NSEI" },
      { label: "Bank Nifty",  sym: "^NSEBANK" },
      { label: "Sensex",      sym: "^BSESN" },
      { label: "Nifty IT",    sym: "^CNXIT" },
      { label: "Nifty Pharma",sym: "^CNXPHARMA" },
    ],
  },
  {
    label: "Large Cap",
    symbols: [
      { label: "Reliance",    sym: "RELIANCE.NS" },
      { label: "TCS",         sym: "TCS.NS" },
      { label: "Infosys",     sym: "INFY.NS" },
      { label: "HDFC Bank",   sym: "HDFCBANK.NS" },
      { label: "ICICI Bank",  sym: "ICICIBANK.NS" },
      { label: "Wipro",       sym: "WIPRO.NS" },
      { label: "SBI",         sym: "SBIN.NS" },
      { label: "Maruti",      sym: "MARUTI.NS" },
      { label: "Sun Pharma",  sym: "SUNPHARMA.NS" },
      { label: "Tata Motors", sym: "TATAMOTORS.NS" },
      { label: "L&T",         sym: "LT.NS" },
      { label: "HCL Tech",    sym: "HCLTECH.NS" },
    ],
  },
  {
    label: "Global Indices",
    symbols: [
      { label: "S&P 500",     sym: "^GSPC" },
      { label: "NASDAQ",      sym: "^IXIC" },
      { label: "Dow Jones",   sym: "^DJI" },
      { label: "FTSE 100",    sym: "^FTSE" },
      { label: "Nikkei 225",  sym: "^N225" },
      { label: "Hang Seng",   sym: "^HSI" },
    ],
  },
  {
    label: "Commodities & FX",
    symbols: [
      { label: "Gold",        sym: "GC=F" },
      { label: "Silver",      sym: "SI=F" },
      { label: "Crude Oil",   sym: "CL=F" },
      { label: "USD/INR",     sym: "USDINR=X" },
      { label: "EUR/INR",     sym: "EURINR=X" },
      { label: "GBP/INR",     sym: "GBPINR=X" },
    ],
  },
];

export default function Charts() {
  const [active, setActive] = useState("RELIANCE.NS");
  const [customInput, setCustomInput] = useState("");

  function handleCustom() {
    const s = customInput.trim().toUpperCase();
    if (s) { setActive(s); setCustomInput(""); }
  }

  const activeLabel =
    GROUPS.flatMap(g => g.symbols).find(s => s.sym === active)?.label || active;

  return (
    <Layout title="Charts">
      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 102px)" }}>

        {/* Left symbol panel */}
        <div style={{
          width: 190, flexShrink: 0, display: "flex", flexDirection: "column", gap: 0,
          background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)",
          overflow: "hidden",
        }}>
          {/* Custom search */}
          <div style={{ padding: "12px 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="input"
                placeholder="e.g. ONGC.NS"
                value={customInput}
                onChange={e => setCustomInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleCustom()}
                style={{ flex: 1, fontSize: "0.78rem", padding: "6px 10px" }}
              />
              <button
                className="btn btn-gold"
                style={{ padding: "6px 10px", fontSize: "0.78rem", flexShrink: 0 }}
                onClick={handleCustom}
              >Go</button>
            </div>
          </div>

          {/* Symbol groups */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {GROUPS.map(group => (
              <div key={group.label}>
                <div style={{
                  fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: "var(--text-3)",
                  padding: "10px 12px 4px",
                }}>
                  {group.label}
                </div>
                {group.symbols.map(s => (
                  <div
                    key={s.sym}
                    onClick={() => setActive(s.sym)}
                    style={{
                      padding: "7px 14px",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      background: active === s.sym ? "var(--bg-hover)" : "transparent",
                      borderLeft: `3px solid ${active === s.sym ? "var(--gold)" : "transparent"}`,
                      color: active === s.sym ? "var(--text-1)" : "var(--text-2)",
                      fontWeight: active === s.sym ? 600 : 400,
                      transition: "all 0.12s",
                      userSelect: "none",
                    }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Chart area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-1)" }}>
              {activeLabel}
            </span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-3)", fontFamily: "monospace" }}>
              {active}
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <TradingViewChart
              key={active}
              symbol={active}
              height={580}
              showToolbar
            />
          </div>
        </div>

      </div>
    </Layout>
  );
}
