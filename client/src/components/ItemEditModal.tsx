import { useEffect, useState } from "react";

type InventoryFieldType =
  | "SINGLE_LINE_TEXT"
  | "MULTI_LINE_TEXT"
  | "NUMBER"
  | "LINK"
  | "BOOLEAN";

interface ItemFieldDto {
  fieldId: string;
  title: string;
  type: InventoryFieldType;
  description: string | null;
  valueString: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueLink: string | null;
}

interface ItemDto {
  id: string;
  inventoryId: string;
  customId: string;
  version: number;
  createdAt: string;
  createdByName: string;
  fields: ItemFieldDto[];
}

interface ItemEditModalProps {
  itemId: string;
  onClose: () => void;
  onSaved: () => void;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({ itemId, onClose, onSaved }) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  const [item, setItem] = useState<ItemDto | null>(null);
  const [customId, setCustomId] = useState<string>("");
  const [fields, setFields] = useState<ItemFieldDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [previewField, setPreviewField] = useState<ItemFieldDto | null>(null);

  const loadItem = async () => {
    if (!itemId) return;
    try {
      setLoading(true);
      setError(null);
      setConflict(null);

      const response = await fetch(`${apiBase}/api/items/${itemId}`);
      if (!response.ok) {
        throw new Error(`Failed to load item: ${response.status}`);
      }

      const data: ItemDto = await response.json();
      setItem(data);
      setCustomId(data.customId);
      setFields(data.fields);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to load item.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const handleFieldChange = (index: number, value: string | boolean) => {
    setFields((prev) =>
      prev.map((field, i) => {
        if (i !== index) return field;
        if (field.type === "NUMBER") {
          const num =
            value === "" ? null : Number.isNaN(Number(value)) ? field.valueNumber : Number(value);
          return { ...field, valueNumber: num };
        }
        if (field.type === "BOOLEAN") {
          return { ...field, valueBoolean: Boolean(value) };
        }
        if (field.type === "LINK") {
          return { ...field, valueLink: String(value) || null };
        }
        // text types
        return { ...field, valueString: String(value) || null };
      }),
    );
  };

  const handleSave = async () => {
    if (!item) return;
    try {
      setSaving(true);
      setError(null);
      setConflict(null);

      const payload = {
        customId: customId.trim() || item.customId,
        version: item.version,
        fields: fields.map((field) => ({
          fieldId: field.fieldId,
          valueString:
            field.type === "SINGLE_LINE_TEXT" || field.type === "MULTI_LINE_TEXT"
              ? field.valueString
              : null,
          valueNumber: field.type === "NUMBER" ? field.valueNumber : null,
          valueBoolean: field.type === "BOOLEAN" ? field.valueBoolean : null,
          valueLink: field.type === "LINK" ? field.valueLink : null,
        })),
      };

      const response = await fetch(`${apiBase}/api/items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        const payloadJson = (await response.json()) as { message: string; current?: ItemDto };
        setConflict(payloadJson.message || "Item was updated by someone else.");
        if (payloadJson.current) {
          setItem(payloadJson.current);
          setCustomId(payloadJson.current.customId);
          setFields(payloadJson.current.fields);
        }
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to save item: ${response.status}`);
      }

      const data: ItemDto = await response.json();
      setItem(data);
      setCustomId(data.customId);
      setFields(data.fields);
      onSaved();
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  if (!item) {
    return (
      <div className="modal d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Edit item</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {loading ? <p className="text-muted mb-0">Loading item...</p> : null}
              {error && (
                <p className="text-danger mb-0" data-testid="item-edit-error">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-lg" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit item {item.customId}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {error && (
              <p className="text-danger mb-2" data-testid="item-edit-error">
                {error}
              </p>
            )}
            {conflict && (
              <p className="text-warning mb-2" data-testid="item-edit-conflict">
                {conflict}
              </p>
            )}

            <form className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Custom ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={customId}
                  onChange={(event) => setCustomId(event.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Created by</label>
                <input
                  type="text"
                  className="form-control"
                  value={item.createdByName}
                  disabled
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Created at</label>
                <input
                  type="text"
                  className="form-control"
                  value={new Date(item.createdAt).toLocaleString()}
                  disabled
                />
              </div>

              <div className="col-12">
                <hr />
              </div>

              {fields.map((field, index) => (
                <div key={field.fieldId} className="col-md-6">
                  <label className="form-label">
                    {field.title}{" "}
                    {field.type === "BOOLEAN" && (
                      <span className="text-muted small">(checkbox)</span>
                    )}
                  </label>
                  {field.description && (
                    <div className="form-text mb-1">{field.description}</div>
                  )}
                  {field.type === "SINGLE_LINE_TEXT" && (
                    <input
                      type="text"
                      className="form-control"
                      value={field.valueString ?? ""}
                      onChange={(event) => handleFieldChange(index, event.target.value)}
                    />
                  )}
                  {field.type === "MULTI_LINE_TEXT" && (
                    <textarea
                      className="form-control"
                      rows={3}
                      value={field.valueString ?? ""}
                      onChange={(event) => handleFieldChange(index, event.target.value)}
                    />
                  )}
                  {field.type === "NUMBER" && (
                    <input
                      type="number"
                      className="form-control"
                      value={field.valueNumber ?? ""}
                      onChange={(event) => handleFieldChange(index, event.target.value)}
                    />
                  )}
                  {field.type === "LINK" && (
                    <div className="input-group">
                      <input
                        type="url"
                        className="form-control"
                        value={field.valueLink ?? ""}
                        onChange={(event) => handleFieldChange(index, event.target.value)}
                        placeholder="https://..."
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        disabled={!field.valueLink}
                        onClick={() => setPreviewField(field)}
                      >
                        Preview
                      </button>
                    </div>
                  )}
                  {field.type === "BOOLEAN" && (
                    <div className="form-check">
                      <input
                        id={`field-${field.fieldId}`}
                        type="checkbox"
                        className="form-check-input"
                        checked={Boolean(field.valueBoolean)}
                        onChange={(event) => handleFieldChange(index, event.target.checked)}
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`field-${field.fieldId}`}
                      >
                        {field.title}
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </form>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
      {previewField && previewField.valueLink && (
        <div className="modal d-block" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Preview: {previewField.title}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setPreviewField(null)}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted small">
                  Document link:&nbsp;
                  <a href={previewField.valueLink} target="_blank" rel="noreferrer">
                    {previewField.valueLink}
                  </a>
                </p>
                <div
                  className="border rounded-3 bg-light d-flex justify-content-center align-items-center"
                  style={{ minHeight: "300px" }}
                >
                  {/\.(png|jpe?g|gif|webp)$/i.test(previewField.valueLink) ? (
                    <img
                      src={previewField.valueLink}
                      alt={previewField.title}
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <iframe
                      src={previewField.valueLink}
                      title={previewField.title}
                      style={{ width: "100%", height: "400px", border: "none" }}
                    />
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPreviewField(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

