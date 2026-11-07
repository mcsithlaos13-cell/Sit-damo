# Stripe Checkout setup

This storefront creates Stripe Checkout Sessions on Vercel. Product IDs and prices are checked in the server function; the Stripe secret key is never sent to the browser.

## Vercel environment variables

In the Vercel project connected to this repository, add these values under **Settings → Environment Variables**, then redeploy:

- `STRIPE_SECRET_KEY` — start with a Stripe test secret key (`sk_test_…`). Use a live key only after the test flow and merchant account are ready.
- `SITE_URL` — the customer-facing return URL, for example `https://mcsithlaos13.github.io/Sit-damo`.
- `ALLOWED_ORIGINS` — the exact browser origin allowed to call the API, for example `https://mcsithlaos13.github.io` (no path or trailing slash).

Enable **Cards** and **PromptPay** for the Stripe account. Stripe Checkout hosts the card/QR form and returns the customer to the site.

If the storefront stays on GitHub Pages, set `window.NOISE_PAYMENT_API` in `payment-config.js` to the Vercel production origin, for example `https://your-project.vercel.app`. If the storefront is opened from that Vercel deployment, leave it empty so the API uses the same origin.

## Before selling downloads

The repository does not contain the plugin installers or sample-pack files yet. Payment status can be verified with Stripe, but the store cannot deliver downloads until the real product files and a delivery method are added. Do not advertise automatic delivery until that is configured.
