import crypto from 'node:crypto';
import { db } from '../db';
import {
  webhookSubscriptions,
  webhookDeliveries,
} from '../db/schema';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { logTimelineActivity } from './timeline';

export interface CreateWebhookSubscriptionInput {
  name: string;
  targetUrl: string;
  eventTypes?: string[];
  secret?: string;
  organizationId?: string | null;
}

export interface WebhookEventEnvelope {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Generate HMAC SHA-256 signature for webhook payload.
 */
export function signPayload(secret: string, timestamp: string, payloadJson: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${timestamp}.${payloadJson}`);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Create an outbound webhook subscription.
 */
export async function createWebhookSubscription(input: CreateWebhookSubscriptionInput) {
  const secret = input.secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;
  const eventTypes = input.eventTypes && input.eventTypes.length > 0 ? input.eventTypes : ['*'];

  const [sub] = await db
    .insert(webhookSubscriptions)
    .values({
      name: input.name,
      targetUrl: input.targetUrl,
      eventTypes,
      secret,
      organizationId: input.organizationId ?? null,
      isActive: true,
    })
    .returning();

  return sub;
}

/**
 * List all webhook subscriptions.
 */
export async function listWebhookSubscriptions(organizationId?: string) {
  return await db.query.webhookSubscriptions.findMany({
    where: organizationId ? eq(webhookSubscriptions.organizationId, organizationId) : undefined,
    orderBy: [desc(webhookSubscriptions.createdAt)],
  });
}

/**
 * Delete a webhook subscription.
 */
export async function deleteWebhookSubscription(subscriptionId: string) {
  const [deleted] = await db
    .delete(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, subscriptionId))
    .returning();
  return deleted;
}

/**
 * Dispatch an outbound webhook event to all matching subscribers.
 */
export async function dispatchWebhookEvent(options: {
  eventType: string;
  payload: Record<string, unknown>;
  organizationId?: string | null;
  timeoutMs?: number;
}) {
  const { eventType, payload, organizationId, timeoutMs = 5000 } = options;

  // 1. Fetch active subscriptions
  const allSubs = await db.query.webhookSubscriptions.findMany({
    where: eq(webhookSubscriptions.isActive, true),
  });

  // Filter subscriptions matching eventType (or wildcard '*') and optional org
  const matchingSubs = allSubs.filter((s) => {
    if (organizationId && s.organizationId && s.organizationId !== organizationId) {
      return false;
    }
    return s.eventTypes.includes('*') || s.eventTypes.includes(eventType);
  });

  if (matchingSubs.length === 0) {
    return {
      dispatchedCount: 0,
      deliveries: [],
    };
  }

  const eventId = `evt_${crypto.randomBytes(12).toString('hex')}`;
  const timestamp = new Date().toISOString();
  const envelope: WebhookEventEnvelope = {
    id: eventId,
    event: eventType,
    timestamp,
    data: payload,
  };
  const payloadJson = JSON.stringify(envelope);

  const deliveryResults = [];

  for (const sub of matchingSubs) {
    // 2. Insert delivery record with PENDING status
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        subscriptionId: sub.id,
        eventType,
        payload: envelope as any,
        status: 'PENDING',
        attempts: 1,
      })
      .returning();

    const signature = signPayload(sub.secret, timestamp, payloadJson);

    try {
      const response = await fetch(sub.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'mysios-crm-webhooks/1.0',
          'X-CRM-Event': eventType,
          'X-CRM-Delivery-Id': delivery.id,
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
        body: payloadJson,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const responseBody = await response.text().catch(() => '');
      const isSuccess = response.status >= 200 && response.status < 300;

      const [updated] = await db
        .update(webhookDeliveries)
        .set({
          status: isSuccess ? 'DELIVERED' : 'FAILED',
          responseStatusCode: response.status,
          responseBody: responseBody.substring(0, 1000),
          deliveredAt: isSuccess ? new Date() : null,
          errorMessage: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
        })
        .where(eq(webhookDeliveries.id, delivery.id))
        .returning();

      deliveryResults.push(updated);
    } catch (err: any) {
      const [updated] = await db
        .update(webhookDeliveries)
        .set({
          status: 'FAILED',
          errorMessage: err.message || String(err),
        })
        .where(eq(webhookDeliveries.id, delivery.id))
        .returning();

      deliveryResults.push(updated);
    }
  }

  return {
    dispatchedCount: deliveryResults.length,
    deliveries: deliveryResults,
  };
}

/**
 * List delivery logs, optionally filtered by subscription.
 */
export async function listWebhookDeliveries(options?: {
  subscriptionId?: string;
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const conditions = [];

  if (options?.subscriptionId) {
    conditions.push(eq(webhookDeliveries.subscriptionId, options.subscriptionId));
  }
  if (options?.status) {
    conditions.push(eq(webhookDeliveries.status, options.status));
  }

  return await db.query.webhookDeliveries.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(webhookDeliveries.createdAt)],
    limit,
    with: {
      subscription: true,
    },
  });
}
