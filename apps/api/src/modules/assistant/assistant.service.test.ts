import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.schema.js';
import { AssistantError, AssistantService } from './assistant.service.js';
import type { ChatMessage } from './assistant.types.js';

// Minimal ConfigService double for the keys the service reads.
function fakeConfig(
  apiKey: string | null,
  ratePerMin = 15,
  cap = 0,
): ConfigService<AppConfig, true> {
  const values: Record<string, unknown> = {
    assistantApiKey: apiKey,
    assistantModel: 'claude-sonnet-5',
    assistantRatePerMin: ratePerMin,
    assistantMonthlyTokenCap: cap,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<AppConfig, true>;
}

const user = (content: string): ChatMessage => ({ role: 'user', content });

describe('AssistantService', () => {
  it('reports not configured and answers with a notice when no API key is set', async () => {
    const svc = new AssistantService(fakeConfig(null));
    expect(svc.configured).toBe(false);
    const reply = await svc.chat([user('Como pago?')]);
    expect(reply.configured).toBe(false);
    expect(reply.reply).toContain('ANTHROPIC_API_KEY');
  });

  it('reports configured when a key is present', () => {
    const svc = new AssistantService(fakeConfig('sk-ant-test'));
    expect(svc.configured).toBe(true);
  });

  it('rejects an empty transcript', async () => {
    const svc = new AssistantService(fakeConfig(null));
    await expect(svc.chat([])).rejects.toBeInstanceOf(AssistantError);
  });

  it('rejects when the last message is not from the user', async () => {
    const svc = new AssistantService(fakeConfig(null));
    await expect(
      svc.chat([user('oi'), { role: 'assistant', content: 'olá' }]),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('rejects an over-long message', async () => {
    const svc = new AssistantService(fakeConfig(null));
    await expect(svc.chat([user('x'.repeat(2001))])).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });

  it('rejects an empty message body', async () => {
    const svc = new AssistantService(fakeConfig(null));
    await expect(svc.chat([user('   ')])).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('rate-limits a client after the per-minute allowance', async () => {
    const svc = new AssistantService(fakeConfig(null, 2)); // 2 requests / minute
    await svc.chat([user('1')], '1.2.3.4');
    await svc.chat([user('2')], '1.2.3.4');
    await expect(svc.chat([user('3')], '1.2.3.4')).rejects.toMatchObject({ code: 'rate_limited' });
    // A different client is unaffected.
    await expect(svc.chat([user('a')], '5.6.7.8')).resolves.toMatchObject({ configured: false });
  });
});
