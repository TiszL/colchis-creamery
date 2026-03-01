// PLACEHOLDER: Stripe integration
// Replace with real Stripe client when company is established and Stripe account is created.

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

export function isStripeConfigured(): boolean {
  return !!STRIPE_KEY && STRIPE_KEY !== "sk_placeholder";
}

export async function createCheckoutSession(items: { priceId: string; quantity: number }[]) {
  if (!isStripeConfigured()) {
    console.warn("[Stripe Placeholder] createCheckoutSession called without valid Stripe key");
    return {
      id: "placeholder_session_" + Date.now(),
      url: null,
      status: "placeholder",
    };
  }

  // TODO: Real Stripe implementation
  // const stripe = new Stripe(STRIPE_KEY);
  // return stripe.checkout.sessions.create({ ... });
  return {
    id: "placeholder_session_" + Date.now(),
    url: null,
    status: "placeholder",
  };
}

export async function createPaymentIntent(amount: number, currency = "usd") {
  if (!isStripeConfigured()) {
    console.warn("[Stripe Placeholder] createPaymentIntent called without valid Stripe key");
    return {
      id: "placeholder_pi_" + Date.now(),
      clientSecret: null,
      status: "placeholder",
    };
  }

  // TODO: Real Stripe implementation
  return {
    id: "placeholder_pi_" + Date.now(),
    clientSecret: null,
    status: "placeholder",
  };
}

export async function createInvoice(customerId: string, items: { description: string; amount: number; quantity: number }[]) {
  if (!isStripeConfigured()) {
    console.warn("[Stripe Placeholder] createInvoice called without valid Stripe key");
    return {
      id: "placeholder_inv_" + Date.now(),
      hostedUrl: null,
      status: "placeholder",
    };
  }

  // TODO: Real Stripe implementation
  return {
    id: "placeholder_inv_" + Date.now(),
    hostedUrl: null,
    status: "placeholder",
  };
}
