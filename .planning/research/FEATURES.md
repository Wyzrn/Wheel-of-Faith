# Feature Landscape: Wheel of Fate

**Domain:** Browser-based random character creation game with animated wheel mechanics
**Researched:** 2026-05-15
**Confidence:** HIGH for structural/design patterns (training data covers D&D, anime scaling, RPG generators well); MEDIUM for specific content volume targets (based on genre conventions, not user data)

---

## Research Basis

WebSearch was unavailable. Findings drawn from:
- D&D 5e/5.5e racial design (Player's Handbook, Tasha's Cauldron, Monsters of the Multiverse) — HIGH confidence
- Anime power-scaling conventions: Dragon Ball (Power Level/Ki), Naruto (Chakra Nature tiers), Bleach (Shinigami/Quincy/Arrancar tiers), One Piece (Haki/Devil Fruit tiers), My Hero Academia (Quirk rarity tiers) — HIGH confidence
- Random character generators (Hero Forge concept, Fantasy Name Generators, Roll20 random stat systems) — MEDIUM confidence
- Wheel-of-Fortune / gacha game reveal mechanics (Genshin Impact, FGO rarity reveal drama) — HIGH confidence
- "Wheel of Faith" Instagram format: sequential spin reveal, dramatic landing, shared result card — HIGH confidence from description in PROJECT.md

---

## Table Stakes

Features users expect. Missing = product feels incomplete or breaks the core loop.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Animated spinning wheel with deceleration | This IS the product — no wheel = no game | High | Must feel satisfying; ease-out deceleration is non-negotiable |
| All 23 spin categories in correct order | The sequence is the game structure | Medium | Order encodes narrative logic (race before abilities, weapon before mastery) |
| Variable ability spin counts per race/archetype | Differentiation between rare/common races; core to power fantasy | Medium | Store ability count on each race/archetype object |
| Letter tier display (F → God) on every stat wheel | Anime-literate audience expects this language; universal shorthand | Low | 9 tiers: F, D, C, B, A, S, SS, SSS, God |
| Numeric score per tier | Enables Redemption Spin probability weighting; makes stats feel precise | Low | Map: F=1-10, D=11-20, C=21-35, B=36-50, A=51-65, S=66-80, SS=81-90, SSS=91-99, God=100 |
| Redemption Spin probability gate | Signature mechanic per PROJECT.md; weak characters need hope | High | Weighted by inverse of total power score |
| Redemption Spin outcome wheel | Second wheel after gate passes; chaotic results; the emotional climax | High | See full outcome table below |
| Character card / sheet after all 23 spins | The payoff — shareable artifact of the whole session | Medium | Styled, readable, feels like a trading card or sheet |
| Shareable URL per character | Core virality mechanic; how it spreads | Medium | UUID or hash in URL, character stored in DB |
| Character gallery | Social proof; browsing inspiration; "what could I get?" | Medium | Browse recent/notable characters |
| Minimum 30 races | Content depth prevents repetition; audience expects it | Low (content work) | See race pool below |
| Meaningful power pool (50+ powers) | Thin power list = boring repeats = killed replayability | Low (content work) | See powers pool below |
| Backstory options (15+) | Grounds the character in lore; audiences love origin stories | Low (content work) | See backstory pool below |
| Weakness options (15+) | Balances power fantasy; creates narrative drama | Low (content work) | See weakness pool below |
| Titles (50+) | The final reveal — must feel earned and surprising | Low (content work) | See titles pool below |

---

## Differentiators

