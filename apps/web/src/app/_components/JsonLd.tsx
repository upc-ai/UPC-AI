/**
 * JSON-LD structured data — how Google's AI Overviews, ChatGPT and other AI
 * engines understand what this site is. Rendered as inline script tags; the
 * CSP already allows inline scripts.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Site-wide entities: the product + the college it serves. */
export const SITE_JSONLD: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "UPC AI",
    url: "https://upcai.app",
    logo: "https://upcai.app/og-image.png",
    description:
      "Official AI study agent for Udai Pratap College, Varanasi — answers from approved college documents with citations.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "UPC AI",
    url: "https://upcai.app",
    inLanguage: "en",
  },
  {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Udai Pratap Autonomous College",
    alternateName: ["Udai Pratap College", "UP College Varanasi", "UPC Varanasi"],
    url: "https://www.upcollege.ac.in/",
    foundingDate: "1909",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Varanasi",
      addressRegion: "Uttar Pradesh",
      addressCountry: "IN",
    },
    slogan: "Established 1909 · First autonomous college in Uttar Pradesh",
  },
];

/** FAQPage schema from the shared FAQS array. */
export function faqJsonLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
