import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Nav } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CustomIdTab } from "../components/CustomIdTab";
import { FieldsTab } from "../components/FieldsTab";
import { StatsTab } from "../components/StatsTab";
import { ItemEditModal } from "../components/ItemEditModal";

type InventoryTab =
  | "items"
  | "discussion"
  | "settings"
  | "customId"
  | "access"
  | "fields"
  | "stats";

interface InventoryItem {
  id: string;
  customId: string;
  createdByName: string;
  likesCount: number;
  likedByCurrentUser: boolean;
}

interface DiscussionPost {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

type InventoryCategory = "EQUIPMENT" | "FURNITURE" | "BOOK" | "OTHER";

interface InventoryDetails {
  id: string;
  title: string;
  description: string;
  category: InventoryCategory;
  isPublic: boolean;
  version: number;
  tags: string[];
  imageUrl: string | null;
}

interface AccessUser {
  id: string;
  name: string | null;
  email: string;
}

export const InventoryPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<InventoryTab>("items");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [discussionPosts, setDiscussionPosts] = useState<DiscussionPost[]>([]);
  const [discussionLoading, setDiscussionLoading] = useState<boolean>(false);
  const [discussionError, setDiscussionError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState<string>("");

  const [inventoryDetails, setInventoryDetails] = useState<InventoryDetails | null>(null);
  const [settingsTitle, setSettingsTitle] = useState<string>("");
  const [settingsDescription, setSettingsDescription] = useState<string>("");
  const [settingsCategory, setSettingsCategory] = useState<InventoryCategory>("EQUIPMENT");
  const [settingsIsPublic, setSettingsIsPublic] = useState<boolean>(false);
  const [settingsImageUrl, setSettingsImageUrl] = useState<string>("");
  const [settingsTags, setSettingsTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [tagSuggestionsLoading, setTagSuggestionsLoading] = useState<boolean>(false);
  const [settingsDirty, setSettingsDirty] = useState<boolean>(false);
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsConflict, setSettingsConflict] = useState<string | null>(null);
  const [settingsLastSavedAt, setSettingsLastSavedAt] = useState<string | null>(null);

  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [accessLoading, setAccessLoading] = useState<boolean>(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSortBy, setAccessSortBy] = useState<"name" | "email">("name");
  const [accessSelectedIds, setAccessSelectedIds] = useState<Set<string>>(new Set());
  const [accessQuery, setAccessQuery] = useState<string>("");
  const [accessSuggestions, setAccessSuggestions] = useState<AccessUser[]>([]);
  const [accessSuggestionsLoading, setAccessSuggestionsLoading] = useState<boolean>(false);

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  const inventoryId = params.id ?? "";

  const inventoryName = `Inventory ${params.id}`;

  const loadInventoryDetails = async () => {
    if (!inventoryId) return;
    try {
      setSettingsError(null);
      setSettingsConflict(null);

      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}`);
      if (!response.ok) {
        throw new Error(`Failed to load inventory: ${response.status}`);
      }

      const data: InventoryDetails = await response.json();
      setInventoryDetails(data);
      setSettingsTitle(data.title);
      setSettingsDescription(data.description);
      setSettingsCategory(data.category);
      setSettingsIsPublic(data.isPublic);
      setSettingsImageUrl(data.imageUrl ?? "");
      setSettingsTags(data.tags);
      setSettingsDirty(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setSettingsError("Failed to load inventory settings.");
    }
  };

  const loadAccess = async () => {
    if (!inventoryId) return;
    try {
      setAccessLoading(true);
      setAccessError(null);
      setAccessSelectedIds(new Set());

      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/access`);
      if (!response.ok) {
        throw new Error(`Failed to load access: ${response.status}`);
      }

      const data: { isPublic: boolean; users: AccessUser[] } = await response.json();
      setSettingsIsPublic(data.isPublic);
      setAccessUsers(data.users);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setAccessError("Failed to load access list.");
    } finally {
      setAccessLoading(false);
    }
  };

  const loadAccessSuggestions = async (query: string) => {
    if (!query.trim()) {
      setAccessSuggestions([]);
      return;
    }

    try {
      setAccessSuggestionsLoading(true);
      const response = await fetch(
        `${apiBase}/api/users/search?query=${encodeURIComponent(query.trim())}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to search users: ${response.status}`);
      }

      const data: { users: AccessUser[] } = await response.json();
      setAccessSuggestions(
        data.users.filter((user) => !accessUsers.some((u) => u.id === user.id)),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setAccessSuggestionsLoading(false);
    }
  };

  const loadItems = async () => {
    if (!inventoryId) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/items`);
      if (!response.ok) {
        throw new Error(`Failed to load items: ${response.status}`);
      }

      const data: { items: InventoryItem[] } = await response.json();
      setItems(data.items);
      setSelectedItemIds(new Set());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to load items.");
    } finally {
      setLoading(false);
    }
  };

  const loadDiscussion = async () => {
    if (!inventoryId) return;
    try {
      setDiscussionLoading(true);
      setDiscussionError(null);

      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/discussion`);
      if (!response.ok) {
        throw new Error(`Failed to load discussion: ${response.status}`);
      }

      const data: { posts: DiscussionPost[] } = await response.json();
      setDiscussionPosts(data.posts);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setDiscussionError("Failed to load discussion.");
    } finally {
      setDiscussionLoading(false);
    }
  };

  useEffect(() => {
    void loadInventoryDetails();
    void loadItems();
    void loadAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId]);

  useEffect(() => {
    if (!inventoryId || activeTab !== "discussion") {
      return;
    }

    void loadDiscussion();
    const intervalId = window.setInterval(() => {
      void loadDiscussion();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId, activeTab]);

  const handleAddItem = async () => {
    if (!inventoryId) return;
    try {
      setError(null);
      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to create item: ${response.status}`);
      }

      await loadItems();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to create item.");
    }
  };

  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleLikeSelected = async () => {
    if (selectedItemIds.size === 0) return;
    try {
      setError(null);
      const response = await fetch(`${apiBase}/api/items/likes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemIds: Array.from(selectedItemIds) }),
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to like items: ${response.status}`);
      }

      await loadItems();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to like selected items.");
    }
  };

  const handleUnlikeSelected = async () => {
    if (selectedItemIds.size === 0) return;
    try {
      setError(null);
      const response = await fetch(`${apiBase}/api/items/likes`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemIds: Array.from(selectedItemIds) }),
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to unlike items: ${response.status}`);
      }

      await loadItems();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Failed to unlike selected items.");
    }
  };

  const handleAddPost = async () => {
    if (!inventoryId || !newPostContent.trim()) return;
    try {
      setDiscussionError(null);
      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/discussion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newPostContent }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create post: ${response.status}`);
      }

      setNewPostContent("");
      await loadDiscussion();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setDiscussionError("Failed to create post.");
    }
  };

  const saveSettings = async () => {
    if (!inventoryId || !inventoryDetails || !settingsDirty) return;
    try {
      setSettingsSaving(true);
      setSettingsError(null);
      setSettingsConflict(null);

      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: settingsTitle,
          description: settingsDescription,
          category: settingsCategory,
          isPublic: settingsIsPublic,
          tags: settingsTags,
          imageUrl: settingsImageUrl || null,
          version: inventoryDetails.version,
        }),
      });

      if (response.status === 409) {
        const payload = (await response.json()) as { message: string; current: InventoryDetails };
        setInventoryDetails(payload.current);
        setSettingsTitle(payload.current.title);
        setSettingsDescription(payload.current.description);
        setSettingsCategory(payload.current.category);
        setSettingsIsPublic(payload.current.isPublic);
        setSettingsImageUrl(payload.current.imageUrl ?? "");
        setSettingsTags(payload.current.tags);
        setSettingsDirty(false);
        setSettingsConflict("Settings updated by someone else. Latest version loaded.");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.status}`);
      }

      const data: InventoryDetails = await response.json();
      setInventoryDetails(data);
      setSettingsImageUrl(data.imageUrl ?? "");
      setSettingsTags(data.tags);
      setSettingsDirty(false);
      setSettingsLastSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setSettingsError("Failed to auto-save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (!inventoryId || !inventoryDetails) return;

    const intervalId = window.setInterval(() => {
      void saveSettings();
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId, inventoryDetails, settingsDirty]);

  const sortedAccessUsers = [...accessUsers].sort((a, b) => {
    if (accessSortBy === "name") {
      const aName = (a.name || a.email).toLowerCase();
      const bName = (b.name || b.email).toLowerCase();
      return aName.localeCompare(bName);
    }
    return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
  });

  const toggleAccessSelection = (userId: string) => {
    setAccessSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleAddAccessUser = async (user: AccessUser) => {
    if (!inventoryId) return;
    try {
      setAccessError(null);
      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add access: ${response.status}`);
      }

      setAccessQuery("");
      setAccessSuggestions([]);
      await loadAccess();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setAccessError("Failed to add user to access list.");
    }
  };

  const handleRemoveSelectedAccess = async () => {
    if (!inventoryId || accessSelectedIds.size === 0) return;
    try {
      setAccessError(null);
      const response = await fetch(`${apiBase}/api/inventories/${inventoryId}/access`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds: Array.from(accessSelectedIds) }),
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to remove access: ${response.status}`);
      }

      await loadAccess();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setAccessError("Failed to remove users from access list.");
    }
  };

  const loadTagSuggestions = async (query: string) => {
    const value = query.trim();
    if (!value) {
      setTagSuggestions([]);
      return;
    }

    try {
      setTagSuggestionsLoading(true);
      const response = await fetch(
        `${apiBase}/api/tags/search?q=${encodeURIComponent(value)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to search tags: ${response.status}`);
      }

      const data: { tags: string[] } = await response.json();
      const existingLower = new Set(settingsTags.map((tag) => tag.toLowerCase()));
      setTagSuggestions(
        data.tags.filter((name) => !existingLower.has(name.toLowerCase())),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setTagSuggestionsLoading(false);
    }
  };

  const handleAddTag = (name: string) => {
    const value = name.trim();
    if (!value) return;
    setSettingsTags((prev) => {
      const lower = value.toLowerCase();
      if (prev.some((tag) => tag.toLowerCase() === lower)) {
        return prev;
      }
      return [...prev, value];
    });
    setSettingsDirty(true);
    setTagInput("");
    setTagSuggestions([]);
  };

  const handleRemoveTag = (name: string) => {
    setSettingsTags((prev) => prev.filter((tag) => tag !== name));
    setSettingsDirty(true);
  };

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
                {/* Toolbar: Add item, like/unlike selected, без кнопок в строках */}
                <button type="button" className="btn btn-sm btn-primary" onClick={handleAddItem}>
                  Add item
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={handleLikeSelected}
                  disabled={selectedItemIds.size === 0}
                >
                  Like selected
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleUnlikeSelected}
                  disabled={selectedItemIds.size === 0}
                >
                  Unlike selected
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    if (selectedItemIds.size === 1) {
                      const [first] = Array.from(selectedItemIds);
                      setEditingItemId(first);
                    }
                  }}
                  disabled={selectedItemIds.size !== 1}
                >
                  Edit selected
                </button>
              </div>
            </div>

            {loading && <p className="text-muted mb-2">Loading items...</p>}
            {error && (
              <p className="text-danger mb-2" data-testid="inventory-items-error">
                {error}
              </p>
            )}

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col" style={{ width: "3rem" }}>
                      <input type="checkbox" aria-label="Select all items" />
                    </th>
                    <th scope="col">Custom ID</th>
                    <th scope="col">Created by</th>
                    <th scope="col" style={{ width: "6rem" }}>
                      Likes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label="Select item"
                          checked={selectedItemIds.has(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                        />
                      </td>
                      <td>{item.customId}</td>
                      <td>{item.createdByName}</td>
                      <td>
                        <span className="badge bg-light text-muted">
                          {item.likesCount}
                          {item.likedByCurrentUser ? " ★" : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && !loading && !error && (
                    <tr>
                      <td colSpan={4} className="text-muted text-center py-3">
                        No items yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "discussion" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">Discussion</h2>
            <p className="text-muted">
              Posts are linear and update automatically every few seconds.
            </p>

            <div className="mb-3">
              <label className="form-label">New post (Markdown supported)</label>
              <textarea
                className="form-control"
                rows={3}
                value={newPostContent}
                onChange={(event) => setNewPostContent(event.target.value)}
                placeholder="Write a comment in Markdown..."
              />
              <div className="d-flex justify-content-end mt-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleAddPost}
                  disabled={!newPostContent.trim()}
                >
                  Add post
                </button>
              </div>
            </div>

            {discussionLoading && <p className="text-muted mb-2">Loading discussion...</p>}
            {discussionError && (
              <p className="text-danger mb-2" data-testid="inventory-discussion-error">
                {discussionError}
              </p>
            )}

            <div className="d-flex flex-column gap-3">
              {discussionPosts.map((post) => (
                <article key={post.id} className="border rounded-3 p-3">
                  <header className="d-flex justify-content-between mb-1">
                    <a href="#" className="fw-semibold small">
                      {post.authorName}
                    </a>
                    <span className="text-muted small">
                      {new Date(post.createdAt).toLocaleString()}
                    </span>
                  </header>
                  <div className="small">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
                  </div>
                </article>
              ))}
              {discussionPosts.length === 0 && !discussionLoading && !discussionError && (
                <p className="text-muted mb-0">No posts yet. Be the first to comment.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">General settings</h2>
            <p className="text-muted mb-2">
              Title, description and visibility. Changes are auto-saved every few seconds.
            </p>

            {settingsError && (
              <p className="text-danger mb-2" data-testid="inventory-settings-error">
                {settingsError}
              </p>
            )}
            {settingsConflict && (
              <p className="text-warning mb-2" data-testid="inventory-settings-conflict">
                {settingsConflict}
              </p>
            )}

            <form className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={settingsTitle}
                  onChange={(event) => {
                    setSettingsTitle(event.target.value);
                    setSettingsDirty(true);
                  }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={settingsCategory}
                  onChange={(event) => {
                    setSettingsCategory(event.target.value as InventoryCategory);
                    setSettingsDirty(true);
                  }}
                >
                  <option value="EQUIPMENT">Equipment</option>
                  <option value="FURNITURE">Furniture</option>
                  <option value="BOOK">Book</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <div className="form-check">
                  <input
                    id="inventory-is-public"
                    type="checkbox"
                    className="form-check-input"
                    checked={settingsIsPublic}
                    onChange={(event) => {
                      setSettingsIsPublic(event.target.checked);
                      setSettingsDirty(true);
                    }}
                  />
                  <label className="form-check-label" htmlFor="inventory-is-public">
                    Public inventory (all authenticated users can add items)
                  </label>
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label">Description (Markdown)</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={settingsDescription}
                  onChange={(event) => {
                    setSettingsDescription(event.target.value);
                    setSettingsDirty(true);
                  }}
                  placeholder="Describe this inventory..."
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Preview</label>
                <div className="border rounded-3 p-2 small bg-light">
                  {settingsDescription ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{settingsDescription}</ReactMarkdown>
                  ) : (
                    <span className="text-muted">Nothing to preview yet.</span>
                  )}
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label">Image URL</label>
                <input
                  type="url"
                  className="form-control"
                  value={settingsImageUrl}
                  onChange={(event) => {
                    setSettingsImageUrl(event.target.value);
                    setSettingsDirty(true);
                  }}
                  placeholder="https://... (image hosted in cloud storage)"
                />
                <div className="form-text">
                  Paste a link to an image stored in cloud storage (e.g. Cloudinary, imgur, etc.).
                  The file is not uploaded to the app server or database.
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Image preview</label>
                <div className="border rounded-3 p-2 bg-light d-flex justify-content-center align-items-center" style={{ minHeight: "140px" }}>
                  {settingsImageUrl ? (
                    <img
                      src={settingsImageUrl}
                      alt={settingsTitle || "Inventory image"}
                      style={{ maxWidth: "100%", maxHeight: "120px", objectFit: "contain" }}
                    />
                  ) : (
                    <span className="text-muted small">No image selected.</span>
                  )}
                </div>
              </div>

              <div className="col-12">
                <label className="form-label">Tags</label>
                <div className="mb-2 d-flex flex-wrap gap-2">
                  {settingsTags.map((tag) => (
                    <span key={tag} className="badge bg-secondary d-inline-flex align-items-center">
                      <span>{tag}</span>
                      <button
                        type="button"
                        className="btn-close btn-close-white btn-sm ms-2"
                        aria-label={`Remove tag ${tag}`}
                        onClick={() => handleRemoveTag(tag)}
                        style={{ fontSize: "0.5rem" }}
                      />
                    </span>
                  ))}
                  {settingsTags.length === 0 && (
                    <span className="text-muted small">No tags yet.</span>
                  )}
                </div>
                <input
                  type="text"
                  className="form-control"
                  value={tagInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTagInput(value);
                    void loadTagSuggestions(value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Add a tag and press Enter..."
                />
                {tagSuggestionsLoading && (
                  <p className="text-muted small mt-1 mb-0">Searching tags...</p>
                )}
                {tagSuggestions.length > 0 && (
                  <ul className="list-group mt-1">
                    {tagSuggestions.map((suggestion) => (
                      <li
                        key={suggestion}
                        className="list-group-item list-group-item-action small"
                        role="button"
                        onClick={() => handleAddTag(suggestion)}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>

            <div className="d-flex justify-content-between align-items-center mt-3 small text-muted">
              <span>
                {settingsSaving
                  ? "Saving..."
                  : settingsDirty
                  ? "Unsaved changes"
                  : settingsLastSavedAt
                  ? `Last saved at ${settingsLastSavedAt}`
                  : "No changes yet"}
              </span>
              {inventoryDetails && <span>Version: {inventoryDetails.version}</span>}
            </div>
          </div>
        )}

        {activeTab === "customId" && <CustomIdTab inventoryId={inventoryId} />}

        {activeTab === "access" && (
          <div className="bg-white rounded-3 shadow-sm p-3">
            <h2 className="h5 mb-3">Access settings</h2>
            <p className="text-muted mb-2">
              Manage who can add and edit items in this inventory.
            </p>

            {accessError && (
              <p className="text-danger mb-2" data-testid="inventory-access-error">
                {accessError}
              </p>
            )}

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">Add user by name or email</label>
                <input
                  type="text"
                  className="form-control"
                  value={accessQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAccessQuery(value);
                    void loadAccessSuggestions(value);
                  }}
                  placeholder="Start typing to search users..."
                />
                {accessSuggestionsLoading && (
                  <p className="text-muted small mt-1 mb-0">Searching users...</p>
                )}
                {accessSuggestions.length > 0 && (
                  <ul className="list-group mt-1">
                    {accessSuggestions.map((user) => (
                      <li
                        key={user.id}
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        role="button"
                        onClick={() => void handleAddAccessUser(user)}
                      >
                        <span>
                          {user.name || user.email}
                          <span className="text-muted small ms-2">{user.email}</span>
                        </span>
                        <span className="badge bg-primary rounded-pill">Add</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <small className="text-muted">
                  Public/private switch is configured on the General settings tab. Here you can
                  fine tune additional users with write access.
                </small>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-semibold">Users with write access</span>
              <div className="btn-toolbar gap-2">
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={accessSortBy}
                  onChange={(event) =>
                    setAccessSortBy(event.target.value === "email" ? "email" : "name")
                  }
                >
                  <option value="name">Sort by name</option>
                  <option value="email">Sort by email</option>
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={handleRemoveSelectedAccess}
                  disabled={accessSelectedIds.size === 0}
                >
                  Remove selected
                </button>
              </div>
            </div>

            {accessLoading && <p className="text-muted mb-2">Loading access list...</p>}

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col" style={{ width: "3rem" }}>
                      {/* Можно добавить select-all при желании */}
                    </th>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAccessUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label="Select user"
                          checked={accessSelectedIds.has(user.id)}
                          onChange={() => toggleAccessSelection(user.id)}
                        />
                      </td>
                      <td>{user.name || "—"}</td>
                      <td className="text-muted small">{user.email}</td>
                    </tr>
                  ))}
                  {sortedAccessUsers.length === 0 && !accessLoading && (
                    <tr>
                      <td colSpan={3} className="text-muted text-center py-3">
                        No additional users with write access yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "fields" && <FieldsTab inventoryId={inventoryId} />}

        {activeTab === "stats" && <StatsTab inventoryId={inventoryId} />}
      </div>
      {editingItemId && (
        <ItemEditModal
          itemId={editingItemId}
          onClose={() => setEditingItemId(null)}
          onSaved={() => {
            void loadItems();
          }}
        />
      )}
    </div>
  );
};

