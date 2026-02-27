import { useEffect, useState } from "react";

type CustomIdElementType =
  | "FIXED_TEXT"
  | "RANDOM_20_BITS"
  | "RANDOM_32_BITS"
  | "RANDOM_6_DIGITS"
  | "RANDOM_9_DIGITS"
  | "GUID"
  | "DATETIME"
  | "SEQUENCE";

interface CustomIdElement {
  id?: string;
  type: CustomIdElementType;
  orderIndex: number;
  fixedText?: string | null;
  numberWidth?: number | null;
}

interface CustomIdTabProps {
  inventoryId: string;
  canEdit: boolean;
}

export const CustomIdTab: React.FC<CustomIdTabProps> = ({ inventoryId, canEdit }) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  const [elements, setElements] = useState<CustomIdElement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  const loadFormat = async () => {
    if (!inventoryId) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/custom-id`);
      if (!response.ok) {
        throw new Error(`Failed to load custom ID format: ${response.status}`);
      }

      const data: { elements: CustomIdElement[] } = await response.json();
      const sorted = [...data.elements].sort((a, b) => a.orderIndex - b.orderIndex);
      setElements(sorted);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to load custom ID format.");
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    if (!inventoryId) return;
    try {
      setPreviewLoading(true);
      setError(null);

      const response = await fetch(
        `${apiBase}/api/inventories/${inventoryId}/custom-id/preview`,
      );
      if (!response.ok) {
        throw new Error(`Failed to load preview: ${response.status}`);
      }

      const data: { preview: string } = await response.json();
      setPreview(data.preview);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to load custom ID preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    void loadFormat();
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId]);

  const handleAddElement = () => {
    if (!canEdit) return;
    setElements((prev) => [
      ...prev,
      {
        type: "FIXED_TEXT",
        orderIndex: prev.length,
        fixedText: "INV-",
        numberWidth: null,
      },
    ]);
  };

  const handleChangeElement = <K extends keyof CustomIdElement>(
    index: number,
    key: K,
    value: CustomIdElement[K],
  ) => {
    if (!canEdit) return;
    setElements((prev) =>
      prev.map((element, i) => {
        if (i !== index) return element;
        const next: CustomIdElement = { ...element, [key]: value };

        if (key === "type") {
          if (value === "FIXED_TEXT") {
            next.fixedText = element.fixedText ?? "INV-";
            next.numberWidth = null;
          } else if (
            value === "RANDOM_6_DIGITS" ||
            value === "RANDOM_9_DIGITS" ||
            value === "SEQUENCE"
          ) {
            const defaultWidth =
              value === "RANDOM_6_DIGITS"
                ? 6
                : value === "RANDOM_9_DIGITS"
                  ? 9
                  : element.numberWidth ?? 6;
            next.numberWidth = defaultWidth;
            next.fixedText = null;
          } else {
            next.fixedText = null;
            next.numberWidth = null;
          }
        }

        return next;
      }),
    );
  };

  const handleMoveElement = (index: number, direction: -1 | 1) => {
    if (!canEdit) return;
    setElements((prev) => {
      const next = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= next.length) {
        return prev;
      }
      const [moved] = next.splice(index, 1);
      next.splice(newIndex, 0, moved);
      return next.map((element, idx) => ({ ...element, orderIndex: idx }));
    });
  };

  const handleRemoveElement = (index: number) => {
    if (!canEdit) return;
    setElements((prev) =>
      prev.filter((_, i) => i !== index).map((element, idx) => ({ ...element, orderIndex: idx })),
    );
  };

  const handleSave = async () => {
    if (!inventoryId || !canEdit) return;
    try {
      setSaving(true);
      setError(null);

      const payload = {
        elements: elements.map((element, index) => ({
          type: element.type,
          orderIndex: index,
          fixedText: element.fixedText ?? null,
          numberWidth:
            typeof element.numberWidth === "number" && !Number.isNaN(element.numberWidth)
              ? element.numberWidth
              : null,
        })),
      };

      const token = window.localStorage.getItem("authToken");
      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/custom-id`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to save custom ID format: ${response.status}`);
      }

      const data: { elements: CustomIdElement[] } = await response.json();
      const sorted = [...data.elements].sort((a, b) => a.orderIndex - b.orderIndex);
      setElements(sorted);
      await loadPreview();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to save custom ID format.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3 shadow-sm p-3">
      <h2 className="h5 mb-3">Custom ID format</h2>
      <p className="text-muted mb-3">
        Configure how item IDs are generated for this inventory. Elements are applied from left to
        right. Existing items keep their IDs.
      </p>

      {error && (
        <p className="text-danger mb-2" data-testid="inventory-custom-id-error">
          {error}
        </p>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="fw-semibold">ID elements</span>
        <div className="btn-toolbar gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => void loadFormat()}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={handleAddElement}
            disabled={!canEdit}
          >
            Add element
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSave}
            disabled={!canEdit || saving}
          >
            {saving ? "Saving..." : "Save format"}
          </button>
        </div>
      </div>

      {loading && <p className="text-muted mb-2">Loading format...</p>}

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
              <th scope="col">Options</th>
              <th scope="col" style={{ width: "10rem" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {elements.map((element, index) => (
              <tr key={element.id ?? index}>
                <td>{index + 1}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={element.type}
                    onChange={(event) =>
                      handleChangeElement(index, "type", event.target.value as CustomIdElementType)
                    }
                    disabled={!canEdit}
                  >
                    <option value="FIXED_TEXT">Fixed text</option>
                    <option value="RANDOM_20_BITS">Random 20-bit number</option>
                    <option value="RANDOM_32_BITS">Random 32-bit number</option>
                    <option value="RANDOM_6_DIGITS">Random 6-digit number</option>
                    <option value="RANDOM_9_DIGITS">Random 9-digit number</option>
                    <option value="GUID">GUID</option>
                    <option value="DATETIME">Date/time</option>
                    <option value="SEQUENCE">Sequence</option>
                  </select>
                </td>
                <td>
                  {element.type === "FIXED_TEXT" && (
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={element.fixedText ?? ""}
                      onChange={(event) =>
                        handleChangeElement(index, "fixedText", event.target.value)
                      }
                      placeholder="Fixed prefix, e.g. INV-"
                      disabled={!canEdit}
                    />
                  )}
                  {(element.type === "RANDOM_6_DIGITS" ||
                    element.type === "RANDOM_9_DIGITS" ||
                    element.type === "SEQUENCE") && (
                    <div className="d-flex align-items-center gap-2">
                      <label className="form-label mb-0 small">Width</label>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        className="form-control form-control-sm"
                        value={element.numberWidth ?? ""}
                        onChange={(event) =>
                          handleChangeElement(
                            index,
                            "numberWidth",
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  )}
                  {element.type !== "FIXED_TEXT" &&
                    element.type !== "RANDOM_6_DIGITS" &&
                    element.type !== "RANDOM_9_DIGITS" &&
                    element.type !== "SEQUENCE" && (
                      <span className="text-muted small">No additional options</span>
                  )}
                </td>
                <td>
                  <div className="btn-group btn-group-sm" role="group" aria-label="Reorder elements">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleMoveElement(index, -1)}
                      disabled={!canEdit || index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleMoveElement(index, 1)}
                      disabled={!canEdit || index === elements.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => handleRemoveElement(index)}
                      disabled={!canEdit}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {elements.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="text-muted text-center py-3">
                  No elements yet. Start by adding a fixed text prefix or a random number block.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border rounded-3 p-3 bg-light">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="fw-semibold">Preview</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => void loadPreview()}
            disabled={previewLoading}
          >
            {previewLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="mb-0">
          {preview ? (
            <span className="fw-monospace">{preview}</span>
          ) : (
            <span className="text-muted">Preview will appear here after you save the format.</span>
          )}
        </p>
        <p className="text-muted small mt-2 mb-0">
          Preview shows an example value generated using the current format. Actual IDs may differ
          due to random parts and sequence numbers.
        </p>
      </div>
    </div>
  );
};

