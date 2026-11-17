// usage: node _tools/build.mjs <site-folder>   bundles src/main.js -> site/assets/js/app.js (classic script, works from file://)
import { build } from 'esbuild';
import path from 'node:path';
const dir = path.resolve(process.argv[2]);
await build({ entryPoints: [path.join(dir, 'src/main.js')], outfile: path.join(dir, 'site/assets/js/app.js'), bundle: true, minify: true, format: 'iife', target: 'es2019', nodePaths: [path.resolve('_tools/node_modules')], legalComments: 'none', logLevel: 'info' });
