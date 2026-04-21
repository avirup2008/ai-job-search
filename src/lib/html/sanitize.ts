import sanitizeHtml from "sanitize-html";

/**
 * Sanitise LLM-generated HTML before storing to Blob.
 * Strips <script>, event handlers (onclick, onerror, etc.), javascript: hrefs,
 * and any tags not in the allowlist.
 *
 * Allows the tags and attributes needed for typical 30-60-90 plan / SEO audit
 * artifact HTML: headings, paragraphs, lists, tables, strong/em, code, hr, br.
 */
export function sanitizeArtifactHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "ul", "ol", "li",
      "strong", "b", "em", "i", "u", "s",
      "code", "pre",
      "table", "thead", "tbody", "tr", "th", "td",
      "blockquote",
      "div", "span", "section", "article", "header", "footer",
      "a",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      "*": ["class", "id"],
    },
    allowedSchemesByTag: {
      a: ["https", "mailto"],
    },
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    },
  });
}
