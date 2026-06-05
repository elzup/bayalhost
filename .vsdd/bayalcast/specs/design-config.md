---
id: design:config
title: bayalcast project registry schema
coherence:
  depends_on: []
---

# design:config

The bayalcast setup workflow uses a repo-local JSON registry as the source of
truth.

## Requirements

- REQ-CONFIG-001: THE SYSTEM SHALL store setup metadata in
  `bayalhost.config.json`.
- REQ-CONFIG-002: THE SYSTEM SHALL validate project names with `[a-z0-9-]+`.
- REQ-CONFIG-003: THE SYSTEM SHALL model each project with `name`, `source`,
  `artifact`, `envFile`, `type`, and `enabled`.
- REQ-CONFIG-004: THE SYSTEM SHALL keep generated site releases out of git.

## Notes

The registry is intentionally static JSON so agents, scripts, and a future web
form can all operate on the same abstraction.
