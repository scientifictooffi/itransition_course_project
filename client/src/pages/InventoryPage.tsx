import { useState } from "react";
import { useParams } from "react-router-dom";
import { Nav } from "react-bootstrap";

type InventoryTab =
  | "items"
  | "discussion"
  | "settings"
  | "customId"
  | "access"
  | "fields"
  | "stats";

export const InventoryPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<InventoryTab>("items");

  const inventoryName = `Inventory ${params.id}`;

  return (
    <div className="container-fluid">
      <section className="mb-3">
        <h1 className="h4 mb-1">{inventoryName}</h1>
        <p className="text-muted mb-0">
          This is a placeholder inventory page. Tabs and layout follow the course requirements.
        </p>
      </section>

      <Nav variant="tabs" activeKey={activeTab} onSelect={(key) => setActiveTab(key as InventoryTab)}>
        <Nav.Item>
          <Nav.Link eventKey="items">Items</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="discussion">Discussion</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="settings">General settings</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="customId">Custom ID</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="access">Access</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="fields">Fields</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="stats">Stats</Nav.Link>
        </Nav.Item>
      </Nav>

      <div className="mt-3">
        {activeTab === "items" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-semibold">Items</span>
              <div className="btn-toolbar gap-2">
                {/* Позже здесь будет toolbar: Add item, Delete selected, без кнопок в строках */}
                <button type="button" className="btn btn-sm btn-primary">
                  Add item
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col" style={{ width: "3rem" }}>
                      <input type="checkbox" aria-label="Select all items" />
                    </th>
                    <th scope="col">Custom ID</th>
                    <th scope="col">Title</th>
                    <th scope="col">Created by</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <input type="checkbox" aria-label="Select item" />
                    </td>
                    <td>BK-000001</td>
                    <td>Example item</td>
                    <td>Alice</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "discussion" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">Discussion</h2>
            <p className="text-muted mb-0">
              Here will be linear posts with Markdown, auto-updating every few seconds.
            </p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">General settings</h2>
            <p className="text-muted mb-0">Title, description (Markdown), category, image and tags.</p>
          </div>
        )}

        {activeTab === "customId" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">Custom ID format</h2>
            <p className="text-muted mb-0">
              Here will be drag-and-drop editor for ID elements and live preview of resulting ID.
            </p>
          </div>
        )}

        {activeTab === "access" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">Access settings</h2>
            <p className="text-muted mb-0">
              Here will be public/private switch and sortable list of users with autocomplete.
            </p>
          </div>
        )}

        {activeTab === "fields" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">Fields</h2>
            <p className="text-muted mb-0">
              Here will be fixed and custom fields configuration with drag-and-drop ordering.
            </p>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">Statistics</h2>
            <p className="text-muted mb-0">
              Here will be item counts, numeric averages/ranges and most frequent string values.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

