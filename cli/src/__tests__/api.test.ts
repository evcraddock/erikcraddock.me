import { describe, it, expect, mock } from "bun:test";
import { ApiClient, verifyApiKey } from "../lib/api";

describe("ApiClient", () => {
  describe("ping", () => {
    it("returns success response on valid ping", async () => {
      // Mock fetch for this test
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: { status: "ok", authenticated: "test@example.com" },
            }),
            { status: 200 }
          )
        )
      ) as unknown as typeof fetch;

      try {
        const client = new ApiClient("https://example.com/api", "ek_test");
        const result = await client.ping();

        expect(result.data?.status).toBe("ok");
        expect(result.data?.authenticated).toBe("test@example.com");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("returns error on failed request", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "Invalid API key" }), {
            status: 401,
          })
        )
      ) as unknown as typeof fetch;

      try {
        const client = new ApiClient("https://example.com/api", "bad_key");
        const result = await client.ping();

        expect(result.error).toBe("Invalid API key");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("returns error on network failure", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("Network error"))
      ) as unknown as typeof fetch;

      try {
        const client = new ApiClient("https://example.com/api", "ek_test");
        const result = await client.ping();

        expect(result.error).toContain("Network error");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("sends Authorization header with Bearer token", async () => {
      const originalFetch = globalThis.fetch;
      let capturedHeaders: Headers | undefined;

      globalThis.fetch = mock((url: string, options: RequestInit) => {
        capturedHeaders = new Headers(options.headers);
        return Promise.resolve(
          new Response(JSON.stringify({ data: { status: "ok" } }), {
            status: 200,
          })
        );
      }) as unknown as typeof fetch;

      try {
        const client = new ApiClient("https://example.com/api", "ek_mykey123");
        await client.ping();

        expect(capturedHeaders?.get("Authorization")).toBe("Bearer ek_mykey123");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

describe("verifyApiKey", () => {
  it("returns success with email for valid key", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: { status: "ok", authenticated: "user@example.com" },
          }),
          { status: 200 }
        )
      )
    ) as unknown as typeof fetch;

    try {
      const result = await verifyApiKey("https://example.com/api", "ek_validkey");

      expect(result.success).toBe(true);
      expect(result.email).toBe("user@example.com");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns failure for invalid key", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }))
    ) as unknown as typeof fetch;

    try {
      const result = await verifyApiKey("https://example.com/api", "ek_badkey");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns failure on network error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("Connection refused"))
    ) as unknown as typeof fetch;

    try {
      const result = await verifyApiKey("https://example.com/api", "ek_key");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns failure for unexpected response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { status: "error" } }), {
          status: 200,
        })
      )
    ) as unknown as typeof fetch;

    try {
      const result = await verifyApiKey("https://example.com/api", "ek_key");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unexpected response");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
