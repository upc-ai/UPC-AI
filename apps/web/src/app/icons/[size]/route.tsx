import { ImageResponse } from "next/og";

/**
 * PWA icon at /icons/icon-192.png and /icons/icon-512.png (set size below).
 * The UPC "U" mark — brand black on white, square, maskable-safe (the mark
 * occupies the center 60% so Android's circular mask never clips it).
 * Rendered on-request via next/og — no static image tooling needed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const size = url.pathname.endsWith("512.png") ? 512 : 192;
  const scale = size / 1024;
  const r = (v: number) => Math.round(v * scale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <svg
          width={r(620)}
          height={r(620)}
          viewBox="0 0 1024 1024"
          fill="#0d0d0d"
        >
          {/* U mark: left stem, right stem, base bar — scaled from the brand rects */}
          <rect x={r(284)} y={r(192)} width={r(144)} height={r(640)} />
          <rect x={r(596)} y={r(192)} width={r(144)} height={r(440)} />
          <rect x={r(284)} y={r(712)} width={r(456)} height={r(120)} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
