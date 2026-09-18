import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes — no auth required
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',    // Clerk user sync webhook (must be public)
  '/api/webhooks/(.*)',     // Other inbound webhooks (Recall.ai, PostHog)
  '/api/health',
  '/icon',                  // Generated favicon (next/og route, no file extension)
  '/opengraph-image',       // Generated social preview image (next/og route)
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on all routes except static files and Next.js internals
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
