import React, { useState } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";

const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });

export default function Charts() {
  const [active] = useState("TVC:GOLD");

  return (
    <Layout title="Charts">
      <div style={{ height: "calc(100vh - 102px)" }}>
        <TradingViewChart
          key={active}
          symbol={active}
          height={typeof window !== "undefined" ? window.innerHeight - 102 : 700}
          showToolbar
        />
      </div>
    </Layout>
  );
}
