# Wheel of Fate

## What This Is

A web-based character creation game where players spin 23 sequential animated wheels to generate a complete character — race, archetypes, stats, powers, weapons, and a final title. Inspired by the "Wheel of Faith" Instagram format, built as a full-featured browser game in JavaScript with backend persistence and a shareable character gallery.

## Core Value

The dramatic, sequential spin-by-spin reveal — each wheel lands somewhere unexpected, building tension and excitement, culminating in the Redemption Spin and a Title that defines who your character is.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Animated spinning wheel graphic that visually decelerates and lands on a result
- [ ] 23 spin categories executed in order: Race → Racial Ability Spin(s) → Archetype → Archetype Ability Spin(s) → Backstory → Height → Strength → Speed → Agility → Durability → IQ → Charisma → Fighting Skill → Power(s) → Power Mastery → Weapon(s) → Weapon Mastery → Weapon Enchantment → Potential → Energy Level → Weakness(s) → Redemption Spin → Title
- [ ] Original multiverse content pool: diverse races (fantasy, sci-fi, mythological, original), archetypes, powers, weapons, backstories, titles
- [ ] Variable ability spin counts — number of racial/archetype ability spins determined by the race/archetype result
- [ ] Dual scaling system: letter tier (F → D → C → B → A → S → SS → SSS → God) + numeric score
- [ ] Redemption Spin: probability wheel weighted by character's overall power score (weak character = higher chance), then if earned, a second outcome wheel with chaotic results (e.g. Inversion, God's Gift, Cursed, etc.)
- [ ] Character card: full display of all 23 spin results in a readable, styled sheet after completion
- [ ] Backend + database for character persistence
- [ ] Shareable character links (unique URL per character)
- [ ] Character gallery/roster to browse saved characters

### Out of Scope

- Multiplayer / real-time play — not the focus, character creation is the game
- Combat system or gameplay beyond character creation — future milestone
- Mobile native app — responsive web is sufficient
- Authentication/accounts — characters saved and shared via link, no login required initially

## Context

- Inspired by "Wheel of Faith" on Instagram — sequential wheel reveals with dramatic outcomes
- Target audience: people who enjoy random character generators, anime power scaling, meme-worthy results
- JavaScript throughout: vanilla JS or framework TBD, Node.js backend
- Content depth matters: many races (30+), meaningful power tiers, lore-rich options that make every character feel unique
- Redemption Spin is a signature mechanic — probability-gated, chaotic outcomes, can help or hurt

## Constraints

- **Tech stack**: JavaScript (browser frontend + Node.js backend)
- **No login required**: characters identified by generated ID / shareable link
- **Content volume**: needs substantial content to avoid repetition — research phase critical

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Backend + database for persistence | Characters must be shareable across devices and sessions | — Pending |
| Full visual spinning wheel (not slot machine) | Dramatic reveal is core to the game experience | — Pending |
| Variable ability spin counts per race/archetype | Some races should feel more powerful/complex by having more abilities | — Pending |
| Tier + numeric scoring | Letter tiers are recognizable, numeric score enables probability calculations for Redemption Spin | — Pending |
| Redemption Spin is probability-weighted | Bad characters deserve a shot at redemption; good characters earned their stats | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-15 after initialization*
