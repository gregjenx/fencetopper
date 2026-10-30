// llms.txt: a plain-text summary for AI assistants and answer engines.
import { brand, colors, heights, specs, faqs, pricing } from '../data/site';

export function GET() {
  const body = `# ${brand.name}

> ${brand.description}

${brand.name} (${brand.domain}) sells a ${brand.descriptor.toLowerCase()}: a modular mesh panel that raises an existing backyard fence up to 2 feet, mounted on extension posts. It works on chain link and round steel posts (2 3/8 in and 1 5/8 in) and wood 4x4 posts. Tagline: "${brand.tagline}"

## Key facts
- Heights: ${heights.min} to ${heights.max} in, in ${heights.step} in steps. ${heights.default} in is most popular and turns a 6 ft fence into 7 ft 6 in.
- Colors: ${colors.map((c) => c.name).join(', ')}.
${specs.map(([k, v]) => `- ${k}: ${v}`).join('\n')}
- Pricing: $${pricing.perSqFt} per square foot of topper (run length × topper height), plus $${pricing.perMiddlePost} per middle post and $${pricing.perPanel} per panel (one panel per run).
- Sold online with an instant estimate. Posts (fence extenders) are supplied and installed by the customer or their contractor.

## Pages
- [Price builder](${brand.url}/shop): enter fence runs, height and color for an estimate, then send it to us for review.
- [Visualizer](${brand.url}/visualizer): preview a to-scale topper on a photo of your fence.
- [Measuring guide](${brand.url}/measure): how to measure a fence for a topper.
- [Fence post extenders](${brand.url}/fence-extenders): the customer-supplied extension posts for chain link, round steel and wood fences, with cut lengths and leveling.
- [Installation guide](${brand.url}/install): seven-step DIY installation.
- [How it's built](${brand.url}/product): construction and specifications.
- [FAQ](${brand.url}/faq)

## FAQ
${faqs.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
