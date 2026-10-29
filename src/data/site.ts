// Single source of truth for brand, product facts, pricing and FAQs.
// Product facts come from the Fence Topper visual brief. Anything marked
// PLACEHOLDER still needs a real value before launch.

// Changes on every build so browsers fetch fresh CSS and JS instead of a stale cached copy.
export const assetVersion = Date.now().toString(36);

export const brand = {
  name: 'FenceTopper',
  domain: 'fencetopper.com',
  url: 'https://fencetopper.com',
  tagline: 'Extend privacy to your backyard.',
  description:
    'FenceTopper adds 12 to 24 inches of privacy, in 1 inch steps, above your existing fence. A tensioned outdoor mesh panel runs between posts you install above your fence. Measured online, built to your runs.',
  email: 'support@fencetopper.com',
  phone: '(406) 306-0663',
};

// Launch switches. Greg, 2026-10-28: launch the site and Shop first. The Builder, My projects,
// sign-in and staff pages stay off until they have a server, real accounts and a database.
export const features = { builder: false };

// Where Shop project requests and the contact form are sent: any endpoint that accepts a JSON POST
// (Formspree, Basin, Getform or your own). Empty means not connected yet.
export const forms = { endpoint: 'https://formspree.io/f/xeaaznoz' };

export const nav = [
  { href: '/shop', label: 'Shop' },
  { href: '/visualizer', label: 'Visualizer' },
  { href: '/measure', label: 'Measuring' },
  { href: '/fence-extenders', label: 'Fence extenders' },
  { href: '/product', label: 'How it’s built' },
  { href: '/faq', label: 'FAQ' },
];

