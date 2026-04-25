import * as fs from "fs";
import * as path from "path";
import type {
  ApiResponse,
  PingResponse,
  PostListItem,
  Post,
  Media,
  Source,
  TagWithCount,
} from "../types";

export class ApiClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle 204 No Content
      if (response.status === 204) {
        return { data: { success: true } as T };
      }

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}` };
      }

      return data;
    } catch (error) {
      return { error: String(error) };
    }
  }

  async ping(): Promise<ApiResponse<PingResponse>> {
    return this.request<PingResponse>("GET", "/ping");
  }

  async listPosts(options?: {
    type?: string;
    tag?: string;
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<PostListItem[]>> {
    const params = new URLSearchParams();
    if (options?.type) params.set("type", options.type);
    if (options?.tag) params.set("tag", options.tag);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.status) params.set("status", options.status);

    const query = params.toString();
    const path = query ? `/posts?${query}` : "/posts";
    return this.request<PostListItem[]>("GET", path);
  }

  async getPost(slug: string): Promise<ApiResponse<Post>> {
    return this.request<Post>("GET", `/posts/by-slug/${encodeURIComponent(slug)}`);
  }

  async createPost(data: {
    type: string;
    slug: string;
    title?: string;
    content: string;
    excerpt?: string;
    url?: string;
    source_id?: number;
    tags?: string[];
    banner_image_id?: number;
    published_at?: string; // ISO date string for imports
  }): Promise<ApiResponse<Post>> {
    return this.request<Post>("POST", "/posts", data);
  }

  async updatePost(
    slug: string,
    data: {
      title?: string;
      content?: string;
      excerpt?: string;
      url?: string;
      source_id?: number;
      tags?: string[];
      banner_image_id?: number;
    }
  ): Promise<ApiResponse<Post>> {
    return this.request<Post>("PUT", `/posts/by-slug/${encodeURIComponent(slug)}`, data);
  }

  async deletePost(slug: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      "DELETE",
      `/posts/by-slug/${encodeURIComponent(slug)}`
    );
  }

  async publishPost(slug: string): Promise<ApiResponse<Post>> {
    return this.request<Post>("POST", `/posts/by-slug/${encodeURIComponent(slug)}/publish`);
  }

  async unpublishPost(slug: string): Promise<ApiResponse<Post>> {
    return this.request<Post>("POST", `/posts/by-slug/${encodeURIComponent(slug)}/unpublish`);
  }

  async getMedia(id: number): Promise<ApiResponse<Media>> {
    return this.request<Media>("GET", `/media/${id}`);
  }

  async uploadMedia(
    filePath: string,
    options?: { key?: string; alt?: string }
  ): Promise<ApiResponse<Media>> {
    const url = `${this.baseUrl}/media`;

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const filename = path.basename(filePath);
      const mimeType = getMimeType(filename);

      const formData = new FormData();
      formData.append("file", new Blob([fileBuffer], { type: mimeType }), filename);
      if (options?.key) {
        formData.append("key", options.key);
      }
      if (options?.alt) {
        formData.append("alt", options.alt);
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}` };
      }

      return data;
    } catch (error) {
      return { error: String(error) };
    }
  }

  async deleteMedia(id: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>("DELETE", `/media/${id}`);
  }

  // Source methods

  async listSources(): Promise<ApiResponse<Source[]>> {
    return this.request<Source[]>("GET", "/sources");
  }

  async getSource(id: number): Promise<ApiResponse<Source>> {
    return this.request<Source>("GET", `/sources/${id}`);
  }

  async createSource(data: {
    name: string;
    url: string;
    feed_url?: string;
    author?: string;
  }): Promise<ApiResponse<Source>> {
    return this.request<Source>("POST", "/sources", data);
  }

  async updateSource(
    id: number,
    data: {
      name?: string;
      url?: string;
      feed_url?: string | null;
      author?: string | null;
    }
  ): Promise<ApiResponse<Source>> {
    return this.request<Source>("PUT", `/sources/${id}`, data);
  }

  async deleteSource(id: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>("DELETE", `/sources/${id}`);
  }

  // Tag methods

  async listTags(): Promise<ApiResponse<TagWithCount[]>> {
    return this.request<TagWithCount[]>("GET", "/tags");
  }

  // Federation methods

  async federationDelete(uri: string): Promise<ApiResponse<{ success: boolean; uri: string }>> {
    return this.request<{ success: boolean; uri: string }>("POST", "/federation/delete", { uri });
  }
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

export async function verifyApiKey(
  apiUrl: string,
  apiKey: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  const client = new ApiClient(apiUrl, apiKey);
  const result = await client.ping();

  if (result.error) {
    return { success: false, error: result.error };
  }

  if (result.data?.status === "ok") {
    return { success: true, email: result.data.authenticated };
  }

  return { success: false, error: "Unexpected response" };
}
