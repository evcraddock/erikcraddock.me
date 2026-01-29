export interface GlobalOptions {
  verbose?: boolean;
  apiUrl?: string;
  apiKey?: string;
  json?: boolean;
  help?: boolean;
}

export interface Config {
  api_url?: string;
  api_key?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PingResponse {
  status: string;
  authenticated: string;
}

export interface PostListItem {
  id: number;
  slug: string;
  type: string;
  title: string | null;
  excerpt: string | null;
  published_at: string | null;
  tags: string[];
}

export interface Post {
  id: number;
  slug: string;
  type: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  url: string | null;
  source_id: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface Media {
  id: number;
  filename: string;
  mime_type: string;
  s3_key: string;
  alt_text: string | null;
  created_at: string;
  url: string;
}
