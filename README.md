# Handfish for Mastodon

The [Handfish](https://handfish.noisefactor.io) design system as Mastodon themes.

## What This Is

A set of Mastodon themes built from the Handfish design language — OKLCH color palettes, themed typography, glassmorphism, consistent spacing. There are two ways to ship them:

- **Selectable themes for Mastodon 4.6+** (recommended). Every Handfish variant is baked into a custom Mastodon image and registered in `config/themes.yml`, so users pick one from Preferences > Appearance. The Handfish palette is bound **directly** onto Mastodon 4.6's `--color-*` design tokens — no intermediate variable layer. See [docs/mastodon-theme-integration.md](docs/mastodon-theme-integration.md) and `npm run build:mastodon46`.
- **Standalone CSS** for the admin Custom CSS box or a browser extension (a single site-wide look). This older build layers Handfish tokens over the [TangerineUI for Mastodon](https://github.com/nileane/TangerineUI-for-Mastodon) base by Nileane. That upstream is discontinued, so the Mastodon 4.6 path above is the one under active development.

## Mastodon 4.6 themes (recommended)

```bash
npm install
npm run build:mastodon46   # -> dist/mastodon46/ (theme entrypoints, themes.yml + locale fragments, Dockerfile)
```

Build the image from `dist/mastodon46/` and point your `web`/`sidekiq` services at it. Full walkthrough: [docs/mastodon-theme-integration.md](docs/mastodon-theme-integration.md).

## Standalone CSS (legacy)

```bash
npm run build                                    # modular output
npm run build:standalone                         # standalone with default tokens
node scripts/build.js --standalone --theme cyberpunk  # standalone with a specific theme
```

Paste the contents of `dist/handfish-mastodon-standalone.css` into your instance's **Custom CSS** field (Administration > Server Settings > Appearance), or load it directly:

```html
<link rel="stylesheet" href="https://handfish.noisefactor.io/0/styles/tokens.css">
<link rel="stylesheet" href="https://handfish.noisefactor.io/0/styles/themes/cyberpunk.css">
<link rel="stylesheet" href="handfish-mastodon.css">
```

## Content Security Policy

Handfish for Mastodon loads fonts (and, for direct linking, stylesheets) from a privacy-respecting CDN with no tracking, cookies, or analytics. If your Mastodon instance uses a Content Security Policy, add these origins:

```
font-src https://fonts.noisefactor.io;
style-src https://handfish.noisefactor.io;
```

The 4.6 themes and the standalone build only require `font-src`. Direct linking requires both.

## Available Themes

`dark` (default), `light`, `brutalist`, `corporate`, `cyberpunk`, `dusk`, `earthy`, `gothic`, `gray-dark`, `gray-light`, `high-contrast-dark`, `high-contrast-light`, `kawaii`, `neutral-dark`, `neutral-light`, `newspaper`, `ocean`, `organic`, `rave`, `sunset`, `synthwave`, `terminal`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for build prerequisites and guidelines.

**Note:** The standalone build requires the [Handfish](https://github.com/noisedeck/handfish) repo cloned as a sibling directory (`../handfish/`). The modular build (`npm run build`) works without it.

## Credits

The standalone/legacy CSS is based on [TangerineUI for Mastodon](https://github.com/nileane/TangerineUI-for-Mastodon) by Nileane (MIT). See LICENSE.

## License

MIT. See LICENSE.
