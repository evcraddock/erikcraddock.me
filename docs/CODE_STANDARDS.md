# Code Standards

## Formatting

This project uses **Prettier**. Run before committing:

```bash
npm run format
```

## Linting

This project uses **ESLint**:

```bash
npm run lint
```

## TypeScript

### Strict Mode

TypeScript strict mode is enabled. No implicit `any`, strict null checks.

```typescript
// ❌ Bad
const data = response as any;

// ✅ Good
const data: ApiResponse = response;
```

### Types

- Define types for all function parameters and return values
- Use interfaces for object shapes
- Export types that are part of public API

```typescript
interface Post {
  id: number;
  title: string;
  content: string;
}

function createPost(data: CreatePostInput): Promise<Post> {
  // ...
}
```

### Null Handling

- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Handle null cases explicitly

```typescript
const title = post.title ?? "Untitled";
const author = post.author?.name;
```

## Imports

- Use path aliases (`@/...`)
- Group: external, internal, relative

```typescript
// External
import { Hono } from "hono";

// Internal
import { db } from "@/db";

// Relative
import { validate } from "./validation";
```

## Exports

- Use named exports (not default)
- Re-export from index.ts for public API

## Functions

- Keep functions small (<30 lines)
- Single responsibility
- Use object params for 3+ parameters

## Error Handling

- Throw errors for exceptional cases
- Include context in error messages

```typescript
if (!post) {
  throw new Error(`Post not found: ${id}`);
}
```

## Testing

- Use Bun's built-in test runner (`bun test`)
- Test all public functions
- Use describe/it blocks
- Import from `bun:test` (not vitest)

```typescript
describe("createPost", () => {
  it("creates post with title and content", async () => {
    const post = await createPost({ title: "Test", content: "..." });
    expect(post.title).toBe("Test");
  });
});
```

## Hono Routes

- Group related routes in separate files under `src/routes/`
- Use route groups for shared middleware

```typescript
// src/routes/admin.tsx
import { Hono } from "hono";
import { authMiddleware } from "@/auth/middleware";

const admin = new Hono();
admin.use("*", authMiddleware);

admin.get("/", (c) => c.html(<Dashboard />));

export { admin };
```

- Mount routes in `src/index.ts`:

```typescript
import { admin } from "@/routes/admin";
app.route("/admin", admin);
```

## Hono JSX

- Templates go in `src/templates/`
- Use a base layout component for consistent structure
- Components are functions returning JSX

```typescript
// src/templates/layout.tsx
export function Layout({ title, children }: { title: string; children: any }) {
  return (
    <html>
      <head><title>{title}</title></head>
      <body>{children}</body>
    </html>
  );
}

// Usage in route
c.html(<Layout title="Home"><h1>Welcome</h1></Layout>);
```

## Drizzle ORM

- Schema defined in `src/db/schema.ts`
- Use snake_case for table/column names
- Export table objects for queries

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

- Queries use the Drizzle query builder:

```typescript
import { db } from "@/db";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";

const post = await db.select().from(posts).where(eq(posts.id, id)).get();
```

## API Responses

- Return JSON with consistent structure
- Use appropriate HTTP status codes

```typescript
// Success
return c.json({ data: post }, 200);

// Created
return c.json({ data: post }, 201);

// Error
return c.json({ error: "Post not found" }, 404);
```
