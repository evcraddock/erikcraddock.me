import type { ApiResponse, PingResponse } from "../types";

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
