import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

const marked = new Marked({ breaks: true, gfm: true });

// All HTML tags that standard Markdown (GFM) can produce
const MARKDOWN_TAGS: string[] = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "strong", "em", "del", "s",
  "code", "pre",
  "ul", "ol", "li",
  "blockquote",
  "a",
  "img",
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title"],
  img: ["src", "alt", "title"],
  th: ["align"],
  td: ["align"],
};

/**
 * Parse Markdown to sanitized HTML.
 * Any raw HTML in the input is stripped — only tags produced by Markdown are allowed.
 */
export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string;
  return sanitizeHtml(raw, {
    allowedTags: MARKDOWN_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
  });
}

/**
 * Strip all Markdown and return plain text.
 * Use this for truncated previews/cards.
 */
export function stripMarkdown(text: string): string {
  const raw = marked.parse(text) as string;
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
}
