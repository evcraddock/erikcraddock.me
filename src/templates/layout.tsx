import type { Child } from "hono/jsx";
import { raw } from "hono/html";

interface LayoutProps {
  title: string;
  children: Child;
  ogImage?: string;
  description?: string;
}

// Inline script to prevent flash of wrong theme
const themeScript = `
(function() {
  var theme = localStorage.getItem('theme');
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export function Layout({ title, children, ogImage, description }: LayoutProps) {
  const siteUrl = process.env.SITE_URL || "https://erikcraddock.me";

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        {/* Open Graph tags */}
        <meta property="og:title" content={title} />
        {description && <meta property="og:description" content={description} />}
        {ogImage && (
          <meta
            property="og:image"
            content={ogImage.startsWith("http") ? ogImage : `${siteUrl}${ogImage}`}
          />
        )}
        <meta property="og:type" content="article" />
        {/* Twitter Card tags */}
        <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={title} />
        {description && <meta name="twitter:description" content={description} />}
        {ogImage && (
          <meta
            name="twitter:image"
            content={ogImage.startsWith("http") ? ogImage : `${siteUrl}${ogImage}`}
          />
        )}
        <script>{raw(themeScript)}</script>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/css/main.css" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="erikcraddock.me RSS Feed"
          href="/feed.xml"
        />
      </head>
      <body class="min-h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <header class="bg-white shadow-sm dark:bg-gray-800 dark:shadow-gray-900/50">
          <nav class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <a
              href="/"
              class="text-lg font-semibold text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300"
            >
              erikcraddock.me
            </a>
            <div class="flex items-center gap-6">
              <a
                href="/articles"
                class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Articles
              </a>
              <a
                href="/feed"
                class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Feed
              </a>
              <a
                href="/sources"
                class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Sources
              </a>
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main class="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">{children}</main>
        <footer class="bg-white border-t dark:bg-gray-800 dark:border-gray-700">
          <div class="max-w-6xl mx-auto px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} Erik Craddock
          </div>
        </footer>
        <script>{raw(toggleScript)}</script>
      </body>
    </html>
  );
}

function ThemeToggle() {
  return (
    <button
      id="theme-toggle"
      type="button"
      class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600"
      aria-label="Toggle dark mode"
    >
      {/* Sun icon (shown in dark mode) */}
      <svg
        id="theme-toggle-light-icon"
        class="hidden w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
          fill-rule="evenodd"
          clip-rule="evenodd"
        />
      </svg>
      {/* Moon icon (shown in light mode) */}
      <svg
        id="theme-toggle-dark-icon"
        class="hidden w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>
    </button>
  );
}

// Script for toggle functionality and icon visibility
const toggleScript = `
(function() {
  var lightIcon = document.getElementById('theme-toggle-light-icon');
  var darkIcon = document.getElementById('theme-toggle-dark-icon');
  var toggle = document.getElementById('theme-toggle');
  
  function updateIcons() {
    if (document.documentElement.classList.contains('dark')) {
      lightIcon.classList.remove('hidden');
      darkIcon.classList.add('hidden');
    } else {
      lightIcon.classList.add('hidden');
      darkIcon.classList.remove('hidden');
    }
  }
  
  updateIcons();
  
  toggle.addEventListener('click', function() {
    document.documentElement.classList.toggle('dark');
    var isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateIcons();
  });
  
  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      updateIcons();
    }
  });
})();
`;
