// In-memory stand-in for expo-secure-store, so the session code can be tested
// without a device. `failing` simulates a platform without secure storage.
const items = new Map<string, string>();
export const state = { failing: false };

export async function getItemAsync(key: string): Promise<string | null> {
  if (state.failing) throw new Error('secure store unavailable');
  return items.get(key) ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  if (state.failing) throw new Error('secure store unavailable');
  items.set(key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  if (state.failing) throw new Error('secure store unavailable');
  items.delete(key);
}
export function reset(): void {
  items.clear();
  state.failing = false;
}
