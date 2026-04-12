import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode, LineStyle, CandlestickSeries, HistogramSeries } from "lightweight-charts";
import { api } from "@/utils/api";

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  showToolbar?: boolean;
  theme?: "dark" | "light";
}

const INTERVALS = [
  { label: "1D",  value: "1d",  period: "3mo" },
  { label: "1W",  value: "1wk", period: "1y" },
  { label: "1M",  value: "1mo", period: "5y" },
  { label: "3M",  value: "1d",  period: "6mo" },
  { label: "1Y",  value: "1d",  period: "1y" },
  { label: "2Y",  value: "1wk", period: "2y" },
  { label: "5Y",  value: "1mo", period: "5y" },
];

const DARK_THEME = {
  background:      "#0f1117",
  text:            "#d1d4dc",
  grid:            "rgba(255,255,255,0.04)",
  border:          "rgba(255,255,255,0.1)",
  upColor:         "#26a69a",
  downColor:       "#ef5350",
  wickUpColor:     "#26a69a",
  wickDownColor:   "#ef5350",
  crosshair:       "#758696",
};

export default function TradingViewChart({
  symbol,
  height = 500,
  showToolbar = true,
  theme = "dark",
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const candleRef    = useRef<any>(null);
  const volRef       = useRef<any>(null);

  const [activeIv, setActiveIv] = useState(4); // default "1Y"
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState<{ price: number; change: number; changePct: number; company: string } | null>(null);

  const colors = DARK_THEME;

  function initChart() {
    if (!containerRef.current) return;
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: height - 44,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor:  colors.text,
        fontSize:   11,
      },
      grid: {
        vertLines:   { color: colors.grid, style: LineStyle.Dotted },
        horzLines:   { color: colors.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode:  CrosshairMode.Normal,
        vertLine: { color: colors.crosshair, labelBackgroundColor: "#2a2e39" },
        horzLine: { color: colors.crosshair, labelBackgroundColor: "#2a2e39" },
      },
      rightPriceScale: {
        borderColor: colors.border,
        textColor:   colors.text,
      },
      timeScale: {
        borderColor: colors.border,
        textColor:   colors.text,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor:         colors.upColor,
      downColor:       colors.downColor,
      wickUpColor:     colors.wickUpColor,
      wickDownColor:   colors.wickDownColor,
      borderVisible:   false,
    });

    const volume = chart.addSeries(HistogramSeries, {
      color:   "rgba(38,166,154,0.3)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;

    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        if (chartRef.current) {
          chartRef.current.applyOptions({ width: e.contentRect.width });
        }
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); };
  }

  async function loadData(ivIdx: number) {
    setLoading(true);
    setError("");
    try {
      const iv = INTERVALS[ivIdx];
      const data = await api.historical(symbol, iv.period, iv.value);
      const rows = (data.data || []) as Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
      if (!rows.length) throw new Error("No price data available");

      const candles = rows.map(r => ({
        time: r.date as any,
        open: r.open, high: r.high, low: r.low, close: r.close,
      }));
      const vols = rows.map(r => ({
        time: r.date as any,
        value: r.volume,
        color: r.close >= r.open ? "rgba(38,166,154,0.4)" : "rgba(239,83,80,0.4)",
      }));

      if (candleRef.current) candleRef.current.setData(candles);
      if (volRef.current)    volRef.current.setData(vols);
      if (chartRef.current)  chartRef.current.timeScale().fitContent();

      const last = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : last;
      setInfo({
        price:     last.close,
        change:    +(last.close - prev.close).toFixed(2),
        changePct: +((last.close - prev.close) / prev.close * 100).toFixed(2),
        company:   data.meta?.company || symbol,
      });
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    }
    setLoading(false);
  }

  useEffect(() => {
    const cleanup = initChart();
    loadData(activeIv);
    return cleanup;
  }, [symbol, height]);

  function switchInterval(idx: number) {
    setActiveIv(idx);
    loadData(idx);
  }

  const up = (info?.changePct ?? 0) >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: colors.background }}>
      {/* Toolbar */}
      {showToolbar && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 14px",
          background: "#171b26",
          borderBottom: `1px solid ${colors.border}`,
          flexWrap: "wrap", gap: 8,
        }}>
          {/* Price info */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "0.78rem", color: "#758696", fontFamily: "monospace", whiteSpace: "nowrap" }}>
              {symbol}
            </span>
            {info && (
              <>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#d1d4dc" }}>
                  {info.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: "0.8rem", color: up ? colors.upColor : colors.downColor, fontWeight: 600 }}>
                  {up ? "▲" : "▼"} {Math.abs(info.change).toFixed(2)} ({up ? "+" : ""}{info.changePct}%)
                </span>
              </>
            )}
            {loading && <span style={{ fontSize: "0.72rem", color: "#758696" }}>Loading…</span>}
          </div>

          {/* Interval buttons */}
          <div style={{ display: "flex", gap: 2 }}>
            {INTERVALS.map((iv, i) => (
              <button key={iv.label} onClick={() => switchInterval(i)} style={{
                padding: "3px 9px", fontSize: "0.72rem", borderRadius: 5,
                border: "none", cursor: "pointer",
                background: activeIv === i ? "var(--gold)" : "transparent",
                color:      activeIv === i ? "#000"        : "#758696",
                fontWeight: activeIv === i ? 700            : 400,
                transition: "all 0.12s",
              }}>
                {iv.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart container */}
      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
        {error && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", flexDirection: "column", gap: 8,
            background: colors.background, zIndex: 2, fontSize: "0.85rem", color: "#758696",
          }}>
            <span style={{ fontSize: "1.5rem" }}>⚠️</span>
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ fontSize: "0.65rem", color: "#4c535e", padding: "5px 14px", background: "#171b26", textAlign: "right", borderTop: `1px solid ${colors.border}` }}>
        Powered by <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer" style={{ color: "#4c535e", textDecoration: "none" }}>TradingView Lightweight Charts</a> · Not financial advice
      </div>
    </div>
  );
}
