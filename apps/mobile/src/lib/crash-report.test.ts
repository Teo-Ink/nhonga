import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCrashReport,
  createCrashReporter,
  installCrashHandler,
  type CrashReport,
} from './crash-report.ts';

const ctx = { platform: 'android 14', release: '1.0.0', route: () => '/produto/toyota-runx?ref=x' };

describe('crash reports', () => {
  it('describes the error, the screen and the version, without query parameters', () => {
    const r = buildCrashReport(new TypeError('x is undefined'), ctx, true);
    assert.equal(r.source, 'mobile');
    assert.equal(r.message, '[fatal] TypeError: x is undefined');
    assert.equal(r.route, '/produto/toyota-runx');
    assert.equal(r.platform, 'android 14');
    assert.equal(r.release, '1.0.0');
    assert.match(r.stack ?? '', /TypeError/);
  });

  it('accepts non-Error values and caps the size', () => {
    assert.equal(buildCrashReport('texto', { platform: 'ios 18', release: '1' }).message, 'texto');
    assert.equal(
      buildCrashReport(new Error('y'.repeat(900)), { platform: 'ios 18', release: '1' }).message
        .length,
      500,
    );
  });

  it('sends each distinct error once and stops after five per start', () => {
    const sent: CrashReport[] = [];
    const report = createCrashReporter(ctx, (r) => sent.push(r));
    assert.equal(report(new Error('a')), true);
    assert.equal(report(new Error('a')), false);
    for (const m of ['b', 'c', 'd', 'e']) assert.equal(report(new Error(m)), true);
    assert.equal(report(new Error('f')), false);
    assert.equal(sent.length, 5);
  });

  it('never throws, even when sending fails', () => {
    const report = createCrashReporter(ctx, () => {
      throw new Error('offline');
    });
    assert.equal(report(new Error('a')), false);
  });
});

describe('global handler', () => {
  it('reports and then lets the original handler run', () => {
    const order: string[] = [];
    let handler = (_e: unknown, _f?: boolean) => void order.push('original');
    const utils = {
      getGlobalHandler: () => handler,
      setGlobalHandler: (h: typeof handler) => void (handler = h),
    };
    const installed = installCrashHandler((_e, fatal) => order.push(`report:${fatal}`), utils);
    assert.equal(installed, true);
    handler(new Error('boom'), true);
    assert.deepEqual(order, ['report:true', 'original']);
  });

  it('does nothing where the hook does not exist', () => {
    assert.equal(
      installCrashHandler(() => {}, undefined),
      false,
    );
  });
});
