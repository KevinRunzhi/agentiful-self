/**
 * API Client
 *
 * Fetch-based HTTP client with trace ID propagation
 */

import type { AuthSession } from "@agentifui/shared/types";

/**
 * API client configuration
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * API error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public traceId: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * API request options
 */
interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
  tenantId?: string;
}

/**
 * Fetch wrapper with auth and trace ID
 */
async function fetchWithAuth(
  url: string,
  options: RequestOptions = {},
  session: AuthSession | null = null
): Promise<Response> {
  const { query, tenantId, ...fetchOptions } = options;

  // Build URL with query params
  let urlObj = new URL(url, API_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        urlObj.searchParams.set(key, String(value));
      }
    });
  }

  // Add tenant header
  const headers = new Headers(fetchOptions.headers);
  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  } else if (session?.tenant) {
    headers.set("x-tenant-id", session.tenant.id);
  }

  // Add auth token
  if (session?.token) {
    headers.set("authorization", `Bearer ${session.token}`);
  }

  // Generate or propagate trace ID
  const traceId = crypto.randomUUID();
  headers.set("x-trace-id", traceId);

  const response = await fetch(urlObj.toString(), {
    ...fetchOptions,
    headers,
  });

  return response;
}

/**
 * Parse API response
 */
async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.error?.code || "API_ERROR",
        data.error?.traceId || "unknown",
        data.error?.message || "An error occurred"
      );
    }

    return data;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "HTTP_ERROR",
      "unknown",
      response.statusText
    );
  }

  return (await response.text()) as unknown as T;
}

/**
 * API client methods
 */
export const apiClient = {
  /**
   * GET request
   */
  async get<T>(url: string, options?: RequestOptions, session?: AuthSession | null): Promise<T> {
    const response = await fetchWithAuth(url, { ...options, method: "GET" }, session);
    return parseResponse<T>(response);
  },

  /**
   * POST request
   */
  async post<T>(url: string, body?: unknown, options?: RequestOptions, session?: AuthSession | null): Promise<T> {
    const response = await fetchWithAuth(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        ...(options?.headers as any),
        "Content-Type": "application/json",
      },
    }, session);
    return parseResponse<T>(response);
  },

  /**
   * PUT request
   */
  async put<T>(url: string, body?: unknown, options?: RequestOptions, session?: AuthSession | null): Promise<T> {
    const response = await fetchWithAuth(url, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        ...(options?.headers as any),
        "Content-Type": "application/json",
      },
    }, session);
    return parseResponse<T>(response);
  },

  /**
   * PATCH request
   */
  async patch<T>(url: string, body?: unknown, options?: RequestOptions, session?: AuthSession | null): Promise<T> {
    const response = await fetchWithAuth(url, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        ...(options?.headers as any),
        "Content-Type": "application/json",
      },
    }, session);
    return parseResponse<T>(response);
  },

  /**
   * DELETE request
   */
  async delete<T>(url: string, options?: RequestOptions, session?: AuthSession | null): Promise<T> {
    const response = await fetchWithAuth(url, { ...options, method: "DELETE" }, session);
    return parseResponse<T>(response);
  },
};

/**
 * Utility to make API calls with current session
 */
export function withSession<T extends (...args: never[]) => Promise<never>>(
  fn: T,
  getSession: () => AuthSession | null
): T {
  return (async (...args: unknown[]) => {
    const session = getSession();
    return fn(...args, session);
  }) as T;
}
