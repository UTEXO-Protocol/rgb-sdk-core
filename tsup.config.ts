import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/conformance/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
});
