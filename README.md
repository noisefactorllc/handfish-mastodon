# Handfish for Mastodon

The [Handfish](https://handfish.noisefactor.io) design system as a Mastodon theme.

Based on [TangerineUI-for-Mastodon](https://github.com/nileane/TangerineUI-for-Mastodon) by Nileane.

## What This Is

A Mastodon CSS theme that combines TangerineUI's UX improvements (compact timeline, interaction animations, icon system, DM styling) with Handfish's design language (OKLCH colors, glassmorphism, themed typography, consistent spacing).

Supports all Handfish themes.

## Usage

### Option A: Separate Stylesheets (Untested)

Load Handfish tokens, an optional theme, then handfish-mastodon:

```html
<link rel="stylesheet" href="https://handfish.noisefactor.io/0/styles/tokens.css">
<link rel="stylesheet" href="https://handfish.noisefactor.io/0/styles/themes/cyberpunk.css">
<link rel="stylesheet" href="handfish-mastodon.css">
```

### Option B: Mastodon Admin Panel

Paste the contents of `dist/handfish-mastodon-standalone.css` into your instance's **Custom CSS** field (Administration > Server Settings > Appearance).

### Option C: Browser Extension

Use [Stylus](https://add0n.com/stylus.html) or similar to inject the standalone CSS.

## Content Security Policy

Handfish for Mastodon loads fonts and (optionally) stylesheets from a privacy-respecting CDN with no tracking, cookies, or analytics. If your Mastodon instance uses a Content Security Policy, add these origins:

```
font-src https://fonts.noisefactor.io;
style-src https://handfish.noisefactor.io;
```

The standalone build (Option B) only requires `font-src`. Direct linking (Option A) requires both.

## Building

```bash
npm install
npm run build                                    # modular output
npm run build:standalone                         # standalone with default tokens
node scripts/build.js --standalone --theme cyberpunk  # standalone with specific theme
```

For Mastodon 4.6 selectable themes, see [docs/mastodon-theme-integration.md](docs/mastodon-theme-integration.md) and `npm run build:mastodon46`.

## Available Themes

Each standalone build bakes in a specific theme. Pick the CSS file that matches the look you want:

`dark` (default), `light`, `brutalist`, `corporate`, `cyberpunk`, `dusk`, `earthy`, `gothic`, `gray-dark`, `gray-light`, `high-contrast-dark`, `high-contrast-light`, `kawaii`, `neutral-dark`, `neutral-light`, `newspaper`, `ocean`, `organic`, `rave`, `sunset`, `synthwave`, `terminal`

For the modular build (Option A), load the matching Handfish theme stylesheet before handfish-mastodon.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for build prerequisites and guidelines.

**Note:** The standalone build requires the [Handfish](https://github.com/noisedeck/handfish) repo cloned as a sibling directory (`../handfish/`). The modular build (`npm run build`) works without it.

## License

MIT. See LICENSE.
