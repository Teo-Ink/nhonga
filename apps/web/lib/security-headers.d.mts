export function contentSecurityPolicy(opts?: {
  dev?: boolean;
  imageHosts?: string[];
  nonce?: string;
}): string;
export function securityHeaders(opts?: {
  dev?: boolean;
  imageHosts?: string[];
}): Array<{ key: string; value: string }>;
export function imageHostsFromEnv(env: Record<string, string | undefined>): string[];
