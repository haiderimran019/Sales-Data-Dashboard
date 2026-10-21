import { HashRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DataProvider } from "./context/DataContext";
import { CustomersPage } from "./pages/CustomersPage";
import { InsightsPage } from "./pages/InsightsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProfitabilityPage } from "./pages/ProfitabilityPage";
import { SalesPage } from "./pages/SalesPage";

export default function App() {
  return (
    <HashRouter>
      <DataProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/profitability" element={<ProfitabilityPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
          </Routes>
        </AppShell>
      </DataProvider>
    </HashRouter>
  );
}
