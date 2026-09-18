import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#0a0a0a",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#fafafa",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 21V8a1 1 0 0 1 .445-.832l7-4.666a1 1 0 0 1 1.11 0l7 4.666A1 1 0 0 1 20 8v13"
                stroke="#0a0a0a"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5M9 9h1M9 12h1M9 15h1M14 9h1M14 12h1M14 15h1"
                stroke="#0a0a0a"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#fafafa" }}>
            Agentic CRM
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.15,
            maxWidth: 960,
          }}
        >
          Self-hosted, MCP-native CRM on PostgreSQL
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#a1a1aa",
            marginTop: 24,
            maxWidth: 900,
          }}
        >
          Next.js 16 web app + 66 Model Context Protocol tools for AI agents
        </div>
      </div>
    ),
    { ...size }
  )
}
