# Publishing fencetopper.com

The site is a static Astro build. `npm run build` writes plain files to `dist/`, so any static host can serve it. The steps below use Cloudflare Pages for hosting and Cloudflare for DNS. The domain stays registered at Namecheap. Cloudflare Pages serves `/shop` from `shop.html` on its own. `vercel.json` only matters if you host on Vercel instead.

## Launch version (site and Shop only)

Greg chose this version on 2026-10-28. The switch is in `src/data/site.ts`:

- `features.builder: false` leaves the Builder, My projects, sign-in and staff pages out of the build, and removes the account icon from the header. Set it to `true` to bring them back once they have a server, real accounts and a database.
- In Shop, "Build my Topper" now asks for the customer's name, email, optional mobile and notes, then sends you their runs, height, color, estimate and chosen extender. There's no code step and no payment.
- `forms.endpoint` decides where those requests and the contact form go. Cloudflare Pages has no built-in forms, so a form service relays each submission to support@fencetopper.com. Any service that accepts a JSON POST works:
  1. Sign up at formspree.io, which has a free tier.
  2. Create a form that delivers to support@fencetopper.com.
  3. Paste its URL, for example `https://formspree.io/f/abcd1234`, into `forms.endpoint`.

  This is now set to Greg's form, `https://formspree.io/f/xeaaznoz`, which delivers to greg@giverise.ai unless support@fencetopper.com is added in the form's Settings.

## Still to fill in before going live

| Item | Where |
|---|---|
| Checkout | `src/pages/cart.astro` isn't connected to payment. Leave it as is, or hide the cart icon |
| Other "Placeholder" tags | Shipping policy, box contents, ratings and similar, marked on the pages |

## Steps (with Claude Code)

1. **Create a GitHub repository.** Make it private, for example `fencetopper-site`.
2. **Push the source.** Copy `/mnt/project-files/fencetopper-site` to your computer, without `node_modules`, `dist` or `preview`. A `.gitignore` is already included.
3. **Add the domain to Cloudflare.** In Cloudflare, choose Add a domain and enter `fencetopper.com` on the Free plan.
   - Cloudflare imports your current DNS records. Check that the MX records are there, so email to support@fencetopper.com keeps working.
   - Cloudflare gives you two nameservers. In Namecheap, go to Domain List, then Manage, then Nameservers. Choose Custom DNS and enter the two Cloudflare nameservers.
   - The switch takes anywhere from a few minutes to 24 hours. Cloudflare emails you when it's active.
4. **Create the Pages project.** In Cloudflare, go to Workers & Pages, choose Create, then Pages, then Connect to Git, and pick the repo. Use these settings:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable: `NODE_VERSION` = `20`
5. **Check the preview URL.** Cloudflare gives you a `*.pages.dev` address. Open the main pages on your phone, and send a test from Shop and from the contact form.
6. **Connect the domain.** In the Pages project, go to Custom domains and add `fencetopper.com` and `www.fencetopper.com`. Because Cloudflare runs your DNS, it creates the records and the HTTPS certificate for you.
7. **Tell search engines.** Submit `https://fencetopper.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

Every later push to the main branch redeploys automatically.

If you'd rather keep hosting on Vercel and use Cloudflare only for DNS: do step 3, then in Cloudflare DNS add the A record and www CNAME that Vercel shows, set to **DNS only** (grey cloud), and add the domain in Vercel.

## A prompt you can paste into Claude Code

> This folder is the FenceTopper Astro site. Read README.md and docs/publish.md. Run `npm install` and `npm run build`, and fix any errors. Then create a private GitHub repo named fencetopper-site, commit, and push. Finally, walk me through moving fencetopper.com's DNS from Namecheap to Cloudflare, creating a Cloudflare Pages project with the settings in docs/publish.md, and adding the custom domain.
