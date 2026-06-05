---
id: spec:setup
title: setup bayalcast in a development repository
coherence:
  depends_on:
    - design:config
---

# spec:setup

## Requirements

- REQ-SETUP-001: WHEN a repository has a static artifact directory containing
  `index.html`, THE SYSTEM SHALL register it as a bayalcast project.
- REQ-SETUP-002: WHEN the user deploys a registered project, THE SYSTEM SHALL
  copy the artifact into `sites/<project>/releases/<timestamp>`.
- REQ-SETUP-003: WHEN a deploy completes, THE SYSTEM SHALL update
  `sites/<project>/current` to point at the new release.
- REQ-SETUP-004: IF an artifact path is missing or lacks `index.html`, THEN THE
  SYSTEM SHALL fail before changing `current`.
