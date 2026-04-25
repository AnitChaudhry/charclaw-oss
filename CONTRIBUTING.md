# Contributing to CharClaw

Thanks for looking at the code. CharClaw is maintained by [@AnitChaudhry](https://github.com/AnitChaudhry) and accepts contributions from anyone who wants to make it better for their own use or for the community.

## Ground rules

- **`main` is protected.** Direct pushes are disabled. Every change goes through a pull request reviewed and merged by the maintainer.
- **Fork first.** If you don't have write access (you don't), create a fork, push your branch to the fork, and open the PR from `your-fork:your-branch` → `AnitChaudhry/CharClaw-App:main`.
- **Small PRs move faster.** One feature or fix per PR. If your change touches more than ~400 lines across more than ~5 files, consider splitting.
- **Keep the repo forkable.** No maintainer credentials, no hostnames, no per-deploy secrets in code. Anything environment-specific belongs in env vars, and documented in `.env.example` or `DEPLOYMENT.md`.

## What gets merged

- Bug fixes (include repro steps in the PR description)
- Test additions
- Documentation improvements
- New agent integrations (follow the pattern in `packages/agents/src/agents/*`)
- Platform features that align with the roadmap in README.md
- Performance and security improvements

## What gets rejected

- Scope creep that bends CharClaw into a different product
- Features that require shared infrastructure (we're self-hosted by design)
- Anything that adds a cloud-vendor dependency without a clean fallback
- PRs that break existing behavior without a migration path
- PRs that pin to Claude Code specifically — CharClaw is multi-agent

## Getting set up locally

```bash
git clone https://github.com/<your-username>/CharClaw-App.git
cd CharClaw-App
npm install
cp .env.example packages/web/.env   # fill in your own values (see DEPLOYMENT.md)
npm run dev -w @charclaw/web        # http://localhost:3000
```

Full production deploy checklist: [DEPLOYMENT.md](DEPLOYMENT.md).

## Opening a PR

1. Create a branch off `main`: `git checkout -b feat/your-change`
2. Make the change. Run `npx tsc --noEmit -p packages/web/tsconfig.json` and fix any new errors your change introduces.
3. If you added logic, add a test under `packages/web/lib/**/*.test.ts`.
4. Push to your fork, open a PR against `AnitChaudhry/CharClaw-App:main`.
5. Fill in the PR template: what it does, why, how you tested, screenshots if UI.
6. The maintainer reviews, leaves comments or merges. Expect 1–5 day turnaround.

## Code of conduct

Be respectful. Criticism of code is fine; criticism of people is not. The maintainer reserves the right to lock or close PRs / issues that are abusive, off-topic, or demanding.

## License

By submitting a contribution you agree it is licensed under Apache 2.0 — the same license the rest of the project uses. See [LICENSE](LICENSE).
