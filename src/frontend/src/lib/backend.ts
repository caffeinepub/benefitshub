import { createActorWithConfig } from "../config";
import type { backendInterface } from "../backend";

let _actor: backendInterface | null = null;
let _promise: Promise<backendInterface> | null = null;

export async function getBackend(): Promise<backendInterface> {
  if (_actor) return _actor;
  if (_promise) return _promise;
  _promise = createActorWithConfig().then((actor) => {
    _actor = actor;
    return actor;
  });
  return _promise;
}

// Proxy that lazily calls through to the actor
export const backend = new Proxy({} as backendInterface, {
  get(_target, prop: string) {
    return async (...args: unknown[]) => {
      const actor = await getBackend();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any)[prop](...args);
    };
  },
});
