# Deploying Agentic CRM to Cloudflare Workers

Agentic CRM is designed to run at the edge on **Cloudflare Workers** using [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). It connects to PostgreSQL through **Cloudflare Hyperdrive** for low-latency pooled connections at the edge.

This guide covers three deployment paths:
1. [**One-Click Deploy via the Cloudflare Button**](#1-one-click-deploy-cloudflare-button) — zero local setup required.
2. [**Cloudflare Workers Builds (CI/CD)**](#2-cloudflare-workers-builds-cicd) — native, Git-connected, zero-config CI.
3. [**Manual Deploy from Local CLI**](#3-manual-deploy-from-local-cli) — for full control.

---

## Prerequisites (All Paths)

You'll need the following accounts and resources before deploying:

1. **[Cloudflare Account](https://dash.cloudflare.com/sign-up)** (free)
2. **PostgreSQL Database**: Any hosted PostgreSQL service works:
   - [Polygres](https://polygres.com) (recommended — includes relational knowledge graph)
   - [Supabase](https://supabase.com)
   - [Neon](https://neon.tech)
   - Any managed or self-hosted PostgreSQL instance
3. **[Clerk Account](https://clerk.com)** (free tier works) for authentication
4. **Cloudflare Hyperdrive** (required for Workers; set up in step below)

---

## Setup: Cloudflare Hyperdrive

Cloudflare Workers cannot open raw TCP connections to PostgreSQL directly. All database traffic must go through **[Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)**, which pools and proxies connections at Cloudflare's edge.

Create a Hyperdrive config from your Cloudflare dashboard or via CLI:

```bash
# Install Wrangler if you haven't already
npm install -g wrangler
wrangler login

# Create Hyperdrive config pointing to your PostgreSQL database
wrangler hyperdrive create agentic-crm-db \
  --connection-string "postgresql://user:password@host:5432/crm?sslmode=require"
```

> Copy the **Hyperdrive Config ID** from the output. You'll need it in the next steps.

---

## 1. One-Click Deploy (Cloudflare Button)

Click the button below to deploy Agentic CRM directly to your Cloudflare account:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MRCORD/crm)

### What happens:
1. Cloudflare clones this repository into your GitHub account.
2. You're prompted to authorize Cloudflare access to the forked repo.
3. Cloudflare runs the GitHub Actions workflow (`.github/workflows/deploy.yml`) to build and deploy.

### Required: Configure GitHub Secrets

After the fork is created, add the following secrets in your GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | From Cloudflare → [Create Token](https://dash.cloudflare.com/profile/api-tokens) with `Workers:Edit` permission |
| `CLOUDFLARE_ACCOUNT_ID` | From Cloudflare Dashboard → right sidebar → Account ID |

### Required: Configure Cloudflare Worker Secrets

After the first deploy, add your application secrets via the Cloudflare dashboard or CLI:

```bash
# Add each secret one at a time:
wrangler secret put DATABASE_URL
wrangler secret put DIRECT_URL
wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET

# Add Hyperdrive binding ID to wrangler.jsonc:
# Replace "YOUR_HYPERDRIVE_CONFIG_ID" with your actual ID
```

### Required: Update `wrangler.jsonc`

Edit `wrangler.jsonc` in your forked repo to replace the Hyperdrive placeholder:
```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "YOUR_ACTUAL_HYPERDRIVE_CONFIG_ID"  // ← Replace this
    }
  ]
}
```

### Required: Run Database Migrations

Connect to your database and run migrations:
```bash
pnpm install
DATABASE_URL="your-connection-string" pnpm db:migrate
```

---

## 2. Cloudflare Workers Builds (CI/CD)

Cloudflare's native **Workers Builds** service connects your GitHub repository and auto-deploys on every push — no GitHub Actions required.

1. Go to **[Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create**.
2. Select **"Workers Builds"** and connect your GitHub account.
3. Select the forked/cloned `crm` repository.
4. Configure the **Build settings**:

   | Setting | Value |
   | :--- | :--- |
   | Build command | `npx @opennextjs/cloudflare build` |
   | Deploy command | `npx @opennextjs/cloudflare deploy` |

5. Add all **Environment Variables** (same as the secrets listed above) under the "Variables & Secrets" tab.
6. Click **Deploy**.

Cloudflare will automatically build and deploy on every push to `main`.

---

## 3. Manual Deploy from Local CLI

```bash
# 1. Clone the repository
git clone https://github.com/MRCORD/crm.git
cd crm
pnpm install

# 2. Set up your .env
cp .env.example .env
# Fill in DATABASE_URL, CLERK keys, POLYGRES keys, etc.

# 3. Run database migrations
pnpm db:migrate

# 4. Edit wrangler.jsonc — replace YOUR_HYPERDRIVE_CONFIG_ID with your actual ID

# 5. Build for Cloudflare Workers
pnpm build:worker

# 6. Upload your secrets to Cloudflare
wrangler secret put DATABASE_URL
wrangler secret put DIRECT_URL
wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET

# 7. Deploy
pnpm deploy:worker
```

---

## Post-Deployment: Promote Admin User

After your first login, promote your Clerk user account to admin via:
```bash
CLERK_USER_ID="user_xxxx" DATABASE_URL="your-connection-string" \
  tsx src/db/scripts/promote-admin.ts
```

---

## Architecture at a Glance

```
Browser / Claude Desktop
        │
        ▼
Cloudflare Workers (Edge)
    @opennextjs/cloudflare
        │
        ▼
Cloudflare Hyperdrive (Connection Pooler)
        │
        ▼
PostgreSQL (Polygres / Supabase / Neon)
5 schemas: system • crm • mcp • retrieval • ingest
```

---

## Troubleshooting

- **"Worker threw exception / TCP hang"**: You're missing the Hyperdrive binding. Ensure the Hyperdrive ID in `wrangler.jsonc` matches a valid Hyperdrive config in your account.
- **"Clerk redirect error on production"**: Add your Worker's deployed URL (`https://your-worker.workers.dev`) to Clerk's allowed origins and redirect URLs in your Clerk Dashboard.
- **"no local hyperdrive connection string"**: This is expected in local `next dev`. The Hyperdrive binding only activates inside a deployed Worker. Locally, the app falls back to `DATABASE_URL`.
