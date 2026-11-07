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
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('origin') || '';
    if (origin && !allowedOrigins().includes(origin.replace(/\/$/, ''))) {
      return json({ error: 'เว็บไซต์นี้ไม่ได้รับอนุญาต' }, 403);
    }
    if (request.method === 'OPTIONS') return json({}, 204, origin);
    if (request.method !== 'GET') return json({ error: 'รองรับเฉพาะการตรวจสอบสถานะ' }, 405, origin);
    if (!process.env.STRIPE_SECRET_KEY) return json({ error: 'ระบบชำระเงินยังตั้งค่าไม่ครบ' }, 503, origin);

    const sessionId = new URL(request.url).searchParams.get('session_id') || '';
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      return json({ error: 'หมายเลขรายการไม่ถูกต้อง' }, 400, origin);
    }

    try {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });
      const session = await response.json();
      if (!response.ok || session?.metadata?.store !== 'noise-dept') {
        return json({ error: 'ไม่พบรายการชำระเงินนี้' }, 404, origin);
      }
      return json({ status: session.status, payment_status: session.payment_status }, 200, origin);
    } catch (error) {
      console.error('Stripe Checkout status request failed:', error?.name || 'UnknownError');
      return json({ error: 'ตรวจสอบสถานะการชำระเงินไม่สำเร็จ' }, 502, origin);
    }
  },
};
