import sanitizeHtml from "sanitize-html";

/**
 * Rich text stored by the admin editors (community posts, landing pages,
 * waivers) is HTML — the format the landing pages already used — so there is
 * only ever one format in the database.
 *
 * Two rules make that safe:
 *
 *   1. Everything is sanitized on the WRITE path, in the API routes. The editor
 *      can only produce tags in its schema, but the routes accept arbitrary
 *      JSON, so a compromised staff account could POST raw HTML directly.
 *   2. Rendering goes through <RichText>, never a bare dangerouslySetInnerHTML.
 */

/**
 * Tags the editor can produce, plus the handful the raw landing-page HTML
 * field already relied on. Deliberately no <script>, <style>, <iframe>,
 * <img> or form elements.
 */
const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "code", "pre",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote", "hr",
  "a", "span", "div",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    "*": ["class"],
  },
  // No javascript:/data: hrefs.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  transformTags: {
    // Links out of our own pages open in a new tab and must not hand the
    // opener a window reference.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

/** Cleans editor/API-supplied HTML down to the allowlist above. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/**
 * Whether a stored value is HTML or legacy plain text.
 *
 * These fields predate the editor, so the database still holds plain strings
 * whose line breaks only survive as "\n". Feeding those through
 * dangerouslySetInnerHTML would silently collapse every paragraph, so
 * <RichText> renders them as text instead. Nothing needs migrating.
 *
 * The test is that the value *opens* with a block tag, not that it contains a
 * tag anywhere. Anywhere is far too loose for prose people actually write:
 * a waiver reading "Contact <legal@throwartstudio.com>" or "see <Section 4>"
 * would be taken for HTML and the sanitizer would delete those spans. A
 * waiver's text is rendered live from this column at signing time and no
 * snapshot is kept, so that would silently alter a legal document.
 *
 * Everything the editor emits qualifies: a ProseMirror document is block+,
 * so getHTML() always starts with one of these.
 */
const OPENS_WITH_BLOCK_TAG = /^<(p|div|h[1-6]|ul|ol|li|blockquote|pre|hr|table|figure)(\s[^>]*)?\/?>/i;

export function isRichTextHtml(value: string): boolean {
  return OPENS_WITH_BLOCK_TAG.test(value.trimStart());
}

/**
 * Plain-text form of a rich value, for previews, meta descriptions and
 * anywhere else that cannot take markup.
 */
export function richTextToPlain(value: string): string {
  if (!isRichTextHtml(value)) return value;
  // Block tags carry the only word boundary between "</h2><p>", so they have
  // to become whitespace or previews read as "HeadingBody".
  const spaced = value.replace(/<\/(p|h[1-6]|li|div|blockquote|pre|tr)>|<br\s*\/?>/gi, " ");
  const text = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

/** True when a rich value has no actual content (empty editor output). */
export function isRichTextEmpty(value: string): boolean {
  return richTextToPlain(value).length === 0;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Decodes entities in ONE pass. Chained .replace() calls would decode twice:
 * "&amp;lt;" — an author who typed a literal "&lt;" — would go to "&lt;" and
 * then on to "<".
 */
function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
}
