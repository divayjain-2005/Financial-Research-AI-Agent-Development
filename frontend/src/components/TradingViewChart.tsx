import React, { useEffect, useRef, useState } from "react";

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  showToolbar?: boolean;
  theme?: "dark" | "light";
}

function toTVSymbol(sym: string): string {
  if (sym.endsWith(".NS")) return `NSE:${sym.replace(".NS", "")}`;
  if (sym.endsWith(".BO")) return `BSE:${sym.replace(".BO", "")}`;
  if (sym.startsWith("^NSEI"))    return "NSE:NIFTY";
  if (sym.startsWith("^NSEBANK")) return "NSE:BANKNIFTY";
  if (sym.startsWith("^BSESN"))  return "BSE:SENSEX";
  if (sym.startsWith("^GSPC"))   return "SP:SPX";
  if (sym.startsWith("^IXIC"))   return "NASDAQ:NDX";
  if (sym.startsWith("^DJI"))    return "DJ:DJI";
  if (sym === "GC=F") return "TVC:GOLD";
  if (sym === "SI=F") return "TVC:SILVER";
  if (sym === "CL=F") return "TVC:USOIL";
  return sym;
}

export default function TradingViewChart({
  symbol,
  height = 600,
  showToolbar = true,
  theme = "dark",
}: TradingViewChartProps) {
  const [ready, setReady] = useState(false);
  const tvSymbol = toTVSymbol(symbol);

  const src =
    `https://www.tradingview.com/widgetembed/` +
    `?symbol=${encodeURIComponent(tvSymbol)}` +
    `&interval=D` +
    `&hidesidetoolbar=0` +
    `&hidetoptoolbar=${showToolbar ? "0" : "1"}` +
    `&symboledit=1` +
    `&saveimage=1` +
    `&toolbarbg=131722` +
    `&studies=${encodeURIComponent("Volume@tv-basicstudies")}` +
    `&theme=${theme}` +
    `&style=1` +
    `&timezone=${encodeURIComponent("Asia/Kolkata")}` +
    `&withdateranges=1` +
    `&locale=en`;

  return (
    <div style={{ position: "relative", width: "100%", height: `${height}px`, background: "#131722", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      {!ready && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12, color: "#758696", fontSize: "0.85rem",
          background: "#131722", zIndex: 1,
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="6" fill="#2962FF"/>
            <path d="M8 20l5-7 4 5 3-4 4 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Loading TradingView chart…</span>
        </div>
      )}
      <iframe
        key={symbol}
        src={src}
        title={`TradingView – ${tvSymbol}`}
        style={{ width: "100%", height: "100%", border: "none", opacity: ready ? 1 : 0, transition: "opacity 0.3s" }}
        allowFullScreen
        onLoad={() => setReady(true)}
      />
    </div>
  );
}
