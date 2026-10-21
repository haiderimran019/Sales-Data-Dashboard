import { CalendarDays, RotateCcw } from "lucide-react";
import { useData } from "../context/DataContext";

export function DateRangeFilter() {
  const { range, setRange, dateBounds } = useData();
  const reset = () => setRange({ startDate: "", endDate: "" });

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none sm:items-end sm:gap-2">
      <div className="hidden items-center gap-2 text-sm text-muted lg:flex"><CalendarDays size={16} /> Date range</div>
      <label className="sr-only" htmlFor="range-start">Start date</label>
      <input id="range-start" className="control min-w-0 w-full flex-1 px-2 text-xs sm:w-auto sm:flex-none sm:px-3 sm:text-sm" type="date" value={range.startDate} min={dateBounds.startDate} max={range.endDate || dateBounds.endDate} onChange={(event) => setRange({ ...range, startDate: event.target.value })} />
      <span className="shrink-0 text-xs text-muted sm:text-sm">–</span>
      <label className="sr-only" htmlFor="range-end">End date</label>
      <input id="range-end" className="control min-w-0 w-full flex-1 px-2 text-xs sm:w-auto sm:flex-none sm:px-3 sm:text-sm" type="date" value={range.endDate} min={range.startDate || dateBounds.startDate} max={dateBounds.endDate} onChange={(event) => setRange({ ...range, endDate: event.target.value })} />
      {(range.startDate || range.endDate) && <button className="icon-button shrink-0" type="button" onClick={reset} aria-label="Clear date range"><RotateCcw size={15} /></button>}
    </div>
  );
}
