import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import { features } from './src/data/site.ts';

// Pages left out of dist/ while their switch is off: the Builder with features.builder, and the
// browser-only sign-in, My projects and staff pages with features.preview.
const switched = [
  { on: features.builder, pages: ['project'], js: ['builder.js', 'projects.js'] },
  { on: features.preview, pages: ['account', 'projects', 'staff', 'staff-project', 'staff-rates'], js: ['account.js', 'staff.js'] },
];
const launchSwitch = {
  name: 'launch-switch',
  hooks: {
    'astro:build:done': ({ dir }) => {
      for (const s of switched.filter((x) => !x.on)) {
        for (const f of s.pages) fs.rmSync(new URL(f + '.html', dir), { force: true });
        for (const f of s.js) fs.rmSync(new URL('js/' + f, dir), { force: true });
      }
    },
  },
};

// Static site. Pages build to flat files (measure.html) so clean URLs work on
// Netlify, Vercel and Cloudflare Pages without extra config.
export default defineConfig({
  site: 'https://fencetopper.com',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
  integrations: [launchSwitch],
});
