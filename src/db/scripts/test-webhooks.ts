import 'dotenv/config';
import http from 'node:http';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import { webhookSubscriptions, webhookDeliveries } from '../schema';
import { eq, inArray } from 'drizzle-orm';
import { signPayload } from '../../lib/webhooks';

async function main() {
  console.log('[Test] Starting Outbound Webhooks end-to-end test against live Polygres DB...');

  const timestamp = Date.now();
  const testPort = 9876;

  // 1. Start local receiver server
  let lastReceivedPayload: any = null;
  let lastReceivedHeaders: http.IncomingHttpHeaders = {};
  let serverReceivedCount = 0;

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      serverReceivedCount++;
      lastReceivedHeaders = req.headers;
      try {
        lastReceivedPayload = JSON.parse(body);
      } catch {
        lastReceivedPayload = body;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, receivedAt: new Date().toISOString() }));
    });
  });

  await new Promise<void>((resolve) => server.listen(testPort, '127.0.0.1', () => resolve()));
  console.log(`✓ Local test webhook receiver listening on http://127.0.0.1:${testPort}`);

  try {
    // 2. Create Webhook Subscription with specific event type
    console.log('\n2. Creating webhook subscription for "opportunity.stage_changed"...');
    const secret = `whsec_test_${timestamp}`;
    const subRes = await crmToolHandlers.createWebhookSubscription({
      name: `Zapier Opportunity Hook ${timestamp}`,
      targetUrl: `http://127.0.0.1:${testPort}/webhook`,
      eventTypes: ['opportunity.stage_changed'],
      secret,
    });
    const sub = subRes.subscription;
    console.log(`✓ Subscription created: "${sub.name}" [ID: ${sub.id}]`);

    // 3. Dispatch an event matching the subscription
    console.log('\n3. Dispatching "opportunity.stage_changed" webhook event...');
    const dispatchRes = await crmToolHandlers.dispatchWebhookEvent({
      eventType: 'opportunity.stage_changed',
      payload: {
        opportunityId: '00000000-0000-0000-0000-000000000001',
        name: 'Stark Arc Reactor License',
        fromStage: 'NEGOTIATION',
        toStage: 'CLOSED_WON',
        amountMicros: 1500000000000,
      },
    });

    console.log(`✓ Dispatched event to ${dispatchRes.dispatchedCount} subscriber(s).`);
    if (dispatchRes.dispatchedCount !== 1) {
      throw new Error(`Expected 1 dispatch, got ${dispatchRes.dispatchedCount}`);
    }

    // 4. Verify receiver payload and cryptographic signature
    console.log('\n4. Verifying received payload and cryptographic HMAC SHA-256 signature...');
    console.log(`  Event header: "${lastReceivedHeaders['x-crm-event']}"`);
    console.log(`  Signature header: "${lastReceivedHeaders['x-crm-signature']}"`);
    console.log(`  Timestamp header: "${lastReceivedHeaders['x-crm-timestamp']}"`);
    console.log(`  Payload Event: "${lastReceivedPayload?.event}"`);
    console.log(`  Payload Deal: "${lastReceivedPayload?.data?.name}" (Stage: ${lastReceivedPayload?.data?.toStage})`);

    const expectedSignature = signPayload(
      secret,
      String(lastReceivedHeaders['x-crm-timestamp']),
      JSON.stringify(lastReceivedPayload)
    );

    if (lastReceivedHeaders['x-crm-signature'] !== expectedSignature) {
      throw new Error(`Signature mismatch! Expected ${expectedSignature}, received ${lastReceivedHeaders['x-crm-signature']}`);
    }
    console.log('✓ HMAC SHA-256 signature verified mathematically 100% authentic!');

    // 5. Check delivery audit log in crm.webhook_deliveries
    console.log('\n5. Inspecting crm.webhook_deliveries audit log...');
    const deliveriesRes = await crmToolHandlers.listWebhookDeliveries({
      subscriptionId: sub.id,
    });
    const delivery = deliveriesRes.deliveries[0]!;
    console.log(`✓ Delivery log verified: status = "${delivery.status}", HTTP ${delivery.responseStatusCode}`);
    if (delivery.status !== 'DELIVERED' || delivery.responseStatusCode !== 200) {
      throw new Error(`Delivery audit log indicates non-delivered status: ${delivery.status}`);
    }

    // 6. Test Wildcard subscription ('*')
    console.log('\n6. Testing Wildcard ("*") subscription...');
    const wildcardSubRes = await crmToolHandlers.createWebhookSubscription({
      name: `Global Audit Wildcard ${timestamp}`,
      targetUrl: `http://127.0.0.1:${testPort}/wildcard`,
      eventTypes: ['*'],
    });

    const wildcardDispatch = await crmToolHandlers.dispatchWebhookEvent({
      eventType: 'custom.arbitrary_event',
      payload: { message: 'Wildcard broadcast test' },
    });
    console.log(`✓ Dispatched arbitrary event to ${wildcardDispatch.dispatchedCount} subscriber(s) (Expected: 1 for wildcard).`);
    if (wildcardDispatch.dispatchedCount !== 1) {
      throw new Error(`Expected wildcard subscription to match, got ${wildcardDispatch.dispatchedCount}`);
    }

    // 7. Cleanup
    console.log('\n7. Cleaning up test subscriptions and deliveries from live DB...');
    await db.delete(webhookDeliveries).where(
      inArray(webhookDeliveries.subscriptionId, [sub.id, wildcardSubRes.subscription.id])
    );
    await db.delete(webhookSubscriptions).where(
      inArray(webhookSubscriptions.id, [sub.id, wildcardSubRes.subscription.id])
    );
    console.log('✓ Cleanup complete.');

    console.log('\n🎉 ALL OUTBOUND WEBHOOKS TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  } finally {
    server.close();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
