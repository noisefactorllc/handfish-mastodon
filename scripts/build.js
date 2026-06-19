#!/usr/bin/env node
/**
 * Build tangerine-handfish CSS bundles.
 *
 * Usage:
 *   node scripts/build.js                    # modular output (requires external handfish tokens)
 *   node scripts/build.js --standalone       # standalone with default handfish tokens inlined
 *   node scripts/build.js --standalone --theme cyberpunk  # standalone with specific theme
 *   node scripts/build.js --standalone --all              # standalone for every theme + default
 *   node scripts/build.js --mastodon                      # Mastodon themes.yml integration files
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { build, transform } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const distDir = path.join(repoRoot, 'dist')
const srcDir = path.join(repoRoot, 'src')

// Handfish paths — sibling repo in platform directory, or HANDFISH_DIR env override
const handfishRoot = process.env.HANDFISH_DIR || path.join(repoRoot, '..', 'handfish')
const handfishStylesDir = path.join(handfishRoot, 'src', 'styles')

const args = process.argv.slice(2)
const isStandalone = args.includes('--standalone')
const isMastodon = args.includes('--mastodon')
const isMastodon46 = args.includes('--mastodon46')
const buildAll = args.includes('--all')
const themeIndex = args.indexOf('--theme')
const themeName = themeIndex !== -1 ? args[themeIndex + 1] : null

fs.mkdirSync(distDir, { recursive: true })

// --- OKLCH to Hex conversion for icon recoloring ---

function oklchToHex(l, c, h) {
    // OKLCH → OKLab
    const hRad = (h * Math.PI) / 180
    const L = l
    const a = c * Math.cos(hRad)
    const b = c * Math.sin(hRad)

    // OKLab → linear sRGB
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b

    const ll = l_ * l_ * l_
    const mm = m_ * m_ * m_
    const ss = s_ * s_ * s_

    const r = +4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss
    const g = -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss
    const bv = -0.0041960863 * ll - 0.7034186147 * mm + 1.7076147010 * ss

    // Linear sRGB → sRGB gamma
    const gamma = (x) => x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x
    const clamp = (x) => Math.max(0, Math.min(255, Math.round(gamma(x) * 255)))

    return clamp(r).toString(16).padStart(2, '0') +
           clamp(g).toString(16).padStart(2, '0') +
           clamp(bv).toString(16).padStart(2, '0')
}

// Parse an oklch() value string like "oklch(72.0% 0.200 140)" → hex
function parseOklch(str) {
    const m = str.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/)
    if (!m) return null
    let l = parseFloat(m[1])
    if (l > 1) l /= 100 // handle percentage
    return oklchToHex(l, parseFloat(m[2]), parseFloat(m[3]))
}

// Extract theme colors from a theme CSS string for icon recoloring
function extractThemeColors(themeCSS, tokensCSS) {
    // Parse all --hf-* values from theme, falling back to tokens defaults
    const parseVars = (css) => {
        const vars = {}
        for (const match of css.matchAll(/--(hf-[\w-]+):\s*([^;]+);/g)) {
            vars[match[1]] = match[2].trim()
        }
        return vars
    }

    const defaults = parseVars(tokensCSS)
    const theme = parseVars(themeCSS)
    const merged = { ...defaults, ...theme }

    // accent-3 = accent color, color-7 = bright text, color-1 = dark bg
    const accent = parseOklch(merged['hf-accent-3'] || '')
    const textDark = parseOklch(merged['hf-color-7'] || '')  // bright text (for dark bg icons)
    const textLight = parseOklch(merged['hf-color-6'] || '') // normal text

    return { accent, textDark, textLight }
}

// Recolor icon SVG data URIs by replacing TangerineUI's hardcoded colors
function recolorIcons(iconsCSS, colors) {
    if (!colors.accent) return iconsCSS
    let result = iconsCSS
    // Replace accent orange variants with theme accent
    result = result.replace(/%23f76902/gi, `%23${colors.accent}`)
    result = result.replace(/%23e68933/gi, `%23${colors.accent}`)
    result = result.replace(/%23ff4013/gi, `%23${colors.accent}`) // boost active
    // Replace dark text color with theme text
    if (colors.textLight) {
        result = result.replace(/%232a2d37/gi, `%23${colors.textLight}`)
    }
    return result
}

const banner = `/**
 * Tangerine-Handfish
 * TangerineUI for Mastodon, ported to the Handfish design system
 * Copyright (c) ${new Date().getFullYear()} Noise Factor LLC
 * Based on TangerineUI by Nileane
 * SPDX-License-Identifier: MIT
 */`

async function buildModular() {
    // Create a temporary entry file that imports all source CSS in order
    const entryContent = [
        `@import "./src/fonts.css";`,
        `@import "./src/mapping.css";`,
        `@import "./src/icons.css";`,
        `@import "./src/tangerine-base.css";`,
        `@import "./src/overrides.css";`,
    ].join('\n')

    const entryPath = path.join(repoRoot, '.build-entry.css')
    fs.writeFileSync(entryPath, entryContent)

    try {
        await build({
            entryPoints: [entryPath],
            bundle: true,
            outfile: path.join(distDir, 'tangerine-handfish.css'),
            minify: false,
            banner: { css: banner },
            logLevel: 'warning',
        })
        console.log('  - dist/tangerine-handfish.css')
    } finally {
        fs.unlinkSync(entryPath)
    }
}

async function buildStandalone(theme = null) {
    const parts = []

    // Inline handfish tokens
    const tokensPath = path.join(handfishStylesDir, 'tokens.css')
    if (!fs.existsSync(tokensPath)) {
        console.error(`Handfish tokens not found at: ${tokensPath}`)
        console.error('Ensure the handfish repo is checked out at ../handfish/')
        process.exit(1)
    }
    parts.push(fs.readFileSync(tokensPath, 'utf8'))

    // Inline theme if specified — unwrap the requested [data-theme="..."] selector
    // to :root so it applies unconditionally, and strip other variants from the file
    if (theme) {
        let themeCSS = null

        // Check themes directory first (exact file, then base name for sub-variants)
        let themePath = path.join(handfishStylesDir, 'themes', `${theme}.css`)
        if (!fs.existsSync(themePath)) {
            const baseName = theme.replace(/-(?:dark|light)$/, '')
            themePath = path.join(handfishStylesDir, 'themes', `${baseName}.css`)
        }
        if (fs.existsSync(themePath)) {
            themeCSS = fs.readFileSync(themePath, 'utf8')
        }

        // Fall back to tokens.css for base dark/light variants
        if (!themeCSS) {
            const tokensCSS = fs.readFileSync(path.join(handfishStylesDir, 'tokens.css'), 'utf8')
            const match = tokensCSS.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{[^}]*\\}`, 's'))
            if (match) {
                themeCSS = match[0]
            }
        }

        if (!themeCSS) {
            console.error(`Handfish theme not found for: ${theme}`)
            process.exit(1)
        }

        // Unwrap the requested variant to :root
        themeCSS = themeCSS.replace(`[data-theme="${theme}"]`, ':root')
        // Remove any other [data-theme="..."] blocks entirely (other variants in same file)
        themeCSS = themeCSS.replace(/\[data-theme="[^"]+"\]\s*\{[^}]*\}/gs, '')
        parts.push(themeCSS)
    }

    // Recolor icons if we have theme colors
    const tokensCSS = parts[0] // tokens.css is always first
    const themeCSS = theme ? parts[parts.length - 1] : '' // theme CSS if present
    const themeColors = extractThemeColors(themeCSS, tokensCSS)

    // Append tangerine-handfish source files (fonts first, overrides LAST so they win over tangerine-base)
    for (const file of ['fonts.css', 'mapping.css', 'icons.css', 'tangerine-base.css', 'overrides.css']) {
        let content = fs.readFileSync(path.join(srcDir, file), 'utf8')
        if (file === 'icons.css' && themeColors.accent) {
            content = recolorIcons(content, themeColors)
        }
        parts.push(content)
    }

    const suffix = theme ? `-${theme}` : ''
    const outPath = path.join(distDir, `tangerine-handfish-standalone${suffix}.css`)

    // Minify the concatenated output via esbuild transform
    const combined = `${banner}\n\n${parts.join('\n\n')}`
    const minified = await transform(combined, { loader: 'css', minify: true })

    // Write both unminified (for debugging) and minified (for admin panel paste)
    fs.writeFileSync(outPath, combined)
    fs.writeFileSync(outPath.replace('.css', '.min.css'), `${banner}\n${minified.code}`)
    console.log(`  - dist/tangerine-handfish-standalone${suffix}.css`)
    console.log(`  - dist/tangerine-handfish-standalone${suffix}.min.css`)
}

