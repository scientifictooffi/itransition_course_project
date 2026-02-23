import { useLocation } from "react-router-dom";
import { InventoryTable } from "../components/InventoryTable";
import type { InventorySummary } from "../types/inventory";

const searchMock: InventorySummary[] = [
  {
    id: "1",
    name: "Office laptops",
    description: "Company laptops and notebooks.",
    ownerName: "Alice",
    itemsCount: 42,
    tags: ["equipment", "laptop"],
  },
];

function useQueryParam(name: string): string {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  return params.get(name) ?? "";
}

export const SearchResultsPage: React.FC = () => {
  const query = useQueryParam("q");

  return (
    <div className="container-fluid">
      <section className="mb-4">
        <h1 className="h4 mb-1">Search results</h1>
        <p className="text-muted mb-3">
          Query: <code>{query || "—"}</code>
        </p>
      </section>

      <InventoryTable title="Matching inventories" inventories={searchMock} />
    </div>
  );
};

