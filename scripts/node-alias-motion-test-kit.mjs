// scripts/node-alias-motion-test-kit.mjs — the bundler's ONE resolve alias, for bare node.
//
//   node --import ./scripts/node-alias-motion-test-kit.mjs scripts/<capture>.mjs
//
// ⚠ WHY A CAPTURE SCRIPT NEEDS THIS AND A TEST DOES NOT. `vite.config.js:37` aliases the bare
// specifier `motion-test-kit` to the vendored submodule, and the test runner reads that config. Bare
// node does not: it resolves `motion-test-kit/core/hash/fnv1a.js` against
// `node_modules/motion-test-kit/package.json`'s `exports` map, which does not publish that subpath,
// so `src/util/scene-naming.js:20` — and therefore `src/objects/Planet.js`, and therefore
// `labPackCtx` — throws ERR_PACKAGE_PATH_NOT_EXPORTED before a capture script can read a single body.
//
// ⛔ IT IS AN ALIAS, NOT A STUB. It re-points the specifier at the SAME vendored files the app and
// the suite load; nothing is mocked, so a fixture captured under it is the shipped code's own output.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./node-alias-motion-test-kit-hooks.mjs', import.meta.url), pathToFileURL('./'));
