import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.schema.js';
import { AssistantError, AssistantService } from './assistant.service.js';
import type { ChatMessage } from './assistant.types.js';

// Minimal ConfigService double: only the two keys the service reads.
function fakeConfig(apiKey: string | null): ConfigService<AppConfig, true> {
  return {
    get: (key: string) => (key === 'assistantApiKey' ? apiKey : 'claude-sonnet-5'),
  } as unknown as ConfigService<AppConfig, true>;
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
});
