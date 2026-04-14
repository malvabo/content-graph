let worker: Worker | null = null;
const pending = new Map<number, (hash: string) => void>();
let nextId = 0;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./hashWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; hash: string }>) => {
      const resolve = pending.get(e.data.id);
      if (resolve) {
        pending.delete(e.data.id);
        resolve(e.data.hash);
      }
    };
  }
  return worker;
}

export function hashContent(input: string): Promise<string> {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    getWorker().postMessage({ id, data: input });
  });
}
