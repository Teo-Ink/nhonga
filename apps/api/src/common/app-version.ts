/**
 * The running version, for the startup line and the error tracker's release.
 *
 * APP_VERSION wins when it names a real version. The deploy only swaps the
 * image tag on the task definition, so in ECS the variable can still say
 * "latest"; then the tag of the image this task actually runs is read from the
 * ECS task metadata endpoint (the commit SHA the pipeline pushed).
 */
const PLACEHOLDERS = new Set(['', 'latest', 'unknown']);

export function versionFromImage(image: string | undefined): string | null {
  if (!image) return null;
  // registry/repo:tag or registry/repo@sha256:…; a registry port is not a tag.
  const name = image.split('@')[0] ?? '';
  const tag = name.slice(name.lastIndexOf('/') + 1).split(':')[1];
  return tag && !PLACEHOLDERS.has(tag) ? tag : null;
}

export async function resolveAppVersion(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const declared = (env['APP_VERSION'] ?? '').trim();
  if (!PLACEHOLDERS.has(declared)) return declared;
  const metadata = env['ECS_CONTAINER_METADATA_URI_V4'];
  if (metadata) {
    try {
      const res = await fetchFn(metadata, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const tag = versionFromImage(((await res.json()) as { Image?: string }).Image);
        if (tag) return tag;
      }
    } catch {
      /* metadata is a nicety; never delay or fail startup over it */
    }
  }
  return declared || 'unknown';
}
