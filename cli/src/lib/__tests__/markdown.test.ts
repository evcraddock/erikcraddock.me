import { describe, expect, it } from "bun:test";
import { parseMarkdown, generateMarkdown } from "../markdown";

describe("parseMarkdown", () => {
  it("parses frontmatter with string values", () => {
    const md = `---
title: My Post
slug: my-post
excerpt: A short summary
---
Content here`;

    const { frontmatter, content } = parseMarkdown(md);

    expect(frontmatter.title).toBe("My Post");
    expect(frontmatter.slug).toBe("my-post");
    expect(frontmatter.excerpt).toBe("A short summary");
    expect(content).toBe("Content here");
  });

  it("parses inline array tags", () => {
    const md = `---
title: Test
tags: [tech, rust, web]
---
Content`;

    const { frontmatter } = parseMarkdown(md);

    expect(frontmatter.tags).toEqual(["tech", "rust", "web"]);
  });

  it("parses multiline array tags", () => {
    const md = `---
title: Test
tags:
  - tech
  - rust
  - web
---
Content`;

    const { frontmatter } = parseMarkdown(md);

    expect(frontmatter.tags).toEqual(["tech", "rust", "web"]);
  });

  it("handles quoted values", () => {
    const md = `---
title: "My: Special Post"
excerpt: 'Single quoted'
---
Content`;

    const { frontmatter } = parseMarkdown(md);

    expect(frontmatter.title).toBe("My: Special Post");
    expect(frontmatter.excerpt).toBe("Single quoted");
  });

  it("handles banner image path", () => {
    const md = `---
title: Test
banner: ./hero.jpg
---
Content`;

    const { frontmatter } = parseMarkdown(md);

    expect(frontmatter.banner).toBe("./hero.jpg");
  });

  it("handles image ID syntax in banner", () => {
    const md = `---
title: Test
banner: image:42
---
Content`;

    const { frontmatter } = parseMarkdown(md);

    expect(frontmatter.banner).toBe("image:42");
  });

  it("returns empty frontmatter for content without frontmatter", () => {
    const md = `Just content
No frontmatter here`;

    const { frontmatter, content } = parseMarkdown(md);

    expect(frontmatter).toEqual({});
    expect(content).toBe(md);
  });

  it("returns empty frontmatter for unclosed frontmatter", () => {
    const md = `---
title: Test
No closing delimiter`;

    const { frontmatter, content } = parseMarkdown(md);

    expect(frontmatter).toEqual({});
    expect(content).toBe(md);
  });

  it("handles empty content after frontmatter", () => {
    const md = `---
title: Test
slug: test
---`;

    const { frontmatter, content } = parseMarkdown(md);

    expect(frontmatter.title).toBe("Test");
    expect(content).toBe("");
  });

  it("preserves content with multiple paragraphs", () => {
    const md = `---
title: Test
---
First paragraph.

Second paragraph.

Third paragraph.`;

    const { content } = parseMarkdown(md);

    expect(content).toBe("First paragraph.\n\nSecond paragraph.\n\nThird paragraph.");
  });

  it("handles type field", () => {
    const md = `---
type: note
slug: quick-thought
---
Just a note`;

    const { frontmatter } = parseMarkdown(md);

    expect(frontmatter.type).toBe("note");
  });
});

describe("generateMarkdown", () => {
  it("generates markdown with frontmatter", () => {
    const frontmatter = {
      title: "My Post",
      slug: "my-post",
      tags: ["tech", "web"],
      excerpt: "A summary",
    };
    const content = "Content here";

    const result = generateMarkdown(frontmatter, content);

    expect(result).toContain("---");
    expect(result).toContain("title: My Post");
    expect(result).toContain("slug: my-post");
    expect(result).toContain("tags: [tech, web]");
    expect(result).toContain("excerpt: A summary");
    expect(result).toContain("Content here");
  });

  it("quotes titles with special characters", () => {
    const frontmatter = {
      title: "My: Special Post",
      slug: "special",
    };

    const result = generateMarkdown(frontmatter, "Content");

    expect(result).toContain('title: "My: Special Post"');
  });

  it("includes status and created date", () => {
    const frontmatter = {
      title: "Test",
      slug: "test",
      status: "published",
      created: "2026-01-29",
    };

    const result = generateMarkdown(frontmatter, "Content");

    expect(result).toContain("status: published");
    expect(result).toContain("created: 2026-01-29");
  });

  it("includes banner", () => {
    const frontmatter = {
      title: "Test",
      slug: "test",
      banner: "https://example.com/image.jpg",
    };

    const result = generateMarkdown(frontmatter, "Content");

    expect(result).toContain("banner: https://example.com/image.jpg");
  });

  it("omits empty tags array", () => {
    const frontmatter = {
      title: "Test",
      slug: "test",
      tags: [],
    };

    const result = generateMarkdown(frontmatter, "Content");

    expect(result).not.toContain("tags:");
  });

  it("handles type field", () => {
    const frontmatter = {
      slug: "note",
      type: "note",
    };

    const result = generateMarkdown(frontmatter, "Quick thought");

    expect(result).toContain("type: note");
  });
});
