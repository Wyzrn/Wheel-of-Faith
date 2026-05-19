---
status: partial
phase: 07-story-mode-shell-character-roster
source: [07-VERIFICATION.md]
started: 2026-05-18T23:58:00Z
updated: 2026-05-18T23:58:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full spin loop end-to-end
expected: Navigate to /story, click Enter Story Mode, spin through the full queue. A new auto-named character appears in the roster grid after the final spin completes. Name format matches 'Adjective Noun' (e.g. 'Crimson Reaper'). Character is at the top of the roster (most-recent-first). localStorage shows story_roster populated and story_session cleared.
result: [pending]

### 2. Mid-session resume prompt
expected: Start a spin session, spin 3 wheels, then reload /story. 'Resume Story Session?' modal appears showing '3 spins done'. Clicking Resume continues from wheel 4. Clicking Start Over clears the session and starts fresh.
result: [pending]

### 3. Manual roster seed → expand → sell flow
expected: Seed localStorage manually, navigate to /story. Entry screen shows '1 / 50 characters' and 'View Roster' link. Clicking View Roster shows one RosterCard. Clicking the card (not Sell) opens an overlay with CharacterCard in readonly mode. Clicking Sell Character opens SellConfirmModal. Confirm Sell removes the card and increments shard balance.
result: [pending]

### 4. Roster sort visual styling
expected: Active sort button shows gold underline, inactive shows neutral background. Sort order switches correctly between Most Recent and Highest Tier.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
