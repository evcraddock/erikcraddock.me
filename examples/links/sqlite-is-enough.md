---
slug: sqlite-is-enough
type: link
title: SQLite is probably all you need
url: https://www.epicweb.dev/why-you-should-probably-be-using-sqlite
excerpt: Kent C. Dodds makes the case for SQLite as your default database choice.
tags: [coding, databases]
---

This resonates with everything I believe about choosing boring technology. Kent argues that SQLite handles far more than most developers assume—up to millions of requests per day on modest hardware.

The key insight: most apps never need horizontal scaling. We reach for Postgres or MySQL out of habit, not necessity. SQLite eliminates an entire category of infrastructure complexity.

I've been running SQLite in production for this site and several side projects. Zero regrets.
