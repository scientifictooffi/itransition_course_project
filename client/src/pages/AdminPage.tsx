import { useEffect, useState } from "react";

type UserRole = "USER" | "ADMIN";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string;
}

export const AdminPage: React.FC = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      setSelectedIds(new Set());

      const token = window.localStorage.getItem("authToken");
      const response = await fetch(`${apiBase}/api/admin/users`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error(`Failed to load users: ${response.status}`);
      }

      const data: { users: AdminUser[] } = await response.json();
      setUsers(data.users);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelection = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const performBulkAction = async (path: string, method: "POST" | "DELETE") => {
    if (selectedIds.size === 0) return;
    try {
      setError(null);
      const token = window.localStorage.getItem("authToken");
      const response = await fetch(`${apiBase}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userIds: Array.from(selectedIds) }),
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Action failed: ${response.status}`);
      }

      await loadUsers();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Admin action failed.");
    }
  };

  const createdSorted = [...users].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="container-fluid">
      <section className="mb-3">
        <h1 className="h4 mb-1">Admin panel</h1>
        <p className="text-muted mb-0">
          User management: block, unblock, delete, add/remove admin role.
        </p>
      </section>

      {error && (
        <p className="text-danger mb-2" data-testid="admin-users-error">
          {error}
        </p>
      )}

      <div className="bg-white rounded-3 shadow-sm p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="fw-semibold">Users</span>
          <div className="btn-toolbar gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => void loadUsers()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => void performBulkAction("/api/admin/users/block", "POST")}
              disabled={selectedIds.size === 0}
            >
              Block selected
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={() => void performBulkAction("/api/admin/users/unblock", "POST")}
              disabled={selectedIds.size === 0}
            >
              Unblock selected
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => void performBulkAction("/api/admin/users/make-admin", "POST")}
              disabled={selectedIds.size === 0}
            >
              Make admin
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => void performBulkAction("/api/admin/users/remove-admin", "POST")}
              disabled={selectedIds.size === 0}
            >
              Remove admin
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => void performBulkAction("/api/admin/users", "DELETE")}
              disabled={selectedIds.size === 0}
            >
              Delete selected
            </button>
          </div>
        </div>

        {loading && <p className="text-muted mb-2">Loading users...</p>}

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th scope="col" style={{ width: "3rem" }}>
                  {/* Можно добавить select-all при желании */}
                </th>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col" style={{ width: "7rem" }}>
                  Role
                </th>
                <th scope="col" style={{ width: "7rem" }}>
                  Status
                </th>
                <th scope="col" style={{ width: "10rem" }}>
                  Created at
                </th>
              </tr>
            </thead>
            <tbody>
              {createdSorted.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Select user"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelection(user.id)}
                    />
                  </td>
                  <td>{user.name || "—"}</td>
                  <td className="text-muted small">{user.email}</td>
                  <td>
                    <span
                      className={`badge ${
                        user.role === "ADMIN" ? "bg-primary" : "bg-light text-muted"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        user.isBlocked ? "bg-danger" : "bg-success"
                      }`}
                    >
                      {user.isBlocked ? "Blocked" : "Active"}
                    </span>
                  </td>
                  <td className="text-muted small">
                    {new Date(user.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {createdSorted.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-muted text-center py-3">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

