import React, { useState } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";

const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });

const GROUPS = [
  {
    label: "Indian Indices",
    symbols: [
      { label: "Nifty 50",    sym: "NSE:NIFTY" },
      { label: "Bank Nifty",  sym: "NSE:BANKNIFTY" },
      { label: "Sensex",      sym: "BSE:SENSEX" },
      { label: "Nifty IT",    sym: "NSE:CNXIT" },
      { label: "Nifty Pharma",sym: "NSE:CNXPHARMA" },
    ],
  },
  {
    label: "Large Cap (NSE)",
    symbols: [
      { label: "Reliance",    sym: "NSE:RELIANCE" },
      { label: "TCS",         sym: "NSE:TCS" },
      { label: "Infosys",     sym: "NSE:INFY" },
      { label: "HDFC Bank",   sym: "NSE:HDFCBANK" },
      { label: "ICICI Bank",  sym: "NSE:ICICIBANK" },
      { label: "Wipro",       sym: "NSE:WIPRO" },
      { label: "SBI",         sym: "NSE:SBIN" },
      { label: "Maruti",      sym: "NSE:MARUTI" },
      { label: "Sun Pharma",  sym: "NSE:SUNPHARMA" },
      { label: "Tata Motors", sym: "NSE:TATAMOTORS" },
      { label: "L&T",         sym: "NSE:LT" },
      { label: "HCL Tech",    sym: "NSE:HCLTECH" },
    ],
  },
  {
    label: "Global Indices",
    symbols: [
      { label: "S&P 500",     sym: "SP:SPX" },
      { label: "NASDAQ 100",  sym: "NASDAQ:NDX" },
      { label: "Dow Jones",   sym: "DJ:DJI" },
      { label: "FTSE 100",    sym: "FTSE:FTSE" },
      { label: "Nikkei 225",  sym: "TVC:NI225" },
      { label: "Hang Seng",   sym: "TVC:HSI" },
    ],
  },
  {
    label: "Commodities & FX",
    symbols: [
      { label: "Gold",        sym: "TVC:GOLD" },
      { label: "Silver",      sym: "TVC:SILVER" },
      { label: "Crude Oil",   sym: "TVC:USOIL" },
      { label: "USD/INR",     sym: "FX:USDINR" },
      { label: "EUR/INR",     sym: "FX:EURINR" },
      { label: "GBP/INR",     sym: "FX:GBPINR" },
    ],
  },
];

export default function Charts() {
  const [active, setActive] = useState("TVC:GOLD");
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <TradingViewChart
            key={active}
            symbol={active}
            height={600}
            showToolbar
          />
        </div>

      </div>
    </Layout>
  );
}
