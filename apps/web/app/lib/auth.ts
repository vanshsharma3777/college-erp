import { AUTH_SERVICE_URL } from "./config";

export interface CurrentUser {
  id: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  firstName: string;
  lastName: string;
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Login failed");
  }
}

// The access token cookie is httpOnly, so this is how the frontend learns
// who's logged in (and which role) without ever touching the token.
  export async function getCurrentUser(): Promise<CurrentUser | null> {
    const res = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.user as CurrentUser;
  }
