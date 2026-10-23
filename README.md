# Bunini Loves: demo storefront

A public **showcase** of the Bunini Loves online store (pastel stationery boutique, Philippines).

> **This is a demo.** Every product, review, event, and news post is made-up sample data that lives in your browser tab.
> Nothing is saved, no payments are taken, and there is no real backend or database in this repository. The owner admin is a working demo on the same sample data.

## What you can try

- Browse and search the shop, filter by category, sort, and open product pages (with options, reviews and ratings)
- Add to cart, apply a discount code (`WELCOME10`, `BUNNY50` over ₱500), and walk through the full checkout
- Create an account with **any** email and password
- Upload any file as a "payment screenshot": the demo order then moves along by itself (processing → shipped → delivered) so you can leave a review
- Wishlist, events with calendar export, news, and a currency picker (display-only estimates)

## Try the owner admin

Sign in with **Admin@gmail.com** and password **admin1234**, then open **Admin** in the menu. (Every other email still signs in with any password.) You can:

- see the dashboard, and move orders along (check a payment proof, pack, ship with a tracking number, cancel)
- add, edit, archive or delete products, upload pictures, and adjust stock
- manage customers, discount codes, reviews (hide or reply), and news & events
- set up **couriers** (J&T Express, LBC): add, rename, remove, mark one *temporarily unavailable* (shown crossed out at checkout), and change each courier's fee for Metro Manila, the rest of Luzon, the Visayas and Mindanao

Admin changes show up in the store straight away. Everything is made up and resets when you refresh.

## Pictures

Put your photos in `public/photos/` with these names: `stationery.jpg`, `sticker.jpg`, `nb.jpg` (one per category) and `bz1.jpg`, `bz2.jpg`, `bz3.jpg` (bazaar events). Until a file is there, a generated picture shows instead.

Data resets whenever you refresh the page.

## Run it locally

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Push this repo to GitHub (branch `main`).
2. In the repo go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow builds and publishes the site on every push. Your demo will be at `https://<user>.github.io/<repo>/`.

## Tech

React, TypeScript, Vite, Tailwind CSS, React Router, React Hook Form, Zod, Framer Motion.
The real store talks to a private backend. In this demo, `src/lib/supabase.ts` is a small in-memory stand-in, and `src/lib/demoData.ts` holds the sample data.

## License / usage

© 2026 All rights reserved. This code and artwork were created as a personal project for Bunini Loves. Please don’t copy or republish them as your own.
