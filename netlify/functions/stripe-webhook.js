// FuneralOS — Stripe webhook (zero external dependencies)
// Uses native Node.js crypto + fetch (Node 18+, available on Netlify)
// Env vars needed: STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const crypto = require('crypto');

function verifyStripeSignature(rawBody, sigHeader, secret) {
  try {
    const parts = sigHeader.split(',');
    const ts = (parts.find(p => p.startsWith('t=')) || '').split('=')[1];
    const sigs = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
    if (!ts || !sigs.length) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${rawBody}`, 'utf8')
      .digest('hex');
    return sigs.some(s => {
      try { return crypto.timingSafeEqual(Buffer.from(s, 'hex'), Buffer.from(expected, 'hex')); }
      catch { return false; }
    });
  } catch { return false; }
}

async function supabaseUpsert(table, record, onConflict) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(record),
    }
  );
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !sig || !verifyStripeSignature(event.body, sig, secret)) {
    return { statusCode: 400, body: 'Webhook signature verification failed' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const email = session.customer_details?.email || session.customer_email;
    const plan = session.metadata?.plan || 'pro';
    const stripeCustomerId = session.customer;

    if (email && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await supabaseUpsert(
        'profiles',
        { email, plan, stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() },
        'email'
      );
    }
  }

  return { statusCode: 200, body: 'ok' };
};
