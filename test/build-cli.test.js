import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
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
