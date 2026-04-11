import React, { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  height?: number;
  theme?: "dark" | "light";
  showToolbar?: boolean;
}

function toTVSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const map: Record<string, string> = {
    "^NSEI":    "NSE:NIFTY",
    "^NSEBANK": "NSE:BANKNIFTY",
    "^BSESN":   "BSE:SENSEX",
    "^NSMIDCP": "NSE:NIFTY_MIDCAP_100",
    "^CNXAUTO": "NSE:CNXAUTO",
    "^CNXPHARMA":"NSE:CNXPHARMA",
    "^CNXIT":   "NSE:CNXIT",
    "GC=F":     "COMEX:GC1!",
    "SI=F":     "COMEX:SI1!",
    "CL=F":     "NYMEX:CL1!",
    "EURINR=X": "FX:EURINR",
    "USDINR=X": "FX_IDC:USDINR",
    "GBPINR=X": "FX_IDC:GBPINR",
    "JPYINR=X": "FX_IDC:JPYINR",
  };
  if (map[s]) return map[s];
  if (s.endsWith(".NS")) return `NSE:${s.replace(".NS", "")}`;
  if (s.endsWith(".BO")) return `BSE:${s.replace(".BO", "")}`;
  return s;
}

const INTERVALS = [
  { label: "1m",  value: "1" },
  { label: "5m",  value: "5" },
  { label: "15m", value: "15" },
  { label: "1h",  value: "60" },
  { label: "1D",  value: "D" },
  { label: "1W",  value: "W" },
  { label: "1M",  value: "M" },
];

export default function TradingViewChart({
  symbol,
  interval = "D",
  height = 520,
  theme = "dark",
  showToolbar = true,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [activeInterval, setActiveInterval] = React.useState(interval);
  const tvSym = toTVSymbol(symbol);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSym,
      interval: activeInterval,
      timezone: "Asia/Kolkata",
      theme,
      style: "1",
      locale: "en",
      backgroundColor: theme === "dark" ? "#0f1117" : "#ffffff",
      gridColor: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      hide_top_toolbar: !showToolbar,
      allow_symbol_change: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      studies: ["RSI@tv-basicstudies", "MAExp@tv-basicstudies"],
    });

    container.appendChild(script);
    widgetRef.current = script;

    return () => {
      if (container) container.innerHTML = "";
    };
  }, [tvSym, activeInterval, theme, showToolbar]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: "var(--bg-card)",
        borderRadius: "10px 10px 0 0",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
            TradingView ·
          </span>
          <span style={{ fontSize: "0.82rem", color: "var(--gold)", fontFamily: "monospace", fontWeight: 700 }}>
            {tvSym}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {INTERVALS.map(iv => (
            <button
              key={iv.value}
              onClick={() => setActiveInterval(iv.value)}
              style={{
                padding: "3px 10px",
                fontSize: "0.75rem",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: activeInterval === iv.value ? "var(--gold)" : "transparent",
                color: activeInterval === iv.value ? "#000" : "var(--text-2)",
                cursor: "pointer",
                fontWeight: activeInterval === iv.value ? 700 : 400,
                transition: "all 0.15s",
              }}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="tradingview-widget-container"
        ref={containerRef}
        style={{
          height,
          borderRadius: "0 0 10px 10px",
          overflow: "hidden",
          background: "#0f1117",
        }}
      />

      <div style={{ fontSize: "0.68rem", color: "var(--text-3)", padding: "6px 16px", textAlign: "right" }}>
        Charts by{" "}
        <a href="https://www.tradingview.com" target="_blank" rel="noreferrer"
          style={{ color: "var(--gold)", textDecoration: "none" }}>TradingView</a>
        {" "} · Not financial advice
      </div>
    </div>
  );
}
