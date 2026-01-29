import { describe, expect, it } from "bun:test";
import { detectImages, rewriteContent } from "../images";

describe("detectImages", () => {
  it("detects banner image in frontmatter", () => {
    const refs = detectImages("./hero.jpg", "Content", "/base");

    expect(refs).toHaveLength(1);
    expect(refs[0].original).toBe("./hero.jpg");
    expect(refs[0].type).toBe("local");
    expect(refs[0].localPath).toBe("/base/hero.jpg");
  });

  it("detects markdown images in content", () => {
    const content = `
Some text
![alt1](./image1.png)
More text
![alt2](./images/photo.jpg)
`;
    const refs = detectImages(undefined, content, "/base");

    expect(refs).toHaveLength(2);
    expect(refs[0].original).toBe("./image1.png");
    expect(refs[0].localPath).toBe("/base/image1.png");
    expect(refs[1].original).toBe("./images/photo.jpg");
    expect(refs[1].localPath).toBe("/base/images/photo.jpg");
  });

  it("detects image ID references", () => {
    const refs = detectImages("image:42", "![photo](image:15)", "/base");

    expect(refs).toHaveLength(2);
    expect(refs[0].original).toBe("image:42");
    expect(refs[0].type).toBe("id");
    expect(refs[0].imageId).toBe(42);
    expect(refs[1].original).toBe("image:15");
    expect(refs[1].type).toBe("id");
    expect(refs[1].imageId).toBe(15);
  });

  it("detects external URLs", () => {
    const refs = detectImages(
      "https://example.com/banner.jpg",
      "![ext](https://cdn.example.com/img.png)",
      "/base"
    );

    expect(refs).toHaveLength(2);
    expect(refs[0].type).toBe("url");
    expect(refs[1].type).toBe("url");
  });

  it("deduplicates repeated references", () => {
    const content = `
![a](./same.jpg)
![b](./same.jpg)
`;
    const refs = detectImages("./same.jpg", content, "/base");

    expect(refs).toHaveLength(1);
    expect(refs[0].original).toBe("./same.jpg");
  });

  it("handles mixed reference types", () => {
    const content = `
![local](./photo.jpg)
![id](image:5)
![external](https://example.com/img.png)
`;
    const refs = detectImages(undefined, content, "/base");

    expect(refs).toHaveLength(3);
    expect(refs[0].type).toBe("local");
    expect(refs[1].type).toBe("id");
    expect(refs[2].type).toBe("url");
  });

  it("handles relative paths with parent directories", () => {
    const refs = detectImages("../images/hero.jpg", "", "/project/posts");

    expect(refs).toHaveLength(1);
    expect(refs[0].localPath).toBe("/project/images/hero.jpg");
  });

  it("returns empty array for no images", () => {
    const refs = detectImages(undefined, "Just text, no images", "/base");

    expect(refs).toHaveLength(0);
  });
});

describe("rewriteContent", () => {
  it("rewrites markdown image sources", () => {
    const content = "![alt](./photo.jpg)";
    const urlMap = new Map([["./photo.jpg", "https://example.com/media/photo.jpg"]]);

    const result = rewriteContent(content, urlMap);

    expect(result).toBe("![alt](https://example.com/media/photo.jpg)");
  });

  it("rewrites multiple images", () => {
    const content = `
![a](./one.jpg)
text
![b](./two.png)
`;
    const urlMap = new Map([
      ["./one.jpg", "https://example.com/one.jpg"],
      ["./two.png", "https://example.com/two.png"],
    ]);

    const result = rewriteContent(content, urlMap);

    expect(result).toContain("![a](https://example.com/one.jpg)");
    expect(result).toContain("![b](https://example.com/two.png)");
  });

  it("rewrites image ID references", () => {
    const content = "![photo](image:42)";
    const urlMap = new Map([["image:42", "https://example.com/media/sunset.jpg"]]);

    const result = rewriteContent(content, urlMap);

    expect(result).toBe("![photo](https://example.com/media/sunset.jpg)");
  });

  it("preserves non-image content", () => {
    const content = `
# Heading

Some text with [a link](https://example.com).

![img](./photo.jpg)

More text.
`;
    const urlMap = new Map([["./photo.jpg", "https://cdn.com/photo.jpg"]]);

    const result = rewriteContent(content, urlMap);

    expect(result).toContain("# Heading");
    expect(result).toContain("[a link](https://example.com)");
    expect(result).toContain("More text.");
    expect(result).toContain("![img](https://cdn.com/photo.jpg)");
  });

  it("handles special regex characters in paths", () => {
    const content = "![img](./path/with.dots/file[1].jpg)";
    const urlMap = new Map([["./path/with.dots/file[1].jpg", "https://example.com/escaped.jpg"]]);

    const result = rewriteContent(content, urlMap);

    expect(result).toBe("![img](https://example.com/escaped.jpg)");
  });
});
