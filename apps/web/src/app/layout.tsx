import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
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
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2b2a27",
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
      <body>{children}</body>
    </html>
  );
}