Features that set this apart from generic character generators.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Redemption Spin with named chaotic outcomes | No other character generator has a second-chance mechanic with dramatic named results | High | "Inversion", "God's Gift", "Cursed" etc. — must feel like gacha UR reveals |
| Variable racial ability counts (1–4) | Rare races feel genuinely rarer; more abilities = visible power gap | Medium | Races with 3+ abilities should appear infrequently on the wheel (weighted) |
| Dual-score system (letter + number) | Letter tier appeals emotionally; numeric enables mechanical probability math | Low | Both displayed simultaneously |
| Original multiverse setting | Not D&D, not generic fantasy — a setting that can hold Saiyans alongside angels | Low (design) | Frees content from IP constraints |
| Sequential dramatic reveal (not all-at-once) | Each spin builds on the last; you don't know your character until the final Title | High (UX) | The tension architecture is the differentiator |
| Power Mastery as separate wheel | Most generators give power and mastery together; separating adds narrative arc | Low | "You have telekinesis but your mastery is F-tier" is the joke/drama |
| Weapon Enchantment as separate wheel | Same logic — weapon and enchantment can contradict interestingly | Low | "Staff of the Ancients... enchanted with... nothing" |
| Potential as a separate stat | Implies the character can grow beyond their current state — narrative hook | Low | Opens door for future "level up" feature |
| Energy Level as separate stat | Stamina/endurance framing; adds tactical nuance to otherwise raw stats | Low | Distinct from Strength/Durability |
| Weighted Redemption gate (not random) | Mechanically fair — bad characters statistically more likely to get the chance | Medium | Feels just, not arbitrary |
| "Title" as final reveal | The title recontextualizes everything that came before; dramatically satisfying | Low (content) | "The Unbreakable" after getting God-tier Durability = cathartic |
| Inversion outcome (all stats flip) | The most dramatic single outcome — a God-tier character can become F-tier | Low | Pure chaos engine; meme content |

---

## Anti-Features

Features to explicitly NOT build in MVP.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Combat system / gameplay | Scope creep; out of scope per PROJECT.md | Character creation IS the game; flag for future milestone |
| Login / accounts | Friction; out of scope; kills casual viral sharing | Characters identified by UUID link only |
| Manual character customization | Defeats the "fate" concept; kills tension | Pure randomness; no re-rolls except Redemption Spin |
| Multiplayer / PvP stat comparison | Complex; out of scope; shifts focus from creation to competition | Gallery browsing is the social layer |
| Lore text walls per result | Kills pacing; interrupts the spin sequence | Brief flavor text only (1 sentence max per result) |
| Mobile native app | Scope and budget; responsive web is sufficient | CSS responsive layout covers this |
| Granular rarity percentages exposed to user | Breaks magic; gacha games hide the math | Show results, not probabilities |
| "Re-spin" buttons except Redemption | If users can re-spin freely, tension collapses | Only Redemption Spin is a second chance |
| User-submitted content | Moderation complexity; not needed at MVP scale | Curated pool only |
| Pay-to-unlock content | Monetization adds friction; this is a viral shareable toy | Free content, gate nothing |

---

## Content Pools (Full Design)

### Races Pool (30+ required)

Organized by origin category. Each race entry includes: Name, Origin Type, Ability Count, and flavor hook.

#### Fantasy Origin (8)
| Race | Ability Count | Flavor Hook |
|------|--------------|-------------|
| Elven Blood | 2 | Ageless precision; magic affinity |
| Dwarven Iron | 1 | Stone-hard endurance; craft instinct |
| Orc Warchief Lineage | 2 | Berserker surge; battle sense |
| Goblin Cunning | 1 | Chaos math; trap instinct |
| Faeborn | 3 | Reality flicker; glamour; fae debt |
| Dragonkin | 2 | Breath weapon; scale armor |
| Undead Revenant | 2 | Death resistance; soul hunger |
| Halfblood Witch | 2 | Hex touch; familiar bond |

#### Mythological Origin (7)
| Race | Ability Count | Flavor Hook |
|------|--------------|-------------|
| Olympian Demigod | 3 | Divine domain; ichor blood; godly favor |
| Valkyrie Scion | 2 | Soul sight; death claim |
| Oni Descendant | 2 | Fear aura; iron-eater |
| Djinn Heritage | 3 | Wish distortion; smoke form; bound vow |
| Naga Bloodline | 2 | Venom; constriction instinct |
| Kitsune | 3 | Fox fire; illusion veil; tail count (power scales with tails) |
| Anubis Ward | 2 | Feather judgment; death escort |

