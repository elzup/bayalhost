import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const defaultCegTool = resolve(
  repoRoot,
  '..',
  'agent-setup',
  'skills',
  'vsdd',
  'tools',
  'ceg.mjs',
);
const cegTool = process.env.CEG_TOOL ?? defaultCegTool;
const specsDir = resolve(here, '..', 'specs');

test('CEG: bayalcast spec graph is consistent', () => {
  const result = spawnSync('node', [cegTool, 'validate', '--specs', specsDir], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
