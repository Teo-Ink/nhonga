import { describe, expect, it } from 'vitest';
import { resolveAppVersion, versionFromImage } from './app-version';

const metadata = (image: string) =>
  (async () => new Response(JSON.stringify({ Image: image }))) as unknown as typeof fetch;

describe('versionFromImage', () => {
  it('reads the tag of an ECR image', () => {
    expect(versionFromImage('1.dkr.ecr.af-south-1.amazonaws.com/nhonga-api:8034344')).toBe(
      '8034344',
    );
  });
  it('ignores a registry port, a digest and placeholder tags', () => {
    expect(versionFromImage('localhost:5000/nhonga-api')).toBeNull();
    expect(versionFromImage('repo/nhonga-api@sha256:abc')).toBeNull();
    expect(versionFromImage('repo/nhonga-api:latest')).toBeNull();
    expect(versionFromImage(undefined)).toBeNull();
  });
});

describe('resolveAppVersion', () => {
  it('keeps a real APP_VERSION without asking ECS', async () => {
    const never = (() => {
      throw new Error('must not be called');
    }) as unknown as typeof fetch;
    expect(
      await resolveAppVersion(
        { APP_VERSION: 'abc123', ECS_CONTAINER_METADATA_URI_V4: 'http://m' },
        never,
      ),
    ).toBe('abc123');
  });

  it('replaces "latest" with the tag of the running image', async () => {
    const env = { APP_VERSION: 'latest', ECS_CONTAINER_METADATA_URI_V4: 'http://m' };
    expect(await resolveAppVersion(env, metadata('repo/nhonga-api:8034344'))).toBe('8034344');
  });

  it('falls back quietly when the metadata is unavailable', async () => {
    const down = (async () => {
      throw new Error('unreachable');
    }) as unknown as typeof fetch;
    const env = { APP_VERSION: 'latest', ECS_CONTAINER_METADATA_URI_V4: 'http://m' };
    expect(await resolveAppVersion(env, down)).toBe('latest');
    expect(await resolveAppVersion({}, down)).toBe('unknown');
  });
});