#### Sci-Fi / Technological Origin (6)
| Race | Ability Count | Flavor Hook |
|------|--------------|-------------|
| Android (Combat Model) | 2 | System override; adaptive armor |
| Cyborg Experiment | 1 | Augment suite; pain suppression |
| Void Parasite Host | 2 | Consumption aura; void step |
| Synthetic Deity | 4 | Creator's code; reality patch; divine firewall; ghost signal |
| Xenomorph Hybrid | 2 | Acid blood; hive signal |
| Neural Uploaded Consciousness | 1 | Digital ghost; ping lag |

#### Anime / Power-Scaling Inspired (7)
| Race | Ability Count | Flavor Hook |
|------|--------------|-------------|
| Saiyan-Class Warrior | 3 | Zenkai surge; great ape transformation; battle rage |
| Soul Reaper (Shinigami) | 2 | Zanpakuto bond; spirit pressure |
| Tailed Beast Jinchuriki | 3 | Bijuu cloak; chakra reserves; tailed surge |
| Devil Fruit Awakened | 2 | Fruit power; awakening burst |
| Esper Rank X | 2 | Psi burst; psychic block |
| Mana Overflow Born | 2 | Mana skin; overflow burst |
| Cursed Vessel | 2 | Cursed energy release; binding vow |

#### Celestial / Infernal / Cosmic Origin (7)
| Race | Ability Count | Flavor Hook |
|------|--------------|-------------|
| Seraph (Fallen) | 3 | Holy blade; wing manifestation; grace decay |
| Demon Lord Shard | 3 | Domain terror; infernal contract; hellfire pulse |
| Cosmic Horror Fragment | 4 | Sanity drain; void gaze; tentacle eruption; incomprehensible form |
| Celestial Guardian | 2 | Starlight aegis; constellation anchor |
| Void Walker | 2 | Dimension slip; darkness immunity |
| Chaos Entity | 4 | Reality warble; probability shift; entropic touch; madness field |
| God Spark Carrier | 3 | Divine ember; mortality burn; ascension threshold |

**Total: 35 races** (exceeds 30+ requirement)

**Rarity Weighting Recommendation:**
- Common (35% wheel weight): Elven Blood, Dwarven Iron, Orc Warchief Lineage, Goblin Cunning, Cyborg Experiment, Android (Combat Model), Halfblood Witch, Undead Revenant, Saiyan-Class Warrior, Soul Reaper
- Uncommon (45% wheel weight): Dragonkin, Valkyrie Scion, Oni Descendant, Naga Bloodline, Devil Fruit Awakened, Esper Rank X, Mana Overflow Born, Cursed Vessel, Xenomorph Hybrid, Faeborn, Olympian Demigod, Anubis Ward, Celestial Guardian, Void Walker, Neural Uploaded Consciousness
- Rare (18% wheel weight): Djinn Heritage, Kitsune, Tailed Beast Jinchuriki, Djinn Heritage, Void Parasite Host, God Spark Carrier, Demon Lord Shard, Seraph (Fallen), Cosmic Horror Fragment, Chaos Entity
- Legendary (2% wheel weight): Synthetic Deity (4 abilities)

---

### Archetypes Pool (12+)

Each archetype determines ability count and thematic flavor.

| Archetype | Ability Count | Core Identity |
|-----------|--------------|---------------|
| Warrior | 2 | Tactical combatant; weapon mastery; battlefield control |
| Mage | 3 | Spell versatility; mana dependent; fragile but ranged |
| Assassin | 2 | Stealth; single-target lethality; escape tools |
| Paladin | 2 | Divine hybrid; healing + melee; oath-bound |
| Berserker | 1 | Pure offense; no defense logic; rage scaling |
| Ranger | 2 | Distance; tracking; terrain advantage |
| Trickster | 3 | Illusion; deception; unpredictable kit |
| Necromancer | 3 | Death magic; undead control; life drain |
| Monk | 2 | Ki/chi flow; unarmed; internal power |
| Warlord | 2 | Command aura; group synergy; leadership buff |
| Void Knight | 3 | Dark combat; dimension slash; nihilism stance |
| Godslayer | 4 | Anti-divine; power nullification; divine wound; legend smite |
| Phantom | 2 | Ghost step; possession threat; untouchable phase |
| Elementalist | 3 | Tri-element control; elemental form; natural fusion |
| Beast Tamer | 2 | Creature bond; feral transformation |

