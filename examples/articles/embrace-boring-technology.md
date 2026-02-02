---
title: In Defense of Boring Technology
slug: embrace-boring-technology
type: article
excerpt: Why choosing the unsexy, battle-tested option is often the smartest engineering decision.
tags: [coding, architecture, engineering]
banner: ../images/boring-tech.jpg
---

# In Defense of Boring Technology

Every week brings a new JavaScript framework. A new database paradigm. A new way to deploy applications. The pressure to adopt the latest technology is relentless. I'm here to advocate for the opposite.

## The Innovation Budget

Dan McKinley coined the term "innovation tokens." Every team has a limited budget for new, unproven technology. Spend them wisely.

Using Kubernetes, a new graph database, and an experimental language simultaneously? You've spent all your tokens. When something goes wrong—and something will—you're debugging three unknowns.

## Battle-Tested Wins

PostgreSQL has been around since 1996. It's boring. It's also:

- Extremely well documented
- Supported everywhere
- Understood by most developers
- Performant enough for most use cases

Can a specialized database outperform it for your specific use case? Probably. Will the operational overhead be worth it? Usually not.

## The Real Cost of New

New technology costs more than learning time:

- **Fewer Stack Overflow answers** when you hit problems
- **Smaller hiring pool** of experienced developers
- **Less tooling** for debugging and monitoring
- **Unknown failure modes** that only appear at scale

## When to Innovate

Save your innovation tokens for genuine competitive advantages:

- Technology that enables capabilities you couldn't otherwise have
- Clear, measurable improvements that justify the risk
- Areas where you have deep expertise to mitigate unknowns

## My Stack

For personal projects, I default to:

- SQLite or PostgreSQL
- TypeScript/Node or Python
- Plain HTML/CSS when possible
- A VPS with a simple deployment script

Boring? Absolutely. Reliable? Also absolutely.

## The Takeaway

Choosing boring technology isn't about being behind the times. It's about focusing your energy on solving actual problems instead of wrestling with tools.

The best technology is the kind you don't have to think about.
