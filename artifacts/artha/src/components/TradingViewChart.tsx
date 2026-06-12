import React, { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  showToolbar?: boolean;
  theme?: "dark" | "light";
}

export function toTVSymbol(sym: string): string {
  if (!sym) return "TVC:GOLD";
  const s = sym.trim().toUpperCase();
  // Yahoo Finance format
  if (s.endsWith(".NS")) return `NSE:${s.replace(".NS", "")}`;
  if (s.endsWith(".BO")) return `BSE:${s.replace(".BO", "")}`;
  // Friendly format ("TICKER NSE" / "TICKER BSE")
  if (s.endsWith(" NSE")) return `NSE:${s.slice(0, -4)}`;
  if (s.endsWith(" BSE")) return `BSE:${s.slice(0, -4)}`;
  if (s === "^NSEI" || s === "^NIFTY50") return "NSE:NIFTY";
  if (s === "^NSEBANK") return "NSE:BANKNIFTY";
  if (s === "^BSESN")  return "BSE:SENSEX";
  if (s === "^CNXIT")  return "NSE:CNXIT";
  if (s === "^GSPC")   return "SP:SPX";
  if (s === "^IXIC")   return "NASDAQ:NDX";
  if (s === "^DJI")    return "DJ:DJI";
  if (s === "^FTSE")   return "FTSE:FTSE";
  if (s === "^N225")   return "TVC:NI225";
  if (s === "^HSI")    return "TVC:HSI";
  if (s === "GC=F")    return "TVC:GOLD";
  if (s === "SI=F")    return "TVC:SILVER";
  if (s === "CL=F")    return "TVC:USOIL";
  return s;
}

export default function TradingViewChart({
  symbol,
  height = 600,
  showToolbar = true,
  theme = "dark",
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = `<div class="tradingview-widget-container__widget" style="height:100%;width:100%;"></div>`;

    const config = {
      autosize: true,
      symbol: toTVSymbol(symbol),
      interval: "D",
      timezone: "Asia/Kolkata",
      theme,
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      hide_side_toolbar: !showToolbar,
      calendar: false,
      studies: ["Volume@tv-basicstudies"],
      support_host: "https://www.tradingview.com",
    };

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.innerHTML = JSON.stringify(config);
    el.appendChild(script);

    return () => { if (el) el.innerHTML = ""; };
  }, [symbol, theme, showToolbar]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: "100%", height: `${height}px` }}
    />
  );
}