**Total: 15 archetypes**

---

### Archetype Abilities Pool (examples per archetype)

Rather than a full spin pool (phase-level detail), each archetype references a named ability pool. Examples:

**Warrior:** Shield Crash, Counter Stance, Blade Tempest, War Cry, Armor Crush
**Mage:** Arcane Missile, Spell Echo, Mana Burst, Ley Line Tap, Void Bolt, Chrono Stutter
**Assassin:** Shadow Step, Vital Strike, Poison Coat, Ghost Exit, Mirror Clone
**Berserker:** Rage Threshold, Blood Frenzy, Null Pain, Demolisher Swing
**Void Knight:** Null Slash, Dimension Rip, Dark Shroud, Existential Threat, Void Armor
**Godslayer:** Divine Severance, Immortal Wound, God Eater Strike, Null Divinity

Each ability pool should have 8–12 entries per archetype minimum to prevent repetition.

---

### Stat Tier System

Used for: Strength, Speed, Agility, Durability, IQ, Charisma, Fighting Skill, Power Mastery, Weapon Mastery, Potential, Energy Level

| Letter Tier | Numeric Range | Real-World Analogy |
|-------------|--------------|-------------------|
| F | 1–10 | Baseline human; untrained |
| D | 11–25 | Trained civilian; above average |
| C | 26–40 | Soldier; professional athlete |
| B | 41–55 | Elite human; peak condition |
| A | 56–70 | Superhuman; low-tier powered |
| S | 71–82 | High-tier powered; regional threat |
| SS | 83–91 | Continental threat; legendary |
| SSS | 92–98 | Planetary threat; mythic |
| God | 99–100 | Omnipotent in domain; immeasurable |

**Anime calibration references (MEDIUM confidence — genre conventions):**
- Goku (base) ≈ A tier by this scale; Ultra Instinct ≈ God tier
- Naruto (Six Paths Sage Mode) ≈ SSS tier
- Ichigo (True Bankai) ≈ SS–SSS tier
- Saitama ≈ God tier by definition
- Average shinobi ≈ C–B tier; chunin ≈ B; jonin ≈ A

This calibration is for internal design consistency, not displayed to users.

---

### Powers Pool (50+ required)

Organized by category. Each power has a name and 1-sentence flavor description.

#### Elemental (10)
1. **Pyrokinesis** — Command and generate flame; heat immunity
2. **Cryokinesis** — Freeze matter; cold absolute zero field
3. **Electrokinesis** — Lightning generation; EM pulse
4. **Aerokinesis** — Wind manipulation; flight at high mastery
5. **Geokinesis** — Earth control; seismic pulse
6. **Hydrokinesis** — Water command; pressure jets
7. **Photokinesis** — Light bending; laser concentration
8. **Umbrakinesis** — Shadow matter; darkness constructs
9. **Plasmakinesis** — Superheated matter state; stellar energy
10. **Magmakinesis** — Volcanic matter control; lava shaping

#### Physical Enhancement (8)
11. **Superhuman Strength** — Physical force multiplied beyond natural limits
12. **Supersonic Speed** — Movement at sound-breaking velocities
13. **Infinite Stamina** — Fatigue-immune; regeneration passive
14. **Density Shift** — Become immovable or phased at will
15. **Berserker Physiology** — Damage taken converts to power output
16. **Pressure Immunity** — Survive any gravitational or crush force
17. **Adaptive Regeneration** — Wounds heal faster with each damage instance
18. **Kinetic Absorption** — Impact force converted to personal energy

#### Mental / Psionic (8)
19. **Telepathy** — Read and project thoughts; psychic network
20. **Telekinesis** — Move objects with mind; force constructs
21. **Precognition** — See seconds to minutes into the future
22. **Memory Erasure** — Wipe targeted memories; reconstruct false ones
23. **Fear Induction** — Project primal terror directly into the mind
24. **Psychic Barrier** — Mental shield blocking psionic intrusion
25. **Mind Fracture** — Shatter concentration and sanity with a touch
26. **Emotion Override** — Force-inject emotional states into targets

