import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';

import { handleStripeEvent } from './route.js';
import type { BillingStore, SubscriptionUpsert } from '@/lib/billing/store';

/** In-memory {@link BillingStore} that records every call for assertions. */
class FakeStore implements BillingStore {
  public readonly links: Array<{ userId: string; customerId: string }> = [];
  public readonly upserts: SubscriptionUpsert[] = [];
  public readonly customers = new Map<string, string>(); // userId -> customerId

  // eslint-disable-next-line @typescript-eslint/require-await
  async linkCustomer(userId: string, stripeCustomerId: string): Promise<void> {
    this.links.push({ userId, customerId: stripeCustomerId });
    this.customers.set(userId, stripeCustomerId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getCustomerId(userId: string): Promise<string | null> {
    return this.customers.get(userId) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async userIdForCustomer(stripeCustomerId: string): Promise<string | null> {
    for (const [userId, customerId] of this.customers.entries()) {
      if (customerId === stripeCustomerId) {
        return userId;
      }
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async upsertSubscription(row: SubscriptionUpsert): Promise<void> {
    this.upserts.push(row);
  }
}

/** Build a minimal subscription event; cast through `unknown` since fixtures are partial. */
function subscriptionEvent(
  type:
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted',
  overrides: Partial<Stripe.Subscription> & { metadata?: Record<string, string> },
): Stripe.Event {
  const base = {
    id: 'sub_123',
    object: 'subscription',
    status: 'active',
    customer: 'cus_123',
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: 'price_pro', metadata: { plan: 'pro' } },
          current_period_end: 1_700_000_000,
        },
      ],
    },
    metadata: {},
    ...overrides,
  };
  return { type, data: { object: base } } as unknown as Stripe.Event;
}

describe('handleStripeEvent', () => {
  it('links the customer on checkout.session.completed using client_reference_id', async () => {
    const store = new FakeStore();
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: { client_reference_id: 'user_1', customer: 'cus_abc', metadata: {} },
      },
    } as unknown as Stripe.Event;

    const result = await handleStripeEvent(event, store);

    expect(result.handled).toBe(true);
    expect(store.links).toEqual([{ userId: 'user_1', customerId: 'cus_abc' }]);
  });

  it('falls back to metadata.user_id on checkout when client_reference_id is absent', async () => {
    const store = new FakeStore();
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: { client_reference_id: null, customer: 'cus_xyz', metadata: { user_id: 'user_2' } },
      },
    } as unknown as Stripe.Event;

    await handleStripeEvent(event, store);

    expect(store.links).toEqual([{ userId: 'user_2', customerId: 'cus_xyz' }]);
  });

  it('upserts an active subscription with the resolved plan and ISO period end', async () => {
    const store = new FakeStore();
    const event = subscriptionEvent('customer.subscription.created', {
      metadata: { user_id: 'user_3' },
    });

    const result = await handleStripeEvent(event, store);

    expect(result.handled).toBe(true);
    expect(store.upserts).toHaveLength(1);
    const row = store.upserts[0]!;
    expect(row.userId).toBe('user_3');
    expect(row.plan).toBe('pro');
    expect(row.status).toBe('active');
    expect(row.priceId).toBe('price_pro');
    expect(row.cancelAtPeriodEnd).toBe(false);
    expect(row.currentPeriodEnd).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it('resolves user via customer reverse-lookup when subscription metadata lacks user_id', async () => {
    const store = new FakeStore();
    store.customers.set('user_4', 'cus_known');
    const event = subscriptionEvent('customer.subscription.updated', {
      customer: 'cus_known',
      metadata: {},
    });

    const result = await handleStripeEvent(event, store);

    expect(result.handled).toBe(true);
    expect(store.upserts[0]!.userId).toBe('user_4');
  });

  it('downgrades plan to free when the subscription is deleted/canceled', async () => {
    const store = new FakeStore();
    const event = subscriptionEvent('customer.subscription.deleted', {
      status: 'canceled',
      metadata: { user_id: 'user_5' },
    });

    await handleStripeEvent(event, store);

    expect(store.upserts[0]!.plan).toBe('free');
    expect(store.upserts[0]!.status).toBe('canceled');
  });

  it('is a no-op for unhandled event types', async () => {
    const store = new FakeStore();
    const event = { type: 'invoice.paid', data: { object: {} } } as unknown as Stripe.Event;

    const result = await handleStripeEvent(event, store);

    expect(result.handled).toBe(false);
    expect(store.upserts).toHaveLength(0);
    expect(store.links).toHaveLength(0);
  });

  it('ignores subscription events that cannot be mapped to a user', async () => {
    const store = new FakeStore();
    const event = subscriptionEvent('customer.subscription.updated', {
      customer: 'cus_unknown',
      metadata: {},
    });

    const result = await handleStripeEvent(event, store);

    expect(result.handled).toBe(false);
    expect(store.upserts).toHaveLength(0);
  });
});
