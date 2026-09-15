import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { JsonLd, SITE_JSONLD } from "./_components/JsonLd";
import { PwaRegister } from "./_components/PwaRegister";

// Self-hosted (Fontsource woff2) — no Google Fonts fetch at build/dev time,
// which is unreachable on some networks and slowed compiles by minutes.
const cormorant = localFont({
  src: [
    { path: "./fonts/cormorant-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = localFont({
  src: [{ path: "./fonts/inter-var.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = localFont({
  src: [{ path: "./fonts/jetbrains-var.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-jetbrains",
  display: "swap",
});

const notoDevanagari = localFont({
  src: [{ path: "./fonts/noto-devanagari-var.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-noto-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://upcai.app"),
  title: {
    default: "UPC AI — Official AI Assistant of Udai Pratap College, Varanasi",
    template: "%s | UPC AI",
  },
  description:
    "Official AI Study Agent for Udai Pratap College students — fees, syllabus, admissions, notices and academic help, answered from approved college documents with citations.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "UPC AI — Official AI Assistant of Udai Pratap College, Varanasi",
    description:
      "Official AI Study Agent for Udai Pratap College students — fees, syllabus, admissions, notices and academic help, answered from approved college documents with citations.",
    type: "website",
    url: "https://upcai.app",
    images: [
      {
        url: "https://upcai.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "UPC AI — Official AI Assistant of Udai Pratap College, Varanasi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UPC AI — Official AI Assistant of Udai Pratap College, Varanasi",
    description:
      "Official AI Study Agent for Udai Pratap College students — fees, syllabus, admissions, notices and academic help, answered from approved college documents with citations.",
    images: ["https://upcai.app/og-image.png"],
  },
  // Google Search Console ownership verification — GSC gives you this token
  // ("google-site-verification=<token>"); set GOOGLE_SITE_VERIFICATION in
  // Vercel env (+ .env.local) and redeploy, or paste the token here directly.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={[
        cormorant.variable,
        inter.variable,
        jetbrains.variable,
        notoDevanagari.variable,
      ].join(" ")}
      data-theme="dark"
      suppressHydrationWarning
    >
      <body>
        {/* Pre-paint theme: apply the user's saved choice (settings page,
            localStorage "upcai:theme") before first paint on EVERY page —
            landing and auth included. First-in-body inline script runs
            before anything renders (next-themes pattern). Default = dark;
            users can switch to light (or System) in Settings. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("upcai:theme");if(t==="light"||t==="dark"||t==="system"){document.documentElement.dataset.theme=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t}else{document.documentElement.dataset.theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}}catch(e){}})();`,
          }}
        />
        <JsonLd data={SITE_JSONLD} />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