#### Spatial / Dimensional (7)
27. **Teleportation** — Instant self-relocation within line of sight or mapped space
28. **Portal Generation** — Open stable doorways between locations
29. **Dimension Pocket** — Personal extradimensional storage / safe room
30. **Phase Walk** — Pass through solid matter temporarily
31. **Gravity Control** — Alter local gravitational constants
32. **Time Dilation** — Slow perceived time in local field
33. **Void Step** — Move through null-space; untraceable travel

#### Conceptual / Reality-Warping (9)
34. **Causality Manipulation** — Alter cause-and-effect chains retroactively
35. **Probability Warping** — Force favorable (or unfavorable) outcomes
36. **Existence Erasure** — Remove target from all timelines simultaneously
37. **Power Nullification** — Disable other abilities in proximity
38. **Absolute Barrier** — Defense that cannot be breached by any known force
39. **Soul Manipulation** — Extract, modify, or destroy the soul
40. **Law Rewriting** — Temporarily alter a physical or metaphysical law
41. **Conceptual Strike** — Attack the concept a being embodies (e.g., strike "speed" itself)
42. **Narrative Control** — Subtly bend story causality in one's own favor

#### Energy / Aura Based (7)
43. **Ki Mastery** — Concentrated life energy; external projection
44. **Aura Infusion** — Coat body or objects in personal energy field
45. **Energy Drain** — Siphon life force, power, or stamina from others
46. **Mana Surge** — Explosive magical energy discharge
47. **Cursed Energy Flow** — Negative emotion converted to destructive output
48. **Holy Radiance** — Divine energy emission; purification effect
49. **Chaos Pulse** — Random energy type discharged at unpredictable intervals

#### Unique / Rare (6)
50. **Immortality** — Cannot die by conventional means; regenerates from destruction
51. **Omni-Mimicry** — Copy any ability observed once
52. **Paradox Body** — Immune to logic; contradictory states coexist in body
53. **World Eater Appetite** — Consumes matter, energy, or concepts for power
54. **Death Embodiment** — Acts as avatar of death; lethal aura; death exemption
55. **Origin Sight** — See the fundamental nature and weakness of any target

**Total: 55 powers** (exceeds 50+ requirement)

---

### Weapons Pool (20+)

| Weapon | Type | Flavor |
|--------|------|--------|
| Obsidian Greatsword | Melee / Blade | Ancient stone; absorbs death energy |
| Chain Scythes | Melee / Reach | Dual-chained; momentum-scaling damage |
| Void Gauntlets | Melee / Strike | Fists that delete matter on impact |
| Bone Lance | Melee / Pierce | Grown from own skeleton; regenerates |
| Soul Whip | Melee / Reach | Strikes the soul, not the body |
| Twin Fang Daggers | Melee / Blade | Poison-grooved; rapid combo tool |
| Celestial Spear | Melee / Pierce | Forged from a dying star; holy affinity |
| Demon Cleaver | Melee / Blade | Eats infernal energy; grows stronger vs. demons |
| Iron War Club | Melee / Blunt | Crude; devastatingly effective; unenchantable (except it can be) |
| Crystal Knuckles | Melee / Strike | Resonant frequency; shatters armor |
| Phantom Bow | Ranged | Arrows materialize from intent; silent |
| Gravity Cannon | Ranged | Fires compressed gravity slugs |
| Soul Rifle | Ranged | Shoots soul fragments; bypasses physical defense |
| Hex Crossbow | Ranged | Bolts carry curse payload on impact |
| Nova Launcher | Ranged | Mini-star projectile; area denial |
| Rune Staff | Magic Focus | Channels and amplifies spell output |
| Grimoire of Depths | Magic Focus | Living book; generates its own spells |
| Forbidden Tome | Magic Focus | Unstable; powerful; damages user too |
| Echo Blade | Exotic | Copies the last strike of any weapon it has killed |
| Null Sword | Exotic | No elemental affinity; nullifies enchantments on contact |
| Cosmic Thread | Exotic | Monofilament line of spacetime; cuts anything |
| The Nameless Weapon | Exotic / Legendary | Appears as what the wielder fears most; unknown damage type |

