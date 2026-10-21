import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Lightbulb, MapPinned, Tag, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { ChartCard } from "../components/ChartCard";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { customerSummary, groupRows } from "../lib/analytics";
import { currency, percent } from "../lib/utils";

export function InsightsPage() {
  const { filteredRows, isLoading, error } = useData();
  const insights = useMemo(() => {
    const subcategories = groupRows(filteredRows, (row) => row.subCategory).sort((a, b) => a.profit - b.profit);
    const regions = groupRows(filteredRows, (row) => row.region).sort((a, b) => b.profit - a.profit);
    const categories = groupRows(filteredRows, (row) => row.category).sort((a, b) => b.sales - a.sales);
    const discounts = [...new Set(filteredRows.map((row) => row.discount))].map((discount) => { const rows = filteredRows.filter((row) => row.discount === discount); return { discount, sales: rows.reduce((total, row) => total + row.sales, 0), profit: rows.reduce((total, row) => total + row.profit, 0) }; }).sort((a, b) => a.profit - b.profit);
    const customers = customerSummary(filteredRows).sort((a, b) => b.sales - a.sales);
    const biggestLoss = subcategories[0];
    const bestRegion = regions[0];
    const leader = categories[0];
    const riskyDiscount = discounts[0];
    const topCustomer = customers[0];
    return [
      { icon: AlertTriangle, title: `${biggestLoss?.label ?? "A sub-category"} is the clearest profit risk`, text: `${biggestLoss?.label ?? "This sub-category"} contributes ${currency(biggestLoss?.profit ?? 0)} in total profit. Its margin is ${percent((biggestLoss?.profit ?? 0) / Math.max(biggestLoss?.sales ?? 0, 1) * 100)}, making it the first place to investigate pricing, cost, and discounting.`, to: "/profitability", link: "Inspect profitability" },
      { icon: Tag, title: `A ${(riskyDiscount?.discount ?? 0) * 100}% discount level needs attention`, text: `This discount level produces ${currency(riskyDiscount?.profit ?? 0)} profit on ${currency(riskyDiscount?.sales ?? 0)} of sales. Review whether promotions at this level create sustainable contribution margin.`, to: "/profitability", link: "Review discount impact" },
      { icon: MapPinned, title: `${bestRegion?.label ?? "The leading region"} leads the selected period`, text: `It delivers ${currency(bestRegion?.sales ?? 0)} in sales and ${currency(bestRegion?.profit ?? 0)} profit. Capture the regional mix and operating practices behind this performance before scaling it.`, to: "/sales", link: "Compare regions" },
      { icon: Lightbulb, title: `${leader?.label ?? "The leading category"} is the revenue anchor`, text: `It produces ${currency(leader?.sales ?? 0)} of revenue, or ${percent((leader?.sales ?? 0) / Math.max(filteredRows.reduce((total, row) => total + row.sales, 0), 1) * 100)} of selected sales. Pair its growth plan with a margin check.`, to: "/sales", link: "Explore categories" },
      { icon: UsersRound, title: `${topCustomer?.label ?? "A top customer"} is the highest-value account`, text: `This customer has ${currency(topCustomer?.sales ?? 0)} in sales across ${topCustomer?.orders ?? 0} orders. High-value account retention should be treated as a commercial priority.`, to: "/customers", link: "View customers" },
    ];
  }, [filteredRows]);
  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  return <>
    <PageHeader eyebrow="What stands out" title="The signal from the current business view." description="These observations are generated from the selected period and point to the pages where each issue can be validated in more detail." />
    {!filteredRows.length ? <EmptyState /> : <div className="grid gap-4 xl:grid-cols-2">{insights.map(({ icon: Icon, title, text, to, link }) => <ChartCard key={title} title={title}><div className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Icon size={19} /></div><div><p className="text-sm leading-6 text-muted">{text}</p><Link className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline" to={to}>{link}<ArrowRight size={15} /></Link></div></div></ChartCard>)}</div>}
  </>;
}
