import { products } from '../lib/products.mjs';

const defaultSiteUrl = 'https://mcsithlaos13.github.io/Sit-damo';

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || 'https://mcsithlaos13.github.io')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function json(body, status = 200, origin = '') {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Origin' };
  if (origin && allowedOrigins().includes(origin.replace(/\/$/, ''))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('origin') || '';
    if (origin && !allowedOrigins().includes(origin.replace(/\/$/, ''))) {
      return json({ error: 'เว็บไซต์นี้ไม่ได้รับอนุญาตให้เริ่มชำระเงิน' }, 403);
    }
    if (request.method === 'OPTIONS') return json({}, 204, origin);
    if (request.method !== 'POST') return json({ error: 'รองรับเฉพาะการสร้างรายการชำระเงิน' }, 405, origin);
    if (!process.env.STRIPE_SECRET_KEY) return json({ error: 'ระบบชำระเงินยังตั้งค่าไม่ครบ กรุณาติดต่อร้านค้า' }, 503, origin);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'ข้อมูลคำสั่งซื้อไม่ถูกต้อง' }, 400, origin); }

    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const paymentMethod = body.paymentMethod;
    const items = body.items;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
      return json({ error: 'กรุณาตรวจชื่อและอีเมลอีกครั้ง' }, 400, origin);
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 7 || !['card', 'promptpay'].includes(paymentMethod)) {
      return json({ error: 'รายการสินค้า หรือช่องทางชำระเงินไม่ถูกต้อง' }, 400, origin);
    }

    const seen = new Set();
    const orderItems = [];
    for (const item of items) {
      const product = Object.hasOwn(products, item?.id) ? products[item.id] : null;
      const quantity = Number(item?.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 5 || seen.has(item.id)) {
        return json({ error: 'มีรายการสินค้าที่ไม่ถูกต้อง' }, 400, origin);
      }
      seen.add(item.id);
      orderItems.push({ product, quantity });
    }

    const siteUrl = (process.env.SITE_URL || defaultSiteUrl).replace(/\/$/, '');
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('customer_email', email);
    form.set('success_url', `${siteUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set('cancel_url', `${siteUrl}/?payment=cancel`);
    form.set('metadata[buyer_name]', name);
    form.set('metadata[store]', 'noise-dept');
    form.set('payment_method_types[0]', paymentMethod);

    orderItems.forEach(({ product, quantity }, index) => {
      form.set(`line_items[${index}][price_data][currency]`, 'thb');
      form.set(`line_items[${index}][price_data][unit_amount]`, String(product.price * 100));
      form.set(`line_items[${index}][price_data][product_data][name]`, product.name);
      form.set(`line_items[${index}][price_data][product_data][description]`, product.description);
      form.set(`line_items[${index}][quantity]`, String(quantity));
    });

    try {
      const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });
      const session = await stripeResponse.json();
      if (!stripeResponse.ok || !session.url) {
        console.error('Stripe Checkout session creation failed:', session?.error?.type || stripeResponse.status);
        return json({ error: 'สร้างหน้าชำระเงินไม่สำเร็จ กรุณาลองใหม่ภายหลัง' }, 502, origin);
      }
      return json({ url: session.url }, 200, origin);
    } catch (error) {
      console.error('Stripe Checkout request failed:', error?.name || 'UnknownError');
      return json({ error: 'เชื่อมต่อผู้ให้บริการชำระเงินไม่สำเร็จ' }, 502, origin);
    }
  },
};
