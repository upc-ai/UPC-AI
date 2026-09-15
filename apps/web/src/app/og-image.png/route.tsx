import { ImageResponse } from "next/og";

/**
 * Serves the social-sharing card at exactly https://upcai.app/og-image.png.
 * 1200×630, light-theme brand card: white canvas, black constructed-"U" mark
 * + UPC AI wordmark, grey tagline. Rendered on-request (next/og) — no static
 * asset to regenerate when the brand changes.
 */
export const runtime = "nodejs";
// On-request, never prerendered: @vercel/og crashes during Windows builds
// when Next tries to statically render this route (Invalid URL in its
// fileURLToPath). Legal config exports only — see note below.
export const dynamic = "force-dynamic";
// Note: alt/size/contentType *exports* are opengraph-image.tsx conventions —
// extra exports are rejected by next build's route type check. Keep local.
const size = { width: 1200, height: 630 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "#ffffff",
        }}
      >
        {/* Whisper-soft grey fields so the white card has depth on any chat app */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -140,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "linear-gradient(180deg, rgba(0,0,0,0.045), rgba(0,0,0,0))",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -240,
            left: -160,
            width: 680,
            height: 680,
            borderRadius: 9999,
            background: "linear-gradient(180deg, rgba(0,0,0,0.035), rgba(0,0,0,0))",
          }}
        />

        {/* Hairline card frame — the premium white-card touch */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            border: "1px solid #ececec",
            borderRadius: 24,
          }}
        />

        {/* Lockup: the constructed "U" mark + wordmark, brand black */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width={116} height={145} viewBox="272 212 480 600" fill="#0d0d0d">
            <rect x="272" y="212" width="120" height="600" />
            <rect x="632" y="212" width="120" height="420" />
            <rect x="452" y="692" width="300" height="120" />
          </svg>
          <div
            style={{
              marginLeft: 26,
              color: "#0d0d0d",
              fontSize: 92,
              fontWeight: 650,
              letterSpacing: "-4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            UPC&nbsp;AI
          </div>
        </div>

        {/* The tagline — exactly once */}
        <div
          style={{
            marginTop: 26,
            color: "#6e6e6e",
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "-0.5px",
            display: "flex",
          }}
        >
          The official AI assistant of Udai Pratap College
        </div>

        {/* Footer line */}
        <div
          style={{
            position: "absolute",
            bottom: 52,
            color: "#98989d",
            fontSize: 22,
            display: "flex",
            letterSpacing: "0.5px",
          }}
        >
          upcai.app · Free for every UPC student
        </div>
      </div>
    ),
    { ...size },
  );
}
