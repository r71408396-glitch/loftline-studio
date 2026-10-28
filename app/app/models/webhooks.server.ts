// Every webhook goes through here: Shopify's HMAC signature is checked by
// authenticate.webhook (an invalid signature never reaches the handler), each
// delivery is logged by its X-Shopify-Webhook-Id, a delivery that already
// succeeded is not processed twice, and a failure answers 500 so Shopify
// retries it.
import db from '../db.server';
import { authenticate } from '../shopify.server';

type WebhookContext = Awaited<ReturnType<typeof authenticate.webhook>>;

export async function handleWebhook(request: Request, handler: (context: WebhookContext) => Promise<string | void>) {
  const context = await authenticate.webhook(request);
  const id = context.webhookId || request.headers.get('x-shopify-webhook-id') || `${context.topic}-${Date.now()}`;

  const previous = await db.webhookEvent.findUnique({ where: { id } });
  if (previous?.status === 'processed') return new Response(null, { status: 200 });

  try {
    const note = await handler(context);
    await db.webhookEvent.upsert({
      where: { id },
      create: { id, shop: context.shop, topic: String(context.topic), status: 'processed', error: note || null },
      update: { status: 'processed', error: note || null, attempts: { increment: 1 } },
    });
    return new Response(null, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Webhook ${context.topic} ${id} failed:`, message);
    await db.webhookEvent.upsert({
      where: { id },
      create: { id, shop: context.shop, topic: String(context.topic), status: 'failed', error: message },
      update: { status: 'failed', error: message, attempts: { increment: 1 } },
    });
    return new Response(null, { status: 500 });
  }
}
