import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pattern Foundry";

const GOLD = "#d69c4d";
const CREAM = "#f6e8c7";
const BRONZE = "#8f6230";
const INK = "#1f1b16";

function BrandMark() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 22px)",
        gridTemplateRows: "repeat(2, 22px)",
        gap: 8,
        padding: 8,
        borderRadius: 18,
        background: INK,
      }}
    >
      <div style={{ borderRadius: 6, background: GOLD }} />
      <div style={{ borderRadius: 6, background: CREAM }} />
      <div style={{ borderRadius: 6, background: BRONZE }} />
      <div style={{ borderRadius: 6, background: GOLD }} />
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: INK,
          color: CREAM,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <BrandMark />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span
              style={{
                fontSize: 22,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: GOLD,
              }}
            >
              Pattern
            </span>
            <span style={{ fontSize: 34, fontWeight: 700 }}>Foundry</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 60,
            fontSize: 44,
            fontWeight: 700,
            maxWidth: 980,
            color: CREAM,
          }}
        >
          Turn ideas into posts, books, and durable frameworks.
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 24, color: "#c9bda6" }}>
          patternfoundryai.com
        </div>
      </div>
    ),
    { ...size },
  );
}
