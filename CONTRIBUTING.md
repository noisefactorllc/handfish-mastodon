# Contributing

Thanks for your interest in handfish-mastodon!

Contributions follow the Noise Factor
[contributing policy](https://github.com/noisefactorllc/.github/blob/main/CONTRIBUTING.md) and
[Code of Conduct](https://github.com/noisefactorllc/.github/blob/main/CODE_OF_CONDUCT.md). The policy covers which pull requests we
accept and what LLM-assisted pull requests need to include. This page adds
what's specific to handfish-mastodon.

## Build Prerequisites

This project's standalone build inlines design tokens from the [Handfish](https://github.com/noisefactorllc/handfish) repo. Clone it as a sibling directory:

```
parent/
├── handfish/              # git clone https://github.com/noisefactorllc/handfish
└── handfish-mastodon/     # this repo
```

The **modular** build (`npm run build`) does not require the Handfish repo — it outputs CSS that expects Handfish tokens loaded separately.

## Development

```bash
npm install
npm run build              # modular (no handfish repo needed)
npm run build:standalone   # standalone (requires ../handfish/)
npm run build:all          # all theme variants
```

## Pull Requests

- Link the `help wanted` issue the pull request resolves.
- Keep changes focused — one concern per PR.
- Test your changes on a live Mastodon instance or with a local dev setup.
- If you're updating the upstream TangerineUI base, note the new version and commit in `package.json`'s `tangerineUI` field.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
