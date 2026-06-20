# Mastodon Theme Integration Guide

Deploy Handfish for Mastodon themes to Docker-based Mastodon instances so users can select their preferred Handfish theme from Preferences > Appearance.

## Overview

`npm run build:mastodon` generates a custom Dockerfile that extends the official Mastodon image with all Handfish theme variants registered in Mastodon's theme system. Users see themes like "Handfish Dark", "Handfish Cyberpunk", etc. in their appearance settings.

**Available themes:** Auto (follows system dark/light), Dark, Light, Corporate, Cyberpunk, Earthy, Gray Dark, Gray Light, Neutral Dark, Neutral Light, Organic, Terminal

**Target instances:** yip.yip.yip.yip.yip.computer (testbed), genart.social

Both run `tootsuite/mastodon:v4.5.7` via Docker Compose. See scaffold runbook for connection details.

## Prerequisites

- SSH access to the target server (see scaffold runbook)
- Node.js 18+ and npm (local machine or CI)
- The `handfish` repo checked out at `../handfish` relative to this repo
- Docker on the target server

## Step 1: Build the Mastodon artifacts

From the handfish-mastodon repo:

```bash
npm install
npm run build:mastodon
```

This generates `dist/mastodon/` containing:
- `styles/handfish-mastodon-*.scss` — SCSS wrappers for each theme
- `themes-fragment.yml` — entries to append to Mastodon's `config/themes.yml`
- `locales-fragment.yml` — human-friendly theme names for Mastodon's locale system
- `Dockerfile` — extends official Mastodon image with all themes pre-compiled

## Step 2: Transfer artifacts to the server

```bash
rsync -avz dist/mastodon/ $DEPLOY_USER@$SERVER:~/mastodon-themes/
```

## Step 3: Build the custom Docker image on the server

```bash
cd ~/mastodon-themes
docker build -t mastodon-handfish:v4.5.7 .
```

This extends `tootsuite/mastodon:v4.5.7` with:
1. Theme SCSS files copied into `app/javascript/styles/`
2. Theme entries appended to `config/themes.yml`
3. Locale entries merged into `config/locales/en.yml`
4. Assets recompiled with all new themes

The build runs `rails assets:precompile` inside the container, which takes a few minutes.

## Step 4: Update docker-compose.yml

Change **both** `web` and `sidekiq` services to use the custom image:

```yaml
# Before:
  web:
    image: tootsuite/mastodon:v4.5.7

# After:
  web:
    image: mastodon-handfish:v4.5.7
```

```yaml
# Before:
  sidekiq:
    image: tootsuite/mastodon:v4.5.7

# After:
  sidekiq:
    image: mastodon-handfish:v4.5.7
```

The `streaming` service does NOT need to change — it uses a separate image (`tootsuite/mastodon-streaming`).

## Step 5: Restart services

```bash
docker compose up -d web sidekiq
```

## Step 6: Verify

1. Open the instance in a browser
2. Go to Preferences > Appearance
3. Confirm the Handfish themes appear in the "Site theme" dropdown
4. Select a theme (e.g., "Handfish Cyberpunk") and save
5. Verify the theme applies correctly

## Rollback

Revert the `image:` lines in docker-compose.yml to `tootsuite/mastodon:v4.5.7`, then:

```bash
docker compose up -d web sidekiq
```

## Upgrading Mastodon

Rebuild the custom image with the new base version:

```bash
# Locally:
npm run build:mastodon

# On server:
cd ~/mastodon-themes
docker build --build-arg MASTODON_VERSION=v4.6.0 -t mastodon-handfish:v4.6.0 .
```

Update `docker-compose.yml` with the new tag, run any Mastodon migrations as usual, then `docker compose up -d web sidekiq`.

## Upgrading Themes

When theme CSS is updated in handfish-mastodon:

1. Rebuild: `npm run build:mastodon`
2. Transfer and rebuild the Docker image (steps 2-3)
3. Restart: `docker compose up -d web sidekiq`

No Mastodon data migrations needed — this is purely CSS.

## Notes

- yipyip's `static/agent-first.css` (served via nginx) is independent of the Mastodon theme system and will continue to work unchanged.
- Deploy to yipyip first as testbed. Deploy to genart.social after confirming all 12 themes work.