**Total: 22 weapons**

---

### Weapon Enchantments Pool (15+)

| Enchantment | Effect Flavor |
|-------------|---------------|
| Soul Drinker | Kills restore the wielder's energy |
| Void Touched | Bypasses dimensional and phase-based defenses |
| Eternal Edge | Weapon never dulls; cuts through any physical material |
| Bloodthirst | Damage increases with each consecutive hit |
| Holy Consecrated | +damage vs. infernal/undead; burns on touch for evil-aligned |
| Cursed | Weapon is bound to wielder; cannot be disarmed; also cannot be dropped |
| Echo Strike | Each attack reverberates 1 second later for partial repeat damage |
| Storm Wreathed | Electricity arcs on every hit; lightning chain to nearby foes |
| Null Field | Suppresses powers of target on contact (temporary) |
| Doom Inscription | Target struck is marked; next hit is always a critical |
| World Ender Sigil | Damage scales with target's maximum HP rather than a fixed value |
| Ghost Forged | Weapon exists partially in spirit realm; hits phased or invisible targets |
| Berserker's Pact | Wielder gains strength from wounds received; weapon grows unstable |
| Celestial Rune | Generates a shield charge on every kill |
| Unenchanted | No enchantment — the wheel's cruelest joke / rare flex |

**Total: 15 enchantments**

---

### Backstories Pool (15+)

| Backstory | Core Tension |
|-----------|--------------|
| Orphan of War | Lost everything; nothing left to lose; underdog energy |
| Displaced Royalty | Born to rule; cast down; reclaiming a throne nobody believes in |
| Lab Experiment | Created, not born; identity crisis; power without consent |
| Chosen One (Reluctant) | Prophecy chose you; you didn't volunteer; burden of destiny |
| Chosen One (Willing) | You believe the prophecy; zealot energy; dangerously committed |
| Forsaken God | Was divine; lost power; remembers everything |
| Survivor of Extinction | Last of your kind; grief as fuel; nothing to go back to |
| Accidental Awakening | Power triggered by trauma; no training; raw and dangerous |
| Ancient Reincarnation | Soul that has lived before; flashes of past memory; incomplete recall |
| Mercenary Without Memory | Woke up mid-contract; skills intact; identity gone |
| Cursed Bloodline | Power runs in the family — so does the price |
| Escaped Slave | Chains broken; rage refined into purpose; freedom at any cost |
| Fallen Soldier | Died in battle; revived; not sure why; sense of unfinished war |
| World Traveler | Crossed dimensions before landing here; perspective no one else has |
| Scholar of Forbidden Arts | Studied what was banned; knows too much; hunted for it |
| Child of Prophecy Unfulfilled | The prophecy failed; you are the aftermath |
| Demon's Bargain | Power gained via infernal contract; terms unclear; clock ticking |

**Total: 17 backstories**

---

### Weaknesses Pool (15+)

| Weakness | Narrative Hook |
|----------|---------------|
| Sunlight | Power diminishes or burns in direct sunlight |
| Running Water | Cannot cross; disrupts power flow |
| Silver | Silver contact causes disproportionate damage |
| Iron (Cold) | Cold iron breaks enchantments and hurts the fae-touched |
| Salt Circle | Immobilized within a salt barrier |
| Holy Ground | Cannot enter consecrated spaces |
| Own Blood | Taking damage that draws blood weakens further |
| Emotional Anchor | Power tied to emotional state; grief/rage causes loss of control |
| Sonic Frequency | A specific frequency disrupts physiology |
| Darkness Dependency | Weakens in light; power is shadow-sourced |
| True Name | Speaking the true name compels obedience |
| Mirror Reflection | Cannot see own reflection; shown one causes paralysis |
| Selflessness Paradox | Power fails when used for others; only works selfishly |
| Time Limit | Full power for X duration only; crash state after |
| Psychological Trigger | Specific memory or phrase can shut power down |
| The Void Hunger | Must consume energy regularly or begins self-consuming |
| Mortal Tether | Has one fully human weak point (e.g., a single non-powered organ) |
| Power of Friendship (Inverted) | Genuinely weakened when allies are present; only stronger alone |

