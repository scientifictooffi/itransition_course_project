import { Link } from "react-router-dom";
import type { InventorySummary } from "../types/inventory";

interface InventoryTableProps {
  title: string;
  inventories: InventorySummary[];
}

export const InventoryTable: React.FC<InventoryTableProps> = ({ title, inventories }) => {
  return (
    <section className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 mb-0">{title}</h2>
        {/* Здесь позже появится toolbar (bulk actions), без кнопок в строках */}
      </div>

      <div className="table-responsive rounded-3 shadow-sm bg-white">
        <table className="table table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th scope="col" style={{ width: "3rem" }}>
                <input type="checkbox" aria-label="Select all" />
              </th>
              <th scope="col">Name</th>
              <th scope="col">Description</th>
              <th scope="col">Owner</th>
              <th scope="col" style={{ width: "6rem" }}>
                Items
              </th>
            </tr>
          </thead>
          <tbody>
            {inventories.map((inventory) => (
              <tr key={inventory.id}>
                <td>
                  <input type="checkbox" aria-label="Select inventory" />
                </td>
                <td>
                  <Link to={`/inventories/${inventory.id}`} className="text-decoration-none">
                    {inventory.name}
                  </Link>
                </td>
                <td className="text-muted small">{inventory.description}</td>
                <td className="text-muted small">{inventory.ownerName}</td>
                <td>{inventory.itemsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

