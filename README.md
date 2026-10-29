# FenceTopper website (fencetopper.com)

Static Astro site: mobile-first, no client framework, built for search engines and AI answer engines.

## Run it
```
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs dist/, deploy to Netlify, Vercel or Cloudflare Pages
```
`node scripts/make-preview.mjs` (after a build) makes `preview/`, a copy with relative `.html` links that opens as plain files.

## Where things live
- `src/data/site.ts` holds brand, colors, heights, specs, FAQs and **placeholder pricing**. Edit here first; pages, schema, chat answers, sitemap and llms.txt all read from it.
- `src/layouts/Base.astro`: head tags, JSON-LD, header, footer, chat panel.
- `src/pages/`: home, shop (price builder), visualizer, measure, install, product, faq, support, shipping, contact, about, cart, 404, plus `kb.json`, `sitemap.xml` and `llms.txt` endpoints.
- `public/js/site.js`: menu, cart (localStorage), quote math, help chat. `shop.js` and `visualizer.js` power those pages.
- `public/img/`: WebP versions of the product images.

## Search and AI optimization
Per-page titles, descriptions and canonicals; Open Graph; JSON-LD for Organization, WebSite, Product, FAQPage, HowTo (measure, install) and BreadcrumbList; `sitemap.xml`; `robots.txt` that allows AI crawlers; `llms.txt` summary; semantic HTML and fast static pages.

## Placeholders to replace before launch
- Prices, post spacing and max panel length (`pricing` in `src/data/site.ts`)
- Checkout (cart page button; connect Shopify, Stripe or similar)
- Contact form delivery, support email and phone
- Shipping and return policy text
- Post mounting bracket design (install step 2) and box contents
- Wind, UV and hardware ratings
- Visualizer AI auto-fit (manual handles work today)
- Help chat runs on FAQ matching in the browser; it can be upgraded to an AI model using `kb.json` as context
- Founder story on the About page, installation video
