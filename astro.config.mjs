import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import { features } from './src/data/site.ts';

// With features.builder off, the Builder, account and staff pages are left out of dist/.
const builderPages = ['account', 'projects', 'project', 'staff', 'staff-project', 'staff-rates'];
const launchSwitch = {
  name: 'launch-switch',
  hooks: {
    'astro:build:done': ({ dir }) => {
      if (features.builder) return;
      for (const f of builderPages) fs.rmSync(new URL(f + '.html', dir), { force: true });
      for (const f of ['account.js', 'builder.js', 'projects.js', 'staff.js']) fs.rmSync(new URL('js/' + f, dir), { force: true });
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
