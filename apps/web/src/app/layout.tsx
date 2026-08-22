import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
    default: "UPC AI — Your campus thinking partner | Udai Pratap College",
    template: "%s | UPC AI",
  },
  description:
    "The official AI assistant of Udai Pratap College. Ask academic questions, get answers grounded in official college documents with citations, and study with AI-generated quizzes and flashcards.",
  openGraph: {
    title: "UPC AI — Your campus thinking partner",
    description: "The official AI assistant of Udai Pratap College, Varanasi.",
    type: "website",
    url: "https://upcai.app",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#212121",
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
            before anything renders (next-themes pattern). Default = dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("upcai:theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}else if(t==="system"){document.documentElement.dataset.theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
