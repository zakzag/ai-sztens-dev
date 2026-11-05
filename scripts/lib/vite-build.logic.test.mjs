/**
 * Tests of the pure helpers behind the Vite build wrapper.
 *
 * They lock the two decisions a broken build depends on: the bundler gets a
 * project-local temp directory (the Windows `esbuild` `Access is denied` fix)
 * and the app's own `vite` is addressed, never a hoisted one.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TEMP_ENV_VARS,
  VITE_BIN_RELATIVE_PATH,
  toBuildEnv,
  toViteBinPath,
} from './vite-build.logic.mjs';

describe('toBuildEnv', () => {
  it('points every temp variable at the project-local directory', () => {
    const env = toBuildEnv(
      { TEMP: 'C:/Users/x/AppData/Local/Temp', TMP: 'C:/old', TMPDIR: 'C:/older' },
      'E:/repo/.tmp/esbuild',
    );

    for (const name of TEMP_ENV_VARS) {
      assert.equal(env[name], 'E:/repo/.tmp/esbuild');
    }
  });

  it('adds the temp variables when they were unset (Linux/macOS CI)', () => {
    const env = toBuildEnv({ PATH: '/usr/bin' }, '/repo/.tmp/esbuild');

    assert.equal(env.TMPDIR, '/repo/.tmp/esbuild');
    assert.equal(env.TEMP, '/repo/.tmp/esbuild');
    assert.equal(env.TMP, '/repo/.tmp/esbuild');
  });

  it('preserves every unrelated variable', () => {
    const env = toBuildEnv(
      { PATH: '/usr/bin', NODE_OPTIONS: '--max-old-space-size=4096', CI: 'true' },
      '/repo/.tmp/esbuild',
    );

    assert.equal(env.PATH, '/usr/bin');
    assert.equal(env.NODE_OPTIONS, '--max-old-space-size=4096');
    assert.equal(env.CI, 'true');
  });

  it('never mutates the environment it was given', () => {
    const base = { TEMP: '/profile/tmp' };

    toBuildEnv(base, '/repo/.tmp/esbuild');

    assert.equal(base.TEMP, '/profile/tmp');
    assert.deepEqual(Object.keys(base), ['TEMP']);
  });
});

describe('toViteBinPath', () => {
  it('addresses the vite CLI of the given app', () => {
    assert.equal(
      toViteBinPath('E:/repo/apps/admin'),
      `E:/repo/apps/admin/${VITE_BIN_RELATIVE_PATH}`,
    );
  });

  it('keeps the relative segment node-resolution friendly', () => {
    assert.ok(VITE_BIN_RELATIVE_PATH.endsWith('node_modules/vite/bin/vite.js'));
  });
});
