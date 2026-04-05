import React, { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { api } from "@/utils/api";

interface Message { role: "user"|"assistant"; text: string; time: string; }

const SUGGESTIONS = [
  "What is SIP and how does it work?",
  "Explain LTCG and STCG tax for equity",
  "How do I analyse a stock using RSI?",
  "What are good sectors to invest in India?",
  "Explain the difference between Nifty 50 and Sensex",
  "How to calculate retirement corpus needed?",
  "What is the ideal emergency fund size?",
  "Give me an investment strategy for 5 years",
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "👋 Hello! I'm **Artha**, your AI financial research assistant specialising in Indian markets.\n\nI can help you with:\n- Stock analysis and technical indicators\n- SIP, tax, and EMI calculations\n- Sector and market analysis\n- Investment strategy and planning\n\nWhat would you like to know?",
      time: new Date().toLocaleTimeString(),
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", text: msg, time: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await api.chat(msg);
      setMessages(prev => [...prev, { role: "assistant", text: res.response, time: new Date().toLocaleTimeString() }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", text: `❌ Error: ${e.message}`, time: new Date().toLocaleTimeString() }]);
    }
    setLoading(false);
  }

  function renderText(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>");
  }

  return (
    <Layout title="AI Financial Assistant">
      <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 54px - 48px)", maxWidth:860, margin:"0 auto" }}>
        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:14, paddingBottom:10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:"flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap:10, alignItems:"flex-start" }}>
              {/* Avatar */}
              <div style={{
                width:32, height:32, borderRadius:"50%", flexShrink:0,
                background: m.role === "user" ? "#1e3a5f" : "#78350f44",
                border: `1px solid ${m.role === "user" ? "#3b82f6" : "var(--gold)"}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.8rem", fontWeight:700,
                color: m.role === "user" ? "#93c5fd" : "var(--gold)",
              }}>
                {m.role === "user" ? "U" : "A"}
              </div>
              {/* Bubble */}
              <div style={{ maxWidth:"78%", display:"flex", flexDirection:"column", gap:3, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  className={m.role === "user" ? "bubble-user" : "bubble-bot"}
                  style={{ padding:"10px 14px", fontSize:"0.875rem", color:"var(--text-1)", lineHeight:1.7 }}
                  dangerouslySetInnerHTML={{ __html: renderText(m.text) }}
                />
                <div style={{ fontSize:"0.65rem", color:"var(--text-3)", padding:"0 4px" }}>{m.time}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"#78350f44", border:"1px solid var(--gold)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gold)", fontWeight:700, fontSize:"0.8rem" }}>A</div>
              <div className="bubble-bot" style={{ padding:"10px 14px" }}>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--gold)", animation:"pulse 1s infinite" }} />
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--gold)", animation:"pulse 1s 0.2s infinite" }} />
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--gold)", animation:"pulse 1s 0.4s infinite" }} />
                  <style>{`@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingBottom:10 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} className="btn btn-ghost" style={{ fontSize:"0.75rem", padding:"4px 10px" }} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display:"flex", gap:10, paddingTop:10, borderTop:"1px solid var(--border)" }}>
          <input
            className="input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about stocks, SIP, tax, market analysis…"
            disabled={loading}
          />
          <button className="btn btn-gold" onClick={() => send()} disabled={loading || !input.trim()}>
            {loading ? <span className="spinner" /> : "Send"}
          </button>
        </div>
        <div style={{ fontSize:"0.65rem", color:"var(--text-3)", textAlign:"center", marginTop:6 }}>
          Not investment advice · Add ANTHROPIC_API_KEY for full Claude-powered responses
        </div>
      </div>
    </Layout>
  );
}
