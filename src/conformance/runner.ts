/** Test-runner plumbing shared by the conformance suites. */

export type ItFn = (name: string, fn: () => void | Promise<void>) => void;
export type DescribeFn = (name: string, fn: () => void) => void;
export type ExpectFn = (actual: unknown) => {
  toBe(expected: unknown): void;
  toContain(expected: unknown): void;
};

export interface RunnerBindings {
  describe?: DescribeFn;
  it?: ItFn;
  expect?: ExpectFn;
}

/** Uses the passed bindings, or the Jest/Vitest globals. */
export function resolveRunner(suite: string, opts: RunnerBindings) {
  const g = globalThis as unknown as Record<string, unknown>;
  const describe = opts.describe ?? (g.describe as DescribeFn | undefined);
  const it = opts.it ?? (g.it as ItFn | undefined);
  const expect = opts.expect ?? (g.expect as ExpectFn | undefined);
  if (!describe || !it || !expect) {
    throw new Error(
      `${suite}: no test runner found. Pass { describe, it, expect } ` +
        'explicitly, or run inside Jest/Vitest where they are global.'
    );
  }
  return { describe, it, expect };
}
