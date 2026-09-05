export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RegisterPayload {
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface JournalEntryPayload {
  entryDate: string;
  mood: 'bad' | 'neutral' | 'good' | 'very_good';
  note: string;
  tags: string[];
}

export class ApiClient {
  private tokenKey = 'auth_token';

  getToken(): string | null {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  setToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(this.tokenKey, token);
      } else {
        localStorage.removeItem(this.tokenKey);
      }
    } catch {
      // safe fallback if storage unavailable
    }
  }

  clearToken(): void {
    this.setToken(null);
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let code = 'ERROR';
      let message = response.statusText || 'Request failed';
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          code = errorData.error.code || code;
          message = errorData.error.message || message;
        }
      } catch {
        // use fallback statusText
      }
      throw new ApiError(response.status, code, message);
    }

    return (await response.json()) as T;
  }

  async register(data: RegisterPayload) {
    return this.request<{ user: { id: string; email: string } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginPayload) {
    const res = await this.request<{ token: string; user: { id: string; email: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async me() {
    return this.request<{ userId: string; email: string }>('/api/auth/me', {
      method: 'GET',
    });
  }

  async saveJournalEntry(entry: JournalEntryPayload) {
    return this.request<{ success: boolean; entry: JournalEntryPayload }>(`/api/journal/entries/${entry.entryDate}`, {
      method: 'PUT',
      body: JSON.stringify({
        mood: entry.mood,
        notes: entry.note,
        tags: entry.tags,
      }),
    });
  }
}

export const api = new ApiClient();
