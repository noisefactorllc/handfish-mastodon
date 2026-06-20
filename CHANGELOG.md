# Changelog

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
