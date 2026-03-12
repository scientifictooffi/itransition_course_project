## Inventory Manager – Course Project

Full‑stack web app for managing arbitrary inventories (equipment, books, documents, etc.) built for the Itransition course project.

### Tech stack

- **Frontend**: React + TypeScript, Vite, React‑Bootstrap, React Router, `react-markdown` + `remark-gfm`
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL (Railway)
- **Auth**: Email/password + Google + GitHub (JWT)
- **Deployment**: Backend on Railway, frontend on Vercel

### Project structure

- `final/server` – Express API, Prisma schema, seed script
- `final/client` – React SPA (Vite)

### Local setup

1. **Clone and install**

```bash
cd final/server
npm install

cd ../client
npm install
```

2. **Configure environment**

Create `final/server/.env`:

```env
DATABASE_URL=postgresql://user:password@host:port/database
CLIENT_APP_URL=http://localhost:5173
JWT_SECRET=some-long-random-secret

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=http://localhost:4000/api/auth/github/callback
```

Create `final/client/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

3. **Migrate and seed database**

```bash
cd final/server
npm run prisma:migrate
npm run seed
```

4. **Run app locally**

From `final`:

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

### Demo credentials

- Email: `demo@example.com`
- Password: `demo1234`

Promote this user to admin (for local testing):

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'demo@example.com';
```

### Main features (per spec)

- Arbitrary inventories with:
  - **Custom item IDs** (configurable format with fixed text, random numbers, GUID, datetime, sequence, etc., with preview and uniqueness per inventory)
  - **Custom fields** (single‑line / multi‑line text, number, link, boolean), ordering, show/hide in table
- **Items**
  - Table view only (no row buttons – actions via toolbars)
  - Optimistic locking on item edit
  - Per‑item likes (single like per user)
- **Inventory page tabs**
  - Items, Discussion (near real‑time polling), General settings (autosave with optimistic locking), Custom ID, Access, Fields, Statistics
- **Access control**
  - Owner + admins can manage settings, fields, access list
  - Write access via explicit user list or public inventories
  - Non‑authenticated users can only view/search
- **Search and navigation**
  - Global full‑text search in header
  - Home page: latest inventories, top‑5 by items count, tag cloud
  - Tag click → search page
- **Admin panel**
  - Block/unblock users, delete users, grant/revoke admin role (including self‑revoke)
- **Other**
  - Two UI languages (EN/RU) and light/dark themes with persistence
  - Markdown support for descriptions and discussion
  - Image/document preview for link fields
  - CSV export for inventory items
  - Swagger/OpenAPI docs exposed at `/api-docs` on the backend

