import { brand } from '../data/site';

const pages = ['/', '/shop', '/visualizer', '/measure', '/fence-extenders', '/install', '/product', '/faq', '/support', '/shipping', '/contact', '/about'];

export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages.map((p) => `  <url><loc>${brand.url}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
