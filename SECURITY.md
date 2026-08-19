# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately through GitHub's private vulnerability reporting:

**https://github.com/PerryLink/dsh-fund-research/security/advisories/new**

That flow keeps the report confidential while we triage, and it is the channel we watch first.

## Before you report

- **Redact sensitive data** from any logs or session excerpts you attach: tokens, API keys, secrets, Authorization/request headers, personal paths, and account identifiers.
- Include, when possible: the plugin version, the harness (`dsh`) version, Node and OS versions, and the minimal steps to reproduce.

## What to expect

- **Acknowledgment**: within 5 business days.
- **Triage**: within 10 business days we confirm the issue and assess severity, or ask for more details.
- **Fix**: security fixes are prepared in a private fork, released as a patch version, and announced in the release notes.

## Disclosure and credit

- We follow coordinated disclosure: a public advisory (and CVE request where appropriate) is published once a fix ships.
- Reporters are credited in the advisory unless they ask to remain anonymous. There is no bug bounty program at this time.

## Scope

This plugin is a read-only research collector. Its guarantees are:

- **Public data only** — it fetches only the public, keyless Tiantian Fund / Eastmoney endpoints listed in the README, with a browser User-Agent and polite pacing; it never logs in, never pays, and never circumvents anti-crawler measures.
- **No remote-code evaluation** — the `pingzhongdata` JavaScript payload is parsed with a depth-aware scanner (`var X = ...` extraction + `JSON.parse`); `eval`/`Function` are never invoked on remote content.
- **No credentials** — the plugin reads no credential store and writes none.
- **Workspace-confined writes** — reports and snapshots are sealed only under the configured report root (default `fund-reports/`) inside the session workspace; fund codes are validated six-digit strings before they join a path.
- **Fail-loud configuration** — every tunable is validated at mount.

Vulnerabilities in the harness itself should be reported to the official harness maintainers instead.
