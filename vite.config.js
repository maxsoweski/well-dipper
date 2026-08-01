import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default ({ command }) => ({
  // BASE IS MODE-DEPENDENT ON PURPOSE (2026-08-01).
  //
  // Production is served at the ROOT of https://welldipper.maxsoweski.com/, so
  // the built base must be '/' or every asset 404s. Dev deliberately KEEPS
  // '/well-dipper/': that path is baked into ~43 places — every lab HTML header,
  // the workstream contracts' verification URLs, and the handoffs — and it is
  // Max's typing muscle memory (`:5174/well-dipper/`). Moving dev to the root
  // would invalidate all of it for zero benefit, since dev is never served from
  // the custom domain.
  //
  // The custom domain itself is set by `public/CNAME`, which Vite copies
  // verbatim into dist/ and GitHub Pages reads from the uploaded artifact.
  // ⚠ Both must stay in step: base '/' without the CNAME breaks the github.io
  // URL, and the CNAME without base '/' breaks the custom domain.
  base: command === 'build' ? '/' : '/well-dipper/',
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
});
