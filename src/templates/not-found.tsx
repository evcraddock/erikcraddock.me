import { Layout } from "./layout";

interface NotFoundProps {
  title?: string;
  message?: string;
}

export function NotFound({
  title = "Not Found",
  message = "The page you're looking for doesn't exist.",
}: NotFoundProps) {
  return (
    <Layout title={`${title} | erikcraddock.me`}>
      <div class="text-center py-12">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{title}</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <a
          href="/"
          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to home
        </a>
      </div>
    </Layout>
  );
}
