import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  // Standalone output is only for the Docker/self-hosted Node.js path
  // (see Dockerfile). The Cloudflare Workers build (`@opennextjs/cloudflare`)
  // reads directly from the default `.next` build output and must NOT use
  // standalone mode, so this is opt-in via BUILD_STANDALONE=1.
  output: process.env.BUILD_STANDALONE ? 'standalone' : undefined,

  // Allows a reverse-proxied local dev domain (e.g. a Cloudflare Tunnel used
  // to test Clerk/webhooks against a real HTTPS hostname) to reach this dev
  // server, including the HMR WebSocket. Without this, Next.js rejects the
  // cross-origin request with a 502 during the WS handshake, and the dev
  // client's runtime blocks on that failed handshake before it ever commits
  // hydration — the whole app looks "broken" (no interactivity at all)
  // even though nothing is actually erroring. Set DEV_TUNNEL_HOSTNAME to
  // your tunnel's hostname (no protocol) to enable this locally.
  allowedDevOrigins: process.env.DEV_TUNNEL_HOSTNAME ? [process.env.DEV_TUNNEL_HOSTNAME] : undefined,
};

export default nextConfig;

// Enables the OpenNext Cloudflare dev bindings (Hyperdrive, env vars, etc.)
// when running `next dev` locally so `process.env` / `getCloudflareContext()`
// behave the same as in a deployed Worker. Guarded to dev only — calling
// this during `next build` throws if no local Hyperdrive connection is set.
//
// NOTE: intentionally NOT awaited. Top-level `await` here breaks Turbopack's
// next.config compilation ("await is not defined"), and the OpenNext docs
// state the function "doesn't need to be awaited" — it populates the global
// Cloudflare context itself once wrangler has resolved.
if (process.env.NODE_ENV === 'development') {
  void initOpenNextCloudflareForDev();
}
