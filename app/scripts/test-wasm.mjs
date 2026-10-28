// Runs every fixture through the BUILT Functions (dist/function.wasm) with
// Shopify's function-runner, and compares the output to the fixture.
// Build first: npx shopify app function build --path extensions/<name>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const bin = path.resolve('node_modules/@shopify/cli/bin');
const runner = fs.readdirSync(bin).find((f) => f.startsWith('function-runner'));
if (!runner) throw new Error('function-runner not found; run a function build once to download it');

let failed = 0;
for (const ext of fs.readdirSync('extensions')) {
  const dir = path.join('extensions', ext);
  const wasm = path.join(dir, 'dist/function.wasm');
  const fixtures = path.join(dir, 'tests/fixtures');
  if (!fs.existsSync(wasm) || !fs.existsSync(fixtures)) continue;
  const query = fs.readdirSync(path.join(dir, 'src')).find((f) => f.endsWith('.graphql'));

  for (const file of fs.readdirSync(fixtures).filter((f) => f.endsWith('.json'))) {
    const { payload } = JSON.parse(fs.readFileSync(path.join(fixtures, file), 'utf8'));
    const input = path.join(os.tmpdir(), `loftline-${ext}-${file}`);
    fs.writeFileSync(input, JSON.stringify(payload.input));
    const raw = execFileSync(path.join(bin, runner), [
      '-f', wasm, '--input', input, '--export', payload.export, '--json',
      '--schema-path', path.join(dir, 'schema.graphql'), '--query-path', path.join(dir, 'src', query),
    ]).toString();
    const result = JSON.parse(raw);
    const ok = isDeepStrictEqual(result.output, payload.output);
    if (!ok) failed++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${ext} / ${file}  (${result.instructions ?? '?'} instructions)`);
    if (!ok) console.log(JSON.stringify(result.output, null, 2));
  }
}
process.exit(failed ? 1 : 0);
