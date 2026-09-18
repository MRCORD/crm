# Deploying Agentic CRM to Cloudflare Workers

Agentic CRM runs at the edge on **Cloudflare Workers** using [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). It requires three external providers to function:

1. **A PostgreSQL Database** — for all CRM data storage.
2. **Clerk** — for user authentication, sessions, and multi-tenant organizations.
3. **Cloudflare** — for serverless edge execution and database connection pooling (Hyperdrive).

This guide walks through each provider setup and then covers three deployment paths:

1. [**One-Click Deploy (Cloudflare Button)**](#deployment-option-1-one-click-deploy)
2. [**Cloudflare Workers Builds (CI/CD)**](#deployment-option-2-cloudflare-workers-builds-cicd)
3. [**Manual Deploy from Local CLI**](#deployment-option-3-manual-deploy-from-local-cli)

---

## Step 1 — Set Up Your PostgreSQL Database

You need a hosted PostgreSQL database. Any of these work:

| Provider | Free Tier | Notes |
| :--- | :--- | :--- |
| **[Polygres](https://polygres.com)** | ✅ Free | Recommended — relational knowledge graph edges + semantic embeddings built-in |
| **[Neon](https://neon.tech)** | ✅ Free | Serverless PostgreSQL, instant branching |
| **[Supabase](https://supabase.com)** | ✅ Free | PostgreSQL + extras |
| Self-hosted PostgreSQL | — | Any accessible Postgres 14+ instance |

### Option A: Polygres (Recommended)

1. Sign up at [polygres.com](https://polygres.com).
2. Click **New Project** and choose a region close to your Cloudflare Worker.
3. From your project dashboard, go to **Settings → Connection Details** and copy:
   - **Connection String** → use as `DATABASE_URL` and `DIRECT_URL`
   - **API Key** → use as `POLYGRES_API_KEY` (starts with `poly_live_...`)
4. Keep `POLYGRES_RUNTIME_URL=https://runtime.polygres.com` (default, no change needed).

### Option B: Neon, Supabase, or self-hosted

1. Create a PostgreSQL database in your provider of choice.
2. Copy the **Connection String** (e.g. `postgresql://user:pass@host:5432/dbname?sslmode=require`).
3. Set both `DATABASE_URL` and `DIRECT_URL` to that connection string.
4. Leave `POLYGRES_API_KEY` and `POLYGRES_RUNTIME_URL` blank — the app works without them (knowledge graph features disabled).

---

## Step 2 — Set Up Clerk Authentication

1. Sign up at [clerk.com](https://clerk.com).
2. Click **Create Application**. Name it anything (e.g. `Agentic CRM`).
3. Choose your preferred sign-in methods (Google, Email, etc.).
4. From **API Keys** in the Clerk dashboard, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — starts with `pk_test_...` or `pk_live_...`
   - `CLERK_SECRET_KEY` — starts with `sk_test_...` or `sk_live_...`
5. From **Webhooks → Add Endpoint**, add your deployed Worker URL:
   - Endpoint: `https://your-worker.your-subdomain.workers.dev/api/webhooks/clerk`
   - Subscribe to events: `user.created`, `user.updated`, `user.deleted`, `organization.*`
   - Copy the **Signing Secret** → use as `CLERK_WEBHOOK_SECRET` (starts with `whsec_...`)
6. (Optional) From **Domains**, add your custom domain to the allowed origins list once deployed.

> 💡 **Access Restriction**: To limit sign-ups to your company's email domain (e.g. only `@yourcompany.com`), set `ALLOWED_EMAIL_DOMAIN=yourcompany.com` in your environment.

---

## Step 3 — Set Up Cloudflare Hyperdrive

Cloudflare Workers cannot open raw TCP connections to PostgreSQL directly. All database traffic must route through **[Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)**, which pools and proxies connections at Cloudflare's edge.

```bash
# Install Wrangler CLI
npm install -g wrangler
wrangler login

# Create Hyperdrive config pointing to your PostgreSQL database
wrangler hyperdrive create agentic-crm-db \
  --connection-string "postgresql://user:password@host:5432/crm?sslmode=require"
```

> Copy the **Hyperdrive Config ID** from the output. You'll add it to `wrangler.jsonc` in the deploy steps below.

---

## Step 4 — Run Database Migrations

Before your first deployment, apply the versioned Drizzle migrations to scaffold all 5 schemas and tables in your database:

```bash
# Clone the repo locally (for migration only)
git clone https://github.com/MRCORD/crm.git && cd crm
pnpm install

# Run migrations
DATABASE_URL="your-connection-string" pnpm db:migrate
```

---

## Deployment Option 1: One-Click Deploy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MRCORD/crm)

Clicking the button will:
1. Fork this repository into your GitHub account.
2. Trigger the GitHub Actions workflow (`.github/workflows/deploy.yml`) to build and deploy.

### Configure GitHub Secrets

In your forked repository, go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret Name | Where to Find It |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | [Cloudflare Dashboard → Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create token with **Workers:Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → any zone → right sidebar → **Account ID** |

### Configure Cloudflare Worker Secrets

```bash
wrangler secret put DATABASE_URL               # PostgreSQL connection string
wrangler secret put DIRECT_URL                 # Same as DATABASE_URL
wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET
wrangler secret put POLYGRES_API_KEY           # Skip if not using Polygres
wrangler secret put POLYGRES_RUNTIME_URL       # Skip if not using Polygres
```

### Update `wrangler.jsonc`

In your forked repo, replace the Hyperdrive placeholder with your actual Config ID:

```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "YOUR_ACTUAL_HYPERDRIVE_CONFIG_ID"
    }
  ]
}
```

Commit and push — the GitHub Actions workflow will re-deploy automatically.

---

## Deployment Option 2: Cloudflare Workers Builds (CI/CD)

Cloudflare's native **Workers Builds** connects your GitHub repo and auto-deploys on every push.

1. Go to **[Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Workers Builds**.
2. Connect your GitHub account and select your forked `crm` repository.
3. In **Build settings**:
   - **Build command**: `npx @opennextjs/cloudflare build`
   - **Deploy command**: `npx @opennextjs/cloudflare deploy`
4. Under **Variables & Secrets**, add all environment variables from the table above.
5. Click **Deploy**.

Every push to `main` will auto-build and deploy.

---

## Deployment Option 3: Manual Deploy from Local CLI

```bash
# 1. Clone and install
git clone https://github.com/MRCORD/crm.git && cd crm
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in all values in .env

# 3. Run database migrations
pnpm db:migrate

# 4. Update wrangler.jsonc with your Hyperdrive Config ID

# 5. Build for Cloudflare Workers
pnpm build:worker

# 6. Upload secrets
wrangler secret put DATABASE_URL
wrangler secret put DIRECT_URL
wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET
wrangler secret put POLYGRES_API_KEY
wrangler secret put POLYGRES_RUNTIME_URL

# 7. Deploy
pnpm deploy:worker
```

---

## Post-Deployment: Promote Your Admin User

After your first login through Clerk, promote your user account to admin:

```bash
# Get your Clerk user ID from the Clerk Dashboard → Users
CLERK_USER_ID="user_xxxx" DATABASE_URL="your-connection-string" \
  npx tsx src/db/scripts/promote-admin.ts
```

---

## Environment Variables Reference

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DIRECT_URL` | ✅ | Same as `DATABASE_URL` (non-pooled, for migrations) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key (`pk_test_...` / `pk_live_...`) |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key (`sk_test_...` / `sk_live_...`) |
| `CLERK_WEBHOOK_SECRET` | ✅ | Clerk webhook signing secret (`whsec_...`) |
| `POLYGRES_API_KEY` | Optional | Polygres project key — enables knowledge graph features |
| `POLYGRES_RUNTIME_URL` | Optional | `https://runtime.polygres.com` |
| `ALLOWED_EMAIL_DOMAIN` | Optional | Restrict sign-ups to a company email domain (e.g. `acme.com`) |
| `DEV_TUNNEL_HOSTNAME` | Dev only | Hostname for Cloudflare Tunnel in local dev (e.g. `devlocal.myapp.com`) |

---

## Architecture Reference

```
Browser / Claude Desktop / Cursor
              │
              ▼
  Cloudflare Workers (Edge)
    @opennextjs/cloudflare
    Clerk Auth (JWT validation)
              │
              ▼
  Cloudflare Hyperdrive
  (TCP pooling & caching)
              │
              ▼
  PostgreSQL (Polygres / Neon / Supabase)
  5 schemas: system • crm • mcp • retrieval • ingest
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Worker hangs / TCP timeout | Missing Hyperdrive binding | Verify Hyperdrive Config ID in `wrangler.jsonc` |
| 401 Unauthorized | Incorrect Clerk keys | Re-check `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| Webhook 400 / signature mismatch | Wrong `CLERK_WEBHOOK_SECRET` | Regenerate signing secret in Clerk Dashboard → Webhooks |
| `no local hyperdrive connection string` | Expected in local dev | Normal — falls back to `DATABASE_URL` locally |
| Clerk redirect error on first login | Missing allowed origin | Add your Worker URL to Clerk Dashboard → Domains |