**Total: 18 weaknesses**

---

### Titles Pool (50+)

Titles are the final reveal. They should recontextualize the whole character. Mix gravitas with irony.

#### Gravitas Titles (feel earned / legendary)
1. The Unbreakable
2. Devourer of Worlds
3. The Last Arbiter
4. Wrath Incarnate
5. Sovereign of the Void
6. The Undying Flame
7. Apex Predator
8. Harbinger of the End
9. The God Killer
10. Champion of Nothing
11. The Eternal Blade
12. Destroyer of Thrones
13. The Boundless
14. The One Who Remains
15. Storm Bringer
16. The Absolute
17. Throne of Ash
18. The Inevitable
19. Seraph's Bane
20. The Unchained

#### Ironic / Chaos Titles (funny vs powerful character gap)
21. The Mostly Harmless
22. Professional Bystander
23. Accidentally Catastrophic
24. The One Who Tried
25. Functional Disaster
26. Surprisingly Alive
27. The Underestimated
28. Chaos with a Name
29. This Shouldn't Work
30. The Reluctant Apocalypse

#### Ominous / Mysterious Titles
31. The One the Gods Fear
32. He Who Must Not Rank
33. The Error in the System
34. Void's Favorite
35. The Unnamed Threat
36. That Which Precedes Silence
37. The Answer to a Question Nobody Asked
38. Origin Unknown
39. The Pattern Breaker
40. Footnote in the Apocalypse

#### Lore / Setting Specific
41. Firstborn of the Multiverse
42. The Scar Between Worlds
43. Exiled Deity
44. The Multiverse's Mistake
45. Last Echo of the Old War
46. Heir to Nothing
47. The Forgotten Promise
48. Fault Line
49. The Convergence Point
50. Architect of Collapse
51. The Weight of All Things
52. Born at the End

**Total: 52 titles**

---

## Redemption Spin — Full Design (18 Outcomes)

The Redemption Spin is a two-stage mechanic:
1. **Gate Wheel** — weighted by inverse of total power score; low-power characters spin with higher probability of earning the outcome wheel
2. **Outcome Wheel** — if gate is passed, this second wheel determines the effect

All outcomes are named, dramatic, and final. No re-rolls after Redemption Spin.

| # | Outcome Name | Effect | Tone |
|---|-------------|--------|------|
| 1 | **Inversion** | Every stat tier flips: God → F, F → God, SSS → D, etc. Letter tiers mirror across the F-God axis | Catastrophic chaos — the ultimate cruelty or blessing |
| 2 | **God's Gift** | Your single lowest stat is elevated to God tier. Everything else unchanged. | Pure redemption — the bad character gets one miracle |
| 3 | **Cursed** | Your single highest stat is reduced to F tier. Everything else unchanged. | Cruel punishment — the strong character gets humbled |
| 4 | **The Equalizer** | All stats set to B tier. Number score randomized within 41–55. | Fair — nobody wins big, nobody loses bad |
| 5 | **Double Down** | Highest stat doubles its numeric score (capped at 100). Lowest stat halves its numeric score (floored at 1). | Rich get richer, poor get poorer |
| 6 | **Ascension** | All stats increase by one letter tier (F→D, D→C, ... SSS→God). | Pure positive — the underdog's fantasy |
| 7 | **The Fall** | All stats decrease by one letter tier (God→SSS, ... D→F, F stays F). | Pure negative — hubris punished |
| 8 | **Wild Card** | All stats re-rolled simultaneously. Character is completely regenerated from this point. | The nuclear option — start again from scratch |
| 9 | **Mirror World** | Race and Archetype abilities swap their ability counts with each other. Backstory changes to its thematic opposite. | Weird and narrative; doesn't change stats but changes identity |
| 10 | **The Bargain** | Choose one: sacrifice your Title (blank) and gain SSS in one stat of choice, OR keep your Title and gain nothing. | Player agency — the only choice in the game |
| 11 | **Phantom Tier** | A hidden bonus stat (Luck) is added to your character sheet at a random tier. No mechanical effect described, just exists. | Mystery / flavor; audiences will debate what it means |
| 12 | **Curse of Potential** | Potential stat set to God tier. All other stats set to F tier. | You are the ultimate latent talent who can't do anything yet |
| 13 | **Overclock** | Energy Level set to God tier. Power Mastery and Weapon Mastery each increase by two letter tiers. | Execution-mode character — skills maximized, raw stats unchanged |
| 14 | **The Drain** | A random Weakness is added (second weakness if one already exists, third if two). | Purely negative addition — more vulnerability |
| 15 | **Soul Swap** | Race changes to a random different race. All racial abilities reset and re-spun. | Identity crisis — you become someone else mid-journey |
| 16 | **Echo of Glory** | A second Title is added — spun fresh. Character now has two Titles. | The double-title character is a flex outcome |
| 17 | **The Reckoning** | All stats below B tier are set to B tier. All stats above B tier are untouched. | Floor raise — good for weak characters, irrelevant for strong ones |
| 18 | **Void Claimed** | Character gains "Void Marked" status. One random stat becomes "???" — unknown and unknowable. Displayed as ??? on character card. | Narrative mystery; intentional ambiguity |

