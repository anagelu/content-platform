import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Try Pattern Foundry";

const GOLD = "#d69c4d";
const CREAM = "#f6e8c7";
const BRONZE = "#8f6230";
const INK = "#1f1b16";

function BrandMark() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 6,
        borderRadius: 14,
        background: INK,
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ display: "flex", width: 16, height: 16, borderRadius: 4, background: GOLD }} />
        <div style={{ display: "flex", width: 16, height: 16, borderRadius: 4, background: CREAM }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ display: "flex", width: 16, height: 16, borderRadius: 4, background: BRONZE }} />
        <div style={{ display: "flex", width: 16, height: 16, borderRadius: 4, background: GOLD }} />
      </div>
    </div>
  );
}

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px",
          background: INK,
          color: CREAM,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BrandMark />
          <span
            style={{
              fontSize: 20,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            Pattern Foundry
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "6px 16px",
              marginBottom: 24,
              borderRadius: 999,
              border: `1px solid ${GOLD}`,
              color: GOLD,
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            No account needed
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.15,
              color: CREAM,
            }}
          >
            Paste your idea. Get a draft.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 22, color: "#c9bda6" }}>
          patternfoundryai.com/try
        </div>
      </div>
    ),
    { ...size },
  );
}
