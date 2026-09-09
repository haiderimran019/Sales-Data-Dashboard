import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type User = {
  id: string;
  email: string;
  display_name: string | null;
  profile_image_url: string | null;
  last_login_at: string | null;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "unavailable";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  login: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function fetchCurrentUser(signal: AbortSignal): Promise<User | null> {
  const response = await fetch(`${apiUrl}/api/me`, { credentials: "include", signal });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Authentication service unavailable");
  return response.json() as Promise<User>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);
    fetchCurrentUser(controller.signal)
      .then((currentUser) => {
        setUser(currentUser);
        setStatus(currentUser ? "authenticated" : "unauthenticated");
      })
      .catch(() => setStatus("unavailable"))
      .finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const login = () => {
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(`${apiUrl}/api/auth/google?return_to=${encodeURIComponent(returnTo)}`);
  };

  const logout = async () => {
    await fetch(`${apiUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    setStatus("unauthenticated");
  };

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