export const footerNav = [
  { href: '/measure', label: 'Measuring guide' },
  { href: '/install', label: 'Installation guide' },
  { href: '/fence-extenders', label: 'Fence extenders' },
  { href: '/shipping', label: 'Shipping & returns' },
  { href: '/support', label: 'Support' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const colors = [
  { id: 'carbon', name: 'Carbon', hex: '#3A3C3F', note: 'Charcoal with cool-gray variation. Our most popular color.' },
  { id: 'black', name: 'Black', hex: '#111214', note: 'Architectural black for modern and dark-stained fences.' },
  { id: 'evergreen', name: 'Evergreen', hex: '#3A4B3C', note: 'Deep moss green that blends into planting.' },
  { id: 'brown', name: 'Brown', hex: '#5A4134', note: 'Espresso-to-walnut brown for cedar and stained wood.' },
];

// Topper height: any whole inch from 12 to 24 (Greg, 2026-10-21). 18 in is the default and most popular.
export const heights = { min: 12, max: 24, step: 1, default: 18, label: '12 to 24 in, in 1 in steps' };
export const heightList = Array.from({ length: heights.max - heights.min + 1 }, (_, i) => heights.min + i);

export const pricing = {
  // Greg's rates. They change with costs: edit them here only. Every price on the site, the JSON-LD,
  // kb.json, llms.txt and the chat read from this object. Area = run length x topper height, summed over runs.
  perSqFt: 14,
  perMiddlePost: 40, // each post between a run's two end posts
  maxPostSpacingFt: 15, // estimates middle posts per run: max(0, ceil(ft / 15) - 1)
  perPanel: 120, // one panel per run
  freeShippingOver: 199,
};

export const specs = [
  ['Topper height', '12 to 24 inches, in 1 inch steps'],
  ['Fabric', 'Smooth woven outdoor mesh with an acrylic-coated, water-repellent finish'],
  ['Colors', 'Carbon, Black, Evergreen, Brown'],
  ['Posts', 'Customer-supplied fence extenders; see the extender options'],
  ['Battens', '3/8 in round fiberglass rods sewn into vertical channels'],
  ['Hems', '2 in deep, double-stitched, top and bottom'],
  ['Webbing', 'Two continuous 1 in black webbing lengths inside the top and bottom hems that become the end straps'],
  ['Fasteners', 'Black pull-through strap adjusters, top and bottom at each end'],
  ['Length adjustment', 'About 4 to 6 in total across both ends'],
  ['Inner posts', 'Oversized two-sided pocket with about 1.5 in of side-to-side adjustment'],
  ['End covers', 'Removable fabric covers attach with a 2 in hook-and-loop strip'],
  ['Corners', 'Two straight panels meet at a shared corner post (customer supplied)'],
];

// Fence extender options (customer supplied). From the Fence Extension Hardware Options brief, 2026-10-21.
// Every option is still being tested: don't call any of them recommended or approved.
// Links were checked Oct 2026. No prices: they change.
export const extenderOptions = [
  { id: 'ozco', group: 'round', type: 'internal', name: 'OZCO 3 ft internal post extender', fits: '2 3/8 in OD round steel posts', rise: '36 in tube, cut to length', note: 'Locks inside the post, so the outside stays clean. Cut the tube 1 in longer than the topper on a level run.', links: [['OZCO at Signet Fence', 'https://www.signetfence.com/3-oz-fence-post-extender-from-ozco-building-products/'], ['Manufacturer page', 'https://ozcobp.com/product/oz-fence-post-extender/']] },
  { id: 'swaged-galv', group: 'round', type: 'swaged', name: 'Galvanized swaged extension', fits: '1 5/8, 1 7/8 or 2 3/8 in round posts (check the inside diameter)', rise: 'Usually 24 in', note: 'Slides into the post. Fasten it with screws or a through bolt; don’t rely on a friction fit.', links: [['American Fence post extensions', 'https://www.afence.com/post-extensions.html']] },
  { id: 'swaged-black', group: 'round', type: 'swaged', name: 'Black swaged extension', fits: '1 5/8 in round posts', rise: '24 in', note: 'Black finish. Comes with a cap and a self-tapping screw.', links: [['CritterFence 1 5/8 in extension', 'https://www.critterfence.com/fence-extensions-for-2-feet-taller-1-5-8-post.aspx']] },
  { id: 'outdeco', group: 'wood', type: 'face', name: 'OUTDECO ODFE39 extension leg', fits: 'Fastens down the face of a wood fence into rails or framing', rise: '13 to 16 in above the fence', note: 'For shorter toppers, about 12 to 15 1/2 in. The 23 in leg stays visible on one side.', links: [['OUTDECO ODFE39 at The Home Depot', 'https://www.homedepot.com/p/OUTDECO-39-in-x-1-in-Black-Galvanized-Steel-Fence-Extension-Leg-for-Decorative-Screen-Panel-ODFE39/329159711']] },
  { id: 'side-pipe', group: 'wood', type: 'side', name: 'Side-mounted round or square pipe', fits: 'Sound 4x4 wood posts', rise: 'Cut to the length you need', note: 'Lag-bolted into the side of the post through drilled holes or with clamps. Best done by a contractor.', links: [] },
  { id: 'custom', group: 'other', type: 'custom', name: 'Custom fence extension', fits: 'Your own design', rise: 'Your choice', note: 'Describe it and send a photo or drawing, and we’ll review whether the topper can be adapted.', links: [] },
];

export const faqs = [
  {
    q: 'What is FenceTopper?',
    a: 'FenceTopper is a privacy extension that mounts above your existing fence. A tensioned outdoor mesh panel runs between posts you install above your fence and adds 12 to 24 inches of screening, in 1 inch steps, without replacing the fence.',
    tags: ['what', 'product', 'about', 'is'],
  },
  {
    q: 'How tall should my fence topper be?',
    a: 'You can choose any height from 12 to 24 inches, in 1 inch steps. Most customers choose 18 inches, which turns a 6 ft fence into 7 ft 6 in. Go lower for a low sightline such as a neighbor’s patio, and higher when you need to screen a deck or a second-floor window. The visualizer shows any height on a photo of your fence.',
    tags: ['height', 'tall', 'size', '12', '18', '24', 'choose'],
  },
  {
    q: 'How do I measure my fence for a topper?',
    a: 'Measure each straight, level run of fence from end post to end post in feet and inches. Where the fence turns a corner or steps up or down, start a new run, and leave out gates. Measure your fence height too. The measuring guide walks through it and the price builder turns your runs into a price. Fences that follow a continuous slope are not currently supported.',
    tags: ['measure', 'measuring', 'length', 'feet', 'tape', 'run'],
  },
  {
    q: 'Can I install it myself?',
    a: 'Yes. You or your contractor install the fence extenders (the posts that hold the topper above your fence), then slide the panel over the inner posts, wrap the end straps around the outer posts, pull them snug and set the height with a screw at each center post. The installation guide shows each step.',
    tags: ['install', 'diy', 'myself', 'tools', 'easy', 'installation', 'hard'],
  },
  {
    q: 'What tools do I need to install it?',
    a: 'A tape measure, a drill or driver, a level and a pencil. Fence extenders and their mounting hardware aren’t included; see the options on our Fence extenders page.',
    tags: ['tools', 'drill', 'need', 'hardware'],
  },
  {
    q: 'Does it work on wood, vinyl and composite fences?',
    a: 'FenceTopper is shown on cedar, horizontal slat, painted wood and composite fences. You or your contractor attach fence extenders to your existing fence posts, and the panel mounts between them. Send us a photo through support if you are unsure about your fence.',
    tags: ['vinyl', 'wood', 'composite', 'cedar', 'metal', 'fence type', 'chain', 'work', 'material'],
  },
  {
    q: 'How does it handle corners?',
    a: 'At a 90-degree corner, two separate straight panels meet at one shared corner post. Each panel ends with its own straps and removable cover, so the fabric never has to bend around the corner.',
    tags: ['corner', 'corners', '90', 'angle', 'turn'],
  },
  {
    q: 'Will it stay tight, or will it sag?',
    a: 'The panel is tensioned from both ends through pull-through strap adjusters, and fiberglass battens keep the edges straight. All posts hold the panel at the same height, so there is no dip at the center posts. You can re-tension the straps at any time.',
    tags: ['sag', 'tight', 'tension', 'loose', 'droop'],
  },
  {
    q: 'How does it hold up to wind and weather?',
    a: 'The fabric is a woven outdoor mesh, so air passes through it instead of loading the fence like a solid board. It has a water-repellent acrylic-coated finish. Wind and UV ratings will be published once testing is complete.',
    tags: ['wind', 'weather', 'rain', 'sun', 'uv', 'storm', 'snow', 'durable', 'last'],
  },
  {
    q: 'What colors are available?',
    a: 'Carbon, Black, Evergreen and Brown. Carbon is the most popular and suits most fences. Order a swatch kit if you want to compare colors against your fence first.',
    tags: ['color', 'colors', 'colour', 'carbon', 'black', 'green', 'evergreen', 'brown', 'swatch'],
  },
  {
    q: 'How much does a fence topper cost?',
    a: `$${pricing.perSqFt} per square foot of topper, plus $${pricing.perMiddlePost} for each middle post and $${pricing.perPanel} for each panel. Enter your runs in Shop for an estimate.`,
    tags: ['price', 'cost', 'how much', 'expensive', 'quote', '$'],
  },
  {
    q: 'Do I need permission from my HOA or city?',
    a: 'Many cities limit backyard fence height to 6 to 8 ft, and HOAs may have their own rules. Check your local code and HOA before you order. Because FenceTopper comes in 1 inch steps from 12 to 24 inches, it’s easy to pick the tallest topper that stays under your limit.',
    tags: ['hoa', 'permit', 'city', 'code', 'legal', 'allowed', 'regulation', 'neighbor'],
  },
  {
    q: 'How long does shipping take?',
    a: 'Orders ship to your door in one box. Shipping times and costs are shown at checkout.',
    tags: ['ship', 'shipping', 'delivery', 'arrive', 'deliver'],
  },
  {
    q: 'Can I take it down for winter?',
    a: 'Yes. Loosen the straps, lift the panel off the posts and store it dry. The posts can stay in place.',
    tags: ['remove', 'winter', 'take down', 'store', 'season'],
  },
  {
    q: 'Are posts included with FenceTopper?',
    a: 'No. You or your contractor provide and install the fence extenders, the posts that hold the topper above your fence. Our Fence extenders page shows the options by fence type, and FenceTopper builds the panel to fit your approved layout.',
    tags: ['posts', 'included', 'extender', 'extenders', 'supply', 'provide', 'hardware'],
    topic: 'extenders',
  },
  {
    q: 'Which extender fits my fence?',
    a: 'It depends on your fence. Round steel posts take an insert-style extender sized to the post, such as the OZCO internal extender for 2 3/8 in posts or a swaged extension for 1 5/8 in posts. Wood fences can use a face-mounted leg or a pipe bolted to the side of a sound 4x4 post. Our Fence extenders page shows each option and what it fits.',
    tags: ['which', 'extender', 'fits', 'fit', 'steel', 'wood', '4x4', 'chain link', 'post size'],
    topic: 'extenders',
  },
  {
    q: 'How tall should the extender be?',
    a: 'Each extender should rise about 1 in above the topper. On a level run, cut an OZCO tube 1 in longer than the topper height, so a 24 in topper uses a 25 in tube. If your post tops aren’t level, set the two end extenders, stretch a mason’s line between them and cut each middle extender to meet the line.',
    tags: ['how tall', 'extender', 'height', 'cut', 'length', 'level', 'mason'],
    topic: 'extenders',
  },
  {
    q: 'Can I use my own extender design?',
    a: 'Yes. Describe it when you send us your project, or email us a photo or drawing with its profile and size. We’ll review whether the topper can be adapted to it. That review isn’t an engineering approval.',
    tags: ['custom', 'own', 'design', 'diy', 'extender', 'different'],
    topic: 'extenders',
  },
  {
    q: 'Do I need a contractor for the extenders?',
    a: 'It’s up to you and depends on the option. Side-mounted pipe on wood posts is best done by a contractor. Either way, make sure your posts, footings and fasteners can carry the taller fence, and check your local height rules.',
    tags: ['contractor', 'diy', 'myself', 'extender', 'install', 'hire'],
    topic: 'extenders',
  },
];
