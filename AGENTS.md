# Agent Instructions

## GitHub Access

- This repository is connected to the ChatGPT GitHub connector under `sivagr-14/english-learning-platform`.
- When GitHub access is needed, prefer the GitHub connector for repository reads, pull request creation, issue/PR inspection, and review workflows.
- Do not treat a missing or unauthenticated local `gh` CLI session as a hard blocker when the GitHub connector is available for the same operation.
- Local `git` may be used for branch creation, commits, and pushes when repository credentials are available.
- Keep unrelated local files out of commits. In particular, only stage files that belong to the user-requested change.
- Default to creating a feature branch and draft pull request rather than pushing directly to `main`, unless the user explicitly asks for a direct main push.
