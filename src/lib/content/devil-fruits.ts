// Demon Fruit name pools keyed by the exact classPool label of the
// Demon Fruit Eater race / archetype. Spliced as a 'devilFruitName' spin
// after 'raceClass' resolves.
//
// Rewritten from the ground up — original generic fantasy naming with no
// franchise IP. Categories renamed from Paramecia/Zoan/Logia (heavily
// associated with a specific anime IP) to plain English descriptors.
// Fruit names use evocative prefixes (Pyralis, Resilira, Umbralis, etc.)
// + a descriptive suffix so the in-game label still tells the player
// what they got.
//
// No default export. Single named export. The legacy DEVIL_FRUIT_POOLS
// name is preserved so existing call sites in +page.svelte + spinQueue.ts
// keep working without a refactor (this is the dictionary; the renamed
// surface is the labels themselves).

export const DEVIL_FRUIT_POOLS: Record<string, { label: string; weight: number }[]> = {
  // ── Form Fruit — body / environment manipulation (was Paramecia) ────────
  'Form Fruit (Body / Environment)': [
    { label: 'Resilira Fruit — Rubber Body',                weight: 4 },
    { label: 'Threadbinder Fruit — Thousand Strings',       weight: 3 },
    { label: 'Bloomling Fruit — Thousand Limbs',            weight: 3 },
    { label: 'Charmlight Fruit — Love Beam',                weight: 3 },
    { label: 'Wardstone Fruit — Barrier Wall',              weight: 3 },
    { label: 'Glasskin Fruit — Frictionless Skin',          weight: 3 },
    { label: 'Mimicra Fruit — Face Clone',                  weight: 2 },
    { label: 'Edgebody Fruit — Blade Body',                 weight: 2 },
    { label: 'Bramble Fruit — Spike Body',                  weight: 2 },
    { label: 'Snare Fruit — Binding Cage',                  weight: 2 },
    { label: 'Sluggard Fruit — Slow Beam',                  weight: 2 },
    { label: 'Threshold Fruit — Door Anywhere',             weight: 2 },
    { label: 'Maw Fruit — Eat Anything',                    weight: 2 },
    { label: 'Tallowshape Fruit — Wax Construct',           weight: 2 },
    { label: 'Surgeon Fruit — Operating Room',              weight: 1 },
    { label: 'Tremor Fruit — Earthquake Fist',              weight: 1 },
    { label: 'Toymaker Fruit — Toy Curse',                  weight: 1 },
    { label: 'Mindscribe Fruit — Memory Edit',              weight: 2 },
    { label: 'Forge Fruit — Heat Aura',                     weight: 2 },
    { label: 'Withering Fruit — Drain Touch',               weight: 2 },
    { label: 'Anthem Fruit — Cheer Amp',                    weight: 2 },
    { label: 'Phasebody Fruit — Pass-Through Body',         weight: 2 },
  ],

  // ── Beast Fruit — animal transformation (was Zoan) ──────────────────────
  'Beast Fruit (Animal Form)': [
    { label: 'Beast Fruit — Wolf Form',                     weight: 4 },
    { label: 'Beast Fruit — Leopard Form',                  weight: 4 },
    { label: 'Beast Fruit — Falcon Form',                   weight: 4 },
    { label: 'Beast Fruit — Stallion Form',                 weight: 3 },
    { label: 'Beast Fruit — Tortoise Form',                 weight: 3 },
    { label: 'Beast Fruit — King Cobra Form',               weight: 3 },
    { label: 'Beast Fruit — Tarantula Form',                weight: 3 },
    { label: 'Beast Fruit — Rhinoceros Beetle Form',        weight: 2 },
    { label: 'Beast Fruit — Mole Form',                     weight: 2 },
    { label: 'Beast Fruit — Elephant Form',                 weight: 2 },
    { label: 'Beast Fruit — Giraffe Form',                  weight: 2 },
    { label: 'Beast Fruit — Locust Form',                   weight: 2 },
    { label: 'Beast Fruit — Axolotl Form',                  weight: 2 },
    { label: 'Beast Fruit — Albatross Form',                weight: 2 },
    { label: 'Beast Fruit — Vampire Bat Form',              weight: 1 },
  ],

  // ── Ancient Beast Fruit — prehistoric beasts ───────────────────────────
  'Ancient Beast Fruit': [
    { label: 'Ancient Beast Fruit — Pteranodon Form',       weight: 4 },
    { label: 'Ancient Beast Fruit — Brachiosaurus Form',    weight: 4 },
    { label: 'Ancient Beast Fruit — Allosaurus Form',       weight: 3 },
    { label: 'Ancient Beast Fruit — Spinosaurus Form',      weight: 3 },
    { label: 'Ancient Beast Fruit — Pachycephalosaurus Form', weight: 3 },
    { label: 'Ancient Beast Fruit — Triceratops Form',      weight: 3 },
    { label: 'Ancient Beast Fruit — Mammoth Form',          weight: 2 },
    { label: 'Ancient Beast Fruit — Saber-Tooth Tiger Form', weight: 2 },
    { label: 'Ancient Beast Fruit — Giant Spider Form',     weight: 1 },
  ],

  // ── Mythic Beast Fruit — legendary creatures (was Mythical Zoan) ───────
  'Mythic Beast Fruit': [
    { label: 'Mythic Beast Fruit — Phoenix Form',           weight: 4 },
    { label: 'Mythic Beast Fruit — Azure Dragon Form',      weight: 3 },
    { label: 'Mythic Beast Fruit — Nine-Tailed Fox Form',   weight: 3 },
    { label: 'Mythic Beast Fruit — Pegasus Form',           weight: 3 },
    { label: 'Mythic Beast Fruit — Great Bodhisattva Form', weight: 2 },
    { label: 'Mythic Beast Fruit — Eight-Headed Serpent Form', weight: 2 },
    { label: 'Mythic Beast Fruit — Cerberus Form',          weight: 2 },
    { label: 'Mythic Beast Fruit — Liberation Form',        weight: 1 },
  ],

  // ── Element Fruit — elemental embodiment (was Logia) ───────────────────
  'Element Fruit (Elemental Form)': [
    { label: 'Pyralis Fruit — Living Fire',                 weight: 4 },
    { label: 'Cryothis Fruit — Living Ice',                 weight: 4 },
    { label: 'Voltaris Fruit — Living Lightning',           weight: 3 },
    { label: 'Sandwraith Fruit — Living Sand',              weight: 3 },
    { label: 'Mistveil Fruit — Living Smoke',               weight: 3 },
    { label: 'Snowdrift Fruit — Living Snow',               weight: 3 },
    { label: 'Toxisma Fruit — Living Poison Gas',           weight: 2 },
    { label: 'Mireheart Fruit — Living Swamp',              weight: 2 },
    { label: 'Magmara Fruit — Living Magma',                weight: 2 },
    { label: 'Lumenara Fruit — Living Light',               weight: 2 },
    { label: 'Umbralis Fruit — Living Darkness',            weight: 1 },
    { label: 'Tempestus Fruit — Living Rain',               weight: 2 },
    { label: 'Aeolis Fruit — Living Wind',                  weight: 2 },
    { label: 'Geomara Fruit — Living Earth',                weight: 2 },
  ],

  // ── Awakened Demon Fruit — peak-tier upgrades ──────────────────────────
  'Awakened Demon Fruit': [
    { label: 'Resilira Fruit: Liberation Awakening',         weight: 3 },
    { label: 'Threadbinder Fruit: Dominion of Strings',      weight: 2 },
    { label: 'Tremor Fruit: World-Breaker Resonance',        weight: 2 },
    { label: 'Cryothis Fruit: Absolute Zero',                weight: 2 },
    { label: 'Surgeon Fruit: Immortality Operation',         weight: 1 },
    { label: 'Umbralis Fruit: Void Awakening',               weight: 1 },
    { label: 'Pyralis Fruit: Apocalypse Conflagration',      weight: 2 },
    { label: 'Unknown Ancient Fruit — Awakened Form',        weight: 3 },
  ],
}
