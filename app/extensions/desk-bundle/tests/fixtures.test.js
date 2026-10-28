// Runs every fixture cart through the Function and checks the result.
// Each fixture is first validated against the real Shopify schema and the
// input query, so a typo in a field name fails here rather than on the store.
// The wasm build is checked separately by `npm run build` once the app is linked.
import path from 'node:path';
import fs from 'node:fs';
import { describe, beforeAll, test, expect } from 'vitest';
import { loadSchema, loadInputQuery, loadFixture, validateTestAssets } from '@shopify/shopify-function-test-helpers';
import { cartTransformRun } from '../src/cart_transform_run.js';

const root = path.resolve(__dirname, '..');
const fixturesDir = path.join(__dirname, 'fixtures');

describe('desk bundle', () => {
  let schema;
  let inputQueryAST;

  beforeAll(async () => {
    schema = await loadSchema(path.join(root, 'schema.graphql'));
    inputQueryAST = await loadInputQuery(path.join(root, 'src/cart_transform_run.graphql'));
  });

  for (const file of fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'))) {
    test(file.replace('.json', '').replaceAll('-', ' '), async () => {
      const fixture = await loadFixture(path.join(fixturesDir, file));
      const validation = await validateTestAssets({ schema, fixture, inputQueryAST });
      expect(validation.inputQuery.errors).toEqual([]);
      expect(validation.inputFixture.errors).toEqual([]);
      expect(validation.outputFixture.errors).toEqual([]);

      expect(cartTransformRun(fixture.input)).toEqual(fixture.expectedOutput);
    });
  }
});
