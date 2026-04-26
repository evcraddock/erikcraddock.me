/**
 * Markdown frontmatter parsing utilities
 */

export interface PostFrontmatter {
  title?: string;
  slug?: string;
  tags?: string[];
  excerpt?: string;
  banner?: string;
  status?: string;
  created?: string;
  type?: string;
  url?: string;
  source?: string;
  author?: string;
  date?: string; // For imports - original publish date
}

export interface ParsedMarkdown {
  frontmatter: PostFrontmatter;
  content: string;
}

/**
 * Parse YAML frontmatter from markdown content
 *
 * Expects format:
 * ---
 * title: My Post
 * slug: my-post
 * ---
 * Content here...
 */
export function parseMarkdown(text: string): ParsedMarkdown {
  const lines = text.split("\n");

  // Check for frontmatter delimiter
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: {}, content: text };
  }

  // Find closing delimiter
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, content: text };
  }

  // Parse YAML frontmatter
  const yamlLines = lines.slice(1, endIndex);
  const frontmatter = parseYaml(yamlLines.join("\n"));

  // Extract content after frontmatter
  const content = lines
    .slice(endIndex + 1)
    .join("\n")
    .trim();

  return { frontmatter, content };
}

/**
 * Simple YAML parser for frontmatter
 * Handles: strings, arrays (both inline and multiline)
 */
function parseYaml(yaml: string): PostFrontmatter {
  const result: PostFrontmatter = {};
  const lines = yaml.split("\n");

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check for array item (- value)
    if (line.match(/^\s+-\s+/)) {
      if (currentArray !== null) {
        const value = line.replace(/^\s+-\s+/, "").trim();
        currentArray.push(unquote(value));
      }
      continue;
    }

    // Commit any pending array
    if (currentKey && currentArray !== null) {
      (result as Record<string, unknown>)[currentKey] = currentArray;
      currentArray = null;
      currentKey = null;
    }

    // Parse key: value
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim();

    // Check for inline array [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      const items = value
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter((s) => s.length > 0);
      (result as Record<string, unknown>)[key] = items;
      continue;
    }

    // Check for start of multiline array (empty value, items follow)
    if (value === "") {
      currentKey = key;
      currentArray = [];
      continue;
    }

    // Regular string value
    (result as Record<string, unknown>)[key] = unquote(value);
  }

  // Commit any pending array at end
  if (currentKey && currentArray !== null) {
    (result as Record<string, unknown>)[currentKey] = currentArray;
  }

  return result;
}

/**
 * Remove surrounding quotes from a string
 */
function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Generate markdown with frontmatter from post data
 */
export function generateMarkdown(frontmatter: PostFrontmatter, content: string): string {
  const lines: string[] = ["---"];

  if (frontmatter.title) {
    lines.push(`title: ${quoteIfNeeded(frontmatter.title)}`);
  }
  if (frontmatter.slug) {
    lines.push(`slug: ${frontmatter.slug}`);
  }
  if (frontmatter.type) {
    lines.push(`type: ${frontmatter.type}`);
  }
  if (frontmatter.url) {
    lines.push(`url: ${frontmatter.url}`);
  }
  if (frontmatter.source) {
    lines.push(`source: ${frontmatter.source}`);
  }
  if (frontmatter.author) {
    lines.push(`author: ${frontmatter.author}`);
  }
  if (frontmatter.status) {
    lines.push(`status: ${frontmatter.status}`);
  }
  if (frontmatter.tags && frontmatter.tags.length > 0) {
    lines.push(`tags: [${frontmatter.tags.join(", ")}]`);
  }
  if (frontmatter.excerpt) {
    lines.push(`excerpt: ${quoteIfNeeded(frontmatter.excerpt)}`);
  }
  if (frontmatter.banner) {
    lines.push(`banner: ${frontmatter.banner}`);
  }
  if (frontmatter.created) {
    lines.push(`created: ${frontmatter.created}`);
  }

  lines.push("---");
  lines.push("");
  lines.push(content);

  return lines.join("\n");
}

/**
 * Quote string if it contains special YAML characters
 */
function quoteIfNeeded(s: string): string {
  if (s.includes(":") || s.includes("#") || s.includes('"') || s.includes("'")) {
    // Escape double quotes and wrap in double quotes
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
