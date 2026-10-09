import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildScript = path.join(repoRoot, 'scripts', 'build.js')

function runBuild(args) {
    return spawnSync(process.execPath, [buildScript, ...args], {
        cwd: repoRoot,
        encoding: 'utf8',
    })
}

const invalidInvocations = [
    {
        name: 'a missing --theme value',
        args: ['--standalone', '--theme'],
        error: /--theme requires a theme name/,
    },
    {
        name: '--theme without --standalone',
        args: ['--theme', 'cyberpunk'],
        error: /--theme requires --standalone/,
    },
    {
        name: '--all without --standalone',
        args: ['--all'],
        error: /--all requires --standalone/,
    },
    {
        name: '--all combined with --theme',
        args: ['--standalone', '--all', '--theme', 'cyberpunk'],
        error: /--all cannot be combined with --theme/,
    },
    {
        name: 'multiple output modes',
        args: ['--mastodon', '--mastodon46'],
        error: /choose only one output mode/,
    },
    {
        name: 'an unknown option',
        args: ['--nonsense'],
        error: /unknown option: --nonsense/,
    },
    {
        name: 'a theme name containing path separators',
        args: ['--standalone', '--theme', '../cyberpunk'],
        error: /invalid theme name: ..\/cyberpunk/,
    },
]

for (const { name, args, error } of invalidInvocations) {
    test(`build CLI rejects ${name} before producing output`, () => {
        const result = runBuild(args)

        assert.notEqual(result.status, 0)
        assert.match(result.stderr, error)
        assert.doesNotMatch(result.stdout, /Building handfish-mastodon/)
    })
}

test('build CLI preserves the documented no-argument modular build', () => {
    const result = runBuild([])

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /dist\/handfish-mastodon\.css/)
    assert.match(result.stdout, /Done\./)
})

// Fixture handfish checkout covering a "pair" theme file whose file name is not
// a theme selector: themes/pair.css only defines [data-theme="pair-dark"] and
// [data-theme="pair-light"], like handfish's gray.css/neutral.css/
// high-contrast.css.
function makeHandfishFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handfish-fixture-'))
    const stylesDir = path.join(root, 'src', 'styles')
    const themesDir = path.join(stylesDir, 'themes')
    fs.mkdirSync(themesDir, { recursive: true })
    fs.writeFileSync(path.join(stylesDir, 'tokens.css'), [
        ':root {',
        '    --hf-color-1: oklch(20% 0 0);',
        '    --hf-color-7: oklch(95% 0 0);',
        '}',
        '',
        '[data-theme="dark"] {',
        '    --hf-color-1: oklch(20% 0 0);',
        '}',
        '',
        '[data-theme="light"] {',
        '    --hf-color-1: oklch(97% 0 0);',
        '}',
        '',
    ].join('\n'))
    fs.writeFileSync(path.join(themesDir, 'pair.css'), [
        '[data-theme="pair-dark"] {',
        '    --hf-color-1: oklch(30% 0 0);',
        '}',
        '',
        '[data-theme="pair-light"] {',
        '    --hf-color-1: oklch(85% 0 0);',
        '}',
        '',
    ].join('\n'))
    return root
}

const handfishFixture = makeHandfishFixture()
const distDir = path.join(repoRoot, 'dist')

test.after(() => {
    fs.rmSync(handfishFixture, { recursive: true, force: true })
    for (const file of ['handfish-mastodon-standalone.css', 'handfish-mastodon-standalone.min.css', 'handfish-mastodon-standalone-pair.css', 'handfish-mastodon-standalone-pair.min.css', 'handfish-mastodon-standalone-pair-dark.css', 'handfish-mastodon-standalone-pair-dark.min.css', 'handfish-mastodon-standalone-pair-light.css', 'handfish-mastodon-standalone-pair-light.min.css']) {
        fs.rmSync(path.join(distDir, file), { force: true })
    }
})

test('build CLI rejects a pair-file base name instead of silently building the wrong theme', () => {
    const result = spawnSync(process.execPath, [buildScript, '--standalone', '--theme', 'pair'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, HANDFISH_DIR: handfishFixture },
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Handfish theme not found for: pair/)
    assert.match(result.stderr, /pair-dark, pair-light/)
    assert.doesNotMatch(result.stdout, /Done\./)
    assert.equal(fs.existsSync(path.join(distDir, 'handfish-mastodon-standalone-pair.css')), false)
})

test('build CLI still unwraps a requested variant from its pair file', () => {
    const result = spawnSync(process.execPath, [buildScript, '--standalone', '--theme', 'pair-dark'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, HANDFISH_DIR: handfishFixture },
    })

    assert.equal(result.status, 0, result.stderr)
    const output = fs.readFileSync(path.join(distDir, 'handfish-mastodon-standalone-pair-dark.css'), 'utf8')
    assert.match(output, /--hf-color-1:\s*oklch\(30% 0 0\)/)
    assert.doesNotMatch(output, /\[data-theme="pair-dark"\]/)
    assert.doesNotMatch(output, /\[data-theme="pair-light"\]/)
})

test('build CLI keeps the OS-dark icon block in the auto standalone build', () => {
    const result = spawnSync(process.execPath, [buildScript, '--standalone'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, HANDFISH_DIR: handfishFixture },
    })

    assert.equal(result.status, 0, result.stderr)
    const output = fs.readFileSync(path.join(distDir, 'handfish-mastodon-standalone.css'), 'utf8')
    assert.match(output, /@media \(prefers-color-scheme: dark\)/)
    assert.match(output, /--icon-reply:/)
})

test('build CLI drops the OS-dark icon block for an explicit light theme', () => {
    const result = spawnSync(process.execPath, [buildScript, '--standalone', '--theme', 'pair-light'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, HANDFISH_DIR: handfishFixture },
    })

    assert.equal(result.status, 0, result.stderr)
    const output = fs.readFileSync(path.join(distDir, 'handfish-mastodon-standalone-pair-light.css'), 'utf8')
    // The OS-dark block forces white icon fills; under an explicit light theme
    // it would render white icons on a light background whenever the OS scheme
    // is dark. An explicit theme keeps one icon set under every OS scheme.
    assert.doesNotMatch(output, /prefers-color-scheme/)
    assert.match(output, /--icon-reply:/)
})
