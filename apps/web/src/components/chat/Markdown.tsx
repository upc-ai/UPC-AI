"use client";

import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import styles from "@/components/chat/chat.module.css";

/** Fenced code block: language label + copy button above the highlighted code. */
function CodeBlock({ node, children }: { node?: { children?: { type?: string; properties?: { className?: unknown } }[] }; children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const first = node?.children?.[0];
  const cls = first && first.type === "element" ? first.properties?.className : undefined;
  const classes = Array.isArray(cls) ? cls.map(String) : typeof cls === "string" ? [cls] : [];
  const lang = classes.find((c) => c.startsWith("language-"))?.slice(9);

  const copy = async () => {
    const text = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span>{lang ?? "code"}</span>
        <button className={styles.codeCopyBtn} onClick={() => void copy()} aria-label="Copy code">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

const components: Components = {
  // react-markdown passes a hast `node`; the loose shape above is all we read from it
  pre: CodeBlock as Components["pre"],
};

/**
 * Markdown renderer for AI responses. Styling (serif headings, warm-dark code
 * blocks, tables) lives in chat.module.css via the .aiMessage scope.
 * Math via remark-math + rehype-katex; highlighting via rehype-highlight
 * (bundled — no runtime network, per the self-hosted-assets rule).
 */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="aiMarkdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
