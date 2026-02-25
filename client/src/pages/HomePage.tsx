import { useEffect, useState } from "react";
import { InventoryTable } from "../components/InventoryTable";
import { TagCloud } from "../components/TagCloud";
import type { InventorySummary } from "../types/inventory";

type Language = "en" | "ru";

interface HomePageProps {
  language: Language;
}

interface TagDto {
  id: string;
  label: string;
  count: number;
}

interface HomeResponseDto {
  latestInventories: InventorySummary[];
  popularInventories: InventorySummary[];
  tags: TagDto[];
}

export const HomePage: React.FC<HomePageProps> = ({ language }) => {
  const [latestInventories, setLatestInventories] = useState<InventorySummary[]>([]);
  const [popularInventories, setPopularInventories] = useState<InventorySummary[]>([]);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
        const response = await fetch(`${apiBase}/api/home`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load home data: ${response.status}`);
        }

        const data: HomeResponseDto = await response.json();
        setLatestInventories(data.latestInventories);
        setPopularInventories(data.popularInventories);
        setTags(data.tags);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        // eslint-disable-next-line no-console
        console.error(err);
        setError("Failed to load data from server.");
      } finally {
        setLoading(false);
      }
    };

    void load();

    return () => controller.abort();
  }, []);

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-lg-8">
          <section className="mb-4">
            <h1 className="h4 mb-1">
              {language === "en"
                ? "Inventory management project"
                : "Проект системы управления инвентарём"}
            </h1>
            <p className="text-muted mb-3">
              {language === "en"
                ? "Latest inventories and the most popular ones. Data is mocked for now."
                : "Последние и самые популярные инвентари. Пока данные моковые."}
            </p>
            {loading && <p className="text-muted mb-0">Loading...</p>}
            {error && <p className="text-danger mb-0">{error}</p>}
          </section>

          <InventoryTable title="Latest inventories" inventories={latestInventories} />
          <InventoryTable title="Top 5 popular inventories" inventories={popularInventories} />
        </div>

        <div className="col-lg-4">
          <TagCloud tags={tags} />
        </div>
      </div>
    </div>
  );
};

