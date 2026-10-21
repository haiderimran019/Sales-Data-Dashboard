import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { BarChart3, BookOpenText, Boxes, ChevronRight, LayoutDashboard, Menu, Moon, Sun, Upload, UsersRound, WalletCards } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { DateRangeFilter } from "./DateRangeFilter";
import { useData } from "../context/DataContext";
import { classNames } from "../lib/utils";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/sales", label: "Sales analysis", icon: BarChart3 },
  { to: "/profitability", label: "Profitability", icon: WalletCards },
  { to: "/customers", label: "Customers", icon: UsersRound },
  { to: "/products", label: "Product explorer", icon: Boxes },
  { to: "/insights", label: "Insights", icon: BookOpenText },
];

const pageTitles: Record<string, string> = {
  "/": "Executive dashboard", "/sales": "Sales analysis", "/profitability": "Profitability", "/customers": "Customers", "/products": "Product explorer", "/insights": "Insights & data story",
};

export function AppShell({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const fileInput = useRef<HTMLInputElement>(null);
  const { importCsv, sourceName } = useData();

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

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {isOpen && <button className="fixed inset-0 z-30 bg-slate-950/25 lg:hidden" aria-label="Close navigation" onClick={() => setIsOpen(false)} />}
      <aside className={classNames("fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-[#111827] px-4 py-5 text-slate-100 shadow-[8px_0_30px_rgba(15,23,42,0.06)] transition-transform lg:translate-x-0", isOpen ? "translate-x-0" : "-translate-x-full")}>
        <NavLink to="/" className="flex items-center gap-3 px-2 text-base font-semibold tracking-tight text-white">
          <span className="brand-mark" aria-hidden="true" />
          <span className="flex flex-col leading-none">
            <span className="text-[10px] uppercase tracking-[0.22em] text-slate-300">Superstore</span>
            <span className="mt-1 text-lg font-semibold tracking-[-0.06em]">Insights</span>
          </span>
        </NavLink>
        <p className="mt-8 px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Analytics</p>
        <nav className="mt-3 space-y-1" aria-label="Dashboard pages">
          {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => classNames("nav-link", isActive && "nav-link-active")}><Icon size={17} />{label}</NavLink>)}
        </nav>
        <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-white">Portfolio project</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Retail performance analysis built from 9,994 Superstore records.</p>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 flex-col gap-2 border-b border-line bg-white/95 px-3 py-2 backdrop-blur dark:bg-[#111827]/95 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3 md:px-7">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted"><button className="icon-button lg:hidden" type="button" onClick={() => setIsOpen(true)} aria-label="Open navigation" aria-expanded={isOpen}><Menu size={18} /></button><span className="hidden sm:inline">Analytics</span><ChevronRight className="hidden sm:block" size={15} /><span className="truncate font-medium text-ink">{pageTitles[location.pathname]}</span></div>
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto"><DateRangeFilter /><span className="hidden max-w-28 truncate text-xs text-muted xl:inline" title={sourceName}>{sourceName}</span><input ref={fileInput} className="sr-only" type="file" accept=".csv,text/csv" onChange={handleImport} /><button className="secondary-button shrink-0 px-2 sm:px-3" type="button" onClick={() => fileInput.current?.click()} aria-label="Import CSV file" title={`Current file: ${sourceName}`}><Upload size={16} /><span className="hidden sm:inline">Import CSV</span></button><button className="icon-button shrink-0" type="button" onClick={() => setIsDark((current) => !current)} aria-label="Toggle color theme">{isDark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-7 md:px-7">{children}</main>
      </div>
    </div>
  );
}
