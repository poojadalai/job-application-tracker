import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeEntities, extractJobPosting, htmlToText } from "@/lib/job-posting";

const page = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;
const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe("extractJobPosting", () => {
  it("reads the real JouwWeb posting", () => {
    const html = readFileSync("tests/fixtures/jouwweb-job.html", "utf8");
    const result = extractJobPosting(html);

    expect(result.company).toBe("JouwWeb");
    expect(result.role).toBe("Front End Engineer");
    expect(result.jobDescription).toMatch(/^At JouwWeb \/ Webador, we help small business owners/);
    expect(result.jobDescription).not.toMatch(/<[a-z/]/i);
  });

  it("finds a JobPosting inside an @graph or array", () => {
    const html = page(
      jsonLd({
        "@graph": [
          { "@type": "WebPage", name: "Careers" },
          { "@type": ["JobPosting"], title: "Data Analyst", hiringOrganization: "Umbrella" },
        ],
      }),
    );
    expect(extractJobPosting(html)).toMatchObject({ company: "Umbrella", role: "Data Analyst" });
  });

  it("decodes an entity-encoded HTML description", () => {
    const html = page(
      jsonLd({
        "@type": "JobPosting",
        title: "Dev",
        hiringOrganization: { name: "Acme" },
        description: "&lt;p&gt;Build things &amp;amp; ship.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;React&lt;/li&gt;&lt;/ul&gt;",
      }),
    );
    expect(extractJobPosting(html).jobDescription).toBe("Build things & ship.\n\n- React");
  });

  it("skips broken JSON-LD and uses the next valid block", () => {
    const html = page(
      `<script type="application/ld+json">{ not json </script>` +
        jsonLd({ "@type": "JobPosting", title: "QA Engineer", hiringOrganization: "Initech" }),
    );
    expect(extractJobPosting(html)).toMatchObject({ company: "Initech", role: "QA Engineer" });
  });

  it("falls back to Open Graph and strips the company from the title", () => {
    const html = page(
      `<meta property="og:site_name" content="Hooli">` +
        `<meta property="og:title" content="Hooli | Backend Engineer">`,
    );
    expect(extractJobPosting(html)).toEqual({
      company: "Hooli",
      role: "Backend Engineer",
      jobDescription: "",
    });
  });

  it("falls back to <title> and capitalizes", () => {
    expect(extractJobPosting(page("<title>frontend developer</title>")).role).toBe(
      "Frontend developer",
    );
  });

  it("returns empty fields when the page has nothing useful", () => {
    expect(extractJobPosting("<html><body>Please log in</body></html>")).toEqual({
      company: "",
      role: "",
      jobDescription: "",
    });
  });

  it("limits field lengths to what an application can store", () => {
    const html = page(
      jsonLd({
        "@type": "JobPosting",
        title: "R".repeat(500),
        hiringOrganization: "C".repeat(500),
        description: "D".repeat(30000),
      }),
    );
    const result = extractJobPosting(html);
    expect(result.company).toHaveLength(200);
    expect(result.role).toHaveLength(200);
    expect(result.jobDescription).toHaveLength(20000);
  });
});

describe("htmlToText", () => {
  it("keeps paragraphs, line breaks and list items readable", () => {
    expect(htmlToText("<p>One</p><p>Two<br>Three</p><ul><li>A</li><li>B</li></ul>")).toBe(
      "One\nTwo\nThree\n\n- A\n- B",
    );
  });

  it("drops scripts and styles entirely", () => {
    expect(htmlToText("<style>p{}</style><p>Hi</p><script>alert(1)</script>")).toBe("Hi");
  });

  it("collapses whitespace", () => {
    expect(htmlToText("<p>  lots   of\tspace&nbsp;here </p>\n\n\n\n<p>x</p>")).toBe(
      "lots of space here\n\nx",
    );
  });
});

describe("decodeEntities", () => {
  it.each([
    ["&amp; &lt; &gt; &quot; &#39;", `& < > " '`],
    ["caf&#233; &#x2014; ok", "café — ok"],
    ["&unknown; stays", "&unknown; stays"],
  ])("%j", (input, expected) => {
    expect(decodeEntities(input)).toBe(expected);
  });
});
