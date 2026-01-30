import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { parseUploadArgs, resolveKey, validateFile, ALLOWED_EXTENSIONS } from "../upload";

describe("parseUploadArgs", () => {
  it("parses file path as first non-flag argument", () => {
    const result = parseUploadArgs(["./photo.jpg"]);
    expect(result.file).toBe("./photo.jpg");
    expect(result.help).toBe(false);
  });

  it("parses --alt with space separator", () => {
    const result = parseUploadArgs(["./photo.jpg", "--alt", "A sunset"]);
    expect(result.file).toBe("./photo.jpg");
    expect(result.options.alt).toBe("A sunset");
  });

  it("parses --alt=value format", () => {
    const result = parseUploadArgs(["./photo.jpg", "--alt=A sunset"]);
    expect(result.options.alt).toBe("A sunset");
  });

  it("parses --key with space separator", () => {
    const result = parseUploadArgs(["./photo.jpg", "--key", "custom/path.jpg"]);
    expect(result.options.key).toBe("custom/path.jpg");
  });

  it("parses --key=value format", () => {
    const result = parseUploadArgs(["./photo.jpg", "--key=custom/path.jpg"]);
    expect(result.options.key).toBe("custom/path.jpg");
  });

  it("parses --post with space separator", () => {
    const result = parseUploadArgs(["./photo.jpg", "--post", "my-post"]);
    expect(result.options.post).toBe("my-post");
  });

  it("parses --post=value format", () => {
    const result = parseUploadArgs(["./photo.jpg", "--post=my-post"]);
    expect(result.options.post).toBe("my-post");
  });

  it("parses --help flag", () => {
    const result = parseUploadArgs(["--help"]);
    expect(result.help).toBe(true);
  });

  it("parses -h shorthand", () => {
    const result = parseUploadArgs(["-h"]);
    expect(result.help).toBe(true);
  });

  it("parses multiple options together", () => {
    const result = parseUploadArgs([
      "./photo.jpg",
      "--alt",
      "Description",
      "--post",
      "my-post",
      "--key",
      "banner.jpg",
    ]);
    expect(result.file).toBe("./photo.jpg");
    expect(result.options.alt).toBe("Description");
    expect(result.options.post).toBe("my-post");
    expect(result.options.key).toBe("banner.jpg");
  });

  it("returns null file when no file provided", () => {
    const result = parseUploadArgs(["--alt", "test"]);
    expect(result.file).toBeNull();
  });

  it("handles --alt with equals sign in value", () => {
    const result = parseUploadArgs(["./photo.jpg", "--alt=a=b=c"]);
    expect(result.options.alt).toBe("a=b=c");
  });
});

describe("resolveKey", () => {
  it("returns undefined when no options provided", () => {
    const result = resolveKey("./photo.jpg", {});
    expect(result).toBeUndefined();
  });

  it("returns posts/<slug>/<filename> for --post only", () => {
    const result = resolveKey("./photo.jpg", { post: "my-post" });
    expect(result).toBe("posts/my-post/photo.jpg");
  });

  it("returns custom key for --key only", () => {
    const result = resolveKey("./photo.jpg", { key: "custom/path.jpg" });
    expect(result).toBe("custom/path.jpg");
  });

  it("combines post and key when both provided", () => {
    const result = resolveKey("./photo.jpg", { post: "my-post", key: "banner.jpg" });
    expect(result).toBe("posts/my-post/banner.jpg");
  });

  it("extracts filename from full path", () => {
    const result = resolveKey("/full/path/to/image.png", { post: "test" });
    expect(result).toBe("posts/test/image.png");
  });
});

describe("validateFile", () => {
  let tempDir: string;
  let tempJpg: string;
  let tempPng: string;
  let tempTxt: string;
  let tempJPG: string;

  beforeAll(() => {
    // Create temp files for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-test-"));
    tempJpg = path.join(tempDir, "test.jpg");
    tempPng = path.join(tempDir, "test.png");
    tempTxt = path.join(tempDir, "test.txt");
    tempJPG = path.join(tempDir, "test.JPG");

    fs.writeFileSync(tempJpg, "fake jpg content");
    fs.writeFileSync(tempPng, "fake png content");
    fs.writeFileSync(tempTxt, "fake txt content");
    fs.writeFileSync(tempJPG, "fake JPG content");
  });

  afterAll(() => {
    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns error for non-existent file", () => {
    const result = validateFile("/nonexistent/file.jpg");
    expect(result).toBe("File not found: /nonexistent/file.jpg");
  });

  it("returns error for unsupported extension", () => {
    const result = validateFile(tempTxt);
    expect(result).toContain("Unsupported file format: .txt");
  });

  it("returns null for valid jpg file", () => {
    const result = validateFile(tempJpg);
    expect(result).toBeNull();
  });

  it("returns null for valid png file", () => {
    const result = validateFile(tempPng);
    expect(result).toBeNull();
  });

  it("handles uppercase extensions", () => {
    const result = validateFile(tempJPG);
    expect(result).toBeNull();
  });
});

describe("ALLOWED_EXTENSIONS", () => {
  it("includes all expected formats", () => {
    expect(ALLOWED_EXTENSIONS).toContain(".jpg");
    expect(ALLOWED_EXTENSIONS).toContain(".jpeg");
    expect(ALLOWED_EXTENSIONS).toContain(".png");
    expect(ALLOWED_EXTENSIONS).toContain(".gif");
    expect(ALLOWED_EXTENSIONS).toContain(".webp");
  });
});
