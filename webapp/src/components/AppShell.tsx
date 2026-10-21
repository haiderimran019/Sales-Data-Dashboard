import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  BarChart3,
  BrainCircuit,
  ChevronRight,
  Database,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Package,
  LogOut,
  Menu,
  Moon,
  Sun,
  TrendingUp,
  Upload,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { DateRangeFilter } from "./DateRangeFilter";
import { useData } from "../context/DataContext";
import { classNames } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { LoginPage } from "../pages/LoginPage";

const navigationGroups = [
  {
    title: "Workspace",
    items: [
      { to: "/", label: "Dashboard builder", icon: LayoutDashboard },
      { to: "/retail-overview", label: "Overview", icon: Gauge },
      { to: "/add-data", label: "Load data", icon: Upload },
    ],
  },
  {
    title: "Analysis",
    items: [
      { to: "/sales", label: "Revenue", icon: BarChart3 },
      { to: "/profitability", label: "Profit & margin", icon: WalletCards },
      { to: "/customers", label: "Customers", icon: UsersRound },
      { to: "/products", label: "Products", icon: Package },
      { to: "/insights", label: "Insights", icon: Lightbulb },
    ],
  },
  {
    title: "Modelling",
    items: [
      { to: "/forecasting", label: "Forecasting", icon: TrendingUp },
      { to: "/ai-analyst", label: "Automated findings", icon: BrainCircuit },
    ],
  },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard builder",
  "/retail-overview": "Overview",
  "/sales": "Revenue",
  "/profitability": "Profit & margin",
  "/customers": "Customers",
  "/products": "Products",
  "/insights": "Insights",
  "/ai-analyst": "Automated findings",
  "/forecasting": "Forecasting",
  "/history": "History",
  "/add-data": "Load data",
};

export function AppShell({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const fileInput = useRef<HTMLInputElement>(null);
  const { importCsv, sourceName } = useData();
  const { user, status, backendConfigured, logout } = useAuth();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void importCsv(file);
    event.target.value = "";
  };

  // Sign-in only gates the app when a backend is configured; the published
  // dashboard runs standalone against the bundled dataset.
  if (backendConfigured && status === "unauthenticated") return <LoginPage />;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {isOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          aria-label="Close navigation"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={classNames(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-white/10 bg-[#111827] px-4 py-5 text-slate-100 shadow-[8px_0_30px_rgba(15,23,42,0.12)] transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <NavLink to="/" className="flex items-center gap-3 px-2 text-base font-semibold tracking-tight text-white">
          <span className="brand-mark" aria-hidden="true" />
          <span className="flex flex-col leading-none">
            <span className="text-[10px] uppercase tracking-[0.24em] text-slate-400 font-bold">
              AUTOBOARD
            </span>
            <span className="mt-1 text-lg font-bold tracking-[-0.04em] text-white">
              Data Studio
            </span>
          </span>
        </NavLink>

        {/* Grouped Navigation */}
        <div className="mt-7 space-y-6">
          {navigationGroups.map((group) => (
            <div key={group.title}>
              <p className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {group.title}
              </p>
              <nav className="mt-2 space-y-0.5" aria-label={group.title}>
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      classNames(
                        "nav-link text-xs py-2 px-2.5",
                        isActive && "nav-link-active"
                      )
                    }
                  >
                    <Icon size={16} className="shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* User / Environment Status Footer */}
        <div className="mt-auto pt-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              <p className="truncate font-semibold text-white">
                {user?.display_name || "Executive Session"}
              </p>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {user?.email || `Active dataset: ${sourceName}`}
            </p>
            {user && (
              <button
                className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-300 hover:text-white"
                type="button"
                onClick={() => void logout()}
              >
                <LogOut size={13} /> Sign out
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Sticky Topbar */}
        <header className="sticky top-0 z-20 flex min-h-16 flex-col gap-2 border-b border-line bg-white/95 px-3 py-2 backdrop-blur dark:bg-[#0f172a]/95 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3 md:px-7">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <button
              className="icon-button lg:hidden"
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Open navigation"
              aria-expanded={isOpen}
            >
              <Menu size={18} />
            </button>
            <span className="hidden font-medium sm:inline">Autoboard</span>
            <ChevronRight className="hidden sm:block" size={15} />
            <span className="truncate font-bold text-ink">
              {pageTitles[location.pathname] || "Dashboard"}
            </span>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            {location.pathname !== "/" && <DateRangeFilter />}

            {/* Active Dataset Chip */}
            {location.pathname !== "/" && <span
              className="hidden max-w-36 truncate rounded-md border border-line bg-canvas px-2 py-1 text-[11px] font-medium text-muted xl:inline"
              title={sourceName}
            >
              <Database size={11} className="inline mr-1 text-brand" />
              {sourceName}
            </span>}

            {/* Custom CSV upload */}
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={handleImport}
            />
            {location.pathname !== "/" && <button
              className="secondary-button shrink-0 px-2 sm:px-3 text-xs"
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label="Import CSV file"
              title={`Active dataset: ${sourceName}`}
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>}

            {/* Theme Toggle */}
            <button
              className="icon-button shrink-0"
              type="button"
              onClick={() => setIsDark((current) => !current)}
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-7 md:px-7">{children}</main>
      </div>
    </div>
  );
}
