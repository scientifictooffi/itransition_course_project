import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { InventoryTable } from "../components/InventoryTable";
import type { InventorySummary } from "../types/inventory";

function useQueryParam(name: string): string {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  return params.get(name) ?? "";
}

export const SearchResultsPage: React.FC = () => {
  const query = useQueryParam("q");
  const tag = useQueryParam("tag");
  const [results, setResults] = useState<InventorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  useEffect(() => {
    const qTrimmed = query.trim();
    const tagTrimmed = tag.trim();

    if (!qTrimmed && !tagTrimmed) {
      setResults([]);
      setError(null);
      return;
    }

    const params = new URLSearchParams();
    if (qTrimmed) params.set("q", qTrimmed);
    if (tagTrimmed) params.set("tag", tagTrimmed);

    const url = `${apiBase}/api/search?${params.toString()}`;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to search: ${response.status}`);
        }

        const data: { inventories: InventorySummary[] } = await response.json();
        setResults(data.inventories);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError("Failed to load search results.");
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tag]);

  const hasQuery = query.trim().length > 0;
  const hasTag = tag.trim().length > 0;

  const queryLabel = hasQuery ? query.trim() : "—";
  const tagLabel = hasTag ? tag.trim() : "—";

  return (
    <div className="container-fluid">
      <section className="mb-4">
        <h1 className="h4 mb-1">Search results</h1>
        <p className="text-muted mb-1">
          Query: <code>{queryLabel}</code>
        </p>
        <p className="text-muted mb-3">
          Tag: <code>{tagLabel}</code>
        </p>
      </section>

      {loading && <p className="text-muted mb-2">Searching...</p>}
      {error && (
        <p className="text-danger mb-2" data-testid="search-error">
          {error}
        </p>
      )}

      <InventoryTable title="Matching inventories" inventories={results} />
      {!loading && !error && results.length === 0 && (hasQuery || hasTag) && (
        <p className="text-muted mt-3">No inventories matched your search.</p>
      )}
    </div>
  );
};

