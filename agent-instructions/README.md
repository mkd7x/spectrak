# Spectrak Agent Bootstrap Pack

This folder contains portable instruction files for projects that use Spectrak as an API-backed Markdown context store.

The pack supports:

- General coding agents that load `AGENTS.md`.
- GitHub Copilot through `.github/copilot-instructions.md`.

## Install

Copy or merge the files into the consuming project. Do not overwrite existing project instructions without reviewing them.

```sh
cp agent-instructions/AGENTS.md /path/to/project/AGENTS.md
mkdir -p /path/to/project/.github
cp agent-instructions/copilot-instructions.md \
  /path/to/project/.github/copilot-instructions.md
```

If either destination already exists, merge the Spectrak rules with the existing instructions instead of replacing project-specific rules.

## Service Discovery

Configure the consuming project with the Spectrak base URL using `SPECTRAK_URL`. Agents should query the runtime contract before using the API:

```sh
curl "$SPECTRAK_URL/api/help"
```

The detailed reference remains in the Spectrak repository at `docs/spectrak-agent-operations.md`.

Keep `AGENTS.md` and `copilot-instructions.md` synchronized when the Spectrak API or agent workflow changes.
