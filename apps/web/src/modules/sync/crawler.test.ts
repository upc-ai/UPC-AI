import { describe, expect, it } from "vitest";
import { extractLinks, extractTitle, htmlToText } from "./crawler";

describe("extractLinks", () => {
  const base = "https://www.college.ac.in/";

  it("extracts same-domain hrefs and resolves relative paths", () => {
    const html = `<a href="/admissions">Admissions</a> <a href="https://www.college.ac.in/fees">Fees</a> <a href="about.html">About</a>`;
    const links = extractLinks(html, base);
    expect(links).toContain("https://www.college.ac.in/admissions");
    expect(links).toContain("https://www.college.ac.in/fees");
    expect(links).toContain("https://www.college.ac.in/about.html");
    expect(links).toHaveLength(3);
  });

  it("skips other domains and non-http protocols", () => {
    const html = `<a href="https://evil.com/x">x</a> <a href="mailto:a@b.c">m</a> <a href="javascript:alert(1)">j</a> <a href="tel:+91">t</a>`;
    expect(extractLinks(html, base)).toHaveLength(0);
  });

  it("skips binary/media assets and strips hash/query", () => {
    const html = `<a href="/img/photo.jpg">p</a> <a href="/docs/file.zip">z</a> <a href="/page#section">s</a> <a href="/list?sort=1">q</a>`;
    const links = extractLinks(html, base);
    expect(links).toContain("https://www.college.ac.in/page");
    expect(links).toContain("https://www.college.ac.in/list");
    expect(links).not.toContain(expect.stringContaining(".jpg"));
    expect(links).not.toContain(expect.stringContaining(".zip"));
  });

  it("ignores malformed hrefs without throwing", () => {
    const html = `<a href="http://[bad">x</a><a href="%zz">y</a>`;
    expect(() => extractLinks(html, base)).not.toThrow();
  });

  it("dedupes repeated links", () => {
    const html = `<a href="/a">1</a><a href="/a">2</a><a href="/a">3</a>`;
    expect(extractLinks(html, base)).toEqual(["https://www.college.ac.in/a"]);
  });
});

describe("extractTitle", () => {
  it("reads <title> and collapses whitespace", () => {
    expect(extractTitle("<html><title>  Home   Page </title></html>", "https://x.y/")).toBe("Home Page");
  });

  it("falls back to the last URL path segment, humanized", () => {
    expect(extractTitle("<html></html>", "https://x.y/admissions/fee-structure")).toBe("fee structure");
  });

  it("falls back to the URL itself for the root path", () => {
    expect(extractTitle("<html></html>", "https://x.y/")).toBe("https://x.y/");
  });
});

describe("htmlToText", () => {
  it("strips script/style/nav/footer and converts headings", () => {
    const html = `<script>evil()</script><style>.a{}</style><nav>Menu Menu</nav><footer>F F F</footer>
      <h2>Admissions Open</h2><p>Apply before <b>June 30</b>.</p><li>Step one</li>`;
    const text = htmlToText(html);
    expect(text).toContain("## Admissions Open");
    expect(text).toContain("Apply before June 30.");
    expect(text).toContain("- Step one");
    expect(text).not.toContain("evil()");
    expect(text).not.toContain("Menu");
    expect(text).not.toContain("F F F");
  });

  it("decodes common entities", () => {
    const text = htmlToText(`<p>Fees &amp; charges &lt;100&gt; &quot;Q&quot; &#39;s&#39;</p>`);
    expect(text).toContain(`Fees & charges <100> "Q" 's'`);
  });

  it("collapses triple newlines", () => {
    const text = htmlToText("<p>a</p><p>b</p><p>c</p>");
    expect(text).not.toMatch(/\n{3,}/);
  });
});
