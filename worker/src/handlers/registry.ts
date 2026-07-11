export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerHandler(name: string, handler: JobHandler) {
  handlers.set(name, handler);
}

export function getHandler(name: string): JobHandler | undefined {
  return handlers.get(name);
}
