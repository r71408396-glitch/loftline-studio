// Bundles the 3D desk viewer (three.js, tree-shaken) into theme/assets.
// Usage: node scripts/build.mjs [--watch] [--serve]
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const serve = process.argv.includes('--serve');

const options = {
  entryPoints: { 'desk-viewer': 'src/desk-viewer/index.js' },
  outdir: 'theme/assets',
  bundle: true,
  format: 'esm',
  minify: true,
  target: ['es2020'],
  legalComments: 'none',
  logLevel: 'info',
  metafile: true,
};

if (watch || serve) {
  const context = await esbuild.context(options);
  await context.watch();
  if (serve) {
    const { port } = await context.serve({ servedir: '.', port: 5178 });
    console.log(`Preview: http://localhost:${port}/preview/desk.html`);
  }
} else {
  const result = await esbuild.build(options);
  const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
  console.log(`desk-viewer.js: ${(bytes / 1024).toFixed(1)} KB`);
}
