import { InventoryTable } from "../components/InventoryTable";
import { TagCloud } from "../components/TagCloud";
import type { InventorySummary } from "../types/inventory";

type Language = "en" | "ru";

interface HomePageProps {
  language: Language;
}

const latestInventoriesMock: InventorySummary[] = [
  {
    id: "1",
    name: "Office laptops",
    description: "Company laptops and notebooks.",
    ownerName: "Alice",
    itemsCount: 42,
    tags: ["equipment", "laptop"],
  },
  {
    id: "2",
    name: "Library books",
    description: "Public library collection.",
    ownerName: "Bob",
    itemsCount: 320,
    tags: ["books"],
  },
];

const popularInventoriesMock: InventorySummary[] = [
  {
    id: "2",
    name: "Library books",
    description: "Public library collection.",
    ownerName: "Bob",
    itemsCount: 320,
    tags: ["books"],
  },
  {
    id: "3",
    name: "HR documents",
    description: "Employee contracts and policies.",
    ownerName: "Carol",
    itemsCount: 85,
    tags: ["documents", "hr"],
  },
];

const tagsMock = [
  { id: "equipment", label: "equipment", count: 12 },
  { id: "laptop", label: "laptop", count: 7 },
  { id: "books", label: "books", count: 15 },
  { id: "documents", label: "documents", count: 9 },
  { id: "hr", label: "hr", count: 4 },
];

export const HomePage: React.FC<HomePageProps> = ({ language }) => {
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
          </section>

          <InventoryTable title="Latest inventories" inventories={latestInventoriesMock} />
          <InventoryTable title="Top 5 popular inventories" inventories={popularInventoriesMock} />
        </div>

        <div className="col-lg-4">
          <TagCloud tags={tagsMock} />
        </div>
      </div>
    </div>
  );
};

