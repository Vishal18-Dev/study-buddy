const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function fetcher<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, ...init } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...init,
    headers,
  });

  let data: { success: boolean; data?: T; error?: string };

  try {
    data = await response.json();
  } catch {
    throw new ApiError('Server returned an invalid response', response.status);
  }

  if (!data.success) {
    throw new ApiError(data.error || 'An unexpected error occurred', response.status);
  }

  return data.data as T;
}

// Helper for GET requests
export const get = <T>(endpoint: string, token?: string) =>
  fetcher<T>(endpoint, { method: 'GET', token });

// Helper for POST requests
export const post = <T>(endpoint: string, body: unknown, token?: string) =>
  fetcher<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

// Helper for PATCH requests
export const patch = <T>(endpoint: string, body: unknown, token?: string) =>
  fetcher<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });
