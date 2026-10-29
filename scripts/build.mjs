// Bundles the theme's JavaScript into theme/assets:
//   desk-viewer.js  3D desk viewer (three.js, tree-shaken)
//   motion.js       GSAP animations and the 3D logo element
//   home.js         home page hero, exploded details view and accessories row
// Code shared between them (three.js, GSAP) and the lazily loaded 3D logo scene
// go into chunk-*.js files next to them. Shopify serves theme assets from one
// folder, so the relative imports between them keep working on the CDN.
// Usage: node scripts/build.mjs [--watch] [--serve]
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const serve = process.argv.includes('--serve');
const outdir = 'theme/assets';

// Old chunks would otherwise pile up in the theme with every build.
for (const file of fs.readdirSync(outdir)) {
  if (/^chunk-[\w-]+\.js$/.test(file)) fs.rmSync(path.join(outdir, file));
}

const options = {
  entryPoints: {
    'desk-viewer': 'src/desk-viewer/index.js',
    motion: 'src/motion/index.js',
    home: 'src/home/index.js',
  },
  outdir,
  bundle: true,
  splitting: true,
  format: 'esm',
  chunkNames: 'chunk-[hash]',
  loader: { '.glb': 'binary' },
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
  for (const [file, output] of Object.entries(result.metafile.outputs)) {
    console.log(`${path.basename(file)}: ${(output.bytes / 1024).toFixed(1)} KB`);
  }
}