**Gate Weighting Logic:**
- Total power score = sum of numeric scores across all tiered stats (max possible: ~1100 across 11 stat wheels)
- Redemption chance = 1 - (total_score / max_possible_score), minimum 5%, maximum 85%
- A character with all F stats has ~85% chance to reach Outcome Wheel
- A character with all God stats has ~5% chance (the humility gate — even legends get a spin)

**Outcome Wheel Weighting (suggested):**
- Equal weight on all 18 outcomes (each ~5.5%) is simplest and most chaotic
- Alternative: weight positive outcomes (God's Gift, Ascension, Overclock) higher for lower-power characters, negative outcomes (Cursed, The Fall, The Drain) higher for already-strong characters who slipped through the gate

---

## Feature Dependencies

```
Race → Racial Ability Count → Racial Ability Spin(s)
Archetype → Archetype Ability Count → Archetype Ability Spin(s)
All Stat Spins → Numeric Scores → Total Power Score
Total Power Score → Redemption Gate Probability → Redemption Spin
Redemption Spin Outcome → Possible stat mutations before final display
All 23 results → Character Card generation → Shareable URL → Gallery entry
```

---

## MVP Recommendation

**Prioritize (core loop, ship first):**
1. The spinning wheel mechanic with deceleration animation (the UI heart of the product)
2. Race pool (35 entries) with variable ability counts wired up
3. All stat wheels with tier + numeric score
4. Redemption Spin — both stages — this is the signature mechanic
5. Character card generation
6. Shareable URL (UUID-based, no login)

**Defer to Phase 2:**
- Full weapons enchantment interactions (display only at MVP)
- Character gallery browse/filter (basic gallery at MVP, rich filtering later)
- Archetype ability pool fully fleshed (stub with placeholder abilities, flesh out content later)
- "The Bargain" Redemption outcome (requires player choice UI — only interactive moment)

---

## Sources

- D&D 5e Player's Handbook racial trait design: 1–5 racial traits per race, tiered by complexity — HIGH confidence (training data; well-documented)
- Tasha's Cauldron of Everything: floating ASI system, variable racial feature count — HIGH confidence
- Dragon Ball power level system: numeric + transformation tier stacking — HIGH confidence
- Naruto rank system (Genin/Chunin/Jonin/Kage) as tier calibration — HIGH confidence
- Bleach spiritual pressure tier conventions — HIGH confidence
- My Hero Academia quirk rarity tiers (F→S used colloquially in community) — MEDIUM confidence (community usage, not official)
- Genshin Impact / gacha game rarity reveal drama patterns — HIGH confidence
- PROJECT.md requirements for Redemption Spin mechanic — HIGH confidence (authoritative)
- Genre conventions for character generators (Hero Forge, D&D Beyond character builder UX) — MEDIUM confidence
