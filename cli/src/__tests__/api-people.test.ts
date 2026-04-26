import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ApiClient } from "../lib/api";

describe("ApiClient people methods", () => {
  let client: ApiClient;
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    client = new ApiClient("https://api.example.com", "test-key");
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  it("calls GET /people", async () => {
    await client.listPeople();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/people",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
  });

  it("calls GET /people/:id", async () => {
    await client.getPerson(3);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/people/3",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("calls POST /people with body", async () => {
    const person = { name: "Ethan Mollick", url: "https://www.oneusefulthing.org/" };

    await client.createPerson(person);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/people",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify(person),
      })
    );
  });

  it("calls PUT /people/:id with body", async () => {
    const updates = { name: "Ethan Mollick", url: null, default_social_account_id: 7 };

    await client.updatePerson(3, updates);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/people/3",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(updates),
      })
    );
  });
});
