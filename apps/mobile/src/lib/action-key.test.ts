// Run with Node's own test runner (no extra dependency in the app):
//   npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ActionKeys, newKey } from './action-key.ts';
import { assertReleaseApiUrl } from './release-config.ts';

describe('ActionKeys', () => {
  it('keeps one key while the same action is repeated', () => {
    let n = 0;
    const keys = new ActionKeys(() => `k${++n}`);
    assert.equal(keys.keyFor('topup:5000'), 'k1');
    assert.equal(keys.keyFor('topup:5000'), 'k1');
    assert.equal(keys.keyFor('topup:9000'), 'k2');
    keys.done();
    assert.equal(keys.keyFor('topup:9000'), 'k3');
  });

  it('makes keys the API accepts', () => {
    assert.match(newKey(), /^[A-Za-z0-9_-]{8,128}$/);
    assert.notEqual(newKey(), newKey());
  });
});

describe('assertReleaseApiUrl', () => {
  it('refuses plain HTTP outside development', () => {
    assert.throws(() => assertReleaseApiUrl('http://api.nhonga.co.mz', false), /https/);
    assert.doesNotThrow(() => assertReleaseApiUrl('https://api.nhonga.co.mz', false));
    assert.doesNotThrow(() => assertReleaseApiUrl('http://192.168.1.10:3000', true));
  });
});
