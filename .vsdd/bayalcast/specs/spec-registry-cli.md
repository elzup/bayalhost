---
id: spec:registry-cli
title: CLI for project registration and deployment
coherence:
  depends_on:
    - design:config
    - spec:setup
---

# spec:registry-cli

## Requirements

- REQ-CLI-001: WHEN the user runs `bayalhost.mjs list`, THE SYSTEM SHALL print
  registered projects with enabled status and artifact path.
- REQ-CLI-002: WHEN the user runs `bayalhost.mjs add <name> <artifact>`, THE
  SYSTEM SHALL add or update the registry entry.
- REQ-CLI-003: WHEN the user runs `bayalhost.mjs deploy <name>`, THE SYSTEM
  SHALL deploy the matching enabled registry entry.
- REQ-CLI-004: WHEN the user runs `bayalhost.mjs validate`, THE SYSTEM SHALL
  verify registered artifact and env file paths.
