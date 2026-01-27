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
        <link rel="stylesheet" href="/css/main.css" />
      </head>
      <body class="min-h-screen flex flex-col bg-gray-50 text-gray-900">
        <header class="bg-white shadow-sm">
          <nav class="max-w-4xl mx-auto px-4 py-4">
            <a href="/" class="text-lg font-semibold text-gray-900 hover:text-gray-600">
              erikcraddock.me
            </a>
          </nav>
        </header>
        <main class="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">{children}</main>
        <footer class="bg-white border-t">
          <div class="max-w-4xl mx-auto px-4 py-4 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Erik Craddock
          </div>
        </footer>
      </body>
    </html>
  );
}
