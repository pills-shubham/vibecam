import { defineConfig } from 'tsup';

/**
 * Bundle the server (and its workspace deps, which are consumed as source)
 * into a single ESM file so `npm start` is a plain `node dist/index.js` with
 * no build-ordering between packages.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Workspace packages are symlinked into node_modules; force them to be bundled.
  noExternal: [/@vibecam\//],
});
