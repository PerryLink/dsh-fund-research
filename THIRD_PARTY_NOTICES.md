# Third-party notices

`dsh-fund-research` bundles no third-party source code. All TypeScript/JavaScript
sources in this repository are original works by the dsh-fund-research contributors,
licensed under Apache-2.0 (see `LICENSE`).

The package depends on the following software. None of it is bundled into the
published tarball except where noted; these are install-time dependencies:

| Package | Version range | License | Purpose |
|---|---|---|---|
| [tsdown](https://github.com/rolldown/tsdown) | `^0.22.14` | MIT | Build-time bundling of `lib/` (a regular dependency so the git-install channel's `prepare` script can build) |
| [typescript](https://github.com/microsoft/TypeScript) | `^5.9.0` | Apache-2.0 | Build-time declaration emission (`lib/types/`) |
| [zod](https://github.com/colinhacks/zod) | `^4.4.3` | MIT | Runtime value schema for the `dsh_fund_research` storage-domain table (bundled into `lib/`; devDependency) |
| [@deepseek-ai/cordis](https://www.npmjs.com/package/@deepseek-ai/cordis) | `^4.0.1` (peer) | See package | The plugin runtime |
| [@deepseek-ai/schemastery](https://www.npmjs.com/package/@deepseek-ai/schemastery) | `^3.18.0` (peer) | See package | Configuration schema |
| `@deepseek-ai/dsh-*` peers | `0.1.0-rc.8` (peer) | See packages | Official harness seams (`dsh-session`, `dsh-tools`, `dsh-storage`, `dsh-storage-json`, `dsh-storage-domain`, `dsh-skill-filesystem`) |

At runtime the plugin talks to the harness services listed as peerDependencies
plus the public Tiantian Fund / Eastmoney endpoints documented in the README;
it stores no credentials.
