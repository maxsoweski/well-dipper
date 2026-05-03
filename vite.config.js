import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  base: '/well-dipper/',
  server: {
    host: true,         // Expose to network so Windows browser can reach WSL
    fs: {
      // Allow the dev server to serve files from the motion-test-kit
      // submodule (already inside the project tree under vendor/).
      // Explicit allow-list documents the contract.
      allow: [path.resolve(__dirname)],
    },
  },
  resolve: {
    alias: {
      // motion-test-kit consumed via git submodule. Alias resolves bare
      // imports like `motion-test-kit/core/predicates` to the vendored
      // copy. The kit's package.json `exports` map handles sub-path
      // routing; Vite's alias points at the kit's root.
      'motion-test-kit': path.resolve(__dirname, 'vendor/motion-test-kit'),
    },
  },
};
