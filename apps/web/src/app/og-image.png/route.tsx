import { ImageResponse } from "next/og";

/**
 * Serves the social-sharing card at exactly https://upcai.app/og-image.png.
 * 1200×630, UPC AI monochrome brand. The tagline appears ONCE here; metadata
 * text lives in layout.tsx. Rendered on-request (next/og) — no static asset
 * to regenerate when the brand changes.
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
          background: "linear-gradient(160deg, #202020 0%, #141414 60%, #101010 100%)",
        }}
      >
        {/* Subtle ambient fields — echoes the landing's radial glows */}
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -120,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0))",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -220,
            left: -140,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))",
          }}
        />

        {/* Lockup: the constructed "U" mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width={116} height={145} viewBox="272 212 480 600" fill="#ececec">
            <rect x="272" y="212" width="120" height="600" />
            <rect x="632" y="212" width="120" height="420" />
            <rect x="452" y="692" width="300" height="120" />
          </svg>
          <div
            style={{
              marginLeft: 26,
              color: "#ececec",
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
            color: "#b4b4b4",
            fontSize: 38,
            fontWeight: 500,
            letterSpacing: "-0.5px",
            display: "flex",
          }}
        >
          The Smarter Way to Study with AI
        </div>

        {/* Footer line */}
        <div
          style={{
            position: "absolute",
            bottom: 46,
            color: "#6e6e6e",
            fontSize: 22,
            display: "flex",
            letterSpacing: "0.5px",
          }}
        >
          upcai.app · Udai Pratap College, Varanasi
        </div>
      </div>
    ),
    { ...size },
  );
}
