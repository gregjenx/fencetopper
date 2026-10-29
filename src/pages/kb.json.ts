// Knowledge base for the on-site help chat, built from the same data as the FAQ page.
import { faqs, pricing, colors, heights, brand } from '../data/site';

export function GET() {
  return new Response(JSON.stringify({ faqs, pricing, colors, heights, email: brand.email }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
