import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type User = {
  id: string;
  email: string;
  display_name: string | null;
  profile_image_url: string | null;
  last_login_at: string | null;
};

/**
 * `standalone` is the normal state for the published dashboard: no API base URL
 * is configured, so the app runs entirely in the browser against the bundled
 * dataset and never attempts a network call. The remaining states only occur
 * when VITE_API_URL points at a running backend.
 */
type AuthStatus = "standalone" | "loading" | "authenticated" | "unauthenticated" | "unreachable";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  /** True when a backend is configured and sign-in is therefore meaningful. */
  backendConfigured: boolean;
  login: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const configuredApiUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");
/**
 * Only talk to a backend that was explicitly configured at build time.
 * Defaulting to localhost meant the deployed site issued a blocked
 * mixed-content request on every page load and briefly rendered a sign-in
 * screen that could never succeed.
 */
const backendConfigured = configuredApiUrl.length > 0;

async function fetchCurrentUser(signal: AbortSignal): Promise<User | null> {
  const response = await fetch(`${configuredApiUrl}/api/me`, {
    credentials: "include",
    signal,
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Authentication service unavailable");
  return (await response.json()) as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(backendConfigured ? "loading" : "standalone");

  useEffect(() => {
    if (!backendConfigured) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);

    fetchCurrentUser(controller.signal)
      .then((currentUser) => {
        setUser(currentUser);
        setStatus(currentUser ? "authenticated" : "unauthenticated");
      })
      .catch(() => setStatus("unreachable"))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const login = () => {
    if (!backendConfigured) return;
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(
      `${configuredApiUrl}/api/auth/google?return_to=${encodeURIComponent(returnTo)}`,
    );
  };

  const logout = async () => {
    if (!backendConfigured) return;
    try {
      await fetch(`${configuredApiUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  };

  return (
    <AuthContext.Provider value={{ user, status, backendConfigured, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
