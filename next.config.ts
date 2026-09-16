import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Enables the OpenNext Cloudflare dev bindings (Hyperdrive, env vars, etc.)
// when running `next dev` locally so `process.env` / `getCloudflareContext()`
// behave the same as in a deployed Worker. Guarded to dev only — calling
// this during `next build` throws if no local Hyperdrive connection is set.
if (process.env.NODE_ENV === 'development') {
  await initOpenNextCloudflareForDev();
}
