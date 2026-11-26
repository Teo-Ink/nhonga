import { afterEach, describe, expect, it } from 'vitest';
import { setReporter } from '../../common/error-reporter';
import { JsonLogger } from '../../common/json-logger';
import { Logger } from '@nestjs/common';
import { ClientErrorsController, scrubText } from './client-errors.controller';

function setup() {
  const lines: string[] = [];
  const reported: Error[] = [];
  Logger.overrideLogger(new JsonLogger('warn', (l) => lines.push(l)));
  setReporter({ captureException: (e) => void reported.push(e as Error) });
  return { lines, reported, controller: new ClientErrorsController() };
}

afterEach(() => {
  setReporter(null);
  Logger.overrideLogger(false);
});

describe('POST /client-errors', () => {
  it('forwards a site crash to the error tracker under its own name', () => {
    const { controller, reported, lines } = setup();
    const out = controller.report({
      source: 'web',
      message: 'TypeError: x is undefined',
      stack: 'TypeError: x is undefined\n    at Card (app.js:10:3)',
      route: '/produto/toyota-runx',
      release: 'abc123',
      platform: 'Chrome 131',
    });
    expect(out).toEqual({ accepted: true });
    expect(reported).toHaveLength(1);
    expect(reported[0]!.name).toBe('ClientWeb');
    expect(reported[0]!.message).toContain('TypeError: x is undefined');
    expect(reported[0]!.message).toContain('route=/produto/toyota-runx');
    expect(reported[0]!.stack).toContain('at Card (app.js:10:3)');
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: 'ERROR', context: 'ClientWeb' });
  });

  it('names app and server-rendering errors apart', () => {
    const { controller, reported } = setup();
    controller.report({ source: 'mobile', message: 'boom' });
    controller.report({ source: 'web-server', message: 'boom' });
    expect(reported.map((e) => e.name)).toEqual(['ClientMobile', 'WebServer']);
  });

  it('strips query strings, e-mails and phone numbers before anything is kept', () => {
    const { controller, reported } = setup();
    controller.report({
      source: 'web',
      message: 'Failed for ana@example.com calling +258 84 123 4567',
      route: '/pesquisa?q=casa&phone=841234567',
      stack: 'Error\n    at https://nhonga.co.mz/entrar?token=secret123:1:1',
    });
    const text = `${reported[0]!.message}\n${reported[0]!.stack}`;
    for (const leak of ['ana@example.com', '84 123 4567', 'q=casa', 'secret123'])
      expect(text).not.toContain(leak);
    expect(text).toContain('route=/pesquisa');
  });

  it('drops reports past the global cap and recovers the next minute', () => {
    const { controller, reported } = setup();
    let now = 1_000_000;
    controller.now = () => now;
    let accepted = 0;
    for (let i = 0; i < 150; i++)
      if (controller.report({ source: 'mobile', message: `e${i}` }).accepted) accepted++;
    expect(accepted).toBe(120);
    expect(reported).toHaveLength(120);
    now += 61_000;
    expect(controller.report({ source: 'mobile', message: 'later' })).toEqual({ accepted: true });
  });
});

describe('scrubText', () => {
  it('leaves ordinary error text alone', () => {
    expect(scrubText("Cannot read properties of undefined (reading 'map')")).toBe(
      "Cannot read properties of undefined (reading 'map')",
    );
    expect(scrubText('at render (chunk-12.js:4:120)')).toBe('at render (chunk-12.js:4:120)');
  });
});
