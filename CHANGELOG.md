# Changelog

## 0.2.2 — 2026-07-19

- Fix (`--mastodon46`): bind the modal overlay tokens (`--color-bg-overlay`, `--color-bg-overlay-base`, `--color-bg-overlay-highlight`) under the same `:root`-inclusive selector as the palette. Mastodon 4.6 defines them only under `[data-color-scheme='light'|'dark']`, so whenever the html attribute stays `auto` (e.g. a proxy CSP that blocks Mastodon's inline theme-selection script) they went undefined and `.modal-root__overlay` rendered transparent — confirm dialogs blended straight into the page (mastodon/mastodon#39869, reported on genart.social). The scrim follows the theme's own palette, not the OS scheme: near-black over dark themes, a background-colored wash over light ones, chosen from the resolved bg lightness at build time. Backdrops are now self-sufficient under `auto`; a few cosmetic scheme-gated tokens (`--dropdown-shadow`, favourite/bookmark highlight colors, graph fills) still depend on the instance letting Mastodon's inline theme-selection script run.

## 0.2.1 — 2026-07-02

- Fix (`--mastodon46`): bind the media/overlay tokens (`--color-text-on-media`, `--color-bg-media`, `--color-bg-media-base`, `--color-border-media`) under the same `:root`-inclusive selector as the palette. Mastodon 4.6 defines these only under `[data-color-scheme='light'|'dark']`, so with appearance `auto` (the default) they went undefined and on-media text inherited the theme's dark body color over the always-dark media scrim — unreadable alt-text/spoiler overlays in every light theme. Now white-on-dark under every scheme, matching Mastodon's intent; no light/dark regression.

## 0.2.0 — 2026-06-20

- Rebrand: "TangerineUI Handfish" → "Handfish for Mastodon" (`@noisedeck/tangerine-handfish` → `@noisefactorllc/handfish-mastodon`); Tangerine project branding dropped, upstream TangerineUI attribution kept
- Mastodon 4.6 support: new `--mastodon46` build binds the Handfish palette directly onto Mastodon 4.6's `--color-*` design tokens — no intermediate `--hf-*` layer. Ships theme entrypoints, `themes.yml` + locale fragments, and a Dockerfile in `dist/mastodon46/`
- All 22 Handfish themes selectable from Preferences > Appearance on Mastodon 4.6
- Release workflow now builds and publishes the 4.6 theme bundle (`handfish-mastodon-<tag>-mastodon46.tar.gz`) alongside the standalone CSS, and checks out the canonical `noisefactorllc/handfish` source

## 0.1.3 — 2026-03-26

- Add 11 new Handfish themes: brutalist, dusk, gothic, high-contrast-dark, high-contrast-light, kawaii, newspaper, ocean, rave, sunset, synthwave

## 0.1.0 — 2026-03-17

Initial release.

- TangerineUI v2.5.3 ported to the Handfish design system
- OKLCH token mapping bridges Handfish variables to TangerineUI expectations
- Icon recoloring — SVG data URIs adapt to theme accent colors
- Modular and standalone build modes via esbuild
- 11 Handfish themes supported: dark, light, cyberpunk, terminal, organic, earthy, corporate, neutral-dark, neutral-light, gray-dark, gray-light
- Custom font stack (Nunito, Noto Sans Mono) via Noise Factor CDN
