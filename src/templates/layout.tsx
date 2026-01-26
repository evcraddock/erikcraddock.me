import type { Child } from "hono/jsx";

interface LayoutProps {
  title: string;
  children: Child;
}

export function Layout({ title, children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
      </head>
      <body>
        <header>
          <nav>
            <a href="/">erikcraddock.me</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <p>&copy; {new Date().getFullYear()} Erik Craddock</p>
        </footer>
      </body>
    </html>
  );
}
