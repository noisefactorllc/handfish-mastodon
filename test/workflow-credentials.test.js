import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// This public repository builds and verifies the Mastodon images for theme
// work and publishes none of them, so no workflow here holds an image
// registry credential.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const github = path.join(root, '.github')

function files(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name)
        return entry.isDirectory() ? files(full) : [full]
    })
}

test('no workflow or action in .github references a registry credential', () => {
    const found = files(github).flatMap((file) =>
        fs.readFileSync(file, 'utf8').split('\n')
            .map((line, i) => [line, i + 1])
            .filter(([line]) => /REGISTRY_(?:USER|PASS|HOST)/.test(line))
            .map(([line, n]) => `${path.relative(root, file)}:${n}: ${line.trim()}`))
    assert.deepEqual(found, [])
})

for (const workflow of ['image.yml', 'streaming.yml']) {
    test(`${workflow} builds and verifies without credentials and publishes nothing`, () => {
        const source = fs.readFileSync(path.join(github, 'workflows', workflow), 'utf8')
        assert.doesNotMatch(source, /\bsecrets\b/)
        assert.doesNotMatch(source, /\bdocker\s+(?:login|push)\b/)
        assert.doesNotMatch(source, /\bskopeo\b|\bcrane\b|\boras\b/)
        assert.match(source, /\bdocker build --pull\b/)
        assert.match(source, /< scripts\/check-brotli\.sh/)
    })
}
