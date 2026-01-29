import type { ApiResponse, PingResponse, PostListItem, Post } from "../types";

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
    tags?: string[];
  }): Promise<ApiResponse<Post>> {
    return this.request<Post>("POST", "/posts", data);
  }

  async updatePost(
    slug: string,
    data: {
      title?: string;
      content?: string;
      excerpt?: string;
      tags?: string[];
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
