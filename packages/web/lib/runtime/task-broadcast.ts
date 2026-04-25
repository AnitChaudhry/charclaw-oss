/**
 * Process-local registry of active daemon SSE controllers.
 *
 * Lives outside `app/api/runtime/tasks/route.ts` because Next.js App Router
 * is strict about what a `route.ts` file may export — anything other than
 * HTTP method handlers (GET/POST/etc.) breaks the generated route type.
 *
 * Stored on `globalThis` because Next.js dev-mode module isolation hands
 * each route its own module instance otherwise, so the SSE handler and
 * the dispatcher would end up with two different `activeStreams` Maps.
 */

type ControllerMap = Map<
  string,
  ReadableStreamDefaultController<Uint8Array>
>

type GlobalWithTasks = typeof globalThis & {
  __charclawActiveStreams?: ControllerMap
}

const g = globalThis as GlobalWithTasks
if (!g.__charclawActiveStreams) {
  g.__charclawActiveStreams = new Map()
}
export const activeStreams: ControllerMap = g.__charclawActiveStreams

export function pushTaskToRuntime(runtimeId: string, task: unknown): boolean {
  const controller = activeStreams.get(runtimeId)
  if (!controller) return false
  const data = `data: ${JSON.stringify(task)}\n\n`
  controller.enqueue(new TextEncoder().encode(data))
  return true
}
