import { InventoryTable } from "../components/InventoryTable";
import type { InventorySummary } from "../types/inventory";

const ownedMock: InventorySummary[] = [
  {
    id: "1",
    name: "Office laptops",
    description: "Company laptops and notebooks.",
    ownerName: "You",
    itemsCount: 42,
    tags: ["equipment", "laptop"],
  },
];

const writableMock: InventorySummary[] = [
  {
    id: "2",
    name: "Library books",
    description: "Public library collection.",
    ownerName: "Bob",
    itemsCount: 320,
    tags: ["books"],
  },
];

export const ProfilePage: React.FC = () => {
  return (
    <div className="container-fluid">
      <section className="mb-4">
        <h1 className="h4 mb-1">My inventories</h1>
        <p className="text-muted mb-3">
          Here you will manage inventories you own and inventories where you have write access.
        </p>
      </section>

      <InventoryTable title="Owned inventories" inventories={ownedMock} />
      <InventoryTable title="Inventories with write access" inventories={writableMock} />
    </div>
  );
};


