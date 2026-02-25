import { FormEvent, useEffect, useState } from "react";
import { InventoryTable } from "../components/InventoryTable";
import type { InventorySummary } from "../types/inventory";

interface ProfileResponseDto {
  owned: InventorySummary[];
  writable: InventorySummary[];
}

export const ProfilePage: React.FC = () => {
  const [owned, setOwned] = useState<InventorySummary[]>([]);
  const [writable, setWritable] = useState<InventorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
  const demoEmail = "demo@example.com";

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${apiBase}/api/profile?userEmail=${encodeURIComponent(demoEmail)}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to load profile: ${response.status}`);
      }

      const data: ProfileResponseDto = await response.json();
      setOwned(data.owned);
      setWritable(data.writable);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to load profile data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateInventory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`${apiBase}/api/inventories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: "EQUIPMENT",
          isPublic: false,
          ownerEmail: demoEmail,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create inventory: ${response.status}`);
      }

      setNewTitle("");
      setNewDescription("");
      await loadProfile();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to create inventory.");
    }
  };

  return (
    <div className="container-fluid">
      <section className="mb-4">
        <h1 className="h4 mb-1">My inventories</h1>
        <p className="text-muted mb-3">
          Here you will manage inventories you own and inventories where you have write access.
        </p>

        <form className="row g-2 align-items-end" onSubmit={handleCreateInventory}>
          <div className="col-md-4">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-control"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="New inventory title"
            />
          </div>
          <div className="col-md-5">
            <label className="form-label">Description</label>
            <input
              type="text"
              className="form-control"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-primary w-100">
              Create inventory
            </button>
          </div>
        </form>

        {loading && <p className="text-muted mt-2 mb-0">Loading...</p>}
        {error && (
          <p className="text-danger mt-2 mb-0" data-testid="profile-error">
            {error}
          </p>
        )}
      </section>

      <InventoryTable title="Owned inventories" inventories={owned} />
      <InventoryTable title="Inventories with write access" inventories={writable} />
    </div>
  );
};

