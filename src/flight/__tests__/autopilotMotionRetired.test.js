import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.resolve(__dirname, '../../main.js');

// Strip // line comments and /* */ block comments so the assertion only sees
// live code. AutopilotMotion is retired (file kept, main.js wiring removed):
// the only surviving mentions are allowed to live inside comments.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (not URLs after ':')
}

describe('AutopilotMotion is retired — no live reference in main.js', () => {
  const code = stripComments(readFileSync(MAIN, 'utf8'));

  it('does not import AutopilotMotion', () => {
    expect(code).not.toMatch(/import\s*\{[^}]*\bAutopilotMotion\b[^}]*\}\s*from/);
  });

  it('does not instantiate or reference the autopilotMotion variable in live code', () => {
    expect(code).not.toMatch(/\bautopilotMotion\b/);
  });

  it('does not expose window._autopilotMotion', () => {
    expect(code).not.toMatch(/window\._autopilotMotion\s*=/);
  });
});
