import React, { useState } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";

const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });

function parseSymbolInput(raw: string): string {
  const parts = raw.trim().toUpperCase().split(/\s+/);
  if (parts.length >= 2) {
    const exchange = parts[parts.length - 1];
    const ticker = parts.slice(0, -1).join("");
    if (exchange === "NSE") return `NSE:${ticker}`;
    if (exchange === "BSE") return `BSE:${ticker}`;
  }
  const single = parts[0];
  if (single.includes(":")) return single;
  return `NSE:${single}`;
}

export default function Charts() {
  const [active, setActive] = useState("TVC:GOLD");
  const [input, setInput]   = useState("");

  function handleSearch() {
    const s = input.trim();
    if (s) { setActive(parseSymbolInput(s)); setInput(""); }
  }

  return (
    <Layout title="Charts">
      {/* Top search strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
        <input
          className="input"
          placeholder="e.g. ONGC NSE  or  QGO BSE  or  TVC:GOLD"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          style={{ maxWidth: 340 }}
        />
        <button className="btn btn-gold" onClick={handleSearch}>Go</button>
        <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
          Viewing: <strong style={{ color: "var(--text-1)" }}>{active}</strong>
        </span>
      </div>

      {/* Full-height chart */}
      <div style={{ height: "calc(100vh - 150px)" }}>
        <TradingViewChart
          key={active}
          symbol={active}
          height={typeof window !== "undefined" ? window.innerHeight - 150 : 680}
          showToolbar
        />
      </div>
    </Layout>
  );
}
