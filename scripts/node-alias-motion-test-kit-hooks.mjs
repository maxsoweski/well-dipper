// scripts/node-alias-motion-test-kit-hooks.mjs — the resolve hook registered by its sibling.
// One rule, the same one vite.config.js:37 states: `motion-test-kit[/subpath]` → `vendor/motion-test-kit[/subpath]`.
import { pathToFileURL } from 'node:url';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = 'motion-test-kit';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === PREFIX || specifier.startsWith(PREFIX + '/')) {
    const rest = specifier.slice(PREFIX.length);
    const url = pathToFileURL(resolvePath(ROOT, 'vendor/motion-test-kit' + rest)).href;
    return { url, shortCircuit: true, format: 'module' };
  }
  return nextResolve(specifier, context);
}