// Discover all available themes from handfish (including sub-variants like gray-dark/gray-light)
function getAvailableThemes() {
    const themes = []

    // Base dark/light variants from tokens.css
    const tokensCSS = fs.readFileSync(path.join(handfishStylesDir, 'tokens.css'), 'utf8')
    for (const m of tokensCSS.matchAll(/\[data-theme="([^"]+)"\]/g)) {
        themes.push(m[1])
    }

    // Named themes from themes directory
    const themesDir = path.join(handfishStylesDir, 'themes')
    for (const file of fs.readdirSync(themesDir).filter(f => f.endsWith('.css'))) {
        const css = fs.readFileSync(path.join(themesDir, file), 'utf8')
        const variants = [...css.matchAll(/\[data-theme="([^"]+)"\]/g)].map(m => m[1])
        if (variants.length > 0) {
            themes.push(...variants)
        } else {
            themes.push(file.replace('.css', ''))
        }
    }
    return themes
}

// Human-friendly theme names for Mastodon's locale system
const THEME_LABELS = {
    dark: 'Handfish Dark',
    light: 'Handfish Light',
    brutalist: 'Handfish Brutalist',
    corporate: 'Handfish Corporate',
    cyberpunk: 'Handfish Cyberpunk',
    dusk: 'Handfish Dusk',
    earthy: 'Handfish Earthy',
    gothic: 'Handfish Gothic',
    'gray-dark': 'Handfish Gray Dark',
    'gray-light': 'Handfish Gray Light',
    'high-contrast-dark': 'Handfish High Contrast Dark',
    'high-contrast-light': 'Handfish High Contrast Light',
    kawaii: 'Handfish Kawaii',
    neutral: 'Handfish Neutral',
    'neutral-dark': 'Handfish Neutral Dark',
    'neutral-light': 'Handfish Neutral Light',
    newspaper: 'Handfish Newspaper',
    ocean: 'Handfish Ocean',
    organic: 'Handfish Organic',
    rave: 'Handfish Rave',
    sunset: 'Handfish Sunset',
    synthwave: 'Handfish Synthwave',
    terminal: 'Handfish Terminal',
}

function themeLabel(theme) {
    if (!theme) return 'Handfish (Auto)'
    if (!THEME_LABELS[theme]) {
        console.warn(`  ⚠ No label in THEME_LABELS for "${theme}", using auto-generated name`)
    }
    return THEME_LABELS[theme] || `Handfish ${theme.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}`
}

// Generate Mastodon themes.yml integration: SCSS wrappers, config fragments, Dockerfile
async function buildMastodon() {
    const mastodonDir = path.join(distDir, 'mastodon')
    const stylesDir = path.join(mastodonDir, 'styles')
    fs.mkdirSync(stylesDir, { recursive: true })

    const themes = getAvailableThemes()

    // Build standalone CSS for all themes first (needed as SCSS source)
    console.log('\n  Building standalone CSS for all themes...')
    await buildStandalone(null) // default (auto dark/light)
    for (const theme of themes) {
        await buildStandalone(theme)
    }

    // Generate SCSS wrappers — each imports Mastodon base styles, then applies our theme
    console.log('\n  Generating Mastodon SCSS wrappers...')
    const allVariants = [null, ...themes] // null = auto/default

    for (const theme of allVariants) {
        const suffix = theme ? `-${theme}` : ''
        const themeId = theme || 'auto'
        const scssName = `tangerine-handfish-${themeId}.scss`
        const standalonePath = path.join(distDir, `tangerine-handfish-standalone${suffix}.min.css`)
        let standaloneCSS = fs.readFileSync(standalonePath, 'utf8')

        // Strip the license banner — it's already in the repo and clutters the SCSS wrapper
        standaloneCSS = standaloneCSS.replace(/\/\*\*[\s\S]*?\*\/\s*/, '')

        // SCSS file: import Mastodon base, then override with our theme CSS
        const scss = `// Tangerine-Handfish: ${themeLabel(theme)}\n` +
            `// Generated by tangerine-handfish build system — do not edit\n` +
            `@use 'application';\n\n` +
            standaloneCSS

        fs.writeFileSync(path.join(stylesDir, scssName), scss)
        console.log(`  - dist/mastodon/styles/${scssName}`)
    }

    // Generate themes.yml fragment
    const themesYml = allVariants.map(theme => {
        const themeId = theme || 'auto'
        return `tangerine-handfish-${themeId}: styles/tangerine-handfish-${themeId}.scss`
    }).join('\n')

    fs.writeFileSync(path.join(mastodonDir, 'themes-fragment.yml'), themesYml + '\n')
    console.log('  - dist/mastodon/themes-fragment.yml')

    // Generate locale fragment (en.yml format)
    const localeEntries = allVariants.map(theme => {
        const themeId = theme || 'auto'
        const label = themeLabel(theme)
        return `    tangerine-handfish-${themeId}: "${label}"`
    }).join('\n')

    const localeYml = `en:\n  themes:\n${localeEntries}\n`
    fs.writeFileSync(path.join(mastodonDir, 'locales-fragment.yml'), localeYml)
    console.log('  - dist/mastodon/locales-fragment.yml')

    // Generate Dockerfile
    const dockerfile = `# Mastodon with Tangerine-Handfish themes
# Generated by tangerine-handfish build system
#
# Build context: dist/mastodon/
#   docker build -t mastodon-handfish:v4.5.7 dist/mastodon/
#
# Usage in docker-compose.yml:
#   image: mastodon-handfish:v4.5.7

ARG MASTODON_VERSION=v4.5.7
FROM node:22-slim AS node
FROM tootsuite/mastodon:\${MASTODON_VERSION}

# Switch to root to install Node.js and modify config files (base image runs as mastodon)
USER root

# Copy Node.js from official image (required for Vite asset compilation in Mastodon v4.5+)
COPY --from=node /usr/local/bin/node /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \\
  && ln -sf /usr/local/lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \\
  && corepack enable \\
  && corepack prepare yarn@4.10.3 --activate

# Copy theme SCSS files (all prefixed with tangerine-handfish- to avoid collisions)
COPY styles/ app/javascript/styles/

# Append theme entries to themes.yml and merge locale entries
COPY themes-fragment.yml locales-fragment.yml /tmp/
RUN cat /tmp/themes-fragment.yml >> config/themes.yml \\
  && ruby -ryaml -e '\\
    base = YAML.safe_load_file("config/locales/en.yml", permitted_classes: [Symbol]); \\
    patch = YAML.safe_load_file("/tmp/locales-fragment.yml", permitted_classes: [Symbol]); \\
    base["en"]["themes"] ||= {}; \\
    base["en"]["themes"].merge!(patch["en"]["themes"]); \\
    File.write("config/locales/en.yml", base.to_yaml)' \\
  && rm /tmp/themes-fragment.yml /tmp/locales-fragment.yml

# Reinstall JS dependencies (node was stripped from base image, state needs regenerating)
RUN yarn install

# Recompile assets with new themes
RUN RAILS_ENV=production \\
    SECRET_KEY_BASE=precompile_placeholder \\
    OTP_SECRET=precompile_placeholder \\
    ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=precompile_placeholder \\
    ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=precompile_placeholder \\
    ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=precompile_placeholder \\
    bundle exec rails assets:precompile

# Fix ownership and restore mastodon user for runtime
RUN chown -R mastodon:mastodon public/assets/ public/packs/
USER mastodon
`
    fs.writeFileSync(path.join(mastodonDir, 'Dockerfile'), dockerfile)
    console.log('  - dist/mastodon/Dockerfile')
}

// ============================================================================
// Mastodon 4.6 token-mapping build (--mastodon46)
//
// 4.6 replaced the SCSS-variable theme system with CSS design tokens
// (--color-* in app/javascript/styles/mastodon/theme/). Each Handfish theme
// becomes a config/themes.yml entry whose entrypoint:
//   1. @use 'application'  — pulls in Mastodon's own theme + component styles
//   2. defines this theme's Handfish --hf-* tokens (a single palette)
//   3. maps Mastodon --color-* semantic tokens onto --hf-* for all schemes
//   4. applies a character layer (fonts/radius/shadow) via --hf-*
// No TangerineUI overlay — that base is discontinued and targeted 4.5 markup.
// ============================================================================

// Mastodon 4.6 semantic token -> Handfish token reference. Applied under every
// color-scheme selector because each Handfish theme is a single fixed palette.
const M46_TOKEN_MAP = {
    '--color-bg-primary': 'var(--hf-color-1)',
    '--color-bg-secondary': 'var(--hf-color-2)',
    '--color-bg-tertiary': 'var(--hf-color-3)',
    '--color-bg-inverted': 'var(--hf-color-7)',
    '--color-bg-brand-base': 'var(--hf-accent-2)',
    '--color-bg-brand-base-hover': 'var(--hf-accent-1)',
    '--color-bg-brand-soft': 'var(--hf-accent-1)',
    '--color-bg-brand-softest': 'color-mix(in oklab, var(--hf-accent-1) 60%, var(--hf-color-2))',
    '--color-bg-error-base': 'var(--hf-red)',
    '--color-bg-success-base': 'var(--hf-green)',
    '--color-bg-warning-base': 'var(--hf-yellow)',
    '--color-text-primary': 'var(--hf-color-7)',
    '--color-text-secondary': 'var(--hf-color-5)',
    '--color-text-tertiary': 'var(--hf-color-4)',
    '--color-text-inverted': 'var(--hf-color-1)',
    '--color-text-brand': 'var(--hf-accent-3)',
    '--color-text-on-brand-base': 'var(--hf-color-7)',
    '--color-text-error': 'var(--hf-red)',
    '--color-text-warning': 'var(--hf-yellow)',
    '--color-text-success': 'var(--hf-green)',
    '--color-border-primary': 'var(--hf-border-subtle)',
    '--color-border-brand': 'var(--hf-accent-3)',
    // High-visibility tokens that otherwise keep Mastodon's indigo/grey palette
    '--color-text-status-links': 'var(--hf-accent-3)',
    '--color-text-brand-soft': 'var(--hf-accent-3)',
    '--color-border-brand-soft': 'var(--hf-accent-2)',
    '--color-border-error': 'var(--hf-red)',
    '--color-text-disabled': 'var(--hf-color-4)',
    '--color-bg-disabled': 'var(--hf-color-3)',
}

// Strip the OS-driven light block so an explicit Handfish theme is deterministic
// (matches one level of brace nesting: the @media wrapper around its :root block).
function stripMediaLight(css) {
    return css.replace(/@media\s*\(prefers-color-scheme:\s*light\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
}

// Assemble the Handfish --hf-* token layer for one theme: tokens.css plus the
// theme file with its [data-theme="X"] block unwrapped to :root (applies
// unconditionally) and other variants stripped. No TangerineUI overlay.
function handfishLayer(theme) {
    let tokensCSS = stripMediaLight(fs.readFileSync(path.join(handfishStylesDir, 'tokens.css'), 'utf8'))
    if (!theme || theme === 'dark') return tokensCSS // dark = tokens.css :root default

    let themePath = path.join(handfishStylesDir, 'themes', `${theme}.css`)
    if (!fs.existsSync(themePath)) {
        const baseName = theme.replace(/-(?:dark|light)$/, '')
        themePath = path.join(handfishStylesDir, 'themes', `${baseName}.css`)
    }
    let themeCSS
    if (fs.existsSync(themePath)) {
        themeCSS = fs.readFileSync(themePath, 'utf8')
    } else {
        const m = tokensCSS.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{[^}]*\\}`, 's'))
        themeCSS = m ? m[0] : ''
    }
    themeCSS = themeCSS.replace(`[data-theme="${theme}"]`, ':root')
    themeCSS = themeCSS.replace(/\[data-theme="[^"]+"\]\s*\{[^}]*\}/gs, '')
    return `${tokensCSS}\n\n${themeCSS}`
}

// Mastodon 4.6 token overrides, emitted under all color-scheme selectors so they
// win over mastodon/theme by equal-specificity + later source order.
function tokenMapBlock() {
    const decls = Object.entries(M46_TOKEN_MAP).map(([k, v]) => `  ${k}: ${v};`).join('\n')
    // Base tier: win over mastodon/theme's [data-color-scheme] rules (equal specificity, later source order).
    const base = `:root,\nhtml:not([data-color-scheme]),\n[data-color-scheme='dark'],\n[data-color-scheme='light'] {\n${decls}\n}`
    // Contrast tier: re-assert at [data-color-scheme][data-contrast='high'] = specificity (0,2,0) so the
    // theme palette also wins over Mastodon's contrast-overrides mixin when the user sets Contrast=High.
    const contrast = `[data-color-scheme='dark'][data-contrast='high'],\n[data-color-scheme='light'][data-contrast='high'],\nhtml:not([data-color-scheme])[data-contrast='high'] {\n${decls}\n}`
    return `${base}\n\n${contrast}`
}

// Character layer: non-color Handfish identity (fonts, radius, shadow) applied to
// stable Mastodon 4.6 surfaces via --hf-* tokens. Conservative v1 — refined with
// visual feedback after the first CI build proves the pipeline.
function characterLayer() {
    return `/* Handfish character layer (v1: fonts + radius + shadow; selectors verified against Mastodon 4.6) */
body, .app-holder, button, input, textarea, select {
  font-family: var(--hf-font-family), system-ui, sans-serif;
}
.dropdown-menu, .modal-root__modal, .dialog-modal, .boost-modal,
.actions-modal, .column-header, .compose-form, .status {
  border-radius: var(--hf-radius);
}
.dropdown-menu, .modal-root__modal, .dialog-modal {
  box-shadow: var(--hf-shadow-lg);
}`
}

async function buildMastodon46() {
    const outDir = path.join(distDir, 'mastodon46')
    const stylesDir = path.join(outDir, 'styles')
    fs.mkdirSync(stylesDir, { recursive: true })

    const discovered = getAvailableThemes()
    const allVariants = ['dark', ...discovered.filter(t => t !== 'dark')]
    const mapBlock = tokenMapBlock()
    const charLayer = characterLayer()

    console.log('\n  Generating Mastodon 4.6 theme entrypoints...')
    for (const theme of allVariants) {
        const scss = `// Handfish: ${themeLabel(theme)} — Mastodon 4.6 (token-mapped)\n` +
            `// Generated by tangerine-handfish (--mastodon46) — do not edit\n` +
            `@use 'application';\n\n` +
            `/* Handfish design tokens — this theme's palette, applied unconditionally */\n` +
            `${handfishLayer(theme)}\n\n` +
            `/* Mastodon 4.6 semantic tokens -> Handfish */\n${mapBlock}\n\n` +
            `${charLayer}\n`
        fs.writeFileSync(path.join(stylesDir, `handfish-${theme}.scss`), scss)
        console.log(`  - dist/mastodon46/styles/handfish-${theme}.scss`)
    }

    const themesYml = allVariants.map(t => `handfish-${t}: styles/handfish-${t}.scss`).join('\n') + '\n'
    fs.writeFileSync(path.join(outDir, 'themes-fragment.yml'), themesYml)
    const localeYml = `en:\n  themes:\n` +
        allVariants.map(t => `    handfish-${t}: "${themeLabel(t)}"`).join('\n') + '\n'
    fs.writeFileSync(path.join(outDir, 'locales-fragment.yml'), localeYml)
    console.log('  - dist/mastodon46/themes-fragment.yml')
    console.log('  - dist/mastodon46/locales-fragment.yml')

    const dockerfile = `# Mastodon 4.6 + Handfish themes (token-mapped)
# Generated by tangerine-handfish (--mastodon46). Build context: dist/mastodon46/
ARG MASTODON_VERSION=v4.6.0
FROM node:22-slim AS node
FROM tootsuite/mastodon:\${MASTODON_VERSION}
USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \\
  && ln -sf /usr/local/lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \\
  && corepack enable && corepack prepare yarn@4.10.3 --activate
COPY styles/ app/javascript/styles/
COPY themes-fragment.yml locales-fragment.yml /tmp/
RUN cat /tmp/themes-fragment.yml >> config/themes.yml \\
  && ruby -ryaml -e '\\
    base = YAML.safe_load_file("config/locales/en.yml", permitted_classes: [Symbol]); \\
    patch = YAML.safe_load_file("/tmp/locales-fragment.yml", permitted_classes: [Symbol]); \\
    base["en"]["themes"] ||= {}; \\
    base["en"]["themes"].merge!(patch["en"]["themes"]); \\
    File.write("config/locales/en.yml", base.to_yaml)' \\
  && rm /tmp/themes-fragment.yml /tmp/locales-fragment.yml
RUN yarn install
RUN RAILS_ENV=production \\
    SECRET_KEY_BASE=precompile_placeholder OTP_SECRET=precompile_placeholder \\
    ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=precompile_placeholder \\
    ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=precompile_placeholder \\
    ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=precompile_placeholder \\
    bundle exec rails assets:precompile
RUN chown -R mastodon:mastodon public/assets/ public/packs/
USER mastodon
`
    fs.writeFileSync(path.join(outDir, 'Dockerfile'), dockerfile)
    console.log('  - dist/mastodon46/Dockerfile')
}

console.log('Building tangerine-handfish...')

if (isMastodon46) {
    await buildMastodon46()
} else if (isMastodon) {
    await buildMastodon()
} else if (isStandalone && buildAll) {
    // Build default (no theme) + all discovered themes
    await buildStandalone(null)
    for (const theme of getAvailableThemes()) {
        await buildStandalone(theme)
    }
} else if (isStandalone) {
    await buildStandalone(themeName)
} else {
    await buildModular()
}

console.log('Done.')
