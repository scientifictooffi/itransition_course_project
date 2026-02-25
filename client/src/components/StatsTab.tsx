import { useEffect, useState } from "react";

interface NumericFieldStats {
  fieldId: string;
  title: string;
  count: number;
  min: number;
  max: number;
  avg: number;
}

interface TextFieldValueStats {
  value: string;
  count: number;
}

interface TextFieldStats {
  fieldId: string;
  title: string;
  topValues: TextFieldValueStats[];
}

interface StatsResponse {
  itemsCount: number;
  numericFields: NumericFieldStats[];
  textFields: TextFieldStats[];
}

interface StatsTabProps {
  inventoryId: string;
}

export const StatsTab: React.FC<StatsTabProps> = ({ inventoryId }) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    if (!inventoryId) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/stats`);
      if (!response.ok) {
        throw new Error(`Failed to load statistics: ${response.status}`);
      }

      const data: StatsResponse = await response.json();
      setStats(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to load statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId]);

  return (
    <div className="bg-white rounded-3 shadow-sm p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="h5 mb-1">Statistics</h2>
          <p className="text-muted mb-0">
            Aggregated information about items and custom fields in this inventory.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => void loadStats()}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="text-danger mb-2" data-testid="inventory-stats-error">
          {error}
        </p>
      )}

      {stats && (
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="border rounded-3 p-3 h-100">
              <h3 className="h6 mb-2">Items</h3>
              <p className="display-6 mb-0">{stats.itemsCount}</p>
              <p className="text-muted small mb-0">Total items in this inventory.</p>
            </div>
          </div>
          <div className="col-md-8">
            <div className="border rounded-3 p-3 h-100">
              <h3 className="h6 mb-2">Summary</h3>
              <p className="text-muted small mb-0">
                Numeric fields show min / max / average values. Text fields show most frequent
                values.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading && !stats && <p className="text-muted mb-0">Loading statistics...</p>}

      {stats && (
        <>
          <div className="mb-3">
            <h3 className="h6 mb-2">Numeric fields</h3>
            {stats.numericFields.length === 0 ? (
              <p className="text-muted small mb-0">
                No numeric fields with values yet. Add numeric custom fields and fill in item data
                to see aggregates here.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col" style={{ width: "6rem" }}>
                        Count
                      </th>
                      <th scope="col" style={{ width: "8rem" }}>
                        Min
                      </th>
                      <th scope="col" style={{ width: "8rem" }}>
                        Max
                      </th>
                      <th scope="col" style={{ width: "8rem" }}>
                        Average
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.numericFields.map((field) => (
                      <tr key={field.fieldId}>
                        <td>{field.title}</td>
                        <td>{field.count}</td>
                        <td>{field.min}</td>
                        <td>{field.max}</td>
                        <td>{field.avg.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="h6 mb-2">Text fields</h3>
            {stats.textFields.length === 0 ? (
              <p className="text-muted small mb-0">
                No text fields with values yet. Add single-line or multi-line text fields and fill
                in item data to see most frequent values here.
              </p>
            ) : (
              <div className="row g-3">
                {stats.textFields.map((field) => (
                  <div key={field.fieldId} className="col-md-6">
                    <div className="border rounded-3 p-3 h-100">
                      <h4 className="h6 mb-2">{field.title}</h4>
                      {field.topValues.length === 0 ? (
                        <p className="text-muted small mb-0">No values yet.</p>
                      ) : (
                        <ul className="list-unstyled mb-0 small">
                          {field.topValues.map((entry) => (
                            <li key={entry.value} className="d-flex justify-content-between">
                              <span className="text-truncate me-2" title={entry.value}>
                                {entry.value}
                              </span>
                              <span className="badge bg-light text-muted">
                                {entry.count}×
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

