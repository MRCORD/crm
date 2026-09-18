import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 21V8a1 1 0 0 1 .445-.832l7-4.666a1 1 0 0 1 1.11 0l7 4.666A1 1 0 0 1 20 8v13"
            stroke="#fafafa"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5M9 9h1M9 12h1M9 15h1M14 9h1M14 12h1M14 15h1"
            stroke="#fafafa"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}
