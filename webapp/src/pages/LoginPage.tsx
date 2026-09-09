import { LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 text-ink">
      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm dark:bg-[#111827]">
        <div className="brand-mark mb-6 h-10 w-10" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Superstore Insights</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in to your analytics workspace</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Use your Google account to access projects and saved analysis history.</p>
        <button className="primary-button mt-7 w-full justify-center" type="button" onClick={login}>
          <LogIn size={17} />
          Continue with Google
        </button>
        <p className="mt-6 flex items-center gap-2 text-xs text-muted"><ShieldCheck size={14} /> Google handles your password securely.</p>
      </section>
    </main>
  );
}
