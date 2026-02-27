import { useEffect, useState } from "react";

type InventoryFieldType = "SINGLE_LINE_TEXT" | "MULTI_LINE_TEXT" | "NUMBER" | "LINK" | "BOOLEAN";

interface InventoryField {
  id?: string;
  type: InventoryFieldType;
  title: string;
  description?: string | null;
  showInTable: boolean;
  orderIndex: number;
}

interface FieldsTabProps {
  inventoryId: string;
}

const FIELD_TYPE_ORDER: InventoryFieldType[] = [
  "SINGLE_LINE_TEXT",
  "MULTI_LINE_TEXT",
  "NUMBER",
  "LINK",
  "BOOLEAN",
];

const FIELD_TYPE_LABELS: Record<InventoryFieldType, string> = {
  SINGLE_LINE_TEXT: "Single-line text",
  MULTI_LINE_TEXT: "Multi-line text",
  NUMBER: "Numeric",
  LINK: "Document/image link",
  BOOLEAN: "True/false (checkbox)",
};

const MAX_PER_TYPE = 3;

export const FieldsTab: React.FC<FieldsTabProps> = ({ inventoryId, canEdit }) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  const [fields, setFields] = useState<InventoryField[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const loadFields = async () => {
    if (!inventoryId) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/fields`);
      if (!response.ok) {
        throw new Error(`Failed to load fields: ${response.status}`);
      }

      const data: { fields: InventoryField[] } = await response.json();
      const sorted = [...data.fields].sort((a, b) => a.orderIndex - b.orderIndex);
      setFields(sorted);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to load fields.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId]);

  const computeTypeCounts = (): Record<InventoryFieldType, number> => {
    const counts: Record<InventoryFieldType, number> = {
      SINGLE_LINE_TEXT: 0,
      MULTI_LINE_TEXT: 0,
      NUMBER: 0,
      LINK: 0,
      BOOLEAN: 0,
    };
    for (const field of fields) {
      counts[field.type] += 1;
    }
    return counts;
  };

  const typeCounts = computeTypeCounts();
  const canAddMore = FIELD_TYPE_ORDER.some((type) => typeCounts[type] < MAX_PER_TYPE);

  const handleAddField = () => {
    if (!canEdit || !canAddMore) {
      return;
    }
    const nextType =
      FIELD_TYPE_ORDER.find((type) => typeCounts[type] < MAX_PER_TYPE) ?? "SINGLE_LINE_TEXT";

    setFields((prev) => [
      ...prev,
      {
        type: nextType,
        title: "",
        description: "",
        showInTable: true,
        orderIndex: prev.length,
      },
    ]);
  };

  const handleChangeField = <K extends keyof InventoryField>(
    index: number,
    key: K,
    value: InventoryField[K],
  ) => {
    if (!canEdit) return;
    setFields((prev) =>
      prev.map((field, i) => {
        if (i !== index) return field;
        return { ...field, [key]: value };
      }),
    );
  };

  const handleMoveField = (index: number, direction: -1 | 1) => {
    if (!canEdit) return;
    setFields((prev) => {
      const next = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= next.length) {
        return prev;
      }
      const [moved] = next.splice(index, 1);
      next.splice(newIndex, 0, moved);
      return next.map((field, idx) => ({ ...field, orderIndex: idx }));
    });
  };

  const handleRemoveField = (index: number) => {
    if (!canEdit) return;
    setFields((prev) =>
      prev.filter((_, i) => i !== index).map((field, idx) => ({ ...field, orderIndex: idx })),
    );
  };

  const handleSave = async () => {
    if (!inventoryId || !canEdit) return;
    try {
      setSaving(true);
      setError(null);

      const payload = {
        fields: fields.map((field, index) => ({
          type: field.type,
          title: field.title,
          description: field.description ?? null,
          showInTable: field.showInTable,
          orderIndex: index,
        })),
      };

      const token = window.localStorage.getItem("authToken");
      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/fields`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 400) {
        const payloadBody = (await response.json()) as { message?: string };
        setError(payloadBody.message ?? "Failed to save fields.");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to save fields: ${response.status}`);
      }

      const data: { fields: InventoryField[] } = await response.json();
      const sorted = [...data.fields].sort((a, b) => a.orderIndex - b.orderIndex);
      setFields(sorted);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to save fields.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3 shadow-sm p-3">
      <h2 className="h5 mb-3">Fields</h2>
      <p className="text-muted mb-2">
        Configure additional fields for items in this inventory. Fixed fields like ID, created by
        and created at are always present and cannot be removed.
      </p>

      {error && (
        <p className="text-danger mb-2" data-testid="inventory-fields-error">
          {error}
        </p>
      )}

      <div className="mb-3">
        <span className="fw-semibold small">Fixed fields (always present): </span>
        <span className="text-muted small">
          Custom ID, Created by, Created at. They will appear automatically on the item form.
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="fw-semibold">Custom fields</span>
        <div className="btn-toolbar gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => void loadFields()}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={handleAddField}
            disabled={!canEdit || !canAddMore}
          >
            Add field
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSave}
            disabled={!canEdit || saving}
          >
            {saving ? "Saving..." : "Save fields"}
          </button>
        </div>
      </div>

      {loading && <p className="text-muted mb-2">Loading fields...</p>}

      <div className="table-responsive mb-3">
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th scope="col" style={{ width: "3rem" }}>
                #
              </th>
              <th scope="col" style={{ width: "14rem" }}>
                Type
              </th>
              <th scope="col" style={{ width: "14rem" }}>
                Title
              </th>
              <th scope="col">Description</th>
              <th scope="col" style={{ width: "8rem" }}>
                Show in table
              </th>
              <th scope="col" style={{ width: "10rem" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id ?? index}>
                <td>{index + 1}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={field.type}
                    onChange={(event) =>
                      handleChangeField(index, "type", event.target.value as InventoryFieldType)
                    }
                    disabled={!canEdit}
                  >
                    {FIELD_TYPE_ORDER.map((type) => {
                      const isLimitReached =
                        typeCounts[type] >= MAX_PER_TYPE && field.type !== type;
                      return (
                        <option key={type} value={type} disabled={isLimitReached}>
                          {FIELD_TYPE_LABELS[type]}
                        </option>
                      );
                    })}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={field.title}
                    onChange={(event) =>
                      handleChangeField(index, "title", event.target.value)
                    }
                    placeholder="Field title"
                    disabled={!canEdit}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={field.description ?? ""}
                    onChange={(event) =>
                      handleChangeField(index, "description", event.target.value)
                    }
                    placeholder="Tooltip or hint (optional)"
                    disabled={!canEdit}
                  />
                </td>
                <td>
                  <div className="form-check d-flex justify-content-center">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={field.showInTable}
                      onChange={(event) =>
                        handleChangeField(index, "showInTable", event.target.checked)
                      }
                      disabled={!canEdit}
                    />
                  </div>
                </td>
                <td>
                  <div className="btn-group btn-group-sm" role="group" aria-label="Reorder fields">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleMoveField(index, -1)}
                      disabled={!canEdit || index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleMoveField(index, 1)}
                      disabled={!canEdit || index === fields.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => handleRemoveField(index)}
                      disabled={!canEdit}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {fields.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-muted text-center py-3">
                  No custom fields yet. You can add up to 3 fields of each type.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-muted small mb-0">
        Limits: up to 3 single-line text, 3 multi-line text, 3 numeric, 3 document/image link and 3
        true/false fields per inventory. The order controls how fields appear on the item form.
      </p>
    </div>
  );
};

