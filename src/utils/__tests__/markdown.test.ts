import { describe, it, expect } from "bun:test";
import { renderMarkdown, markdownToPlainText, escapeHtml, stripHtml } from "../markdown";

describe("renderMarkdown", () => {
  it("renders bold text", () => {
    const result = renderMarkdown("**bold text**");
    expect(result).toContain("<strong>bold text</strong>");
  });

  it("renders italic text", () => {
    const result = renderMarkdown("*italic text*");
    expect(result).toContain("<em>italic text</em>");
  });

  it("renders headings", () => {
    const result = renderMarkdown("# Heading 1\n## Heading 2");
    expect(result).toContain("<h1");
    expect(result).toContain("Heading 1");
    expect(result).toContain("<h2");
    expect(result).toContain("Heading 2");
  });

  it("renders unordered lists", () => {
    const result = renderMarkdown("- item 1\n- item 2");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>item 1</li>");
    expect(result).toContain("<li>item 2</li>");
  });

  it("renders ordered lists", () => {
    const result = renderMarkdown("1. first\n2. second");
    expect(result).toContain("<ol>");
    expect(result).toContain("<li>first</li>");
    expect(result).toContain("<li>second</li>");
  });

  it("renders blockquotes", () => {
    const result = renderMarkdown("> This is a quote");
    expect(result).toContain("<blockquote>");
    expect(result).toContain("This is a quote");
  });

  it("renders inline code", () => {
    const result = renderMarkdown("Use `const` for constants");
    expect(result).toContain("<code>const</code>");
  });

  it("renders code blocks", () => {
    const result = renderMarkdown("```\nconst x = 1;\n```");
    expect(result).toContain("<pre>");
    expect(result).toContain("<code>");
    expect(result).toContain("const x = 1;");
  });

  it("renders links", () => {
    const result = renderMarkdown("[example](https://example.com)");
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain(">example</a>");
  });

  it("adds rel noopener noreferrer to external links", () => {
    const result = renderMarkdown("[example](https://example.com)");
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('target="_blank"');
  });

  it("does not add rel to internal links", () => {
    const result = renderMarkdown("[about](/about)");
    expect(result).not.toContain("noopener");
    expect(result).not.toContain("target=");
  });

  it("strips HTML tags from input for XSS protection", () => {
    const result = renderMarkdown("<script>alert('xss')</script>Hello");
    expect(result).not.toContain("<script>");
    expect(result).toContain("Hello");
  });

  it("escapes HTML in link URLs", () => {
    const result = renderMarkdown('[test](javascript:alert("xss"))');
    expect(result).toContain("javascript:");
    expect(result).not.toContain('alert("xss")');
  });
});

describe("markdownToPlainText", () => {
  it("removes bold formatting", () => {
    const result = markdownToPlainText("**bold** text");
    expect(result).toBe("bold text");
  });

  it("removes italic formatting", () => {
    const result = markdownToPlainText("*italic* text");
    expect(result).toBe("italic text");
  });

  it("removes headers", () => {
    const result = markdownToPlainText("# Header\nContent");
    expect(result).toBe("Header Content");
  });

  it("removes links but keeps text", () => {
    const result = markdownToPlainText("Click [here](https://example.com)");
    expect(result).toBe("Click here");
  });

  it("removes inline code backticks", () => {
    const result = markdownToPlainText("Use `const` keyword");
    expect(result).toBe("Use const keyword");
  });

  it("removes blockquote markers", () => {
    const result = markdownToPlainText("> A quote\n> continues");
    expect(result).toBe("A quote continues");
  });

  it("truncates to maxLength with ellipsis", () => {
    const result = markdownToPlainText("This is a long sentence that should be truncated", 25);
    expect(result).toContain("...");
    expect(result.length).toBeLessThanOrEqual(28); // maxLength + "..."
  });

  it("handles empty string", () => {
    const result = markdownToPlainText("");
    expect(result).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less than", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('a "b" c')).toBe("a &quot;b&quot; c");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("a 'b' c")).toBe("a &#039;b&#039; c");
  });
});

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("removes script tags", () => {
    expect(stripHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("handles nested tags", () => {
    expect(stripHtml("<div><p>Hello</p></div>")).toBe("Hello");
  });

  it("preserves text without tags", () => {
    expect(stripHtml("Hello world")).toBe("Hello world");
  });
});
