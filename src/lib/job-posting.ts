import { capitalizeFirst } from "@/lib/applications";

// Reads company, role and description from a job page's HTML. Most job boards
// publish a schema.org JobPosting as JSON-LD (it's what Google for Jobs
// reads); Open Graph and <title> are fallbacks for pages without it.

export type JobPostingDetails = {
  company: string;
  role: string;
  jobDescription: string;
};

export type JobPostingResult =
  | ({ ok: true } & JobPostingDetails)
  | { ok: false; reason: "invalid-link" | "unreadable" };

// Same limits as saving an application (see validation.ts).
const MAX = { company: 200, role: 200, jobDescription: 20000 };

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Plain text keeps paragraphs and list items readable in the textarea.
export function htmlToText(html: string) {
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    // No </li> here: each <li> already starts its own line.
    .replace(/<\/(p|div|ul|ol|h[1-6]|section|article|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJobPosting(node: JsonObject) {
  const type = node["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

// JSON-LD can be a single object, an array, or a {"@graph": [...]} wrapper.
function findJobPosting(value: unknown): JsonObject | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;
  if (isJobPosting(value)) return value;
  return findJobPosting(value["@graph"]);
}

function jsonLdJobPosting(html: string) {
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, content] of scripts) {
    try {
      const found = findJobPosting(JSON.parse(content));
      if (found) return found;
    } catch {
      // Broken JSON-LD on one script shouldn't stop us checking the others.
    }
  }
  return undefined;
}

function metaContent(html: string, key: string) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (content) return decodeEntities(content).trim();
  }
  return "";
}

function organizationName(value: unknown) {
  if (typeof value === "string") return value;
  if (isObject(value) && typeof value.name === "string") return value.name;
  return "";
}

// "JouwWeb - Front End Engineer" -> "Front End Engineer" when the company is known.
function stripCompany(title: string, company: string) {
  if (!company) return title;
  const parts = title.split(/\s+[-|–—:]\s+/);
  const rest = parts.filter((part) => part.toLowerCase() !== company.toLowerCase());
  return rest.length > 0 && rest.length < parts.length ? rest.join(" - ") : title;
}

function clean(value: string, max: number) {
  return capitalizeFirst(value.replace(/\s+/g, " ").trim().slice(0, max));
}

export function extractJobPosting(html: string): JobPostingDetails {
  const posting = jsonLdJobPosting(html);

  const company =
    organizationName(posting?.hiringOrganization) || metaContent(html, "og:site_name");

  const title =
    (typeof posting?.title === "string" && posting.title) ||
    metaContent(html, "og:title") ||
    decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "");

  // Descriptions are HTML, sometimes entity-encoded ("&lt;p&gt;") as well.
  const description =
    typeof posting?.description === "string"
      ? htmlToText(decodeEntities(posting.description))
      : "";

  return {
    company: clean(decodeEntities(company), MAX.company),
    role: clean(stripCompany(decodeEntities(title), company), MAX.role),
    jobDescription: description.slice(0, MAX.jobDescription),
  };
}
