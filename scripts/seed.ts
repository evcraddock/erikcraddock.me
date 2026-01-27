import { db, posts, tags, postTags } from "../src/db";

async function seed() {
  console.log("🌱 Seeding database...");

  // Check if already seeded
  const existingPosts = db.select().from(posts).all();
  if (existingPosts.length > 0) {
    console.log("Database already has posts, skipping seed.");
    return;
  }

  const now = new Date();

  // Create tags
  console.log("Creating tags...");
  const tagData = [
    { name: "TypeScript", slug: "typescript" },
    { name: "Web Development", slug: "web-development" },
    { name: "ActivityPub", slug: "activitypub" },
  ];

  const createdTags: { id: number; slug: string }[] = [];
  for (const tag of tagData) {
    const result = db.insert(tags).values(tag).returning().get();
    createdTags.push({ id: result.id, slug: tag.slug });
  }

  // Create posts
  console.log("Creating posts...");
  const postData = [
    {
      type: "article",
      title: "Building a Federated Blog",
      content: `This is the first post on my new federated blog. The goal is to create a personal website that can be followed from Mastodon and other ActivityPub-compatible platforms.

When someone follows @erik@erikcraddock.me, they'll see my posts show up in their home feed, just like following any other account.

The tech stack includes:
- **Hono** for the web framework
- **Fedify** for ActivityPub
- **Drizzle + SQLite** for the database
- **Tailwind** for styling

More posts coming soon as I build this out!`,
      excerpt: "Introducing my new federated blog that can be followed from Mastodon.",
      published_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      created_at: now,
      updated_at: now,
      tagSlugs: ["typescript", "web-development", "activitypub"],
    },
    {
      type: "article",
      title: "Why TypeScript for Everything",
      content: `I've been using TypeScript for all my projects lately, and I wanted to share why.

The type safety catches so many bugs at compile time that would otherwise slip through. The IDE support is incredible - autocomplete, refactoring, and inline documentation all work seamlessly.

For this blog project, TypeScript with strict mode enabled has been invaluable. The Drizzle ORM integration means my database queries are fully typed, and Hono's JSX support gives me type-safe templates.

The small upfront cost of adding types pays off enormously as the project grows.`,
      excerpt: "Why I use TypeScript for every project, from small scripts to full applications.",
      published_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      created_at: now,
      updated_at: now,
      tagSlugs: ["typescript", "web-development"],
    },
    {
      type: "note",
      title: null,
      content: "Just pushed the first version of the site. Still lots to do but it's a start! 🚀",
      excerpt: null,
      published_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      created_at: now,
      updated_at: now,
      tagSlugs: [],
    },
  ];

  for (const post of postData) {
    const { tagSlugs, ...postValues } = post;

    const result = db.insert(posts).values(postValues).returning().get();

    // Create post-tag associations
    for (const slug of tagSlugs) {
      const tag = createdTags.find((t) => t.slug === slug);
      if (tag) {
        db.insert(postTags).values({ post_id: result.id, tag_id: tag.id }).run();
      }
    }
  }

  console.log(`✅ Seeded ${postData.length} posts and ${tagData.length} tags`);
}

seed().catch(console.error);
