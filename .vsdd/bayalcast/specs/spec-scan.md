---
id: spec:scan
title: scan candidate static artifacts
coherence:
  depends_on:
    - design:config
---

# spec:scan

## Requirements

- REQ-SCAN-001: WHEN the user runs `bayalhost.mjs scan`, THE SYSTEM SHALL scan
  configured `scanRoots`.
- REQ-SCAN-002: THE SYSTEM SHALL treat `out`, `dist`, and `build` directories
  containing `index.html` as candidates.
- REQ-SCAN-003: THE SYSTEM SHALL mark candidates already present in the registry
  as `registered`.
- REQ-SCAN-004: THE SYSTEM SHALL avoid recursive full-disk scanning.
