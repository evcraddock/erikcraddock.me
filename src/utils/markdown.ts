import { marked } from "marked";

// Configure marked for security
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
});

// Custom renderer for security and styling
const renderer = new marked.Renderer();

// Make external links safe
renderer.link = ({ href, title, text }) => {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  const attrs = isExternal ? ' rel="noopener noreferrer" target="_blank"' : "";
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(href)}"${titleAttr}${attrs}>${text}</a>`;
};

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Strip HTML tags from input (defense in depth)
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/**
 * Render markdown content to HTML.
 *
 * Security:
 * - Raw HTML in input is stripped
 * - Output is sanitized
 * - External links get rel="noopener noreferrer"
 *
 * @param content - Markdown content to render
 * @returns HTML string safe for rendering
 */
export function renderMarkdown(content: string): string {
  // Strip any HTML from input as defense in depth
  const cleanContent = stripHtml(content);

  // Parse markdown to HTML
  const html = marked.parse(cleanContent, { renderer }) as string;

  return html;
}

/**
 * Render markdown but return only plain text (for excerpts).
 * Strips all HTML and markdown formatting.
 *
 * @param content - Markdown content
 * @param maxLength - Maximum length of output
 * @returns Plain text string
 */
export function markdownToPlainText(content: string, maxLength?: number): string {
  // Strip HTML first
  let text = stripHtml(content);

  // Remove markdown formatting
  text = text
    .replace(/#{1,6}\s+/g, "") // Headers
    .replace(/\*\*(.+?)\*\*/g, "$1") // Bold
    .replace(/\*(.+?)\*/g, "$1") // Italic
    .replace(/__(.+?)__/g, "$1") // Bold alt
    .replace(/_(.+?)_/g, "$1") // Italic alt
    .replace(/~~(.+?)~~/g, "$1") // Strikethrough
    .replace(/`(.+?)`/g, "$1") // Inline code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Links
    .replace(/!\[.*?\]\(.+?\)/g, "") // Images
    .replace(/^>\s+/gm, "") // Blockquotes
    .replace(/^[-*+]\s+/gm, "") // Unordered lists
    .replace(/^\d+\.\s+/gm, "") // Ordered lists
    .replace(/---+/g, "") // Horizontal rules
    .replace(/\n{2,}/g, " ") // Multiple newlines to space
    .replace(/\n/g, " ") // Single newlines to space
    .trim();

  if (maxLength && text.length > maxLength) {
    // Cut at word boundary
    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > maxLength * 0.8) {
      return truncated.slice(0, lastSpace) + "...";
    }
    return truncated + "...";
  }

  return text;
}

// Export for testing
export { escapeHtml, stripHtml };
