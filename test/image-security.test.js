import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = path.join(root, 'scripts', 'check-brotli.sh')

function runGate({ version = '1.1.0-2+deb13u1', floor = '1.1.0-2+deb13u1', comparison = 0, nodeVersion = '26.12.1', nodeStatus = 0 } = {}) {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'brotli-gate-'))
    try {
        fs.writeFileSync(path.join(bin, 'dpkg-query'), '#!/bin/sh\n[ "$1" = -W ] && [ "$2" = \'-f=${Version}\' ] && [ "$3" = libbrotli1 ] || exit 2\n[ -n "$PACKAGE_VERSION" ] || exit 1\nprintf %s "$PACKAGE_VERSION"\n', { mode: 0o700 })
        fs.writeFileSync(path.join(bin, 'dpkg'), '#!/bin/sh\n[ "$*" = "--compare-versions $PACKAGE_VERSION ge $EXPECTED_FLOOR" ] || exit 2\nexit "$COMPARISON_STATUS"\n', { mode: 0o700 })
        fs.writeFileSync(path.join(bin, 'node'), `#!${process.execPath}\nif (process.env.NODE_STATUS !== '0') process.exit(Number(process.env.NODE_STATUS))\nif (process.argv[2] !== '-e') process.exit(2)\nObject.defineProperty(process.versions, 'node', { value: process.env.TEST_NODE_VERSION })\neval(process.argv[3])\n`, { mode: 0o700 })
        return spawnSync('sh', [check], {
            encoding: 'utf8',
            env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PACKAGE_VERSION: version,
                EXPECTED_FLOOR: floor, COMPARISON_STATUS: String(comparison),
                TEST_NODE_VERSION: nodeVersion, NODE_STATUS: String(nodeStatus) },
        })
    } finally {
        fs.rmSync(bin, { recursive: true, force: true })
    }
}

for (const [version, floor, comparison, success] of [
    ['1.1.0-2+b7', '1.1.0-2+deb13u1', 1, false],
    ['1.1.0-2+deb13u1', '1.1.0-2+deb13u1', 0, true],
    ['1.1.0-2+deb13u2', '1.1.0-2+deb13u1', 0, true],
    ['1.0.9-2', '1.0.9-2+deb12u1', 1, false],
    ['1.0.9-2+deb12u1', '1.0.9-2+deb12u1', 0, true],
    ['1.2.0-4', '', 0, false],
    ['', '', 0, false],
]) {
    test(`image Brotli gate ${success ? 'accepts' : 'rejects'} ${version || 'a missing package'}`, () => {
        const result = runGate({ version, floor, comparison })
        assert.equal(result.status === 0, success, result.stderr)
        if (success) assert.match(result.stdout, /libbrotli1:/)
        else assert.match(result.stderr, floor ? /below the CVE-2026-111497 fixed package/ : version ? /unverified package version/ : /not installed/)
    })
}

for (const [nodeVersion, success] of [
    ['22.23.3', false], ['22.23.4', true], ['22.23.5', true], ['22.24.0', true],
    ['24.22.0', false], ['24.22.1', true], ['24.22.2', true], ['24.23.0', true],
    ['26.10.0', false], ['26.12.0', false], ['26.12.1', true], ['26.12.2', true], ['26.13.0', true],
    ['20.99.0', false], ['23.99.0', false], ['25.99.0', false], ['28.0.0', false],
    ['26.12.1-rc.1', false], ['26.12.1+custom', false], ['26.12', false], ['', false],
]) {
    test(`image Node gate ${success ? 'accepts' : 'rejects'} ${nodeVersion || 'a missing version'}`, () => {
        const result = runGate({ nodeVersion })
        assert.equal(result.status === 0, success, result.stderr)
        if (success) assert.match(result.stdout, /Node\.js:/)
        else assert.match(result.stderr, /Node\.js.*CVE-2026-111497/)
    })
}

test('image gate rejects a Node executable that cannot run', () => {
    assert.notEqual(runGate({ nodeStatus: 127 }).status, 0)
})

for (const workflow of ['image.yml', 'streaming.yml']) {
    test(`${workflow} verifies Brotli before publication`, () => {
        const source = fs.readFileSync(path.join(root, '.github', 'workflows', workflow), 'utf8')
        const gate = source.indexOf('< scripts/check-brotli.sh')
        assert.ok(gate > 0, 'image must run the package gate')
        assert.ok(gate < source.indexOf('- name: Push'))
        if (workflow === 'streaming.yml') {
            assert.match(source, /apt-get install -y --no-install-recommends --only-upgrade libbrotli1/)
            assert.match(source, /USER mastodon\n\s+DOCKERFILE/)
        }
    })
}
