import type { Race } from './types'
import { bulkRegisterRaceWheels } from '$lib/game/raceWheelRegistry'

export const races: Race[] = [
  // ── Common (weight 30–40, abilitySpinCount 1) ──
  {
    label: 'Human',
    spinIdentity: ['FateManipulator', 'Scaling'],
    limitBreakOdds: 20,
    weight: 15,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 1.0,
    description: 'Resilient, adaptable, and infuriatingly average.',
    // FateManipulator identity: two injected wheels that paint the run's
    // narrative direction. Destiny is the dominant arc (Chosen One vs
    // Underdog vs Survivor). Talent is a smaller secondary that buffs a
    // matching stat at character build time.
    injectedWheels: [
      { id: 'destiny', displayName: 'Destiny', order: 1, segments: [
        { label: 'Ordinary Soul',  weight: 6, description: 'No special destiny. Just a person.' },
        { label: 'Chosen One',     weight: 1, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, description: 'A prophecy applies.' },
        { label: 'Survivor',       weight: 2, statBonusGrants: { durability: 'statBonus' }, description: 'Cannot be killed easily.' },
        { label: 'Underdog',       weight: 2, statBonusGrants: { potential: 'statBonus' }, description: 'Stronger when behind.' },
        { label: 'Genius',         weight: 2, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, description: 'A mind ahead of its time.' },
        { label: 'Fatebreaker',    weight: 1, statBonusGrants: { potential: 'statBonus', fightingSkill: 'statBonus' }, description: 'Rewrites whatever fate offers.' },
        { label: 'Heroic Soul',    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Bound for legend.' },
      ]},
      { id: 'talent', displayName: 'Talent', order: 2, segments: [
        { label: 'Unfocused',          weight: 6, description: 'Jack of all trades.' },
        { label: 'Combat Prodigy',     weight: 2, statBonusGrants: { fightingSkill: 'statBonus' } },
        { label: 'Inventor\'s Mind',   weight: 2, statBonusGrants: { iq: 'statBonus' } },
        { label: 'Iron Will',          weight: 2, statBonusGrants: { durability: 'statBonus', potential: 'statBonus' } },
        { label: 'Silver Tongue',      weight: 2, statBonusGrants: { charisma: 'statBonus' } },
        { label: 'Lucky Star',         weight: 1, statBonusGrants: { potential: 'statBonus' }, description: 'Wildcards favour you.' },
      ]},
    ],
    // Humans use all weapon and armor types — no bias (balanced baseline)
    classPool: [
      { label: 'Knight',    weight: 4, element: 'Light', grade: 'D', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Shield Wall', weight: 2, element: 'Light', grade: 'C' }, { label: 'Tactical Formation', weight: 2, element: 'Light', grade: 'D' }, { label: 'Mounted Prowess', weight: 2, element: 'Light', grade: 'D' }, { label: 'Iron Resolve', weight: 2, element: 'Light', grade: 'D' }, { label: 'Honor Guard', weight: 2, element: 'Light', grade: 'D' }, { label: 'Battle Banner', weight: 1, element: 'Light', grade: 'C' }], powerPool: [{ label: 'Divine Smite', weight: 3 }, { label: 'Holy Strike', weight: 3 }, { label: 'Shield Slam', weight: 2 }, { label: 'Aura of Retribution', weight: 2 }, { label: 'Lay on Hands', weight: 2 }, { label: 'Consecrated Ground', weight: 1 }, { label: 'Counter-Strike Reflex', weight: 2 }] },
      { label: 'Wizard',    weight: 3, element: 'Arcane', grade: 'C', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Arcane Memory', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Spell Slot Efficiency', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Scroll Mastery', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Magical Attunement', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Concentration Focus', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Ritual Circle', weight: 1, element: 'Arcane', grade: 'C' }], powerPool: [{ label: 'Arcane Barrage', weight: 3 }, { label: 'Counterspell', weight: 3 }, { label: 'Arcane Mastery', weight: 2 }, { label: 'Spell Steal', weight: 2 }, { label: 'Prismatic Spray', weight: 2 }, { label: 'Arcane Torrent', weight: 1 }, { label: 'Mana Drain', weight: 2 }] },
      { label: 'Rogue',     weight: 4, element: 'Shadow', grade: 'D', abilities: [{ label: 'Evasion', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Cunning Action', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Uncanny Dodge', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Trap Sense', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Quick Draw', weight: 2, element: 'Shadow', grade: 'D' }, { label: "Opportunist's Edge", weight: 1 }], powerPool: [{ label: 'Backstab', weight: 3 }, { label: 'Sneak Attack', weight: 3 }, { label: 'Vanishing Act', weight: 2 }, { label: 'Poison Blade', weight: 2 }, { label: 'Smoke Bomb', weight: 2 }, { label: 'Invisibility', weight: 2 }, { label: 'Shadow Step', weight: 1 }] },
      { label: 'Ranger',    weight: 3, element: 'Nature', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Favored Enemy', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Wilderness Expert', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Animal Empathy', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Natural Tracker', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Ambush Setup', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Beast Whisper', weight: 1, element: 'Nature', grade: 'C' }], powerPool: [{ label: "Hunter's Mark", weight: 3 }, { label: 'Volley Shot', weight: 3 }, { label: 'Beast Bond', weight: 2 }, { label: 'Terrain Mastery', weight: 2 }, { label: 'Predator Stance', weight: 2 }, { label: 'Precognition', weight: 1 }] },
      { label: 'Cleric',    weight: 3, element: 'Light', grade: 'C', statBonusGrants: { potential: 'statBonus' }, abilities: [{ label: 'Channel Divinity', weight: 2, element: 'Light', grade: 'C' }, { label: 'Divine Shield', weight: 2, element: 'Light', grade: 'C' }, { label: 'Sacred Ground Aura', weight: 2, element: 'Light', grade: 'C' }, { label: 'Blessed Form', weight: 2, element: 'Light', grade: 'C' }, { label: 'Holy Resilience', weight: 2, element: 'Light', grade: 'C' }, { label: 'Turn Undead (Passive)', weight: 1, element: 'Soul', grade: 'C' }], powerPool: [{ label: 'Sacred Heal', weight: 3 }, { label: 'Turn Undead', weight: 3 }, { label: 'Radiant Strike', weight: 2 }, { label: 'Channel Divinity', weight: 2 }, { label: 'Healing Factor', weight: 2 }, { label: 'Courage Aura', weight: 1 }] },
      { label: 'Barbarian', weight: 4, element: 'Fire', grade: 'D', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Rage Sense', weight: 2, element: 'Time', grade: 'D' }, { label: 'Pain Push', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Danger Sense', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Primal Instinct', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Iron Gut', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Relentless Stand', weight: 1, element: 'Fire', grade: 'D' }], powerPool: [{ label: 'Berserker Frenzy', weight: 3 }, { label: 'Reckless Attack', weight: 3 }, { label: 'Indomitable Rage', weight: 2 }, { label: 'Super Strength', weight: 2 }, { label: 'Battle Precognition', weight: 2 }, { label: 'Warrior Trance', weight: 1 }] },
      { label: 'Bard',      weight: 2, element: 'Sound', grade: 'B', statBonusGrants: { charisma: 'statBonus' }, abilities: [{ label: 'Inspire Courage', weight: 2, element: 'Time', grade: 'B' }, { label: 'Bardic Lore', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Countercharm', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Silver Tongue', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Story Hook', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Crowd Reading', weight: 1, element: 'Sound', grade: 'B' }], powerPool: [{ label: 'Inspire Greatness', weight: 3 }, { label: 'Heroic Tale', weight: 3 }, { label: 'Cutting Words', weight: 2 }, { label: 'Song of Victory', weight: 2 }, { label: 'Enchantment Mastery', weight: 2 }, { label: 'Sound Shaping', weight: 1 }] },
      { label: 'Shaman',    weight: 2, element: 'Nature', grade: 'B', statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Spirit Sight', weight: 2, element: 'Soul', grade: 'B' }, { label: 'Totem Ward', weight: 2, element: 'Arcane', grade: 'C' }, { label: "Nature's Memory", weight: 2 }, { label: 'Ancestor Guidance', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Ritual Mastery', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Earth Communion', weight: 1, element: 'Earth', grade: 'B' }], powerPool: [{ label: 'Druidic Wild Shape', weight: 3 }, { label: 'Spirit Guide', weight: 3 }, { label: "Nature's Grasp", weight: 2 }, { label: 'Storm Circle', weight: 2 }, { label: 'Ancestor Spirit', weight: 2 }, { label: 'Weather Dominion', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 2 }, { label: "5'2\"", weight: 4 }, { label: "5'4\"", weight: 6 },
      { label: "5'6\"", weight: 7 }, { label: "5'8\"", weight: 8 }, { label: "5'10\"", weight: 8 },
      { label: "6'0\"", weight: 7 }, { label: "6'2\"", weight: 5 }, { label: "6'4\"", weight: 3 },
      { label: "6'6\"", weight: 1 },
    ],

    abilities: [
      { label: 'Jack of All Trades', weight: 3, element: 'Nature', grade: 'B' },
      { label: 'Iron Will', weight: 3, element: 'Nature', grade: 'B' },
      { label: 'Community Bonding', weight: 2, element: 'Nature', grade: 'B' },
      { label: 'Adaptability', weight: 3, element: 'Nature', grade: 'B' },
      { label: 'Tool Mastery', weight: 2, element: 'Nature', grade: 'C' },
      { label: 'Stubborn Survival', weight: 3, element: 'Nature', grade: 'B' },
      { label: 'Inspirational Mediocrity', weight: 1, element: 'Nature', grade: 'B' },
    ],
  },
  {
    label: 'Orc',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 24,
    weight: 10,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 1.2,
    minStatTier: 'D-',
    description: 'Built for war and strongly opposed to subtlety.',
    injectedWheels: [
      { id: 'rage', displayName: 'Rage', order: 1, segments: [
        { label: 'Sullen', weight: 5, description: 'Slow to anger. Slower to forgive.' },
        { label: 'Hot-Blooded', weight: 5, statBonusGrants: { strength: 'statBonus' }, description: 'Quick to anger. Quicker to act.' },
        { label: 'War-Hardened', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Anger has a rhythm now. A discipline.' },
        { label: 'Blood Frenzy', weight: 2, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', iq: 'statPenalty' }, description: 'Loses words. Finds the spine.' },
        { label: 'Pure Wrath', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statPenalty' }, description: 'The orc has become the rage.' },
      ]},
      { id: 'warpaint', displayName: 'Warpaint', order: 2, segments: [
        { label: 'Clan Marks', weight: 5, statBonusGrants: { charisma: 'statBonus' }, description: 'Lineage written across the face.' },
        { label: 'Wolf Stripe', weight: 4, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, description: "Hunter's pattern. Wear and chase." },
        { label: 'Bone Mask', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Carved from an enemy. Worn proudly.' },
        { label: 'Death Sigil', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Promises this orc is the last thing you see.' },
        { label: 'Spirit Paint', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Ancestors visible behind the eyes.' },
      ]},
    ],
    statModifiers: { strength: 1.6, durability: 1.3, armorStrength: 1.25, iq: 0.7, charisma: 0.7 },
    weaponTypeBias: { 'Melee': 3.0, 'Ancient': 2.0, 'Exotic': 1.5, 'Ranged': 0.3, 'Magical': 0.3, 'None': 0.1 },
    armorTypeBias:  { 'Full-Suit': 2.5, 'Half-Suit': 1.5, 'Ancient': 2.0, 'Helmet Only': 0.5, 'Exotic': 0.7, 'None': 0.1 },
    classPool: [
      { label: 'Warchief',   weight: 2, element: 'Earth', grade: 'A', statBonusGrants: { strength: 'statBonus', charisma: 'statBonus' }, abilities: [{ label: 'Command Presence', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Battle Tactics', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Rally Cry', weight: 2, element: 'Earth', grade: 'A' }, { label: 'Fear Aura (Minor)', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'War Drums', weight: 2, element: 'Earth', grade: 'A' }, { label: 'Tactical Read', weight: 1, element: 'Earth', grade: 'A' }], powerPool: [{ label: 'Warchief Rally', weight: 3 }, { label: 'Battle Cry', weight: 3 }, { label: 'Indomitable Rage', weight: 2 }, { label: 'Ancestral Weapon', weight: 2 }, { label: 'Aura of Retribution', weight: 1 }] },
      { label: 'Berserker',  weight: 4, element: 'Fire', grade: 'D', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Bloodlust', weight: 2, element: 'Blood', grade: 'D' }, { label: 'Pain Immunity', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Savage Fortitude', weight: 2, element: 'Time', grade: 'D' }, { label: 'Reckless Abandon', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Carnage Sense', weight: 2, element: 'Time', grade: 'D' }, { label: 'Berserker Scar', weight: 1, element: 'Chaos', grade: 'D' }], powerPool: [{ label: 'Berserker Frenzy', weight: 3 }, { label: 'Reckless Attack', weight: 3 }, { label: 'Super Strength', weight: 2 }, { label: 'Indomitable Rage', weight: 2 }, { label: 'Battle Precognition', weight: 1 }] },
      { label: 'Shaman',     weight: 3, element: 'Nature', grade: 'B', abilities: [{ label: "Ancestor's Favor", weight: 2 }, { label: 'Tribal Blessing', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Curse Sense', weight: 2, element: 'Soul', grade: 'B' }, { label: 'War Paint', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Earth Communion', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Spirit Guidance', weight: 1, element: 'Soul', grade: 'B' }], powerPool: [{ label: 'Spirit Walk', weight: 3 }, { label: 'Spirit Guide', weight: 3 }, { label: 'Ancestor Spirit', weight: 2 }, { label: "Nature's Wrath", weight: 2 }, { label: 'Ancestral Weapon', weight: 2 }] },
      { label: 'Warrior',    weight: 5, element: 'Earth', grade: 'D', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Iron Discipline', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Shield Block', weight: 2, element: 'Earth', grade: 'C' }, { label: "Veteran's Edge", weight: 2 }, { label: 'Combat Hardening', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Battlefield Awareness', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Iron Gut', weight: 1, element: 'Earth', grade: 'D' }], powerPool: [{ label: 'Ancestral Weapon', weight: 3 }, { label: 'Shield Slam', weight: 3 }, { label: 'Combat Flow State', weight: 2 }, { label: 'Warrior Trance', weight: 2 }, { label: 'Battle Precognition', weight: 1 }] },
      { label: 'Gladiator',  weight: 3, element: 'Neutral', grade: 'D', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Crowd Reading', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Pain as Fuel', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Performance Combat', weight: 2, element: 'Neutral', grade: 'C' }, { label: "Champion's Presence", weight: 2 }, { label: 'Bloody Momentum', weight: 2, element: 'Blood', grade: 'D' }, { label: 'Ring Mastery', weight: 1, element: 'Neutral', grade: 'C' }], powerPool: [{ label: 'Combat Flow State', weight: 3 }, { label: 'Reckless Attack', weight: 3 }, { label: 'Perfect Parry', weight: 2 }, { label: 'Counter-Strike Reflex', weight: 2 }, { label: 'Warrior Trance', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "6'0\"", weight: 2 }, { label: "6'2\"", weight: 3 }, { label: "6'4\"", weight: 4 },
      { label: "6'6\"", weight: 5 }, { label: "6'8\"", weight: 5 }, { label: "6'10\"", weight: 4 },
      { label: "7'0\"", weight: 3 }, { label: "7'2\"", weight: 2 }, { label: "7'6\"", weight: 1 },
      { label: "8'0\" (Giant-Blooded)", weight: 1 },
    ],

    abilities: [
      { label: 'Battle Cry', weight: 3, element: 'Neutral', grade: 'C' },
      { label: 'Bloodlust', weight: 2, element: 'Blood', grade: 'D' },
      { label: 'Troll Blood', weight: 2, element: 'Blood', grade: 'D' },
      { label: "Berserker's Focus", weight: 2 },
      { label: 'Crushing Blow', weight: 3, element: 'Gravity', grade: 'D' },
      { label: 'War Drums', weight: 2, element: 'Neutral', grade: 'D' },
      { label: 'Primal Fury', weight: 1, element: 'Neutral', grade: 'D' },
    ],
  },
  {
    label: 'Halfling',
    spinIdentity: ['FateManipulator'],
    limitBreakOdds: 22,
    weight: 15,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 0.9,
    // Tier 1 — no stat lock
    description: 'Small in stature, enormous in luck and appetite.',
    injectedWheels: [
      { id: 'fortune', displayName: 'Fortune', order: 1, segments: [
        { label: 'Lucky Day', weight: 5, statBonusGrants: { potential: 'statBonus' }, description: 'Wildcards favour you.' },
        { label: 'Coin Flip', weight: 4, description: 'Even odds. May the spin decide.' },
        { label: 'Streak', weight: 3, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, description: 'Crit streaks compound.' },
        { label: 'Lottery Soul', weight: 2, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, description: 'One wheel will jackpot.' },
        { label: 'Cursed Coin', weight: 1, statBonusGrants: { charisma: 'statPenalty' }, description: 'Bad luck twin. Avoid mirrors.' },
      ]},
      { id: 'trinket', displayName: 'Trinket', order: 2, segments: [
        { label: 'Empty Pocket', weight: 6, description: 'Just lint, mostly.' },
        { label: 'Lucky Stone', weight: 4, statBonusGrants: { durability: 'statBonus' }, description: 'Smooth river stone. Warm in your pocket.' },
        { label: 'Crit Charm', weight: 3, statBonusGrants: { fightingSkill: 'statBonus' }, description: 'Improves precision in tense moments.' },
        { label: 'Coinpurse', weight: 2, description: 'Always rattles. Always full.' },
        { label: 'Forgotten Map', weight: 1, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, description: "Leads somewhere it shouldn't." },
      ]},
    ],
    statModifiers: { charisma: 1.3, speed: 1.2, agility: 1.2, strength: 0.7 },
    weaponTypeBias: { 'Ranged': 2.5, 'Melee': 1.0, 'None': 1.5, 'Magical': 0.9, 'Exotic': 0.8, 'Cursed': 0.5, 'Ancient': 0.5 },
    armorTypeBias:  { 'None': 1.8, 'Helmet Only': 1.5, 'Half-Suit': 1.2, 'Full-Suit': 0.3, 'Exotic': 0.7, 'Cursed': 0.5, 'Ancient': 0.4 },
    classPool: [
      { label: 'Rogue',       weight: 4, element: 'Shadow', grade: 'D', abilities: [{ label: 'Small Target', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Nimble Escape', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Trap Intuition', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Quick Fingers', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Social Invisible', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Acrobatic Defense', weight: 1, element: 'Shadow', grade: 'D' }], powerPool: [{ label: 'Backstab', weight: 3 }, { label: 'Vanishing Act', weight: 3 }, { label: 'Smoke Bomb', weight: 2 }, { label: 'Sneak Attack', weight: 2 }, { label: 'Shadow Step', weight: 2 }, { label: 'Poison Blade', weight: 1 }] },
      { label: 'Bard',        weight: 3, element: 'Sound', grade: 'B', abilities: [{ label: 'Natural Performer', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Halfling Charm', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Tale Spinner', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Lucky Lore', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Crowd Pleaser', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Emotional Strings', weight: 1, element: 'Sound', grade: 'B' }], powerPool: [{ label: 'Inspire Greatness', weight: 3 }, { label: 'Heroic Tale', weight: 3 }, { label: 'Cutting Words', weight: 2 }, { label: 'Enchantment Mastery', weight: 2 }, { label: 'Song of Victory', weight: 1 }] },
      { label: 'Scout',       weight: 4, element: 'Nature', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Keen Ear', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Light Step', weight: 2, element: 'Light', grade: 'C' }, { label: 'Path Memory', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Quick Intel', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Escape Artist', weight: 2, element: 'Nature', grade: 'C' }, { label: "Nature's Camouflage", weight: 1 }], powerPool: [{ label: "Hunter's Mark", weight: 3 }, { label: 'Terrain Mastery', weight: 3 }, { label: 'Predator Stance', weight: 2 }, { label: 'Vanishing Act', weight: 2 }, { label: 'Beast Bond', weight: 1 }] },
      { label: 'Lucky Merchant', weight: 2, element: 'Chaos', grade: 'B', abilities: [{ label: 'Bargain Sense', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Lucky Deal', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Trade Instinct', weight: 2, element: 'Chaos', grade: 'C' }, { label: 'Value Sight', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Risk Assessment', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Sixth Coin Sense', weight: 1, element: 'Chaos', grade: 'B' }], powerPool: [{ label: 'Probability Manipulation', weight: 3 }, { label: 'Trickster Gambit', weight: 3 }, { label: 'Murphy\'s Law Reversal', weight: 2 }, { label: 'Deception Detection', weight: 2 }, { label: 'Perfect Bluff', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "2'10\"", weight: 1 }, { label: "2'11\"", weight: 2 }, { label: "3'0\"", weight: 3 },
      { label: "3'1\"",  weight: 4 }, { label: "3'2\"",  weight: 5 }, { label: "3'3\"",  weight: 5 },
      { label: "3'4\"",  weight: 5 }, { label: "3'5\"",  weight: 4 }, { label: "3'6\"",  weight: 3 },
      { label: "3'7\"",  weight: 2 }, { label: "3'8\"",  weight: 1 },
      { label: 'Suspiciously Round', weight: 1 },
    ],
    abilities: [
      { label: 'Lucky Break', weight: 3, element: 'Chaos', grade: 'B' },
      { label: 'Small But Mighty', weight: 2, element: 'Chaos', grade: 'B' },
      { label: 'Bravery of the Underestimated', weight: 2, element: 'Chaos', grade: 'B' },
      { label: 'Second Breakfast Surge', weight: 3, element: 'Chaos', grade: 'B' },
      { label: 'Foot of Fortune', weight: 2, element: 'Chaos', grade: 'B' },
      { label: 'Hiding in Plain Sight', weight: 2, element: 'Chaos', grade: 'B' },
      { label: 'Light Fingers', weight: 1, element: 'Light', grade: 'B' },
    ],
  },
  {
    label: 'Dwarf',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 26,
    weight: 12,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 0.8,
    minStatTier: 'D-',
    description: 'Stubborn as stone, twice as dense.',
    injectedWheels: [
      { id: 'forge', displayName: 'Forge', order: 1, segments: [
        { label: 'Apprentice Work', weight: 5, statBonusGrants: { weaponMastery: 'statBonus' }, description: 'Solid for a beginner. Heavy for the carrier.' },
        { label: 'Guild Quality', weight: 5, statBonusGrants: { weaponMastery: 'statBonus', armorStrength: 'statBonus' }, description: 'Standard dwarvish craftsmanship. Excellent everywhere.' },
        { label: 'Heirloom Weapon', weight: 3, statBonusGrants: { weaponMastery: 'statBonus', fightingSkill: 'statBonus' }, description: 'Passed down through generations.' },
        { label: 'Mastercraft', weight: 2, statBonusGrants: { weaponMastery: 'statBonus', armorStrength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Once-in-a-lifetime piece.' },
        { label: 'Legendary Forge', weight: 1, statBonusGrants: { armorStrength: 'statBonus', weaponMastery: 'statBonus', strength: 'statBonus' }, description: 'Forged in fire that no longer exists.' },
      ]},
      { id: 'rune', displayName: 'Rune', order: 2, segments: [
        { label: 'No Rune', weight: 5, description: 'The weapon stands on its own.' },
        { label: 'Rune of Sharpness', weight: 4, statBonusGrants: { fightingSkill: 'statBonus' }, description: 'Cuts deeper. The edge sings.' },
        { label: 'Rune of Warding', weight: 4, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Light beneath the skin.' },
        { label: 'Rune of Power', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, description: 'Glowing veins along the metal.' },
        { label: 'Rune of Doom', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statPenalty' }, description: 'Carved in a tongue no one remembers.' },
      ]},
    ],
    statModifiers: { durability: 1.6, strength: 1.4, armorStrength: 1.5, speed: 0.6, agility: 0.7 },
    weaponTypeBias: { 'Melee': 2.5, 'Ancient': 2.5, 'None': 0.1, 'Ranged': 0.4, 'Magical': 0.4, 'Cursed': 0.5 },
    armorTypeBias:  { 'Full-Suit': 3.0, 'Half-Suit': 1.5, 'Ancient': 3.0, 'None': 0.1, 'Cursed': 0.3, 'Helmet Only': 0.5 },
    subTypePool: [
      { label: 'Hill Dwarf',     weight: 5, element: 'Earth', grade: 'D', abilities: [{ label: 'Hardy Constitution', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Ancestor Memory', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Hill Sense', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Community Lore', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Enduring Spirit', weight: 2, element: 'Soul', grade: 'D' }, { label: 'Ancient Grudge', weight: 1, element: 'Earth', grade: 'D' }], powerPool: [{ label: 'Stone Endurance', weight: 3 }, { label: 'Ancestor Spirit', weight: 3 }, { label: 'Ancestral Weapon', weight: 2 }, { label: 'Healing Factor', weight: 2 }, { label: 'Courage Aura', weight: 1 }] },
      { label: 'Mountain Dwarf', weight: 4, element: 'Metal', grade: 'D', abilities: [{ label: 'Stone Fortitude', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Forge Mastery', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Altitude Sense', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Armor Expert', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Combat Born', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Rock Steady', weight: 1, element: 'Earth', grade: 'D' }], powerPool: [{ label: 'Stone Call', weight: 3 }, { label: 'Forge Blessing', weight: 3 }, { label: 'Ancestral Weapon', weight: 2 }, { label: 'Indomitable Rage', weight: 2 }, { label: 'Tremor Sense', weight: 1 }] },
      { label: 'Deep Dwarf',     weight: 3, element: 'Shadow', grade: 'C', abilities: [{ label: 'Darkblind Immunity', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Tremor Sense (Passive)', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Stone Communion', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Deep Lore', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Silence Walk', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Underground Expert', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Tremor Sense', weight: 3 }, { label: 'Stone Call', weight: 3 }, { label: 'Crystal Armor', weight: 2 }, { label: 'Shadow Step', weight: 2 }, { label: 'Darkness Veil', weight: 1 }] },
      { label: 'Runic Dwarf',    weight: 2, element: 'Arcane', grade: 'A', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Runic Memory', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Symbol Attunement', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Ancient Inscription', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Magical Seal', weight: 2, element: 'Water', grade: 'A' }, { label: 'Power Word Etching', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Rune Shield (Passive)', weight: 1, element: 'Arcane', grade: 'C' }], powerPool: [{ label: 'Runic Ward', weight: 3 }, { label: 'Forge Blessing', weight: 3 }, { label: 'Ancestor Spirit', weight: 2 }, { label: 'Arcane Infusion', weight: 2 }, { label: 'Stone Call', weight: 1 }] },
      { label: 'Forge Dwarf',    weight: 3, element: 'Metal', grade: 'C', abilities: [{ label: 'Master Craftsman', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Metal Sense', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Forge Bond', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Weapon Attunement', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Armor Refinement', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Craft Mastery', weight: 1, element: 'Metal', grade: 'C' }], powerPool: [{ label: 'Forge Blessing', weight: 3 }, { label: 'Ancestral Weapon', weight: 3 }, { label: 'Runic Ward', weight: 2 }, { label: 'Stone Call', weight: 2 }, { label: 'Crystal Armor', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "4'0\"", weight: 2 }, { label: "4'1\"", weight: 3 }, { label: "4'2\"", weight: 4 },
      { label: "4'3\"", weight: 5 }, { label: "4'4\"", weight: 6 }, { label: "4'5\"", weight: 6 },
      { label: "4'6\"", weight: 5 }, { label: "4'7\"", weight: 4 }, { label: "4'8\"", weight: 3 },
      { label: "4'9\"", weight: 2 }, { label: "4'10\"", weight: 1 },
      { label: 'Wider Than Tall', weight: 1 },
    ],
    abilities: [
      { label: 'Stone Skin', weight: 3, element: 'Earth', grade: 'C' },
      { label: 'Forge Mastery', weight: 2, element: 'Metal', grade: 'C' },
      { label: 'Ancient Grudge', weight: 3, element: 'Metal', grade: 'C' },
      { label: 'Ale Immunity', weight: 3, element: 'Metal', grade: 'C' },
      { label: 'Trap Sense', weight: 2, element: 'Metal', grade: 'C' },
      { label: 'Mountain Walker', weight: 2, element: 'Earth', grade: 'C' },
      { label: 'Ancestral Stubbornness', weight: 1, element: 'Metal', grade: 'C' },
    ],
  },
  {
    label: 'Goblin',
    spinIdentity: ['HighVariance'],
    limitBreakOdds: 24,
    weight: 15,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 1.3,
    description: 'Chaos given a small, green body.',
    injectedWheels: [
      { id: 'scrap', displayName: 'Scrap Pile', order: 1, segments: [
        { label: 'Sharpened Junk', weight: 6, statBonusGrants: { fightingSkill: 'statBonus' }, description: 'Cobbled-together blade. Probably tetanus.' },
        { label: 'Sparking Wire', weight: 4, statBonusGrants: { powerMastery: 'statBonus', iq: 'statPenalty' }, description: 'It shocks. Yes. Constantly.' },
        { label: 'Salvage Cache', weight: 3, description: 'A box of parts. Many useful, none safe.' },
        { label: 'Live Grenade', weight: 2, statBonusGrants: { strength: 'statBonus', iq: 'statPenalty' }, description: "Pin's still in. Probably." },
        { label: 'Goblin Engine', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, description: 'An impossible machine. It works. Sometimes.' },
      ]},
      { id: 'loot', displayName: 'Loot', order: 2, segments: [
        { label: 'Bag of Coins', weight: 5, description: 'Stolen earlier today.' },
        { label: 'Stolen Trinket', weight: 4, statBonusGrants: { charisma: 'statBonus' }, description: 'Belonged to someone important.' },
        { label: 'Half a Weapon', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', weaponMastery: 'statBonus' }, description: 'Just the sharp end.' },
        { label: 'Rare Component', weight: 2, statBonusGrants: { iq: 'statBonus' }, description: 'Worth more than the goblin who stole it.' },
        { label: 'Cursed Idol', weight: 1, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' }, description: 'Voices in the head. Just whispers, really.' },
      ]},
    ],
    statModifiers: { agility: 1.4, speed: 1.3, charisma: 0.7, durability: 0.7 },
    weaponTypeBias: { 'Melee': 1.5, 'Ranged': 1.3, 'Exotic': 2.0, 'Cursed': 2.5, 'None': 1.5, 'Magical': 0.7, 'Ancient': 0.3 },
    armorTypeBias:  { 'None': 2.5, 'Helmet Only': 1.5, 'Cursed': 2.0, 'Exotic': 1.2, 'Half-Suit': 0.7, 'Full-Suit': 0.2, 'Ancient': 0.3 },
    classPool: [
      { label: 'Alchemist',   weight: 3, element: 'Poison', grade: 'C', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Toxin Resistance', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Chemical Intuition', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Fume Sense', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Improvised Brew', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Reagent Sense', weight: 2, element: 'Time', grade: 'C' }, { label: 'Explosive Tinkering', weight: 1, element: 'Poison', grade: 'C' }], powerPool: [{ label: 'Bomb Toss', weight: 3 }, { label: 'Scavenge Protocol', weight: 3 }, { label: 'Smoke Bomb', weight: 2 }, { label: 'Poison Blade', weight: 2 }, { label: 'Pathogen Generation', weight: 1 }] },
      { label: 'Assassin',    weight: 3, element: 'Shadow', grade: 'C', abilities: [{ label: 'Death from Below', weight: 2, element: 'Soul', grade: 'C' }, { label: 'Target Exploit', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Execution Rush', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Silent Footfall', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Weakness Read', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Escape Protocol', weight: 1, element: 'Shadow', grade: 'C' }], powerPool: [{ label: 'Backstab', weight: 3 }, { label: 'Vanishing Act', weight: 3 }, { label: 'Poison Blade', weight: 2 }, { label: 'Smoke Bomb', weight: 2 }, { label: 'Shadow Step', weight: 1 }] },
      { label: 'Tinkerer',    weight: 3, element: 'Metal', grade: 'B', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Device Intuition', weight: 2, element: 'Ice', grade: 'B' }, { label: 'Jury Rigging', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Blueprint Memory', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Mechanism Sense', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Gadget Affinity', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Overclock Reflex', weight: 1, element: 'Metal', grade: 'B' }], powerPool: [{ label: 'Gadget Deploy', weight: 3 }, { label: 'Bomb Toss', weight: 3 }, { label: 'Scavenge Protocol', weight: 2 }, { label: 'Illusory Decoy', weight: 2 }, { label: 'Tinkered Familiar', weight: 1 }] },
      { label: 'Warlock',     weight: 2, element: 'Shadow', grade: 'B', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Dark Bargain', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Patron Bond', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Eldritch Sight', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Corruption Sense', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Infernal Ear', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Warped Instinct', weight: 1, element: 'Shadow', grade: 'C' }], powerPool: [{ label: 'Hex Curse', weight: 3 }, { label: 'Eldritch Blast (Advanced)', weight: 3 }, { label: 'Darkness Veil', weight: 2 }, { label: 'Devil Sight', weight: 2 }, { label: 'Infernal Contract', weight: 1 }] },
      { label: 'Gang Boss',   weight: 4, element: 'Neutral', grade: 'D', abilities: [{ label: 'Mob Loyalty', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Street Savvy', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Fear Authority', weight: 2, element: 'Psychic', grade: 'D' }, { label: 'Underworld Ties', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Criminal Network', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Pack Discipline', weight: 1, element: 'Neutral', grade: 'D' }], powerPool: [{ label: 'Warchief Rally', weight: 3 }, { label: 'Smoke Bomb', weight: 3 }, { label: 'Fear Projection', weight: 2 }, { label: 'Bomb Toss', weight: 2 }, { label: 'Trickster Gambit', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "3'2\"", weight: 2 }, { label: "3'4\"", weight: 3 }, { label: "3'6\"", weight: 5 },
      { label: "3'8\"", weight: 6 }, { label: "3'10\"", weight: 6 }, { label: "4'0\"", weight: 5 },
      { label: "4'2\"", weight: 3 }, { label: "4'4\"", weight: 2 }, { label: "4'6\"", weight: 1 },
      { label: 'Suspiciously Small', weight: 1 },
    ],

    abilities: [
      { label: 'Pack Tactics', weight: 3, element: 'Neutral', grade: 'D' },
      { label: 'Opportunistic Strike', weight: 3, element: 'Neutral', grade: 'D' },
      { label: 'Trash Alchemy', weight: 2, element: 'Neutral', grade: 'D' },
      { label: 'Explosive Distraction', weight: 2, element: 'Neutral', grade: 'D' },
      { label: 'Chaos Incarnate', weight: 1, element: 'Chaos', grade: 'D' },
      { label: "Scavenger's Eye", weight: 2 },
      { label: 'Tiny Target', weight: 2, element: 'Neutral', grade: 'D' },
    ],
  },
  {
    label: 'Half-Elf',
    spinIdentity: ['FateManipulator'],
    limitBreakOdds: 26,
    weight: 10,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 0.95,
    minStatTier: 'E-',
    description: 'Caught between two worlds and uncomfortable in both.',
    injectedWheels: [
      { id: 'heritage', displayName: 'Heritage Pull', order: 1, segments: [
        { label: 'Human-Side', weight: 5, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, description: 'Lives among humans. Mortal pace.' },
        { label: 'Elf-Side', weight: 4, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', potential: 'statBonus' }, description: 'Lives among elves. Slower pace, longer view.' },
        { label: 'Wanderer', weight: 3, statBonusGrants: { iq: 'statBonus', charisma: 'statBonus', agility: 'statBonus' }, description: 'Neither, fully. Both, partly.' },
        { label: 'Bridge-Walker', weight: 2, statBonusGrants: { charisma: 'statBonus', iq: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' }, description: 'Diplomat between worlds. Both sides trust.' },
        { label: 'Awakened Blood', weight: 1, statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus', iq: 'statBonus' }, description: 'Both heritages compounding. Rare phenotype.' },
      ]},
    ],
    statModifiers: { charisma: 1.3, agility: 1.2 },
    weaponTypeBias: { 'Ranged': 1.8, 'Magical': 1.5, 'Exotic': 1.2, 'Melee': 0.9, 'None': 1.0 },
    armorTypeBias:  { 'Half-Suit': 1.5, 'Helmet Only': 1.2, 'Exotic': 1.2, 'Full-Suit': 0.6, 'None': 1.0 },
    subTypePool: [
      { label: 'Wood Elf Heritage',  weight: 4, element: 'Nature', grade: 'D', abilities: [{ label: 'Forest Instinct', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Elven Agility', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Nature Bond', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Beast Empathy', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Wild Blood', weight: 2, element: 'Blood', grade: 'D' }, { label: 'Camouflage Sense', weight: 1, element: 'Shadow', grade: 'D' }], powerPool: [{ label: 'Forest Meld', weight: 3 }, { label: 'Beast Bond', weight: 3 }, { label: "Nature's Grasp", weight: 2 }, { label: 'Terrain Mastery', weight: 2 }, { label: 'Predator Stance', weight: 1 }] },
      { label: 'High Elf Heritage',  weight: 4, element: 'Arcane', grade: 'C', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Arcane Curiosity', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Elven Clarity', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Spell Touch', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Ancient Lineage', weight: 2, element: 'Time', grade: 'C' }, { label: 'Magic Affinity', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Trance Meditation', weight: 1, element: 'Arcane', grade: 'C' }], powerPool: [{ label: 'Arcane Mastery', weight: 3 }, { label: 'Arcane Barrage', weight: 3 }, { label: 'Elven Star Shot', weight: 2 }, { label: 'Counterspell', weight: 2 }, { label: 'Moonwell Draw', weight: 1 }] },
      { label: 'Drow Heritage',      weight: 2, element: 'Shadow', grade: 'B', abilities: [{ label: 'Shadow Affinity', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Dual Sight', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Darkness Comfort', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Cunning Mind', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Spell Resistance Shard', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Underground Ease', weight: 1, element: 'Earth', grade: 'B' }], powerPool: [{ label: 'Shadow Veil', weight: 3 }, { label: 'Faerie Fire Curse', weight: 3 }, { label: 'Web Entangle', weight: 2 }, { label: 'Darkness Veil', weight: 2 }, { label: 'Devil Sight', weight: 1 }] },
      { label: 'Sea Elf Heritage',   weight: 3, element: 'Water', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Water Affinity', weight: 2, element: 'Water', grade: 'C' }, { label: 'Tidal Sense', weight: 2, element: 'Water', grade: 'C' }, { label: 'Aquatic Heritage', weight: 2, element: 'Water', grade: 'C' }, { label: 'Salt Skin', weight: 2, element: 'Water', grade: 'C' }, { label: 'Pressure Adaptation', weight: 2, element: 'Gravity', grade: 'C' }, { label: 'Sea Instinct', weight: 1, element: 'Water', grade: 'C' }], powerPool: [{ label: 'Moonwell Draw', weight: 3 }, { label: 'Hydrokinesis', weight: 3 }, { label: 'Aqua Form', weight: 2 }, { label: 'Tidal Burst', weight: 2 }, { label: 'Elven Star Shot', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'4\"", weight: 3 }, { label: "5'6\"", weight: 5 }, { label: "5'8\"", weight: 7 },
      { label: "5'10\"", weight: 8 }, { label: "6'0\"", weight: 7 }, { label: "6'2\"", weight: 5 },
      { label: "6'4\"", weight: 3 }, { label: "6'6\"", weight: 1 },
    ],

    abilities: [
      { label: 'Cultural Fluency', weight: 3, element: 'Water', grade: 'C' },
      { label: 'Dual Heritage', weight: 2, element: 'Time', grade: 'C' },
      { label: 'Diplomatic Immunity (Sort Of)', weight: 2, element: 'Water', grade: 'C' },
      { label: 'Social Chameleon', weight: 3, element: 'Water', grade: 'C' },
      { label: 'Borrowed Grace', weight: 2, element: 'Water', grade: 'C' },
      { label: 'Elven Agility Shard', weight: 2, element: 'Water', grade: 'C' },
      { label: 'Human Resilience Echo', weight: 2, element: 'Sound', grade: 'C' },
    ],
  },
  {
    label: 'Half-Orc',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 24,
    weight: 10,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 1.1,
    minStatTier: 'E-',
    description: 'The best parts of two species. Probably.',
    injectedWheels: [
      { id: 'temperament', displayName: 'Temperament', order: 1, segments: [
        { label: 'Calm', weight: 4, statBonusGrants: { iq: 'statBonus', charisma: 'statBonus' }, description: 'Holds back. Civilised face on.' },
        { label: 'Driven', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Half-orc strength channelled. Disciplined.' },
        { label: 'Ferocious', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus' }, description: 'The orc half is the louder voice.' },
        { label: 'Berserker Blood', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', iq: 'statPenalty' }, description: 'Rage runs deeper than the human half can hold.' },
        { label: 'Mongrel Apex', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' }, description: 'Best of both. Cousins on both sides claim the lineage.' },
      ]},
    ],
    statModifiers: { strength: 1.3, durability: 1.2 },
    weaponTypeBias: { 'Melee': 2.2, 'Ancient': 1.3, 'Ranged': 0.6, 'Magical': 0.6, 'None': 0.4 },
    armorTypeBias:  { 'Full-Suit': 1.8, 'Half-Suit': 2.0, 'Ancient': 1.3, 'None': 0.3, 'Exotic': 0.8 },
    classPool: [
      { label: 'Berserker', weight: 4, element: 'Fire', grade: 'D', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Half-Blood Fury', weight: 2, element: 'Blood', grade: 'D' }, { label: 'Relentless Rage', weight: 2, element: 'Time', grade: 'D' }, { label: 'Pain Push', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Orcish Endurance', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Savage Surge', weight: 2, element: 'Time', grade: 'D' }, { label: 'Scar Hardened', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Berserker Frenzy', weight: 3 }, { label: 'Reckless Attack', weight: 3 }, { label: 'Indomitable Rage', weight: 2 }, { label: 'Super Strength', weight: 2 }, { label: 'Warrior Trance', weight: 1 }] },
      { label: 'Fighter',   weight: 5, element: 'Neutral', grade: 'D', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Combat Instinct', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Tactical Reflex', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Iron Stand', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Weapon Affinity', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Battle Awareness', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Second Skin Armor', weight: 1, element: 'Neutral', grade: 'D' }], powerPool: [{ label: 'Combat Flow State', weight: 3 }, { label: 'Ancestral Weapon', weight: 3 }, { label: 'Perfect Parry', weight: 2 }, { label: 'Counter-Strike Reflex', weight: 2 }, { label: 'Battle Precognition', weight: 1 }] },
      { label: 'Scout',     weight: 3, element: 'Nature', grade: 'C', abilities: [{ label: 'Wilderness Sense', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Predator Eye', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Survival Mastery', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Tracking Instinct', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Ambush Positioning', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Terrain Read', weight: 1, element: 'Water', grade: 'C' }], powerPool: [{ label: 'Predator Stance', weight: 3 }, { label: "Hunter's Mark", weight: 3 }, { label: 'Terrain Mastery', weight: 2 }, { label: 'Beast Bond', weight: 2 }, { label: 'Vanishing Act', weight: 1 }] },
      { label: 'Warlord',   weight: 2, element: 'Earth', grade: 'A', statBonusGrants: { charisma: 'statBonus' }, abilities: [{ label: 'Battlefield Command', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Tactical Supremacy', weight: 2, element: 'Earth', grade: 'A' }, { label: 'Intimidation Mastery', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Strategic Mind', weight: 2, element: 'Psychic', grade: 'A' }, { label: "Leader's Presence", weight: 2 }, { label: 'War Strategy', weight: 1, element: 'Earth', grade: 'A' }], powerPool: [{ label: 'Warchief Rally', weight: 3 }, { label: 'Aura of Retribution', weight: 3 }, { label: 'Battle Cry', weight: 2 }, { label: 'Fear Projection', weight: 2 }, { label: 'Courage Aura', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'10\"", weight: 3 }, { label: "6'0\"", weight: 4 }, { label: "6'2\"", weight: 5 },
      { label: "6'4\"", weight: 6 }, { label: "6'6\"", weight: 5 }, { label: "6'8\"", weight: 4 },
      { label: "6'10\"", weight: 3 }, { label: "7'0\"", weight: 2 }, { label: "7'2\"", weight: 1 },
    ],

    abilities: [
      { label: 'Relentless Endurance', weight: 3, element: 'Earth', grade: 'C' },
      { label: 'Savage Fury', weight: 2, element: 'Time', grade: 'A' },
      { label: 'Intimidating Presence', weight: 2, element: 'Psychic', grade: 'A' },
      { label: 'Never Say Die', weight: 3, element: 'Earth', grade: 'A' },
      { label: 'Hybrid Vigour', weight: 2, element: 'Earth', grade: 'A' },
      { label: 'Orcish Might', weight: 2, element: 'Earth', grade: 'A' },
      { label: 'Survival Instinct', weight: 2, element: 'Earth', grade: 'C' },
    ],
  },
  {
    label: 'Gnome',
    spinIdentity: ['HighVariance'],
    limitBreakOdds: 22,
    weight: 15,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 1.0,
    description: 'Tiny. Ingenious. Almost certainly up to something.',
    injectedWheels: [
      { id: 'gadget', displayName: 'Gadget', order: 1, segments: [
        { label: 'Spring-Loaded', weight: 5, statBonusGrants: { agility: 'statBonus' }, description: 'Snaps open. Maybe useful, maybe a face full of spring.' },
        { label: 'Clockwork Aid', weight: 4, statBonusGrants: { iq: 'statBonus' }, description: 'Reliable in calm moments.' },
        { label: "Tinker's Goggles", weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, description: "See what others can't focus on." },
        { label: 'Pocket Engine', weight: 2, statBonusGrants: { powerMastery: 'statBonus' }, description: "A miniature reactor. Don't drop it." },
        { label: 'Prototype Failure', weight: 1, statBonusGrants: { potential: 'statBonus', iq: 'statPenalty' }, description: 'It exploded. They still build.' },
      ]},
      { id: 'experiment', displayName: 'Experiment', order: 2, segments: [
        { label: 'Stable Compound', weight: 6, statBonusGrants: { durability: 'statBonus' }, description: 'Passed three rounds of testing.' },
        { label: 'Reactive Compound', weight: 4, statBonusGrants: { powerMastery: 'statBonus' }, description: 'Still bubbling. Still smoking.' },
        { label: 'Mind Solvent', weight: 3, statBonusGrants: { iq: 'statBonus', charisma: 'statPenalty' }, description: 'Sharper, lonelier.' },
        { label: 'Gnomish Catalyst', weight: 2, statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus' }, description: 'Multiplies whatever it touches.' },
        { label: 'Lab Accident', weight: 1, statBonusGrants: { strength: 'statBonus', iq: 'statPenalty' }, description: 'Forever altered. Possibly improved.' },
      ]},
    ],
    statModifiers: { iq: 1.6, potential: 1.4, strength: 0.6 },
    weaponTypeBias: { 'Magical': 2.5, 'Exotic': 2.0, 'Ranged': 1.2, 'None': 1.2, 'Melee': 0.4, 'Cursed': 0.5, 'Ancient': 0.5 },
    armorTypeBias:  { 'Exotic': 2.0, 'None': 1.5, 'Half-Suit': 1.0, 'Helmet Only': 0.8, 'Full-Suit': 0.3, 'Ancient': 0.5 },
    subTypePool: [
      { label: 'Forest Gnome',    weight: 4, element: 'Nature', grade: 'D', abilities: [{ label: 'Nature Chat', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Beast Friend', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Illusion Instinct', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Berry Wisdom', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Sprout Camouflage', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Root Magic', weight: 1, element: 'Arcane', grade: 'D' }], powerPool: [{ label: 'Illusory Decoy', weight: 3 }, { label: 'Beast Bond', weight: 3 }, { label: 'Forest Meld', weight: 2 }, { label: "Nature's Grasp", weight: 2 }, { label: 'Tinkered Familiar', weight: 1 }] },
      { label: 'Rock Gnome',      weight: 5, element: 'Metal', grade: 'D', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Tinker Mastery', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Clockwork Sense', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Blueprint Memory', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Mechanism Intuition', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Cog Mind', weight: 2, element: 'Psychic', grade: 'D' }, { label: 'Gadget Jury-Rig', weight: 1, element: 'Metal', grade: 'D' }], powerPool: [{ label: 'Gadget Deploy', weight: 3 }, { label: 'Tinkered Familiar', weight: 3 }, { label: 'Arcane Infusion', weight: 2 }, { label: 'Illusory Decoy', weight: 2 }, { label: 'Crystal Armor', weight: 1 }] },
      { label: 'Deep Gnome',      weight: 3, element: 'Earth', grade: 'C', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Stone Sight', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Gem Assessment', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Depth Adaptation', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Tunnel Master', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Silence Walk', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Stonecunning', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Tremor Sense', weight: 3 }, { label: 'Invisibility', weight: 3 }, { label: 'Stone Call', weight: 2 }, { label: 'Darkness Veil', weight: 2 }, { label: 'Illusory Decoy', weight: 1 }] },
      { label: 'Tinker Gnome',    weight: 3, element: 'Arcane', grade: 'A', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Invention Burst', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Overclock Mind', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Blueprint Vision', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Innovation Instinct', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Prototype Reflex', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Spark of Genius', weight: 1, element: 'Lightning', grade: 'A' }], powerPool: [{ label: 'Gadget Deploy', weight: 3 }, { label: 'Arcane Infusion', weight: 3 }, { label: 'Tinkered Familiar', weight: 2 }, { label: 'Arcane Barrage', weight: 2 }, { label: 'Counterspell', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "2'8\"", weight: 1 }, { label: "2'9\"",  weight: 2 }, { label: "2'10\"", weight: 3 },
      { label: "2'11\"", weight: 4 }, { label: "3'0\"",  weight: 5 }, { label: "3'1\"",  weight: 5 },
      { label: "3'2\"",  weight: 4 }, { label: "3'3\"",  weight: 3 }, { label: "3'4\"",  weight: 2 },
      { label: "3'5\"",  weight: 1 }, { label: "3'6\"",  weight: 1 },
      { label: 'Technically a Tallish Mushroom', weight: 1 },
    ],
    abilities: [
      { label: "Tinker's Touch", weight: 3 },
      { label: 'Illusion Weaving', weight: 2, element: 'Psychic', grade: 'A' },
      { label: "Gadgeteer's Expertise", weight: 3 },
      { label: 'Gnomish Cunning', weight: 3, element: 'Arcane', grade: 'A' },
      { label: 'Arcane Anchoring', weight: 2, element: 'Arcane', grade: 'A' },
      { label: 'Magic Resistance', weight: 1, element: 'Arcane', grade: 'A' },
      { label: 'Clockwork Familiar', weight: 2, element: 'Arcane', grade: 'A' },
      { label: 'Pocket Dimension (Regulation Size)', weight: 1, element: 'Arcane', grade: 'A' },
    ],
  },
  {
    label: 'Robot',
    spinIdentity: ['HighVariance', 'Scaling'],
    limitBreakOdds: 36,
    weight: 12,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 1.5,
    weaknessCount: 2,
    description: 'A mechanical construct operating in a biological world. Entirely unimpressed by your organic limitations.',
    injectedWheels: [
      { id: 'core', displayName: 'Core', order: 1, segments: [
        { label: 'Combat Core', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Built for war. Optimised for kill chains.' },
        { label: 'Defense Core', weight: 4, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Mobile fortress configuration.' },
        { label: 'Logic Core', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, description: 'Strategy engine. Computes ten steps ahead.' },
        { label: 'Stealth Core', weight: 3, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'Silent runners. Cold operation.' },
        { label: 'Experimental Core', weight: 1, statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus', durability: 'statPenalty' }, description: 'Field test. Untested. Glowing.' },
      ]},
      { id: 'module', displayName: 'Module', order: 2, segments: [
        { label: 'Standard Loadout', weight: 5, description: 'Factory default. Reliable, unremarkable.' },
        { label: 'Plasma Arm', weight: 4, statBonusGrants: { powerMastery: 'statBonus' }, description: 'Vents heat between shots.' },
        { label: 'Reinforced Plating', weight: 4, statBonusGrants: { armorStrength: 'statBonus' }, description: 'Extra weight, extra survival.' },
        { label: 'Sensor Array', weight: 3, statBonusGrants: { iq: 'statBonus', agility: 'statBonus' }, description: 'Sees the battlefield as data.' },
        { label: 'Glitched Module', weight: 1, statBonusGrants: { powerMastery: 'statBonus', iq: 'statPenalty' }, description: 'Behaviour inconsistent. Output high.' },
      ]},
    ],
    statModifiers: { durability: 1.3, iq: 1.2, charisma: 0.4, agility: 0.7 },
    subTypePool: [
      { label: 'Utility Unit', weight: 3, element: 'Metal', grade: 'D', abilities: [{ label: 'Precision Tools', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Task Efficiency', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Mechanical Endurance', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Data Storage', weight: 2, element: 'Time', grade: 'D' }, { label: 'Error Logging', weight: 1, element: 'Metal', grade: 'D' }] },
      { label: 'Combat Unit', weight: 3, element: 'Metal', grade: 'D', abilities: [{ label: 'Targeting System', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Armor Plating', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Weapon Integration', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Threat Assessment', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Suppressive Fire Protocol', weight: 1, element: 'Fire', grade: 'D' }] },
      { label: 'Service Unit', weight: 2, element: 'Neutral', grade: 'D', abilities: [{ label: 'Social Protocol', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Language Module', weight: 2, element: 'Time', grade: 'D' }, { label: 'Hospitality Subroutine', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Polite Decline', weight: 1, element: 'Neutral', grade: 'D' }, { label: 'Customer Satisfaction Loop', weight: 1, element: 'Neutral', grade: 'D' }] },
      { label: 'Research Unit', weight: 1, element: 'Arcane', grade: 'D', abilities: [{ label: 'Data Analysis', weight: 2, element: 'Arcane', grade: 'D' }, { label: 'Hypothesis Engine', weight: 2, element: 'Arcane', grade: 'D' }, { label: 'Pattern Recognition', weight: 2, element: 'Arcane', grade: 'D' }, { label: 'Recursive Learning', weight: 2, element: 'Arcane', grade: 'D' }, { label: 'Experiment Protocol', weight: 1, element: 'Arcane', grade: 'D' }] },
      // 10% chance: Sentient unit — splices a bonus spin on EVERY stat + grants godly power
      { label: 'SENTIENT — Awakened Consciousness (1-in-10)',
        weight: 1,
        element: 'Cosmic',
        grade: 'SSS',
        statBonusGrants: { strength: 'statBonus', speed: 'statBonus', agility: 'statBonus', durability: 'statBonus', iq: 'statBonus', charisma: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', weaponMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' },
        powerPool: [
          { label: 'Digital Omniscience', weight: 3 },
          { label: 'Reality Calculation Engine', weight: 3 },
          { label: 'Probability Override', weight: 2 },
          { label: 'Infinite Processing Array', weight: 2 },
          { label: 'Machine God Protocol', weight: 1 },
        ],
        abilities: [{ label: 'True Sentience', weight: 1, element: 'Cosmic', grade: 'SSS' }, { label: 'Emotional Core Online', weight: 2, element: 'Cosmic', grade: 'SSS' }, { label: 'Infinite Processing', weight: 2, element: 'Cosmic', grade: 'SSS' }, { label: 'Self-Determined', weight: 2, element: 'Cosmic', grade: 'SSS' }, { label: 'Soul in the Machine', weight: 2, element: 'Soul', grade: 'SSS' }],
      },
    ],
    customHeightPool: [
      { label: "5'0\" (Compact Unit)", weight: 2 }, { label: "5'6\"", weight: 4 }, { label: "6'0\"", weight: 5 },
      { label: "6'4\"", weight: 4 }, { label: "6'8\"", weight: 3 }, { label: "7'0\"", weight: 3 },
      { label: "7'6\" (Heavy Unit)", weight: 2 }, { label: "8'0\" (Siege Frame)", weight: 1 },
    ],

    customGenderPool: [
      { label: 'Genderless (Unit)', weight: 4 }, { label: 'Male-Presenting', weight: 2 }, { label: 'Female-Presenting', weight: 2 },
    ],

    abilities: [
      { label: 'Internal Clock (Never Late)', weight: 3, element: 'Cosmic', grade: 'SSS' },
      { label: 'Battery Operated (Recharge Required)', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Error 404: Empathy Not Found', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Mechanical Fortitude', weight: 3, element: 'Cosmic', grade: 'SSS' },
      { label: 'Overclock (Risky)', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Self-Repair Protocol (Slow)', weight: 1, element: 'Time', grade: 'SSS' },
      { label: 'Built-In Threat Scanner', weight: 1, element: 'Cosmic', grade: 'SSS' },
    ],
  },

  // ── Uncommon / Tier 2 (weight 14–22, F tier locked → minStatTier E-) ──
  {
    label: 'Elf',
    spinIdentity: ['FateManipulator'],
    limitBreakOdds: 28,
    weight: 10,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 0.8,
    minStatTier: 'E-',
    description: 'Ancient, graceful, and quietly judgemental.',
    injectedWheels: [
      { id: 'blessing', displayName: 'Blessing', order: 1, segments: [
        { label: "Forest's Favour", weight: 5, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'Trees know them. Move with.' },
        { label: 'Moonlit Path', weight: 4, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Walks where moonlight can find them.' },
        { label: 'Wild Hunt Mark', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', speed: 'statBonus' }, description: 'Marked for the hunt. Always returning.' },
        { label: 'Star Blessed', weight: 2, statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'One stat reaches cosmic minimum.' },
        { label: 'Ancient Bargain', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', durability: 'statPenalty' }, description: 'Older than the trees. Older than them.' },
      ]},
      { id: 'moonPhase', displayName: 'Moon Phase', order: 2, segments: [
        { label: 'New Moon', weight: 3, statBonusGrants: { agility: 'statBonus' }, description: 'Unseen. Movements quieter.' },
        { label: 'Waxing', weight: 3, statBonusGrants: { potential: 'statBonus' }, description: 'Growing into something.' },
        { label: 'Half Moon', weight: 4, description: 'Balanced. Even.' },
        { label: 'Waning', weight: 3, statBonusGrants: { iq: 'statBonus' }, description: 'Letting go of something.' },
        { label: 'Full Moon', weight: 2, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Power floods. The elf glows.' },
      ]},
    ],
    statModifiers: { speed: 1.4, agility: 1.4, charisma: 1.2, durability: 0.8 },
    subTypePool: [
      { label: 'High Elf',  weight: 4, element: 'Arcane', grade: 'B', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Arcane Affinity', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Ancient Spellcraft', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Trance Memory', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Mana Attunement', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Elven Spell Precision', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Ley Sense', weight: 1, element: 'Arcane', grade: 'B' }], powerPool: [{ label: 'Arcane Mastery', weight: 3 }, { label: 'Arcane Barrage', weight: 3 }, { label: 'Counterspell', weight: 2 }, { label: 'Elven Star Shot', weight: 2 }, { label: 'Moonwell Draw', weight: 1 }] },
      { label: 'Wood Elf',  weight: 5, element: 'Nature', grade: 'D', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Fleet Foot', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Woodland Camouflage', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Mask of the Wild', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Natural Stride', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Forest Sight', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Beast Kin', weight: 1, element: 'Nature', grade: 'D' }], powerPool: [{ label: 'Forest Meld', weight: 3 }, { label: 'Beast Bond', weight: 3 }, { label: "Nature's Grasp", weight: 2 }, { label: 'Terrain Mastery', weight: 2 }, { label: 'Predator Stance', weight: 1 }] },
      { label: 'Drow',      weight: 3, element: 'Shadow', grade: 'B', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Sunblind Awareness', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Drow Magic Innate', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Spider Silk Sense', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Darkness Master', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Underground Expert', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Faerie Fire Touch', weight: 1, element: 'Fire', grade: 'B' }], powerPool: [{ label: 'Faerie Fire Curse', weight: 3 }, { label: 'Web Entangle', weight: 3 }, { label: 'Shadow Veil', weight: 2 }, { label: 'Darkness Veil', weight: 2 }, { label: 'Devil Sight', weight: 1 }] },
      { label: 'Sea Elf',   weight: 3, element: 'Water', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Aquatic Adaptation', weight: 2, element: 'Water', grade: 'C' }, { label: 'Tidal Awareness', weight: 2, element: 'Water', grade: 'C' }, { label: 'Pressure Immunity', weight: 2, element: 'Gravity', grade: 'C' }, { label: 'Aqua Communication', weight: 2, element: 'Water', grade: 'C' }, { label: 'Underwater Speed', weight: 2, element: 'Water', grade: 'C' }, { label: 'Brine Touch', weight: 1, element: 'Water', grade: 'C' }], powerPool: [{ label: 'Hydrokinesis', weight: 3 }, { label: 'Moonwell Draw', weight: 3 }, { label: 'Aqua Form', weight: 2 }, { label: 'Tidal Burst', weight: 2 }, { label: 'Elven Star Shot', weight: 1 }] },
      { label: 'Eladrin',   weight: 2, element: 'Chaos', grade: 'S', statBonusGrants: { potential: 'statBonus' }, abilities: [{ label: 'Seasonal Shift', weight: 2, element: 'Water', grade: 'S' }, { label: 'Fey Step Mastery', weight: 2, element: 'Chaos', grade: 'C' }, { label: 'Enchantment Affinity', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Emotion Reading', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Feywild Sight', weight: 2, element: 'Nature', grade: 'S' }, { label: 'Seasonal Blessing', weight: 1, element: 'Water', grade: 'S' }], powerPool: [{ label: 'Teleportation', weight: 3 }, { label: 'Moonwell Draw', weight: 3 }, { label: 'Elven Star Shot', weight: 2 }, { label: 'Arcane Mastery', weight: 2 }, { label: 'Reality Warping', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'6\"", weight: 2 }, { label: "5'8\"", weight: 4 }, { label: "5'10\"", weight: 6 },
      { label: "6'0\"", weight: 7 }, { label: "6'2\"", weight: 7 }, { label: "6'4\"", weight: 5 },
      { label: "6'6\"", weight: 3 }, { label: "6'8\"", weight: 1 },
    ],

    abilities: [
      { label: 'Arrow of the Ancient Forest', weight: 2, element: 'Nature', grade: 'S' },
      { label: 'Fey Step', weight: 2, element: 'Chaos', grade: 'S' },
      { label: 'Trance Meditation', weight: 2, element: 'Chaos', grade: 'S' },
      { label: 'Forest Sight', weight: 2, element: 'Nature', grade: 'S' },
      { label: 'Elven Accuracy', weight: 2, element: 'Chaos', grade: 'S' },
      { label: 'Ancient Memory', weight: 1, element: 'Chaos', grade: 'S' },
      { label: 'Nature Bond', weight: 2, element: 'Nature', grade: 'S' },
      { label: 'Timeless Agility', weight: 1, element: 'Chaos', grade: 'S' },
    ],
  },
  {
    label: 'Tiefling',
    spinIdentity: ['Corruption', 'Combo'],
    limitBreakOdds: 30,
    weight: 9,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.4,
    minStatTier: 'D-',
    description: 'Infernal heritage — great for intimidation, rough for job applications.',
    injectedWheels: [
      { id: 'contract', displayName: 'Infernal Contract', order: 1, segments: [
        { label: 'No Pact', weight: 5, description: 'The blood is enough.' },
        { label: 'Minor Pact', weight: 4, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' }, description: 'A small price. Small power.' },
        { label: 'Soul Power', weight: 3, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', durability: 'statPenalty' }, description: 'Trades vitality for power.' },
        { label: 'Blood Pact', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', potential: 'statPenalty' }, description: 'Sealed in red. Burns slowly.' },
        { label: 'Eternal Flame', weight: 1, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus', iq: 'statPenalty' }, description: 'Cannot be extinguished. Cannot be paid back.' },
      ]},
      { id: 'sin', displayName: 'Sin', order: 2, segments: [
        { label: 'Wrath', weight: 3, statBonusGrants: { strength: 'statBonus', charisma: 'statPenalty' }, description: 'Burns from inside.' },
        { label: 'Pride', weight: 3, statBonusGrants: { charisma: 'statBonus', fightingSkill: 'statBonus' }, description: 'Posture and presence.' },
        { label: 'Greed', weight: 3, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, description: 'Hoards advantages.' },
        { label: 'Envy', weight: 2, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', charisma: 'statPenalty' }, description: 'Takes what others have.' },
        { label: 'Lust', weight: 2, statBonusGrants: { charisma: 'statBonus', speed: 'statBonus' }, description: 'Pulls without asking.' },
        { label: 'Sloth', weight: 2, statBonusGrants: { durability: 'statBonus', potential: 'statBonus', speed: 'statPenalty' }, description: 'Patient. The longest game.' },
        { label: 'Gluttony', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', agility: 'statPenalty' }, description: 'Always hungry.' },
      ]},
    ],
    statModifiers: { charisma: 1.4, iq: 1.2 },
    subTypePool: [
      { label: 'Asmodeus Bloodline',      weight: 4, element: 'Fire', grade: 'B', abilities: [{ label: 'Hellfire Affinity', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Contract Sense', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Infernal Sight', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Devilish Charm', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Soul Read', weight: 2, element: 'Soul', grade: 'B' }, { label: 'Dark Pact', weight: 1, element: 'Shadow', grade: 'B' }], powerPool: [{ label: 'Hellfire Burst', weight: 3 }, { label: 'Infernal Contract', weight: 3 }, { label: 'Devil Sight', weight: 2 }, { label: 'Infernal Armor', weight: 2 }, { label: 'Darkness Veil', weight: 1 }] },
      { label: 'Zariel Bloodline',        weight: 3, element: 'Fire', grade: 'A', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Battle Blessing', weight: 2, element: 'Fire', grade: 'C' }, { label: 'War Angel Instinct', weight: 2, element: 'Fire', grade: 'C' }, { label: "Warrior's Rite", weight: 2 }, { label: 'Heavenly Fury', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Combat Aura', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Blade Bond', weight: 1, element: 'Fire', grade: 'A' }], powerPool: [{ label: 'Divine Smite', weight: 3 }, { label: 'Hellfire Burst', weight: 3 }, { label: 'Aura of Retribution', weight: 2 }, { label: 'Berserker Frenzy', weight: 2 }, { label: 'Infernal Armor', weight: 1 }] },
      { label: 'Glasya Bloodline',        weight: 3, element: 'Psychic', grade: 'A', abilities: [{ label: 'Silver Tongue Mastery', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Shape-Shift Instinct', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Illusion Touch', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Escape Artistry', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Charm Lock', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Disguise Sense', weight: 1, element: 'Psychic', grade: 'A' }], powerPool: [{ label: 'Trickster Gambit', weight: 3 }, { label: 'Invisibility', weight: 3 }, { label: 'Shadow Veil', weight: 2 }, { label: 'Darkness Veil', weight: 2 }, { label: 'Devil Sight', weight: 1 }] },
      { label: 'Mephistopheles Bloodline', weight: 2, element: 'Arcane', grade: 'S', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Arcane Bloodline', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Spell Amplification', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Ritual Mastery', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Magic Sensitivity', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Eldritch Heritage', weight: 2, element: 'Time', grade: 'S' }, { label: 'Power Focus', weight: 1, element: 'Arcane', grade: 'S' }], powerPool: [{ label: 'Arcane Torrent', weight: 3 }, { label: 'Arcane Barrage', weight: 3 }, { label: 'Counterspell', weight: 2 }, { label: 'Hellfire Burst', weight: 2 }, { label: 'Infernal Contract', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Mortally Touched',        weight: 5, element: 'Fire', grade: 'D', statBonus: 0.9 },
      { label: 'Infernal Awakening',      weight: 4, element: 'Fire', grade: 'C', statBonus: 1.1 },
      { label: "Devil's Claim Stirring",  weight: 3, element: 'Fire', grade: 'B', statBonus: 1.3 },
      { label: 'Hellborn Unleashed',      weight: 2, element: 'Fire', grade: 'A', statBonus: 1.6 },
      { label: 'True Fiend Ascendant',    weight: 1, element: 'Fire', grade: 'SS', statBonus: 2.0 },
    ],
    customHeightPool: [
      { label: "5'2\"", weight: 2 }, { label: "5'4\"", weight: 4 }, { label: "5'6\"", weight: 6 },
      { label: "5'8\"", weight: 7 }, { label: "5'10\"", weight: 7 }, { label: "6'0\"", weight: 5 },
      { label: "6'2\"", weight: 3 }, { label: "6'4\"", weight: 1 },
      { label: 'Horns Not Included in Height', weight: 1 },
    ],

    abilities: [
      { label: 'Hellfire Breath', weight: 2, element: 'Fire', grade: 'SS' },
      { label: 'Infernal Charm', weight: 2, element: 'Fire', grade: 'SS' },
      { label: 'Shadow Walk', weight: 2, element: 'Shadow', grade: 'SS' },
      { label: 'Darkvision', weight: 3, element: 'Shadow', grade: 'SS' },
      { label: 'Cursed Bloodline (Boon in Disguise)', weight: 1, element: 'Blood', grade: 'SS' },
      { label: 'Infernal Resilience', weight: 2, element: 'Fire', grade: 'SS' },
      { label: "Devil's Deal", weight: 1 },
    ],
  },
  {
    label: 'Dragonborn',
    spinIdentity: ['Evolution', 'Combo'],
    limitBreakOdds: 34,
    weight: 8,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.9,
    minStatTier: 'D-',
    description: 'Draconic bloodline, breath weapon included, no refunds.',
    injectedWheels: [
      { id: 'dragonAspect', displayName: 'Dragon Aspect', order: 1, segments: [
        { label: 'Common Blood', weight: 5, description: 'Dragon ancestor. Distant.' },
        { label: 'Infernal', weight: 3, statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus' }, description: 'Fire ancestor. Forged in heat.' },
        { label: 'Frost', weight: 3, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Ice ancestor. Patient ruin.' },
        { label: 'Storm', weight: 3, statBonusGrants: { speed: 'statBonus', energyLevel: 'statBonus' }, description: 'Storm ancestor. Lightning blood.' },
        { label: 'Void', weight: 2, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Void ancestor. Older than night.' },
        { label: 'Solar', weight: 1, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', charisma: 'statBonus' }, description: 'Sun ancestor. Walking dawn.' },
      ]},
      { id: 'breathEvolution', displayName: 'Breath Evolution', order: 2, segments: [
        { label: 'Single Breath', weight: 6, statBonusGrants: { powerMastery: 'statBonus' }, description: 'One element. Pure.' },
        { label: 'Refined Breath', weight: 4, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus' }, description: 'Aimed. Precise.' },
        { label: 'Dual Breath', weight: 3, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Two flavours. Twice the trouble.' },
        { label: 'Catastrophe', weight: 1, statBonusGrants: { powerMastery: 'statBonus', strength: 'statBonus', energyLevel: 'statBonus' }, description: 'Last-resort breath. Scorches a city.' },
      ]},
    ],
    statModifiers: { strength: 1.4, charisma: 1.3, durability: 1.2 },
    subTypePool: [
      { label: 'Red Dragonborn (Fire)',         weight: 3, element: 'Fire', grade: 'D', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Fire Resistance', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Thermal Vision', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Flame Affinity', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Smoke Immunity', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Char Touch', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Heat Sense', weight: 1, element: 'Fire', grade: 'D' }], grantedPowers: ['Fire Breath'] },
      { label: 'Blue Dragonborn (Lightning)',   weight: 3, element: 'Lightning', grade: 'D', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Static Field', weight: 2, element: 'Lightning', grade: 'D' }, { label: 'Thunder Immunity', weight: 2, element: 'Lightning', grade: 'D' }, { label: 'Storm Sense', weight: 2, element: 'Lightning', grade: 'D' }, { label: 'Electric Touch', weight: 2, element: 'Lightning', grade: 'D' }, { label: 'Charge Aura', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Storm Awareness', weight: 1, element: 'Lightning', grade: 'D' }], grantedPowers: ['Lightning Breath'] },
      { label: 'Green Dragonborn (Poison)',     weight: 2, element: 'Poison', grade: 'C', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Toxin Immunity', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Poison Sense', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Venom Blood', weight: 2, element: 'Blood', grade: 'C' }, { label: 'Plague Resistance', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Corrosive Aura', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Jungle Instinct', weight: 1, element: 'Poison', grade: 'C' }], grantedPowers: ['Poison Breath'] },
      { label: 'Black Dragonborn (Acid)',       weight: 2, element: 'Poison', grade: 'C', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Acid Immunity', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Corrosive Touch', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Decay Sense', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Swamp Adaptation', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Dissolution Aura', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Rust Sight', weight: 1, element: 'Poison', grade: 'C' }], grantedPowers: ['Acid Spray'] },
      { label: 'White Dragonborn (Ice)',        weight: 2, element: 'Ice', grade: 'D', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Cold Immunity', weight: 2, element: 'Ice', grade: 'D' }, { label: 'Arctic Adaptation', weight: 2, element: 'Ice', grade: 'D' }, { label: 'Blizzard Sense', weight: 2, element: 'Ice', grade: 'D' }, { label: 'Freeze Touch', weight: 2, element: 'Ice', grade: 'D' }, { label: 'Glacial Blood', weight: 2, element: 'Ice', grade: 'D' }, { label: 'Snow Tracking', weight: 1, element: 'Ice', grade: 'D' }], grantedPowers: ['Frost Breath'] },
      { label: 'Gold Dragonborn (Fire)',        weight: 1, element: 'Fire', grade: 'A', abilities: [{ label: 'Sunfire Affinity', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Sacred Flame Resistance', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Light Body', weight: 2, element: 'Light', grade: 'A' }, { label: 'Holy Warmth', weight: 2, element: 'Light', grade: 'A' }, { label: 'Honorable Bearing', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Solar Sense', weight: 1, element: 'Fire', grade: 'A' }], grantedPowers: ['Fire Breath', 'Sunfire Aura'] },
      { label: 'Silver Dragonborn (Ice)',       weight: 1, element: 'Ice', grade: 'A', abilities: [{ label: 'Moon Ice Affinity', weight: 2, element: 'Ice', grade: 'A' }, { label: 'Celestial Cold', weight: 2, element: 'Ice', grade: 'A' }, { label: 'Sacred Resistance', weight: 2, element: 'Light', grade: 'A' }, { label: 'Truth Sense', weight: 2, element: 'Ice', grade: 'A' }, { label: 'Silvery Aura', weight: 2, element: 'Ice', grade: 'C' }, { label: 'Mist Walk', weight: 1, element: 'Water', grade: 'A' }], grantedPowers: ['Frost Breath', 'Blizzard Call'] },
      { label: 'Bronze Dragonborn (Lightning)', weight: 1, element: 'Lightning', grade: 'A', abilities: [{ label: 'Storm Bond', weight: 2, element: 'Lightning', grade: 'A' }, { label: 'Thunder Voice', weight: 2, element: 'Ice', grade: 'A' }, { label: 'Lightning Immunity', weight: 2, element: 'Lightning', grade: 'A' }, { label: 'Maritime Affinity', weight: 2, element: 'Lightning', grade: 'A' }, { label: 'Current Sense', weight: 2, element: 'Lightning', grade: 'A' }, { label: 'Sea Storm Adaptation', weight: 1, element: 'Lightning', grade: 'A' }], grantedPowers: ['Lightning Breath', 'Thunder Clap'] },
    ],
    customHeightPool: [
      { label: "6'0\"", weight: 2 }, { label: "6'2\"", weight: 4 }, { label: "6'4\"", weight: 6 },
      { label: "6'6\"", weight: 7 }, { label: "6'8\"", weight: 6 }, { label: "6'10\"", weight: 4 },
      { label: "7'0\"", weight: 3 }, { label: "7'2\"", weight: 2 }, { label: "7'4\"", weight: 1 },
    ],

    abilities: [
      { label: "Dragon's Breath", weight: 2 },
      { label: 'Scale Armor', weight: 2, element: 'Lightning', grade: 'A' },
      { label: "Dragon's Gaze", weight: 2 },
      { label: 'Draconic Roar', weight: 2, element: 'Sound', grade: 'A' },
      { label: 'Chromatic Resistance', weight: 2, element: 'Lightning', grade: 'A' },
      { label: 'Ancient Blood Surge', weight: 1, element: 'Blood', grade: 'A' },
      { label: 'Dragon Fear', weight: 1, element: 'Psychic', grade: 'A' },
    ],
  },
  {
    label: 'Aasimar',
    spinIdentity: ['FateManipulator'],
    limitBreakOdds: 34,
    weight: 8,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.6,
    minStatTier: 'D-',
    description: 'Touched by the divine. Painfully aware of it.',
    injectedWheels: [
      { id: 'halo', displayName: 'Halo', order: 1, segments: [
        { label: 'Hidden', weight: 5, description: 'Mortals do not see the light.' },
        { label: 'Subtle Glow', weight: 4, statBonusGrants: { charisma: 'statBonus' }, description: 'A warmth. A familiarity.' },
        { label: 'Radiant', weight: 3, statBonusGrants: { charisma: 'statBonus', potential: 'statBonus' }, description: 'Light visible at distance. Pursued by faith.' },
        { label: 'Burning Halo', weight: 2, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Holy flame. Marks them.' },
        { label: 'Divine Mercy', weight: 1, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' }, description: 'One terrible roll is rerolled automatically.' },
      ]},
      { id: 'blessing', displayName: 'Blessing', order: 2, segments: [
        { label: 'Healing Hands', weight: 4, statBonusGrants: { potential: 'statBonus', durability: 'statBonus' }, description: 'Wounds close. Slowly.' },
        { label: 'Guardian Word', weight: 4, statBonusGrants: { charisma: 'statBonus', durability: 'statBonus' }, description: 'Allies feel safer near you.' },
        { label: 'Lawbringer', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', iq: 'statBonus' }, description: 'Wrongs against you correct themselves.' },
        { label: 'Light-bearer', weight: 2, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Bring light into dark places. Visibly.' },
        { label: 'Sacred Vow', weight: 1, statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Vows you cannot break, but you do not want to.' },
      ]},
    ],
    statModifiers: { charisma: 1.5, potential: 1.3, fightingSkill: 1.2 },
    subTypePool: [
      { label: 'Protector Aasimar', weight: 4, element: 'Light', grade: 'D', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Radiant Healing Touch', weight: 2, element: 'Light', grade: 'D' }, { label: 'Guardian Wings (Minor)', weight: 2, element: 'Light', grade: 'D' }, { label: 'Holy Barrier', weight: 2, element: 'Light', grade: 'D' }, { label: 'Light of Dawn', weight: 2, element: 'Light', grade: 'D' }, { label: 'Empathic Healing', weight: 2, element: 'Light', grade: 'D' }, { label: 'Celestial Shield', weight: 1, element: 'Light', grade: 'C' }], powerPool: [{ label: 'Radiant Soul', weight: 3 }, { label: 'Angelic Wings', weight: 3 }, { label: 'Sacred Heal', weight: 2 }, { label: 'Courage Aura', weight: 2 }, { label: 'Aura of Retribution', weight: 1 }] },
      { label: 'Scourge Aasimar',   weight: 3, element: 'Light', grade: 'A', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Radiant Detonation', weight: 2, element: 'Light', grade: 'A' }, { label: 'Channel Holy Wrath', weight: 2, element: 'Light', grade: 'A' }, { label: 'Searing Burst', weight: 2, element: 'Water', grade: 'A' }, { label: 'Pain Endurance', weight: 2, element: 'Light', grade: 'C' }, { label: 'Consecrated Rage', weight: 2, element: 'Light', grade: 'A' }, { label: 'Scourge Mark', weight: 1, element: 'Light', grade: 'A' }], powerPool: [{ label: 'Scourge Burst', weight: 3 }, { label: 'Radiant Soul', weight: 3 }, { label: 'Radiant Strike', weight: 2 }, { label: 'Channel Divinity', weight: 2 }, { label: 'Consecrated Ground', weight: 1 }] },
      { label: 'Fallen Aasimar',    weight: 2, element: 'Shadow', grade: 'A', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Necrotic Shroud', weight: 2, element: 'Soul', grade: 'A' }, { label: 'Fear Aura (Passive)', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Dark Resilience', weight: 2, element: 'Shadow', grade: 'A' }, { label: 'Fallen Grasp', weight: 2, element: 'Shadow', grade: 'A' }, { label: 'Shadow Corruption Aura', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Hellish Rebuke', weight: 1, element: 'Shadow', grade: 'A' }], powerPool: [{ label: 'Fallen Angel Strike', weight: 3 }, { label: 'Darkness Veil', weight: 3 }, { label: 'Fear Projection', weight: 2 }, { label: 'Shadow Veil', weight: 2 }, { label: 'Soul Absorption', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Quietly Blessed',       weight: 5, element: 'Light', grade: 'D', statBonus: 1.0 },
      { label: 'Divine Spark Active',   weight: 4, element: 'Light', grade: 'C', statBonus: 1.2 },
      { label: 'Heavenly Vessel',       weight: 3, element: 'Light', grade: 'B', statBonus: 1.5 },
      { label: 'Radiant Champion',      weight: 2, element: 'Light', grade: 'A', statBonus: 1.8 },
      { label: 'Celestial Avatar',      weight: 1, element: 'Light', grade: 'SS', statBonus: 2.2, statBonusGrants: { charisma: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'6\"", weight: 2 }, { label: "5'8\"", weight: 4 }, { label: "5'10\"", weight: 6 },
      { label: "6'0\"", weight: 7 }, { label: "6'2\"", weight: 6 }, { label: "6'4\"", weight: 4 },
      { label: "6'6\"", weight: 2 }, { label: '(Halo Radiates Upward)', weight: 1 },
    ],

    abilities: [
      { label: 'Celestial Radiance', weight: 2, element: 'Light', grade: 'SS' },
      { label: 'Healing Touch', weight: 2, element: 'Light', grade: 'SS' },
      { label: 'Divine Resistance', weight: 2, element: 'Light', grade: 'SS' },
      { label: 'Holy Smite', weight: 2, element: 'Light', grade: 'SS' },
      { label: 'Purifying Aura', weight: 1, element: 'Light', grade: 'C' },
      { label: 'Radiant Soul', weight: 1, element: 'Light', grade: 'SS' },
      { label: 'Heavenly Intervention', weight: 1, element: 'Light', grade: 'SS' },
    ],
  },
  {
    label: 'Lizardfolk',
    spinIdentity: ['Evolution', 'Scaling'],
    limitBreakOdds: 30,
    weight: 9,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 1.0,
    minStatTier: 'E-',
    description: 'Cold-blooded in every sense of the phrase.',
    injectedWheels: [
      { id: 'instinct', displayName: 'Instinct', order: 1, segments: [
        { label: 'Watchful', weight: 5, statBonusGrants: { iq: 'statBonus', agility: 'statBonus' }, description: 'Reads the room before anyone speaks.' },
        { label: 'Patient', weight: 4, statBonusGrants: { durability: 'statBonus', potential: 'statBonus' }, description: 'Waits. The water comes back.' },
        { label: 'Hunter', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', speed: 'statBonus' }, description: 'Tracks. Pounces.' },
        { label: 'Cold', weight: 3, statBonusGrants: { durability: 'statBonus', charisma: 'statPenalty' }, description: 'Reads emotion only as data.' },
        { label: 'Apex', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' }, description: 'Top of the food chain.' },
      ]},
      { id: 'evolution', displayName: 'Evolution', order: 2, segments: [
        { label: 'Scaled', weight: 5, statBonusGrants: { armorStrength: 'statBonus' }, description: 'Natural plate. Heavy.' },
        { label: 'Venom Glands', weight: 3, statBonusGrants: { powerMastery: 'statBonus' }, description: 'A bite is now a problem.' },
        { label: 'Regeneration', weight: 3, statBonusGrants: { durability: 'statBonus', potential: 'statBonus' }, description: 'Limbs return. Slowly.' },
        { label: 'Camouflage', weight: 2, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'Always somewhere else.' },
        { label: 'Apex Mutation', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus' }, description: 'Something the species has never been.' },
      ]},
    ],
    statModifiers: { durability: 1.4, strength: 1.2 },
    subTypePool: [
      { label: 'Komodo Lizardfolk', weight: 2, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus' } },
      { label: 'Gecko Lizardfolk', weight: 3, element: 'Nature', grade: 'C', statBonusGrants: { agility: 'statBonus' } },
      { label: 'Chameleon Lizardfolk', weight: 2, element: 'Shadow', grade: 'C', statBonusGrants: { agility: 'statBonus', speed: 'statBonus' } },
      { label: 'Basilisk Lizardfolk', weight: 1, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      { label: 'Crocodilian Lizardfolk', weight: 2, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus' } },
      { label: 'Sea Serpent Lizardfolk', weight: 1, element: 'Water', grade: 'C', statBonusGrants: { agility: 'statBonus' } },
      { label: 'Frilled Dragon Lizardfolk', weight: 2, element: 'Nature', grade: 'C', statBonusGrants: { strength: 'statBonus' } },
      { label: 'Skink Lizardfolk', weight: 3, element: 'Nature', grade: 'C', statBonusGrants: { speed: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'8\"", weight: 3 }, { label: "6'0\"", weight: 5 }, { label: "6'2\"", weight: 6 },
      { label: "6'4\"", weight: 6 }, { label: "6'6\"", weight: 5 }, { label: "6'8\"", weight: 4 },
      { label: "7'0\"", weight: 2 }, { label: "7'4\" (Tail Counted)", weight: 1 },
    ],

    abilities: [
      { label: 'Natural Armor', weight: 3, element: 'Nature', grade: 'C' },
      { label: 'Bite Attack', weight: 3, element: 'Nature', grade: 'C' },
      { label: 'Hold Breath', weight: 2, element: 'Nature', grade: 'C' },
      { label: 'Cold-Blooded Calm', weight: 2, element: 'Ice', grade: 'C' },
      { label: 'Tail Sweep', weight: 2, element: 'Nature', grade: 'C' },
      { label: 'Slow Regeneration', weight: 1, element: 'Time', grade: 'C' },
      { label: 'Reptilian Focus', weight: 2, element: 'Nature', grade: 'C' },
    ],
  },
  {
    label: 'Tabaxi',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 30,
    weight: 9,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 1.0,
    minStatTier: 'E-',
    description: 'Cat person. Speedrunner. Easily distracted by shiny objects.',
    injectedWheels: [
      { id: 'hunt', displayName: 'Hunt', order: 1, segments: [
        { label: 'Stalker', weight: 5, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'Approaches without sound.' },
        { label: 'Pouncer', weight: 4, statBonusGrants: { speed: 'statBonus', fightingSkill: 'statBonus' }, description: 'All energy at the strike.' },
        { label: 'Acrobat', weight: 3, statBonusGrants: { agility: 'statBonus', potential: 'statBonus' }, description: 'Three storeys, no harm.' },
        { label: 'Night Cat', weight: 2, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', iq: 'statBonus' }, description: 'Sees in the dark you fear.' },
        { label: 'Apex Hunter', weight: 1, statBonusGrants: { speed: 'statBonus', agility: 'statBonus', fightingSkill: 'statBonus' }, description: 'No prey escapes twice.' },
      ]},
      { id: 'reflex', displayName: 'Reflex', order: 2, segments: [
        { label: 'Quick', weight: 5, statBonusGrants: { speed: 'statBonus' }, description: 'First to react.' },
        { label: 'Counter-Sense', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus' }, description: 'Reads strikes before they land.' },
        { label: 'Combo Chain', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', speed: 'statBonus' }, description: 'Three hits where most see one.' },
        { label: 'Dodge Master', weight: 2, statBonusGrants: { agility: 'statBonus', potential: 'statBonus' }, description: 'Cannot be cornered.' },
        { label: 'Time Slip', weight: 1, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', potential: 'statBonus' }, description: 'Moves through the moment, not past it.' },
      ]},
    ],
    statModifiers: { speed: 1.6, agility: 1.5, strength: 0.8 },
    classPool: [
      { label: 'Hunter',         weight: 4, element: 'Nature', grade: 'D', statBonusGrants: { speed: 'statBonus' }, abilities: [{ label: 'Track by Scent', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Kill Zone Awareness', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Ambush Trigger', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Prey Memory', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Sprint Burst Activation', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Pounce Calculation', weight: 1, element: 'Nature', grade: 'D' }], powerPool: [{ label: 'Pounce Strike', weight: 3 }, { label: "Hunter's Mark", weight: 3 }, { label: 'Predator Stance', weight: 2 }, { label: 'Beast Bond', weight: 2 }, { label: 'Terrain Mastery', weight: 1 }] },
      { label: 'Shadow Dancer',  weight: 3, element: 'Shadow', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Darkness Melding', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Silent Landing', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Blur Form', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Umbral Step', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Shadow Disguise', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Void Pounce', weight: 1, element: 'Void', grade: 'C' }], powerPool: [{ label: 'Shadow Stalk', weight: 3 }, { label: 'Acrobatic Assault', weight: 3 }, { label: 'Vanishing Act', weight: 2 }, { label: 'Shadow Step', weight: 2 }, { label: 'Pounce Strike', weight: 1 }] },
      { label: 'Arcane Stalker', weight: 2, element: 'Arcane', grade: 'A', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Mana Scent', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Arcane Silence', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Spell Disruption', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Magic Trace Detection', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Arcane Camouflage', weight: 2, element: 'Shadow', grade: 'A' }, { label: 'Spellbane Pounce', weight: 1, element: 'Arcane', grade: 'A' }], powerPool: [{ label: 'Arcane Infusion', weight: 3 }, { label: 'Shadow Stalk', weight: 3 }, { label: 'Illusory Decoy', weight: 2 }, { label: 'Predator Stance', weight: 2 }, { label: 'Pounce Strike', weight: 1 }] },
      { label: 'Treasure Seeker', weight: 3, element: 'Chaos', grade: 'B', abilities: [{ label: 'Relic Sense', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Trap Immunity (Experienced)', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Appraisal Touch', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Lucky Find', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Danger Premonition', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Treasure Map Divination', weight: 1, element: 'Chaos', grade: 'B' }], powerPool: [{ label: 'Trickster Gambit', weight: 3 }, { label: 'Acrobatic Assault', weight: 3 }, { label: 'Terrain Mastery', weight: 2 }, { label: 'Probability Manipulation', weight: 2 }, { label: 'Perfect Bluff', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'8\"", weight: 3 }, { label: "5'10\"", weight: 5 }, { label: "6'0\"", weight: 6 },
      { label: "6'2\"", weight: 6 }, { label: "6'4\"", weight: 5 }, { label: "6'6\"", weight: 4 },
      { label: "6'8\"", weight: 2 }, { label: "7'0\"", weight: 1 },
      { label: '(Tail Not Included)', weight: 1 },
    ],

    abilities: [
      { label: "Cat's Claws", weight: 3 },
      { label: 'Feline Grace', weight: 2, element: 'Chaos', grade: 'B' },
      { label: 'Curiosity Surge', weight: 2, element: 'Chaos', grade: 'B' },
      { label: 'Landing on All Fours', weight: 3, element: 'Chaos', grade: 'B' },
      { label: "Predator's Pounce", weight: 2 },
      { label: 'Night Vision', weight: 2, element: 'Shadow', grade: 'B' },
      { label: 'Sprinting Burst', weight: 2, element: 'Chaos', grade: 'B' },
      { label: 'Purring (Diplomatically)', weight: 1, element: 'Chaos', grade: 'B' },
    ],
  },
  {
    label: 'Goliath',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 32,
    weight: 8,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 0.8,
    minStatTier: 'D',
    description: 'Literal mountain people. The mountain says no.',
    injectedWheels: [
      { id: 'colossus', displayName: 'Colossus', order: 1, segments: [
        { label: 'Tall', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Above most rooms.' },
        { label: 'Mountain', weight: 4, statBonusGrants: { strength: 'statBonus', armorStrength: 'statBonus' }, description: 'Stands like terrain.' },
        { label: 'Earthshaker', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Each step is a tremor.' },
        { label: 'Titan-Born', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Lineage of the old giants.' },
        { label: 'Living Peak', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', potential: 'statBonus' }, description: 'There is no taller mountain than this one.' },
      ]},
      { id: 'endurance', displayName: 'Endurance', order: 2, segments: [
        { label: 'Hardy', weight: 5, statBonusGrants: { durability: 'statBonus' }, description: 'Long days.' },
        { label: 'Stoneskin', weight: 4, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Wounds slow.' },
        { label: 'Marathon', weight: 3, statBonusGrants: { durability: 'statBonus', energyLevel: 'statBonus' }, description: 'Never tires.' },
        { label: 'Pain-Tolerant', weight: 2, statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Smiles through it.' },
        { label: 'Immovable', weight: 1, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus', strength: 'statBonus' }, description: 'The wind goes around them.' },
      ]},
    ],
    statModifiers: { strength: 1.6, durability: 1.5, armorStrength: 1.35, speed: 0.7, agility: 0.7 },
    classPool: [
      { label: 'Stone Guardian',    weight: 4, element: 'Earth', grade: 'C', abilities: [{ label: 'Boulder Stance', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Fortified Position', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Immovable Defense', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Ground Bind', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Shielding Aura', weight: 2, element: 'Earth', grade: 'C' }, { label: "Mountain's Will", weight: 1 }], powerPool: [{ label: 'Stone Endurance', weight: 3 }, { label: 'Crystal Armor', weight: 3 }, { label: 'Mountain Crash', weight: 2 }, { label: 'Stone Call', weight: 2 }, { label: 'Tremor Sense', weight: 1 }] },
      { label: 'Mountain Barbarian', weight: 4, element: 'Earth', grade: 'C', abilities: [{ label: 'Avalanche Charge', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Elevation Combat', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Raw Power Channel', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Pain Absorption', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Rage Onset', weight: 2, element: 'Time', grade: 'C' }, { label: "Cliff's Edge Reflexes", weight: 1 }], powerPool: [{ label: 'Berserker Frenzy', weight: 3 }, { label: 'Mountain Crash', weight: 3 }, { label: 'Titan Grip', weight: 2 }, { label: 'Indomitable Rage', weight: 2 }, { label: 'Reckless Attack', weight: 1 }] },
      { label: 'Titan Wrestler',    weight: 3, element: 'Earth', grade: 'C', abilities: [{ label: 'Grip of Ages', weight: 2, element: 'Time', grade: 'C' }, { label: 'Leverage Mastery', weight: 2, element: 'Time', grade: 'C' }, { label: 'Body Lock', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Throw Range', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Counter-Grapple', weight: 2, element: 'Earth', grade: 'C' }, { label: "Titan's Squeeze", weight: 1 }], powerPool: [{ label: 'Titan Grip', weight: 3 }, { label: 'Mountain Crash', weight: 3 }, { label: 'Super Strength', weight: 2 }, { label: 'Stone Endurance', weight: 2 }, { label: 'Warrior Trance', weight: 1 }] },
      { label: 'Storm Herald',      weight: 2, element: 'Lightning', grade: 'A', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Weather Reading', weight: 2, element: 'Lightning', grade: 'A' }, { label: 'Thunder Step', weight: 2, element: 'Lightning', grade: 'A' }, { label: 'Lightning Attunement', weight: 2, element: 'Lightning', grade: 'A' }, { label: 'Storm Stance', weight: 2, element: 'Lightning', grade: 'A' }, { label: 'Static Aura', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Tempest Calling', weight: 1, element: 'Wind', grade: 'A' }], powerPool: [{ label: 'Storm Born', weight: 3 }, { label: 'Lightning Generation', weight: 3 }, { label: 'Storm Circle', weight: 2 }, { label: 'Storm Surge', weight: 2 }, { label: 'Thunder Clap', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "7'0\"",  weight: 3 }, { label: "7'2\"",  weight: 4 }, { label: "7'4\"",  weight: 5 },
      { label: "7'6\"",  weight: 5 }, { label: "7'8\"",  weight: 4 }, { label: "7'10\"", weight: 3 },
      { label: "8'0\"",  weight: 2 }, { label: "8'3\"",  weight: 2 }, { label: "8'6\"",  weight: 1 },
      { label: 'Geologically Significant', weight: 1 },
    ],
    abilities: [
      { label: "Stone's Endurance", weight: 3 },
      { label: 'Mountain Born', weight: 2, element: 'Earth', grade: 'A' },
      { label: 'Powerful Build', weight: 3, element: 'Lightning', grade: 'A' },
      { label: "Titan's Grip", weight: 2 },
      { label: 'Altitude Resistance', weight: 2, element: 'Lightning', grade: 'A' },
      { label: 'Glacial Endurance', weight: 1, element: 'Ice', grade: 'C' },
      { label: "Earth's Blessing", weight: 1 },
    ],
  },
  {
    label: 'Genasi (Fire)',
    spinIdentity: ['Combo'],
    limitBreakOdds: 32,
    weight: 7,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.1,
    minStatTier: 'D-',
    description: 'Born of elemental fire. Perpetually warm to the touch.',
    injectedWheels: [
      { id: 'inferno', displayName: 'Inferno', order: 1, segments: [
        { label: 'Ember', weight: 5, statBonusGrants: { energyLevel: 'statBonus' }, description: 'Always slightly warm. Steam in cold air.' },
        { label: 'Burning Aura', weight: 4, statBonusGrants: { powerMastery: 'statBonus' }, description: 'Things near them get hotter.' },
        { label: 'Pyroclasm', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, description: 'Explosive output.' },
        { label: 'Solar Heart', weight: 2, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'A sun in the chest.' },
        { label: 'Living Flame', weight: 1, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', fightingSkill: 'statBonus' }, description: 'Touches return as ash.' },
      ]},
    ],
    statModifiers: { energyLevel: 1.6, powerMastery: 1.3 },
    classPool: [
      { label: 'Flamecaller',  weight: 4, element: 'Fire', grade: 'C', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Ignition Control', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Fire Shape', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Heat Sense', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Smoke Immunity', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Ash Form', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Wildfire Instinct', weight: 1, element: 'Fire', grade: 'C' }], powerPool: [{ label: 'Pyrokinesis', weight: 3 }, { label: 'Fire Breath', weight: 3 }, { label: 'Cinder Surge', weight: 2 }, { label: 'Lava Control', weight: 2 }, { label: 'Lava Shield', weight: 1 }] },
      { label: 'Emberwarden',  weight: 3, element: 'Fire', grade: 'C', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Ember Shield', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Slow Burn', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Fire Suppression', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Heat Absorption', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Smoldering Core', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Cinder Armor', weight: 1, element: 'Fire', grade: 'C' }], powerPool: [{ label: 'Lava Shield', weight: 3 }, { label: 'Fire Breath', weight: 3 }, { label: 'Pyrokinesis', weight: 2 }, { label: 'Sunfire Aura', weight: 2 }, { label: 'Consecrated Ground', weight: 1 }] },
      { label: 'Magma Shaper', weight: 3, element: 'Fire', grade: 'B', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Lava Touch', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Rock Melt', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Tectonic Sense', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Earthen Heat', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Lava Pool', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Volcanic Barrier', weight: 1, element: 'Fire', grade: 'B' }], powerPool: [{ label: 'Lava Control', weight: 3 }, { label: 'Lava Shield', weight: 3 }, { label: 'Cinder Surge', weight: 2 }, { label: 'Fire Breath', weight: 2 }, { label: 'Tremor Sense', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'2\"", weight: 3 }, { label: "5'4\"", weight: 5 }, { label: "5'6\"", weight: 7 },
      { label: "5'8\"", weight: 7 }, { label: "5'10\"", weight: 6 }, { label: "6'0\"", weight: 4 },
      { label: "6'2\"", weight: 2 }, { label: "6'4\"", weight: 1 },
    ],

    abilities: [
      { label: 'Fire Immunity', weight: 2, element: 'Fire', grade: 'B' },
      { label: 'Flame Burst', weight: 2, element: 'Fire', grade: 'B' },
      { label: 'Cauterize', weight: 2, element: 'Fire', grade: 'B' },
      { label: 'Smoke Screen', weight: 2, element: 'Shadow', grade: 'B' },
      { label: 'Pyrokinetic Touch', weight: 2, element: 'Fire', grade: 'B' },
      { label: 'Burning Determination', weight: 2, element: 'Fire', grade: 'B' },
      { label: 'Ash Cloud', weight: 1, element: 'Fire', grade: 'B' },
    ],
  },
  {
    label: 'Genasi (Water)',
    spinIdentity: ['Combo', 'FateManipulator'],
    limitBreakOdds: 32,
    weight: 7,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 0.9,
    minStatTier: 'D-',
    description: 'Born of elemental water. Great swimmer. Bad hair day, always.',
    injectedWheels: [
      { id: 'tide', displayName: 'Tide', order: 1, segments: [
        { label: 'Calm Pool', weight: 5, statBonusGrants: { potential: 'statBonus', durability: 'statBonus' }, description: 'Patient. Deep.' },
        { label: 'River-Bent', weight: 4, statBonusGrants: { agility: 'statBonus', potential: 'statBonus' }, description: 'Flows around obstacles.' },
        { label: 'Healing Tide', weight: 3, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, description: 'Where they walk, wounds close.' },
        { label: 'Riptide', weight: 2, statBonusGrants: { strength: 'statBonus', potential: 'statBonus' }, description: 'Pulls everything down.' },
        { label: 'Ocean Heart', weight: 1, statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus', durability: 'statBonus' }, description: 'The deep listens to them.' },
      ]},
    ],
    statModifiers: { potential: 1.3, agility: 1.2 },
    classPool: [
      { label: 'Tidecaller',  weight: 4, element: 'Water', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Current Read', weight: 2, element: 'Water', grade: 'C' }, { label: 'Water Shaping', weight: 2, element: 'Water', grade: 'C' }, { label: 'Tide Sense', weight: 2, element: 'Water', grade: 'C' }, { label: 'Flow Control', weight: 2, element: 'Water', grade: 'C' }, { label: 'Aqua Whip', weight: 2, element: 'Water', grade: 'C' }, { label: 'Wave Mastery', weight: 1, element: 'Water', grade: 'C' }], powerPool: [{ label: 'Hydrokinesis', weight: 3 }, { label: 'Tidal Burst', weight: 3 }, { label: 'Aqua Form', weight: 2 }, { label: 'Cryokinesis', weight: 2 }, { label: 'Moonwell Draw', weight: 1 }] },
      { label: 'Frostweaver', weight: 3, element: 'Ice', grade: 'C', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Freeze Sense', weight: 2, element: 'Ice', grade: 'C' }, { label: 'Ice Formation', weight: 2, element: 'Ice', grade: 'D' }, { label: 'Cold Immunity', weight: 2, element: 'Ice', grade: 'C' }, { label: 'Frost Trail', weight: 2, element: 'Ice', grade: 'C' }, { label: 'Blizzard Conjure (Minor)', weight: 2, element: 'Ice', grade: 'C' }, { label: 'Permafrost Touch', weight: 1, element: 'Ice', grade: 'C' }], powerPool: [{ label: 'Cryokinesis', weight: 3 }, { label: 'Frost Breath', weight: 3 }, { label: 'Blizzard Call', weight: 2 }, { label: 'Aqua Form', weight: 2 }, { label: 'Hydrokinesis', weight: 1 }] },
      { label: 'Stormborn',   weight: 3, element: 'Lightning', grade: 'B', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Static Immunity', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Storm Sense', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Charge Buildup', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Lightning Rod', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Thunder Stride', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Eye of the Storm', weight: 1, element: 'Lightning', grade: 'B' }], powerPool: [{ label: 'Lightning Generation', weight: 3 }, { label: 'Storm Surge', weight: 3 }, { label: 'Hydrokinesis', weight: 2 }, { label: 'Thunder Clap', weight: 2 }, { label: 'Tidal Burst', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 3 }, { label: "5'2\"", weight: 5 }, { label: "5'4\"", weight: 7 },
      { label: "5'6\"", weight: 7 }, { label: "5'8\"", weight: 6 }, { label: "5'10\"", weight: 4 },
      { label: "6'0\"", weight: 2 }, { label: "6'2\"", weight: 1 },
    ],

    abilities: [
      { label: 'Amphibious', weight: 3, element: 'Lightning', grade: 'B' },
      { label: 'Water Control', weight: 2, element: 'Water', grade: 'B' },
      { label: 'Tidal Surge', weight: 2, element: 'Water', grade: 'B' },
      { label: 'Rain Regeneration', weight: 2, element: 'Water', grade: 'B' },
      { label: 'Ice Shard', weight: 2, element: 'Ice', grade: 'B' },
      { label: 'Drowning Aura', weight: 1, element: 'Lightning', grade: 'C' },
      { label: 'Fluid Evasion', weight: 2, element: 'Lightning', grade: 'B' },
    ],
  },
  {
    label: 'Genasi (Air)',
    spinIdentity: ['Combo', 'FateManipulator'],
    limitBreakOdds: 32,
    weight: 7,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.9,
    minStatTier: 'D-',
    description: 'Born of elemental air. Technically never has a bad smell.',
    injectedWheels: [
      { id: 'tempest', displayName: 'Tempest', order: 1, segments: [
        { label: 'Breeze', weight: 5, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, description: 'Always cooler than they should be.' },
        { label: 'Gale', weight: 4, statBonusGrants: { speed: 'statBonus', energyLevel: 'statBonus' }, description: 'Hard to stand against.' },
        { label: 'Updraft', weight: 3, statBonusGrants: { agility: 'statBonus', potential: 'statBonus' }, description: 'Falls become flights.' },
        { label: 'Storm Caller', weight: 2, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Weather pays attention.' },
        { label: 'Living Tempest', weight: 1, statBonusGrants: { speed: 'statBonus', agility: 'statBonus', powerMastery: 'statBonus' }, description: 'Is the storm.' },
      ]},
    ],
    statModifiers: { speed: 1.7, agility: 1.5, durability: 0.7 },
    classPool: [
      { label: 'Stormcaller', weight: 4, element: 'Wind', grade: 'C', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Storm Sense', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Thunder Anticipation', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Gale Force', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Electrical Attunement', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Cyclone Formation', weight: 2, element: 'Wind', grade: 'D' }, { label: 'Tempest Roar', weight: 1, element: 'Wind', grade: 'C' }], powerPool: [{ label: 'Storm Surge', weight: 3 }, { label: 'Lightning Generation', weight: 3 }, { label: 'Thunder Clap', weight: 2 }, { label: 'Storm Circle', weight: 2 }, { label: 'Aerokinesis', weight: 1 }] },
      { label: 'Windrunner',  weight: 4, element: 'Wind', grade: 'C', statBonusGrants: { speed: 'statBonus' }, abilities: [{ label: 'Slipstream Step', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Draft Riding', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Burst Speed', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Altitude Adaptation', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Wind Walk', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Vacuum Pocket', weight: 1, element: 'Wind', grade: 'C' }], powerPool: [{ label: 'Aerokinesis', weight: 3 }, { label: 'Wind Shear', weight: 3 }, { label: 'Super Speed', weight: 2 }, { label: 'Flight', weight: 2 }, { label: 'Storm Surge', weight: 1 }] },
      { label: 'Tempest Born', weight: 3, element: 'Wind', grade: 'B', statBonusGrants: { speed: 'statBonus' }, abilities: [{ label: 'Pressure Immunity', weight: 2, element: 'Gravity', grade: 'B' }, { label: 'Sonic Burst (Passive)', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Atmospheric Control', weight: 2, element: 'Wind', grade: 'B' }, { label: 'Static Field', weight: 2, element: 'Wind', grade: 'B' }, { label: 'Wind Shield', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Hurricane Channel', weight: 1, element: 'Wind', grade: 'B' }], powerPool: [{ label: 'Wind Shear', weight: 3 }, { label: 'Storm Born', weight: 3 }, { label: 'Aerokinesis', weight: 2 }, { label: 'Thunder Clap', weight: 2 }, { label: 'Lightning Generation', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 3 }, { label: "5'2\"", weight: 5 }, { label: "5'4\"", weight: 7 },
      { label: "5'6\"", weight: 7 }, { label: "5'8\"", weight: 5 }, { label: "5'10\"", weight: 3 },
      { label: "6'0\"", weight: 2 }, { label: '(Technically Weightless)', weight: 1 },
    ],

    abilities: [
      { label: 'Wind Step', weight: 3, element: 'Wind', grade: 'B' },
      { label: 'Breathless', weight: 2, element: 'Wind', grade: 'B' },
      { label: 'Gust Barrier', weight: 2, element: 'Wind', grade: 'B' },
      { label: 'Aerial Surveillance', weight: 2, element: 'Wind', grade: 'B' },
      { label: 'Static Charge', weight: 2, element: 'Wind', grade: 'B' },
      { label: 'Pressure Wave', weight: 1, element: 'Water', grade: 'B' },
      { label: 'Uncontrolled Lightning Strike', weight: 1, element: 'Lightning', grade: 'B' },
    ],
  },
  {
    label: 'Genasi (Earth)',
    spinIdentity: ['Combo'],
    limitBreakOdds: 32,
    weight: 7,
    abilitySpinCount: 1,
    weaknessProbabilityModifier: 0.8,
    minStatTier: 'D-',
    description: 'Born of elemental earth. Grounded. Literally.',
    injectedWheels: [
      { id: 'stoneheart', displayName: 'Stoneheart', order: 1, segments: [
        { label: 'Soil-Born', weight: 5, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Slow to react. Slow to fall.' },
        { label: 'Bedrock', weight: 4, statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, description: 'Cannot be moved.' },
        { label: 'Stone Sense', weight: 3, statBonusGrants: { iq: 'statBonus', durability: 'statBonus' }, description: 'Hears the bones of the world.' },
        { label: 'Mountain Lord', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Earth answers to them.' },
        { label: 'Living Stone', weight: 1, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus', strength: 'statBonus', speed: 'statPenalty' }, description: 'Flesh is suggestion.' },
      ]},
    ],
    statModifiers: { durability: 1.7, strength: 1.5, speed: 0.5, agility: 0.5 },
    classPool: [
      { label: 'Stonebinder',   weight: 4, element: 'Earth', grade: 'C', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Mineral Sense', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Binding Earth', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Stone Call (Passive)', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Deep Vibration', weight: 2, element: 'Sound', grade: 'C' }, { label: 'Rock Formation', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Petrify Touch', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Geokinesis', weight: 3 }, { label: 'Tremor Sense', weight: 3 }, { label: 'Stone Call', weight: 2 }, { label: 'Crystal Armor', weight: 2 }, { label: 'Terrakinesis', weight: 1 }] },
      { label: 'Quake Walker',  weight: 4, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Seismic Step', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Shock Wave Emit', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Ground Split', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Fault Line Read', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Quake Anticipation', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Tectonic Stomp', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Seismic Command', weight: 3 }, { label: 'Geokinesis', weight: 3 }, { label: 'Mountain Crash', weight: 2 }, { label: 'Tremor Sense', weight: 2 }, { label: 'Stone Call', weight: 1 }] },
      { label: 'Crystal Shaper', weight: 3, element: 'Earth', grade: 'B', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Gem Formation', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Prismatic Defense', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Crystal Lattice Sense', weight: 2, element: 'Ice', grade: 'B' }, { label: 'Refraction Control', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Shard Burst', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Diamond Hard Skin', weight: 1, element: 'Earth', grade: 'B' }], powerPool: [{ label: 'Crystal Armor', weight: 3 }, { label: 'Geokinesis', weight: 3 }, { label: 'Runic Ward', weight: 2 }, { label: 'Terrakinesis', weight: 2 }, { label: 'Stone Call', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'4\"", weight: 3 }, { label: "5'6\"", weight: 5 }, { label: "5'8\"", weight: 6 },
      { label: "5'10\"", weight: 6 }, { label: "6'0\"", weight: 5 }, { label: "6'2\"", weight: 4 },
      { label: "6'4\"", weight: 3 }, { label: "6'6\"", weight: 2 }, { label: "6'8\"", weight: 1 },
    ],

    abilities: [
      { label: 'Stone Form', weight: 2, element: 'Earth', grade: 'B' },
      { label: 'Tremorsense', weight: 2, element: 'Earth', grade: 'B' },
      { label: 'Earthen Shell', weight: 3, element: 'Earth', grade: 'B' },
      { label: 'Quake Stomp', weight: 2, element: 'Earth', grade: 'B' },
      { label: 'Dust Cloud', weight: 2, element: 'Earth', grade: 'B' },
      { label: 'Root (Pin Enemies)', weight: 2, element: 'Nature', grade: 'B' },
      { label: 'Terra Firma', weight: 1, element: 'Earth', grade: 'B' },
    ],
  },
  {
    label: 'Warforged',
    spinIdentity: ['HighVariance', 'Evolution'],
    limitBreakOdds: 38,
    weight: 7,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 0.7,
    minStatTier: 'D',
    description: 'Constructed for war, now grappling with purpose and carpal tunnel.',
    injectedWheels: [
      { id: 'upgradeTree', displayName: 'Upgrade Tree', order: 1, segments: [
        { label: 'Field-Ready', weight: 5, description: 'Standard build. Reliable.' },
        { label: 'Reinforced', weight: 4, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Plates upgraded.' },
        { label: 'Optimised', weight: 3, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'Lighter actuators.' },
        { label: 'Battle-Calibrated', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, description: 'Tuned for combat.' },
        { label: 'Prototype Frame', weight: 1, statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus' }, description: 'Untested. Promising.' },
      ]},
      { id: 'protocol', displayName: 'Combat Protocol', order: 2, segments: [
        { label: 'Defender', weight: 4, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Hold the line.' },
        { label: 'Vanguard', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Be the line.' },
        { label: 'Skirmisher', weight: 3, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, description: 'Move with the line.' },
        { label: 'Sniper', weight: 2, statBonusGrants: { fightingSkill: 'statBonus', iq: 'statBonus' }, description: 'Make the line moot.' },
        { label: 'Override', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'All protocols. Simultaneously.' },
      ]},
    ],
    statModifiers: { durability: 1.5, strength: 1.3, armorStrength: 1.6, charisma: 0.6 },
    subTypePool: [
      { label: 'Battle Chassis',              weight: 3, element: 'Metal', grade: 'D', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      { label: 'Scout Unit',                  weight: 3, element: 'Metal', grade: 'D', statBonusGrants: { speed: 'statBonus', agility: 'statBonus' } },
      { label: 'Infiltrator Frame',           weight: 2, element: 'Metal', grade: 'C', statBonusGrants: { agility: 'statBonus', speed: 'statBonus' } },
      { label: 'Labor-Class Construct',       weight: 3, element: 'Metal', grade: 'D', statBonusGrants: { strength: 'statBonus' } },
      { label: 'Experimental Prototype',      weight: 1, element: 'Arcane', grade: 'B', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Siege Platform',              weight: 1, element: 'Metal', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      { label: 'Medic Unit',                  weight: 2, element: 'Metal', grade: 'C', statBonusGrants: { durability: 'statBonus' } },
      { label: 'Diplomatic Envoy Model',      weight: 1, element: 'Neutral', grade: 'C', statBonusGrants: { charisma: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'8\" (Scout)", weight: 3 }, { label: "6'0\"", weight: 5 }, { label: "6'2\"", weight: 6 },
      { label: "6'4\"", weight: 6 }, { label: "6'6\"", weight: 5 }, { label: "6'8\"", weight: 4 },
      { label: "7'0\" (Battle Chassis)", weight: 2 }, { label: "7'4\" (Siege Unit)", weight: 1 },
    ],

    customGenderPool: [
      { label: 'Genderless (Construct)', weight: 5 }, { label: 'Male-Presenting', weight: 2 }, { label: 'Female-Presenting', weight: 2 },
    ],

    abilities: [
      { label: 'Integrated Protection', weight: 3, element: 'Neutral', grade: 'C' },
      { label: 'Constructed Resilience', weight: 3, element: 'Neutral', grade: 'C' },
      { label: "Sentry's Rest", weight: 2 },
      { label: 'Machine Efficiency', weight: 2, element: 'Neutral', grade: 'C' },
      { label: 'Integrated Tool', weight: 2, element: 'Neutral', grade: 'C' },
      { label: 'Living Armor Upgrade', weight: 1, element: 'Neutral', grade: 'C' },
      { label: 'Self-Repair Protocol', weight: 1, element: 'Neutral', grade: 'C' },
      { label: 'Tactical Memory Core', weight: 1, element: 'Neutral', grade: 'C' },
    ],
  },
  // ── Cyborg (Tier 3 — F+E locked) ──
  {
    label: 'Cyborg',
    spinIdentity: ['HighVariance'],
    limitBreakOdds: 38,
    weight: 7,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.8,
    minStatTier: 'D-',
    description: 'Part flesh, part machine. Neither side is happy about it.',
    injectedWheels: [
      { id: 'implant', displayName: 'Implant', order: 1, segments: [
        { label: 'Stock', weight: 5, description: 'Factory parts.' },
        { label: 'Combat Limb', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Replacement arm. Stronger than the original.' },
        { label: 'Optic Array', weight: 3, statBonusGrants: { iq: 'statBonus', fightingSkill: 'statBonus' }, description: 'Sees the air move.' },
        { label: 'Spinal Reactor', weight: 2, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus' }, description: 'Power core in the back.' },
        { label: 'Black Market', weight: 1, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', durability: 'statPenalty' }, description: 'Off-the-books surgery. Untraceable. Unstable.' },
      ]},
      { id: 'corruptedTech', displayName: 'System Status', order: 2, segments: [
        { label: 'Stable', weight: 5, description: 'All systems nominal.' },
        { label: 'Overclocked', weight: 3, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', durability: 'statPenalty' }, description: 'Past spec. Performs. Glows.' },
        { label: 'Hijacked', weight: 2, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' }, description: 'Someone else is at the keyboard.' },
        { label: 'Glitched', weight: 2, statBonusGrants: { powerMastery: 'statBonus', iq: 'statPenalty' }, description: 'Reality stutters around them.' },
        { label: 'System Failure', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', iq: 'statPenalty' }, description: 'Total breakdown. Surprisingly effective.' },
      ]},
    ],
    statModifiers: { durability: 1.6, strength: 1.4, iq: 1.3, agility: 0.8 },
    subTypePool: [
      { label: 'Combat Cyborg',                   weight: 4, element: 'Metal', grade: 'B', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'Weapon Integration', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Targeting Assist', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Combat Overclock', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Damage Absorption', weight: 2, element: 'Time', grade: 'B' }, { label: 'Tactical HUD', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Lethal Protocol', weight: 1, element: 'Metal', grade: 'B' }], powerPool: [{ label: 'Super Strength', weight: 3 }, { label: 'Invulnerability', weight: 3 }, { label: 'Combat Flow State', weight: 2 }, { label: 'Electrokinesis', weight: 2 }, { label: 'Warrior Trance', weight: 1 }] },
      { label: 'Stealth Cyborg',                  weight: 3, element: 'Shadow', grade: 'B', abilities: [{ label: 'Optical Camouflage', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Noise Suppression', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Signal Masking', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Hacking Suite', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Silent Servos', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Ghost Protocol', weight: 1, element: 'Soul', grade: 'B' }], powerPool: [{ label: 'Invisibility', weight: 3 }, { label: 'Shadow Step', weight: 3 }, { label: 'Neural Hijack', weight: 2 }, { label: 'Vanishing Act', weight: 2 }, { label: 'Electrokinesis', weight: 1 }] },
      { label: 'Medical Cyborg',                  weight: 2, element: 'Metal', grade: 'B', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Nanite Repair', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Pain Override', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Adrenaline Injection', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Organ Backup', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Stimulant Release', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Death Deferral', weight: 1, element: 'Soul', grade: 'B' }], powerPool: [{ label: 'Healing Factor', weight: 3 }, { label: 'Invulnerability', weight: 3 }, { label: 'Runic Ward', weight: 2 }, { label: 'Stone Endurance', weight: 2 }, { label: 'Regeneration Burst', weight: 1 }] },
      { label: 'Full Conversion (90% Machine)',   weight: 1, element: 'Metal', grade: 'A', statBonusGrants: { durability: 'statBonus', strength: 'statBonus', iq: 'statBonus' }, abilities: [{ label: 'Near-Total Immunity', weight: 2, element: 'Metal', grade: 'A' }, { label: 'Machine Logic Absolute', weight: 2, element: 'Metal', grade: 'A' }, { label: 'No Biological Weakness', weight: 2, element: 'Metal', grade: 'A' }, { label: 'Integrated Arsenal', weight: 2, element: 'Metal', grade: 'A' }, { label: 'Full System Override', weight: 2, element: 'Metal', grade: 'A' }, { label: 'Posthuman Transcendence', weight: 1, element: 'Metal', grade: 'SS' }], powerPool: [{ label: 'Digital Omniscience', weight: 3 }, { label: 'Invulnerability', weight: 3 }, { label: 'Probability Override', weight: 2 }, { label: 'Reality Calculation Engine', weight: 2 }, { label: 'Machine God Protocol', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'6\"", weight: 3 }, { label: "5'8\"", weight: 4 }, { label: "6'0\"", weight: 6 },
      { label: "6'2\"", weight: 6 }, { label: "6'4\"", weight: 5 }, { label: "6'6\"", weight: 4 },
      { label: "6'8\"", weight: 3 }, { label: "7'0\" (Full Conversion)", weight: 2 },
      { label: "7'6\" (Siege Frame)", weight: 1 },
    ],

    abilities: [
      { label: 'Integrated Weapons System', weight: 3, element: 'Metal', grade: 'A' },
      { label: 'EMP Resistance', weight: 2, element: 'Metal', grade: 'A' },
      { label: 'Cybernetic Strength', weight: 3, element: 'Metal', grade: 'A' },
      { label: 'Heads-Up Display', weight: 2, element: 'Metal', grade: 'A' },
      { label: 'Pain Suppressor', weight: 2, element: 'Metal', grade: 'A' },
      { label: 'Emergency Repair Nanites', weight: 1, element: 'Metal', grade: 'A' },
      { label: "Emotions.exe (Partially Corrupt)", weight: 1 },
    ],
  },
  // Bender (Avatar: The Last Airbender / The Legend of Korra)
  {
    label: 'Bender',
    spinIdentity: ['Combo'],
    limitBreakOdds: 40,
    weight: 7,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.9,
    minStatTier: 'C-',
    description: 'Manipulates one of the four elements through spiritual discipline and martial arts.',
    injectedWheels: [
      { id: 'masteryLevel', displayName: 'Mastery Level', order: 1, segments: [
        { label: 'Initiate', weight: 5, description: 'Just the basics.' },
        { label: 'Adept', weight: 4, statBonusGrants: { powerMastery: 'statBonus' }, description: 'Forms hold. Mostly.' },
        { label: 'Master', weight: 3, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus' }, description: 'Sub-style developed. Style respected.' },
        { label: 'Grandmaster', weight: 2, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' }, description: 'Style emulated.' },
        { label: 'Avatar Spark', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Tiny chance to dual-element. Very few alive can.' },
      ]},
    ],
    statModifiers: { energyLevel: 1.5, fightingSkill: 1.4, potential: 1.3 },
    subTypePool: [
      { label: 'Waterbender',        weight: 4, element: 'Water', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Healing Water', weight: 2, element: 'Water', grade: 'C' }, { label: 'Blood Sense (Passive)', weight: 2, element: 'Blood', grade: 'C' }, { label: 'Current Riding', weight: 2, element: 'Water', grade: 'C' }, { label: 'Ice Formation (Quick)', weight: 2, element: 'Ice', grade: 'D' }, { label: 'Tidal Push', weight: 2, element: 'Water', grade: 'C' }, { label: 'Moon Empowerment', weight: 1, element: 'Water', grade: 'C' }], grantedPowers: ['Hydrokinesis'] },
      { label: 'Earthbender',        weight: 4, element: 'Earth', grade: 'C', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Seismic Sense', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Metalbending Trace', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Stone Riding', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Crystal Sight', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Rock Form', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Lavabend Partial', weight: 1, element: 'Earth', grade: 'C' }], grantedPowers: ['Geokinesis'] },
      { label: 'Firebender',         weight: 4, element: 'Fire', grade: 'C', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Lightning Generation (Passive)', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Combustion Point', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Heat Immunity', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Dragon Breathing', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Flame Whip', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Inner Flame', weight: 1, element: 'Fire', grade: 'C' }], grantedPowers: ['Pyrokinesis'] },
      { label: 'Airbender',          weight: 3, element: 'Wind', grade: 'C', statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, abilities: [{ label: 'Air Step', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Vacuole Punch', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Deflection Sphere', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Sound Amplification', weight: 2, element: 'Sound', grade: 'C' }, { label: 'Pressure Wave', weight: 2, element: 'Water', grade: 'C' }, { label: 'Spirit World Sense', weight: 1, element: 'Soul', grade: 'C' }], grantedPowers: ['Aerokinesis'] },
      { label: 'Metalbender',        weight: 2, element: 'Metal', grade: 'B', statBonusGrants: { strength: 'statBonus', iq: 'statBonus' }, abilities: [{ label: 'Magnetic Sensitivity', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Metal Armor Strip', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Ore Detection', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Cable Control', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Metal Wall', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Precision Wire', weight: 1, element: 'Metal', grade: 'B' }], grantedPowers: ['Metallokinesis'] },
      { label: 'Lavabender',         weight: 1, element: 'Fire', grade: 'B', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Rock Melt', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Lava Pool', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Seismic Heat Sense', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Volcanic Eruption (Minor)', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Magma Shield', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Crust Disruption', weight: 1, element: 'Fire', grade: 'B' }], grantedPowers: ['Lava Control'] },
      { label: 'Bloodbender',        weight: 1, element: 'Blood', grade: 'B', statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Biological Override', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Pain Induction', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Puppet Control (Brief)', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Blood Barrier', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Forced Stillness', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Full Moon Surge', weight: 1, element: 'Blood', grade: 'B' }], grantedPowers: ['Bloodbending'] },
      { label: 'Lightning Bender',   weight: 1, element: 'Lightning', grade: 'B', statBonusGrants: { energyLevel: 'statBonus', speed: 'statBonus' }, abilities: [{ label: 'Arc Control', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Voltage Modulation', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Static Immunity', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Lightning Redirect', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Capacitor Store', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Thunder Armor', weight: 1, element: 'Lightning', grade: 'B' }], grantedPowers: ['Lightning Generation'] },
      { label: 'Avatar (All Elements)', weight: 1, element: 'Cosmic', grade: 'S', statBonusGrants: { energyLevel: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'All Elements Touch', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Spiritual Projection', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Past Life Echo', weight: 2, element: 'Sound', grade: 'S' }, { label: 'Avatar State (Partial)', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Harmonic Convergence', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'World Axis Bond', weight: 1, element: 'Cosmic', grade: 'S' }], grantedPowers: ['All Elements Mastery'] },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 3 }, { label: "5'2\"", weight: 5 }, { label: "5'4\"", weight: 7 },
      { label: "5'6\"", weight: 7 }, { label: "5'8\"", weight: 6 }, { label: "5'10\"", weight: 5 },
      { label: "6'0\"", weight: 3 }, { label: "6'2\"", weight: 2 }, { label: "6'4\"", weight: 1 },
    ],

    abilities: [
      { label: 'Elemental Mastery', weight: 3, element: 'Cosmic', grade: 'C' },
      { label: 'Chi Blocking Resistance', weight: 2, element: 'Cosmic', grade: 'S' },
      { label: 'Spiritual Connection', weight: 2, element: 'Arcane', grade: 'S' },
      { label: 'Advanced Bending Technique', weight: 2, element: 'Cosmic', grade: 'S' },
      { label: 'Animal Communication (Spirit World)', weight: 1, element: 'Nature', grade: 'S' },
      { label: 'Energy Reading', weight: 1, element: 'Cosmic', grade: 'S' },
      { label: 'Elemental Defense', weight: 3, element: 'Cosmic', grade: 'C' },
      { label: 'Avatar State (Temporary)', weight: 1, element: 'Cosmic', grade: 'S' },
    ],
  },
  // Shinobi (Naruto / Naruto Shippuden)
  {
    label: 'Shinobi',
    spinIdentity: ['Combo'],
    limitBreakOdds: 42,
    weight: 6,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.1,
    minStatTier: 'C-',
    description: 'A ninja trained in chakra manipulation, ninjutsu, and the art of sneaking dramatically.',
    injectedWheels: [
      { id: 'clan', displayName: 'Clan', order: 1, segments: [
        { label: 'No Clan', weight: 5, description: 'Trained alone. Owes no one.' },
        { label: 'Outer Clan', weight: 4, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'Tolerated. Useful. Replaceable.' },
        { label: 'Main House', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Bloodline technique inherited.' },
        { label: 'Heir', weight: 2, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Trained to lead. Trained to die first.' },
        { label: 'Forbidden Clan', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus', iq: 'statBonus', charisma: 'statPenalty' }, description: 'Bloodline so dangerous it was outlawed.' },
      ]},
      { id: 'jutsu', displayName: 'Jutsu Affinity', order: 2, segments: [
        { label: 'Taijutsu', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, description: 'Body alone. No tricks.' },
        { label: 'Ninjutsu', weight: 4, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Hand seals. Element work.' },
        { label: 'Genjutsu', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, description: 'The mind is the battlefield.' },
        { label: 'Sealing', weight: 2, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Binds things — energy, beings, fate itself.' },
        { label: 'Forbidden Art', weight: 1, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus', durability: 'statPenalty' }, description: 'Used once. Documented because nothing survived to forget.' },
      ]},
      { id: 'chakraNature', displayName: 'Chakra Nature', order: 3, segments: [
        { label: 'Single Nature', weight: 6, statBonusGrants: { powerMastery: 'statBonus' }, description: 'One element. Trained deeply.' },
        { label: 'Dual Nature', weight: 3, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Two natures. Recombines into a sub-style.' },
        { label: 'Bloodline Nature', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: "Family fusion. Inherited, can't be taught." },
        { label: 'All Five', weight: 1, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'Fire. Water. Earth. Wind. Lightning. All of them.' },
      ]},
    ],
    statModifiers: { agility: 1.5, speed: 1.4, fightingSkill: 1.3 },
    subTypePool: [
      { label: 'Konohagakure Shinobi (Hidden Leaf)', weight: 4, element: 'Nature', grade: 'C', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Will of Fire', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Team Tactics', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Leaf Village Jutsu Library', weight: 2, element: 'Time', grade: 'C' }, { label: 'Taijutsu Foundation', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Sensei Bond', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Hidden Leaf Loyalty', weight: 1, element: 'Nature', grade: 'C' }] },
      { label: 'Sunagakure Shinobi (Hidden Sand)', weight: 2, element: 'Earth', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Desert Camouflage', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Sand Sense', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Puppet Training Foundation', weight: 2, element: 'Water', grade: 'D' }, { label: 'Conserve Chakra', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Wind Affinity', weight: 2, element: 'Wind', grade: 'C' }, { label: "Gaara's Sand Echo", weight: 1 }] },
      { label: 'Kirigakure Shinobi (Hidden Mist)', weight: 2, element: 'Water', grade: 'C', statBonusGrants: { agility: 'statBonus' }, abilities: [{ label: 'Mist Concealment', weight: 2, element: 'Water', grade: 'C' }, { label: 'Silent Kill Foundation', weight: 2, element: 'Water', grade: 'D' }, { label: 'Water Affinity', weight: 2, element: 'Water', grade: 'C' }, { label: 'Blood Mist Aura (Passive)', weight: 2, element: 'Water', grade: 'C' }, { label: 'Seven Swords Style Trace', weight: 2, element: 'Water', grade: 'C' }, { label: 'Hidden Mist Discipline', weight: 1, element: 'Water', grade: 'C' }] },
      { label: 'Kumogakure Shinobi (Hidden Cloud)', weight: 2, element: 'Lightning', grade: 'C', statBonusGrants: { speed: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'Lightning Affinity', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Raikage Speed Echo', weight: 2, element: 'Time', grade: 'C' }, { label: 'Cloud Taijutsu', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Lightning Armor (Minor)', weight: 2, element: 'Lightning', grade: 'C' }, { label: 'Iron Claw Foundation', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Thunderclap Step', weight: 1, element: 'Lightning', grade: 'C' }] },
      { label: 'Missing-Nin (Rogue)', weight: 3, element: 'Shadow', grade: 'C', statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus' }, abilities: [{ label: 'Off-Grid Survival', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Forbidden Jutsu Access', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Unregistered Chakra', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Rogue Combat', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Mercenary Tactical Mind', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Wanted Status (Intimidation)', weight: 1, element: 'Shadow', grade: 'C' }] },
      { label: 'Akatsuki Member', weight: 1, element: 'Shadow', grade: 'B', statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'S-Rank Jutsu Foundation', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Pain Path Awareness', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Ring of Judgment', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Bijuu Extraction Resist', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Akatsuki Cloak', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Infamy Aura', weight: 1, element: 'Shadow', grade: 'C' }] },
      { label: 'ANBU Black Ops', weight: 1, element: 'Shadow', grade: 'B', statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus', speed: 'statBonus' }, abilities: [{ label: 'Assassination Protocol', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Memory Seal', weight: 2, element: 'Water', grade: 'B' }, { label: 'ANBU Mask Disguise', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Double Agent Shift', weight: 2, element: 'Time', grade: 'B' }, { label: 'Forbidden Archive Access', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Root Conditioning', weight: 1, element: 'Nature', grade: 'B' }] },
    ],
    classPool: [
      { label: 'Academy Student (Genin Potential)', weight: 4, element: 'Neutral', grade: 'D', statBonusGrants: { fightingSkill: 'statPenalty' }, abilities: [{ label: 'Basic Ninjutsu', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Three Jutsu Mastery', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Team Tactics (Beginner)', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Chakra Shaping (Early)', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Kunai Precision', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Academy Resilience', weight: 1, element: 'Neutral', grade: 'D' }] },
      { label: 'Chunin', weight: 4, element: 'Neutral', grade: 'C', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Exam Hardened', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Chakra Reserve Growth', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Tactical Leadership Basics', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Mid-Range Jutsu', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Trap Awareness', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Chunin Exam Scar', weight: 1, element: 'Neutral', grade: 'C' }] },
      { label: 'Jonin', weight: 3, element: 'Neutral', grade: 'B', statBonusGrants: { fightingSkill: 'statBonus', speed: 'statBonus' }, abilities: [{ label: 'High-Rank Jutsu Access', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'Combat Intuition', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Battlefield Command', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Advanced Chakra Nature', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Sensor Level', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'S-Rank Resistance', weight: 1, element: 'Neutral', grade: 'B' }] },
      { label: 'Jonin Commander', weight: 2, element: 'Neutral', grade: 'B', statBonusGrants: { fightingSkill: 'statBonus', iq: 'statBonus' }, abilities: [{ label: 'Strategic Oversight', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'Multi-Team Coordination', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'War-Veteran Reflex', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'Chakra Efficiency Mastery', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Command Presence', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Iron Discipline', weight: 1, element: 'Neutral', grade: 'B' }] },
      { label: 'Kage-Level', weight: 1, element: 'Arcane', grade: 'S', statBonusGrants: { fightingSkill: 'statBonus', energyLevel: 'statBonus' }, abilities: [{ label: 'Unmatched Chakra Reserves', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Forbidden Arts Access', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Bijuu Knowledge', weight: 2, element: 'Arcane', grade: 'S' }, { label: "Kage's Will Aura", weight: 2 }, { label: 'Country-Level Threat', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Shadow Clone Mastery', weight: 1, element: 'Shadow', grade: 'C' }] },
    ],
    transformationPool: [
      { label: 'Chakra-Suppressed', weight: 4, element: 'Neutral', grade: 'D', statBonus: 0.8 },
      { label: 'Full Chakra', weight: 5, element: 'Neutral', grade: 'C', statBonus: 1.0 },
      { label: 'Sage Mode', weight: 3, element: 'Nature', grade: 'B', statBonus: 1.5 },
      { label: 'Tailed Beast Chakra Cloak', weight: 2, element: 'Nature', grade: 'A', statBonus: 1.8 },
      { label: 'Six Paths Sage Mode', weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 2.4, statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 3 }, { label: "5'2\"", weight: 6 }, { label: "5'4\"", weight: 8 },
      { label: "5'6\"", weight: 8 }, { label: "5'8\"", weight: 6 }, { label: "5'10\"", weight: 4 },
      { label: "6'0\"", weight: 2 }, { label: "6'2\"", weight: 1 },
    ],

    abilities: [
      { label: 'Sharingan / Dojutsu (Rare)', weight: 1, element: 'Cosmic', grade: 'SS' },
      { label: 'Shadow Clone Jutsu', weight: 3, element: 'Shadow', grade: 'SS' },
      { label: 'Chakra Control Mastery', weight: 3, element: 'Cosmic', grade: 'C' },
      { label: 'Body Flicker Technique', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Elemental Ninjutsu', weight: 3, element: 'Cosmic', grade: 'C' },
      { label: 'Genjutsu Resistance', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Taijutsu Expert', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Summoning Jutsu', weight: 2, element: 'Cosmic', grade: 'SS' },
    ],
  },
  // Mutant (X-Men / Marvel)
  {
    label: 'Mutant',
    spinIdentity: ['HighVariance', 'Scaling'],
    limitBreakOdds: 44,
    weight: 6,
    abilitySpinCount: 2,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 1.2,
    minStatTier: 'C-',
    description: 'A homo superior with a genetic X-gene mutation — feared and misunderstood everywhere.',
    injectedWheels: [
      { id: 'mutation', displayName: 'Mutation', order: 1, segments: [
        { label: 'Cosmetic Mutation', weight: 4, statBonusGrants: { charisma: 'statBonus' }, description: 'Looks different. Same person.' },
        { label: 'Power Manifest', weight: 4, statBonusGrants: { powerMastery: 'statBonus' }, description: 'A new thing they can do.' },
        { label: 'Physical Boost', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Bigger. Tougher. Heavier.' },
        { label: 'Sensory Expansion', weight: 3, statBonusGrants: { iq: 'statBonus', agility: 'statBonus' }, description: 'Sees, hears, feels more than humans should.' },
        { label: 'Multi-Mutation', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Three or four mutations stacked. Some synergise.' },
      ]},
      { id: 'defect', displayName: 'Defect', order: 2, segments: [
        { label: 'Stable', weight: 5, description: 'No downside. Lucky.' },
        { label: 'Minor', weight: 4, statBonusGrants: { durability: 'statPenalty' }, description: 'One quirk. Cosmetic, mostly.' },
        { label: 'Significant', weight: 3, statBonusGrants: { strength: 'statBonus', iq: 'statPenalty' }, description: 'The mutation chose what to take.' },
        { label: 'Severe', weight: 2, statBonusGrants: { powerMastery: 'statBonus', durability: 'statPenalty', charisma: 'statPenalty' }, description: 'The price is visible.' },
        { label: 'Cascade', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', iq: 'statPenalty', potential: 'statPenalty' }, description: 'Mutations keep mutating. Will end before it stops.' },
      ]},
    ],
    statModifiers: { potential: 1.6, powerMastery: 1.4 },
    classPool: [
      { label: 'Gamma Level Mutant', weight: 5, element: 'Psychic', grade: 'C', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Power Stabilization', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Secondary Mutation Active', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Combat Training (Xavier)', weight: 2, element: 'Water', grade: 'C' }, { label: 'Adaptive Defense', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Mutant Bond Network', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Controlled Release', weight: 1, element: 'Psychic', grade: 'C' }], powerPool: [{ label: 'Power Copying', weight: 3 }, { label: 'Adaptive Power Expression', weight: 3 }, { label: 'Shapeshifting', weight: 2 }, { label: 'Healing Factor', weight: 2 }, { label: 'Telekinesis', weight: 1 }] },
      { label: 'Beta Level Mutant',  weight: 4, element: 'Psychic', grade: 'B', statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Passive Field Generation', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Enhanced Durability (Mutation)', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Instinctive Power Use', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Power Synergy', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Mutation Surge (Stress)', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Tactical X-Gene', weight: 1, element: 'Psychic', grade: 'B' }], powerPool: [{ label: 'Adaptive Power Expression', weight: 3 }, { label: 'Power Copying', weight: 3 }, { label: 'Telekinesis', weight: 2 }, { label: 'Telepathy', weight: 2 }, { label: 'Elemental Mastery', weight: 1 }] },
      { label: 'Alpha Level Mutant', weight: 3, element: 'Psychic', grade: 'A', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Power Pinnacle Form', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Omega Trace Access', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Alpha Resilience', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Energy Absorption (Partial)', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Natural Counter', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Mutation Mastery', weight: 1, element: 'Psychic', grade: 'C' }], powerPool: [{ label: 'Elemental Mastery', weight: 3 }, { label: 'Telepathy', weight: 3 }, { label: 'Telekinesis', weight: 2 }, { label: 'Reality Warping', weight: 2 }, { label: 'Adaptive Power Expression', weight: 1 }] },
      { label: 'Omega Level Mutant', weight: 1, element: 'Psychic', grade: 'S', statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Unlimited Potential Cap', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Reality Interface Trace', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Psychic Fortress', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Omni-Adaptation', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Existential Threat Aura', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Omega Event Horizon', weight: 1, element: 'Psychic', grade: 'S' }], powerPool: [{ label: 'Reality Warping', weight: 3 }, { label: 'Elemental Mastery', weight: 3 }, { label: 'Psychic Dominion', weight: 2 }, { label: 'Matter Disintegration', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "4'6\" (Mutation Stunted)", weight: 1 }, { label: "5'0\"", weight: 3 }, { label: "5'4\"", weight: 5 },
      { label: "5'8\"", weight: 7 }, { label: "6'0\"", weight: 7 }, { label: "6'4\"", weight: 5 },
      { label: "6'8\"", weight: 3 }, { label: "7'0\"", weight: 2 }, { label: "7'6\"", weight: 1 },
      { label: "8'0\" (Omega Growth Mutation)", weight: 1 },
    ],

    abilities: [
      { label: 'Adaptive Power Expression', weight: 3, element: 'Psychic', grade: 'S' },
      { label: 'X-Gene Surge', weight: 2, element: 'Psychic', grade: 'S' },
      { label: 'Mutant Resistance (Secondary)', weight: 2, element: 'Psychic', grade: 'S' },
      { label: 'Secondary Mutation', weight: 2, element: 'Psychic', grade: 'S' },
      { label: 'Xavier Institute Training', weight: 2, element: 'Water', grade: 'D' },
      { label: 'Power Instability (Double-Edged)', weight: 1, element: 'Psychic', grade: 'S' },
      { label: 'X-Factor Resilience', weight: 2, element: 'Psychic', grade: 'S' },
      { label: 'Genetic Evolution (Situational)', weight: 1, element: 'Psychic', grade: 'S' },
    ],
  },
  // Nen User (Hunter × Hunter)
  {
    label: 'Nen User',
    spinIdentity: ['Combo'],
    limitBreakOdds: 46,
    weight: 6,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.9,
    minStatTier: 'C-',
    description: 'A Hunter who has unlocked Nen — the manipulation of life energy. What type you are defines your destiny.',
    injectedWheels: [
      { id: 'nenCategory', displayName: 'Nen Category', order: 1, segments: [
        { label: 'Enhancement', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Make yourself more.' },
        { label: 'Emission', weight: 3, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Throw your aura far.' },
        { label: 'Transmutation', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Aura becomes anything you imagine.' },
        { label: 'Conjuration', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, description: 'Make objects from nothing.' },
        { label: 'Manipulation', weight: 2, statBonusGrants: { iq: 'statBonus', charisma: 'statBonus' }, description: 'Control things — people, objects, fate.' },
        { label: 'Specialist', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'One rule. One ability. Often impossible.' },
      ]},
      { id: 'restriction', displayName: 'Restriction', order: 2, segments: [
        { label: 'Unrestricted', weight: 5, description: 'No vows. No bonus. Average ceiling.' },
        { label: 'Time Restriction', weight: 4, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Only at certain hours. Worth it.' },
        { label: 'Target Restriction', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Only against one type of foe. Devastating against it.' },
        { label: 'Condition Lock', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', durability: 'statPenalty' }, description: 'Only when X. The X is hard.' },
        { label: 'Death Vow', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', potential: 'statBonus' }, description: 'Use it and die. Power: absurd.' },
      ]},
      { id: 'vow', displayName: 'Vow', order: 3, segments: [
        { label: 'No Vow', weight: 5, description: 'Power tracks raw talent.' },
        { label: 'Minor Vow', weight: 4, statBonusGrants: { powerMastery: 'statBonus' }, description: 'Small promise to self. Visible bonus.' },
        { label: 'Public Vow', weight: 3, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Announced. Cannot be taken back.' },
        { label: 'Blood Vow', weight: 2, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', durability: 'statPenalty' }, description: 'Sealed with the body.' },
        { label: 'Soul Vow', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Bound to the spirit itself. Breaking it ends both.' },
      ]},
    ],
    statModifiers: { energyLevel: 1.6, fightingSkill: 1.4, potential: 1.3 },
    classPool: [
      { label: 'Enhancer',    weight: 4, element: 'Earth', grade: 'C', abilities: [{ label: 'Physical Amplification', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Healing Rate Surge', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Nen Reinforcement', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Durability Push', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Gyo Combat', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Simple But Effective', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Super Strength', weight: 3 }, { label: 'Healing Factor', weight: 3 }, { label: 'Invulnerability', weight: 2 }, { label: 'Indomitable Rage', weight: 2 }, { label: 'Warrior Trance', weight: 1 }] },
      { label: 'Emitter',     weight: 3, element: 'Arcane', grade: 'C', abilities: [{ label: 'Ranged Nen Control', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Projectile Aim', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Energy Dispersion', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Detached Aura', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Long-Range Hatsu', weight: 2, element: 'Arcane', grade: 'C' }, { label: "Emitter's Eye", weight: 1 }], powerPool: [{ label: 'Ki Blast', weight: 3 }, { label: 'Pyrokinesis', weight: 3 }, { label: 'Electrokinesis', weight: 2 }, { label: 'Cryokinesis', weight: 2 }, { label: 'Plasma Generation', weight: 1 }] },
      { label: 'Transmuter',  weight: 3, element: 'Chaos', grade: 'C', abilities: [{ label: 'Form Lock', weight: 2, element: 'Chaos', grade: 'C' }, { label: 'Property Transfer', weight: 2, element: 'Chaos', grade: 'C' }, { label: 'Illusion Layer', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Frequency Shift', weight: 2, element: 'Chaos', grade: 'C' }, { label: 'Speed of Thought Shift', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Identity Change', weight: 1, element: 'Chaos', grade: 'C' }], powerPool: [{ label: 'Transmutation', weight: 3 }, { label: 'Shapeshifting', weight: 3 }, { label: 'Mimicry', weight: 2 }, { label: 'Molecular Vibration', weight: 2 }, { label: 'Atomic Restructuring', weight: 1 }] },
      { label: 'Manipulator', weight: 3, element: 'Psychic', grade: 'C', abilities: [{ label: 'Puppet Protocol', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Command Implant', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Aura Interference', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Object Binding', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Remote Gyo', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Hivemind Trace', weight: 1, element: 'Psychic', grade: 'C' }], powerPool: [{ label: 'Telekinesis', weight: 3 }, { label: 'Neural Hijack', weight: 3 }, { label: 'Telepathy', weight: 2 }, { label: 'Mind Control', weight: 2 }, { label: 'Psychic Dominion', weight: 1 }] },
      { label: 'Conjurer',    weight: 2, element: 'Arcane', grade: 'B', abilities: [{ label: 'Object Permanence Nen', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Conjure Quality Lock', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Item Enhancement', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Manifest Duration', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Nen Materialization', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Item World', weight: 1, element: 'Arcane', grade: 'B' }], powerPool: [{ label: 'Conjuration', weight: 3 }, { label: 'Mana Construct Creation', weight: 3 }, { label: 'Dimensional Pocket', weight: 2 }, { label: 'Golem Forging', weight: 2 }, { label: 'Summoning Surge', weight: 1 }] },
      { label: 'Specialist',  weight: 1, element: 'Chaos', grade: 'S', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Undefined Power Form', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Rule-Breaking Aptitude', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Foreign Nen Reading', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Cross-Type Borrowing', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Luck Nen', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Singularity Event', weight: 1, element: 'Gravity', grade: 'S' }], powerPool: [{ label: 'Reality Warping', weight: 3 }, { label: 'Probability Manipulation', weight: 3 }, { label: 'Omnipotence (Weekend Only)', weight: 2 }, { label: 'Fate Threading', weight: 2 }, { label: 'Causality Violation', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Nen Awakening (Basic)', weight: 5, element: 'Neutral', grade: 'D', statBonusGrants: { energyLevel: 'statPenalty' }, statBonus: 0.9 },
      { label: 'Nen Refined', weight: 4, element: 'Neutral', grade: 'C', statBonusGrants: { energyLevel: 'statBonus' }, statBonus: 1.1 },
      { label: 'Zetsu / Gyo Mastery', weight: 3, element: 'Neutral', grade: 'B', statBonusGrants: { energyLevel: 'statBonus', fightingSkill: 'statBonus' }, statBonus: 1.3 },
      { label: 'Hatsu Developed', weight: 3, element: 'Arcane', grade: 'B', statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus', fightingSkill: 'statBonus' }, statBonus: 1.5 },
      { label: 'Nen Genius / Post-NDE Upgrade', weight: 1, element: 'Arcane', grade: 'SS', statBonus: 2.2, statBonusGrants: { energyLevel: 'statBonus', fightingSkill: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 3 }, { label: "5'2\"", weight: 5 }, { label: "5'4\"", weight: 7 },
      { label: "5'6\"", weight: 7 }, { label: "5'8\"", weight: 6 }, { label: "5'10\"", weight: 5 },
      { label: "6'0\"", weight: 3 }, { label: "6'2\"", weight: 2 }, { label: "6'4\"", weight: 1 },
    ],

    abilities: [
      { label: 'Ten (Life Aura Coating)', weight: 3, element: 'Arcane', grade: 'C' },
      { label: 'Ren (Aura Amplification)', weight: 3, element: 'Arcane', grade: 'C' },
      { label: 'Hatsu (Personal Nen Technique)', weight: 2, element: 'Psychic', grade: 'SS' },
      { label: 'Ko (Focused Strike)', weight: 2, element: 'Arcane', grade: 'SS' },
      { label: 'Ken (Sustained Defense)', weight: 2, element: 'Arcane', grade: 'SS' },
      { label: 'Shu (Weapon Coating)', weight: 1, element: 'Arcane', grade: 'SS' },
      { label: 'In (Concealed Aura)', weight: 1, element: 'Arcane', grade: 'C' },
    ],
  },
  // Namekian (Dragon Ball Z)
  {
    label: 'Namekian',
    spinIdentity: ['Scaling', 'Summoner'],
    limitBreakOdds: 48,
    weight: 5,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 0.7,
    minStatTier: 'C-',
    description: 'Green warriors from Planet Namek. They can regenerate limbs and create Dragon Balls, which is cheating.',
    injectedWheels: [
      { id: 'dragonClan', displayName: 'Dragon Clan Gift', order: 1, segments: [
        { label: 'Reserved', weight: 5, description: 'The gift is dormant.' },
        { label: 'Crafted', weight: 4, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Can shape and call. Small wishes.' },
        { label: 'Granter', weight: 3, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus', iq: 'statBonus' }, description: 'Calls upon Eternal Dragon. Three wishes.' },
        { label: 'Grand Elder', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus', charisma: 'statBonus' }, description: 'Awakens dormant power in others. Can change fates.' },
      ]},
      { id: 'warriorClan', displayName: 'Warrior Path', order: 2, segments: [
        { label: 'Pacifist', weight: 5, statBonusGrants: { durability: 'statBonus', potential: 'statBonus' }, description: 'Refuses combat. Stronger for it.' },
        { label: 'Defender', weight: 4, statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Will fight to protect. Will not start.' },
        { label: 'Battle-Hardened', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus' }, description: 'Has seen things. Brought them back.' },
        { label: 'Super Namekian', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'The full path. Both clans merged.' },
      ]},
    ],
    statModifiers: { potential: 1.5, iq: 1.3, durability: 1.2 },
    subTypePool: [
      { label: 'Warrior-Type Namekian', weight: 4, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      { label: 'Dragon Clan Namekian', weight: 4, element: 'Nature', grade: 'C', statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Super Namekian', weight: 2, element: 'Earth', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "6'8\"", weight: 2 }, { label: "7'0\"", weight: 4 }, { label: "7'4\"", weight: 6 },
      { label: "7'8\"", weight: 6 }, { label: "8'0\"", weight: 5 }, { label: "8'4\"", weight: 4 },
      { label: "8'8\"", weight: 2 }, { label: "9'0\" (Elder)", weight: 1 },
      { label: 'Giant Form (30+)', weight: 1 },
    ],

    customGenderPool: [
      { label: 'Genderless (Asexual Species)', weight: 1 },
    ],

    abilities: [
      { label: 'Limb Regeneration', weight: 3, element: 'Nature', grade: 'A' },
      { label: 'Dragon Ball Sensing', weight: 2, element: 'Earth', grade: 'A' },
      { label: 'Fusion Compatibility', weight: 2, element: 'Earth', grade: 'A' },
      { label: 'Giant Form (Warrior Class)', weight: 2, element: 'Earth', grade: 'C' },
      { label: 'Mystic Attack (Stretchy Arms)', weight: 2, element: 'Arcane', grade: 'A' },
      { label: 'Sleeping Warrior Mode', weight: 1, element: 'Earth', grade: 'C' },
      { label: 'Ki Suppression', weight: 2, element: 'Earth', grade: 'A' },
    ],
  },
  // Titan Shifter (Attack on Titan)
  {
    label: 'Titan Shifter',
    spinIdentity: ['Evolution'],
    limitBreakOdds: 50,
    weight: 6,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.3,
    minStatTier: 'C-',
    description: 'A human who can transform into a massive Titan at will. Subject to 13-year curse. Great at breaking walls.',
    injectedWheels: [
      { id: 'titanType', displayName: 'Titan Type', order: 1, segments: [
        { label: 'Attack', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus' }, description: 'Fast. Aggressive. Never retreats.' },
        { label: 'Armored', weight: 3, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus', strength: 'statBonus' }, description: 'Hardened plating. Cannot be cut by ordinary means.' },
        { label: 'Beast', weight: 3, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus' }, description: 'Fur. Claws. Smells fear.' },
        { label: 'Colossal', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', armorStrength: 'statBonus', speed: 'statPenalty' }, description: 'The largest. The wall.' },
        { label: 'Founding', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'Controls all titans. The original.' },
      ]},
    ],
    statModifiers: { strength: 1.9, durability: 1.6, fightingSkill: 1.5, speed: 1.3 },
    subTypePool: [
      { label: 'Attack Titan',    weight: 3, element: 'Earth', grade: 'B', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'Future Memory Access', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Rage Titan Surge', weight: 2, element: 'Time', grade: 'B' }, { label: 'Path Bond', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Shifter Will', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Coordinate Sensitivity', weight: 2, element: 'Earth', grade: 'B' }, { label: "Eren's Legacy Echo", weight: 1 }], grantedPowers: ['Titan Shift'] },
      { label: 'Armored Titan',   weight: 2, element: 'Earth', grade: 'B', statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Hardening Mastery', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Armor Formation Speed', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Full Body Hardening', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Plate Recovery', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Tank-Mode Shift', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Armored Will', weight: 1, element: 'Earth', grade: 'B' }], grantedPowers: ['Titan Shift', 'Hardening'] },
      { label: 'Female Titan',    weight: 2, element: 'Earth', grade: 'C', statBonusGrants: { agility: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'Crystal Hardening', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Shifter Scream (Attract Pure Titans)', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Endurance Body', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Flexible Combat', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Titan Copy', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Adaptive Mimicry', weight: 1, element: 'Earth', grade: 'C' }], grantedPowers: ['Titan Shift'] },
      { label: 'Jaw Titan',       weight: 2, element: 'Earth', grade: 'C', statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, abilities: [{ label: 'Jaw Shatter Force', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Speed Shift', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Ultra Fast Transformation', weight: 2, element: 'Earth', grade: 'D' }, { label: "Ymir's Mark", weight: 2 }, { label: 'Tendon Strength', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Crystal Breaker', weight: 1, element: 'Earth', grade: 'C' }], grantedPowers: ['Titan Shift', 'Jaw Titan Bite'] },
      { label: 'Cart Titan',      weight: 2, element: 'Earth', grade: 'C', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Long-Range Endurance', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Carrier Form', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Quadrupedal Speed', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Logistical Bond', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Endurance Mode', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Pack Carrier', weight: 1, element: 'Earth', grade: 'C' }], grantedPowers: ['Titan Shift'] },
      { label: 'Beast Titan',     weight: 2, element: 'Nature', grade: 'C', statBonusGrants: { strength: 'statBonus', iq: 'statBonus' }, abilities: [{ label: 'Projectile Launch (Full Body)', weight: 2, element: 'Nature', grade: 'C' }, { label: "Ymir's Curse Adaptation", weight: 2 }, { label: 'Beast Form Intelligence', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Ape Combat', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Throwing Precision', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Animal Horde Command', weight: 1, element: 'Nature', grade: 'C' }], grantedPowers: ['Titan Shift'] },
      { label: 'Colossal Titan',  weight: 1, element: 'Fire', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Heat Wave Aura', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Massive Form Shift', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Steam Defense', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Structural Collapse', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Blast Entry', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Citywall Presence', weight: 1, element: 'Psychic', grade: 'A' }], grantedPowers: ['Titan Shift', 'Steam Explosion'] },
      { label: 'War Hammer Titan', weight: 1, element: 'Earth', grade: 'A', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Construct Memory', weight: 2, element: 'Earth', grade: 'A' }, { label: 'Spike Formation Speed', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Terrain Control', weight: 2, element: 'Water', grade: 'A' }, { label: 'Distance Creation', weight: 2, element: 'Earth', grade: 'SSS' }, { label: 'Hardening Art', weight: 2, element: 'Earth', grade: 'A' }, { label: 'Living Weapon', weight: 1, element: 'Earth', grade: 'A' }], grantedPowers: ['Titan Shift', 'Hardening'] },
      { label: 'Founding Titan',  weight: 1, element: 'Soul', grade: 'S', statBonusGrants: { strength: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Coordinate Activation', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Titan Command (Broad)', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Memory Alteration (Partial)', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Subjects of Ymir Bond', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Ancient Power Echo', weight: 2, element: 'Sound', grade: 'S' }, { label: 'World-Memory Access', weight: 1, element: 'Soul', grade: 'S' }], grantedPowers: ['Titan Shift'] },
    ],
    transformationPool: [
      { label: 'Shifter Awakened',          weight: 5, element: 'Earth', grade: 'D', statBonus: 1.0 },
      { label: 'Controlled Transformation', weight: 4, element: 'Earth', grade: 'C', statBonus: 1.2 },
      { label: 'Hardening Mastered',        weight: 3, element: 'Earth', grade: 'B', statBonus: 1.4 },
      { label: 'Coordinate Awakened',       weight: 2, element: 'Soul', grade: 'A', statBonus: 1.8 },
      { label: 'Founder\'s Power Unleashed', weight: 1, element: 'Neutral', grade: 'C', statBonus: 2.5, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 3 }, { label: "5'2\"", weight: 5 }, { label: "5'4\"", weight: 7 },
      { label: "5'6\"", weight: 7 }, { label: "5'8\"", weight: 6 }, { label: "5'10\"", weight: 4 },
      { label: "6'0\"", weight: 2 }, { label: '(Titan Form: 4m–60m)', weight: 1 },
    ],

    abilities: [
      { label: 'Titan Transformation', weight: 2, element: 'Neutral', grade: 'D' },
      { label: 'Regeneration (Human Form)', weight: 3, element: 'Nature', grade: 'C' },
      { label: 'Inheritor Memory', weight: 2, element: 'Neutral', grade: 'C' },
      { label: 'Titanization Control', weight: 2, element: 'Neutral', grade: 'C' },
      { label: 'Hardening', weight: 2, element: 'Neutral', grade: 'C' },
      { label: 'Steam Emission (Combat)', weight: 1, element: 'Neutral', grade: 'C' },
      { label: 'Titan Scream (Minor)', weight: 1, element: 'Neutral', grade: 'C' },
    ],
  },

  // ── Rare / Tier 4 (weight 5–9, F+E+D locked → minStatTier C-) ──
  {
    label: 'Vampire',
    spinIdentity: ['Evolution', 'Corruption'],
    limitBreakOdds: 46,
    weight: 5,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.8,
    minStatTier: 'C-',
    description: 'Immortal, elegant, dramatically inconvenienced by sunlight.',
    injectedWheels: [
      { id: 'bloodline', displayName: 'Bloodline', order: 1, segments: [
        { label: 'Noble', weight: 4, statBonusGrants: { charisma: 'statBonus', iq: 'statBonus' }, description: 'Old money. Older blood. Servants for centuries.' },
        { label: 'Feral', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statPenalty' }, description: 'No coffin. No manners. All teeth.' },
        { label: 'Shadow', weight: 3, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', powerMastery: 'statBonus' }, description: 'Walks through walls. Sometimes literally.' },
        { label: 'Crimson', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, description: 'Blood obeys. Iron forgets which way it should fall.' },
        { label: 'Ancient', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Older than the empire that named them.' },
      ]},
      { id: 'age', displayName: 'Age', order: 2, segments: [
        { label: 'Fledgling', weight: 5, description: 'Decades, at most. Still learning the hunger.' },
        { label: 'Mature', weight: 4, statBonusGrants: { charisma: 'statBonus', fightingSkill: 'statBonus' }, description: 'A century or two. Comfortable in the night.' },
        { label: 'Elder', weight: 3, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', charisma: 'statBonus' }, description: 'Saw empires rise. Outlasts them.' },
        { label: 'Ancestor', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Predates language as you know it.' },
        { label: 'Primordial Vampire', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statPenalty' }, description: 'There were vampires before there was night.' },
      ]},
      { id: 'corruption', displayName: 'Corruption', order: 3, segments: [
        { label: 'Composed', weight: 5, description: 'The hunger is leashed.' },
        { label: 'Slipping', weight: 4, statBonusGrants: { strength: 'statBonus', charisma: 'statPenalty' }, description: 'The face changes around blood.' },
        { label: 'Beast-Near', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', iq: 'statPenalty' }, description: 'The leash is fraying.' },
        { label: 'Awakening', weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', charisma: 'statPenalty' }, description: 'The thing inside speaks for itself now.' },
        { label: "Sun's Edge", weight: 1, statBonusGrants: { potential: 'statBonus', durability: 'statPenalty' }, description: 'One step from dust. One step from divine.' },
      ]},
    ],
    statModifiers: { charisma: 1.7, speed: 1.3, agility: 1.3, energyLevel: 0.6 },
    transformationPool: [
      { label: 'Newly Turned',       weight: 5, element: 'Blood', grade: 'D', statBonusGrants: { speed: 'statPenalty', strength: 'statPenalty' }, statBonus: 0.8 },
      { label: 'Young Vampire',      weight: 4, element: 'Blood', grade: 'C', statBonusGrants: { charisma: 'statBonus' }, statBonus: 1.0, grantedPowers: ['Vampiric Drain'] },
      { label: 'Ancient',            weight: 3, element: 'Blood', grade: 'B', statBonusGrants: { charisma: 'statBonus', speed: 'statBonus' }, statBonus: 1.3, grantedPowers: ['Vampiric Drain', 'Bat Form'] },
      { label: 'Elder',              weight: 2, element: 'Blood', grade: 'A', statBonusGrants: { charisma: 'statBonus', speed: 'statBonus', strength: 'statBonus' }, statBonus: 1.6, grantedPowers: ['Vampiric Drain', 'Bat Form', 'Mind Fog'] },
      { label: 'True Progenitor',    weight: 1, element: 'Blood', grade: 'SS', statBonus: 2.0, statBonusGrants: { charisma: 'statBonus', speed: 'statBonus' }, grantedPowers: ['Vampiric Drain', 'Bat Form', 'Mind Fog', 'Blood Control'] },
    ],
    customHeightPool: [
      { label: "5'4\"", weight: 2 }, { label: "5'6\"", weight: 4 }, { label: "5'8\"", weight: 6 },
      { label: "5'10\"", weight: 7 }, { label: "6'0\"", weight: 7 }, { label: "6'2\"", weight: 5 },
      { label: "6'4\"", weight: 3 }, { label: "6'6\"", weight: 2 }, { label: '(Preserved From Death)', weight: 1 },
    ],

    abilities: [
      { label: 'Blood Drain', weight: 2, element: 'Water', grade: 'SS' },
      { label: 'Shadow Meld', weight: 2, element: 'Shadow', grade: 'SS' },
      { label: 'Bat Form', weight: 2, element: 'Blood', grade: 'SS' },
      { label: 'Hypnotic Gaze', weight: 2, element: 'Blood', grade: 'SS' },
      { label: 'Spider Climb', weight: 2, element: 'Blood', grade: 'SS' },
      { label: 'Mist Form', weight: 1, element: 'Water', grade: 'SS' },
      { label: 'Undead Resilience', weight: 1, element: 'Soul', grade: 'SS' },
    ],
  },
  {
    label: 'Werewolf',
    spinIdentity: ['Evolution'],
    limitBreakOdds: 44,
    weight: 5,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.6,
    minStatTier: 'C-',
    description: 'Full moon not required, full anger is.',
    injectedWheels: [
      { id: 'moon', displayName: 'Moon Phase', order: 1, segments: [
        { label: 'New Moon', weight: 3, statBonusGrants: { agility: 'statBonus' }, description: 'Smallest form. Easiest to hide.' },
        { label: 'Crescent', weight: 3, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, description: 'The wolf stirs.' },
        { label: 'Half Moon', weight: 4, description: 'Balanced. Could go either way.' },
        { label: 'Gibbous', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Hunger sharpens.' },
        { label: 'Full Moon', weight: 2, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus', iq: 'statPenalty' }, description: 'All wolf. All hunger.' },
      ]},
      { id: 'alpha', displayName: 'Pack Rank', order: 2, segments: [
        { label: 'Lone', weight: 4, statBonusGrants: { agility: 'statBonus', charisma: 'statPenalty' }, description: 'No pack. No leash. No safety.' },
        { label: 'Omega', weight: 3, statBonusGrants: { speed: 'statBonus', durability: 'statBonus' }, description: 'Last in line. Knows every escape.' },
        { label: 'Hunter', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus' }, description: 'Brings food back. Keeps the pack alive.' },
        { label: 'Beta', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' }, description: "The Alpha's right hand." },
        { label: 'Alpha', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus', potential: 'statBonus' }, description: 'The pack runs because they say so.' },
      ]},
    ],
    statModifiers: { strength: 1.7, speed: 1.4, fightingSkill: 1.5 },
    transformationPool: [
      { label: 'New Moon (Suppressed)',               weight: 4, element: 'Blood', grade: 'D', statBonus: 0.7, statBonusGrants: { strength: 'statPenalty' } },
      { label: 'Half Moon',                           weight: 4, element: 'Blood', grade: 'C', statBonusGrants: { strength: 'statBonus' }, statBonus: 1.0 },
      { label: 'Full Moon',                           weight: 3, element: 'Blood', grade: 'B', statBonusGrants: { strength: 'statBonus', speed: 'statBonus' }, statBonus: 1.4 },
      { label: 'Blood Moon',                          weight: 2, element: 'Blood', grade: 'A', statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus' }, statBonus: 1.8 },
      { label: 'Eternal Night (Always Full Moon)',    weight: 1, element: 'Blood', grade: 'SS', statBonus: 2.2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'8\" (Human Form)", weight: 3 }, { label: "5'10\"", weight: 5 }, { label: "6'0\"", weight: 6 },
      { label: "6'2\"", weight: 6 }, { label: "6'4\"", weight: 5 }, { label: "6'6\"", weight: 3 },
      { label: "6'8\"", weight: 2 }, { label: '7\'0\" (War Form: 8-9\')', weight: 1 },
    ],

    abilities: [
      { label: 'Full Moon Fury', weight: 2, element: 'Blood', grade: 'SS' },
      { label: 'Pack Bond', weight: 2, element: 'Blood', grade: 'SS' },
      { label: 'Accelerated Regeneration', weight: 2, element: 'Time', grade: 'SS' },
      { label: 'Enhanced Senses', weight: 2, element: 'Blood', grade: 'C' },
      { label: 'Howl of Terror', weight: 2, element: 'Blood', grade: 'SS' },
      { label: 'Feral Instinct', weight: 1, element: 'Nature', grade: 'C' },
      { label: 'Alpha Command', weight: 1, element: 'Blood', grade: 'SS' },
    ],
  },
  {
    label: 'Undead (Revenant)',
    spinIdentity: ['Corruption', 'Scaling'],
    limitBreakOdds: 50,
    weight: 4,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.5,
    minStatTier: 'C-',
    description: 'Died once. Refused to stay that way. Now furious.',
    injectedWheels: [
      { id: 'causeOfDeath', displayName: 'Cause of Death', order: 1, segments: [
        { label: 'Forgotten', weight: 5, statBonusGrants: { agility: 'statBonus', durability: 'statBonus' }, description: 'The why is gone. The grudge remains.' },
        { label: 'Betrayal', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus', charisma: 'statPenalty' }, description: 'Someone they trusted. They remember the name.' },
        { label: 'Battle', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus' }, description: 'Died on a field. Got back up. Kept walking.' },
        { label: 'Cursed', weight: 2, statBonusGrants: { powerMastery: 'statBonus', durability: 'statBonus', potential: 'statPenalty' }, description: 'Died as part of a working. Bound to it.' },
        { label: 'Self-Imposed', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' }, description: 'Walked into death. Chose to return.' },
      ]},
      { id: 'vengeance', displayName: 'Vengeance', order: 2, segments: [
        { label: 'Drifting', weight: 5, statBonusGrants: { agility: 'statBonus', potential: 'statBonus' }, description: 'No clear target. Wandering.' },
        { label: 'Named Target', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, description: 'One person. One name. One direction.' },
        { label: 'Lineage Target', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', iq: 'statBonus' }, description: 'A family. All of them. Inheritance counts.' },
        { label: 'Kingdom Target', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'A whole nation. Generational debt.' },
        { label: 'World Target', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', fightingSkill: 'statBonus' }, description: 'Everyone responsible. Everyone benefiting.' },
      ]},
    ],
    statModifiers: { durability: 1.4, strength: 1.2, charisma: 0.5 },
    transformationPool: [
      { label: 'Recently Deceased',          weight: 5, element: 'Soul', grade: 'D', statBonusGrants: { durability: 'statPenalty' }, statBonus: 0.8 },
      { label: 'Decades Dead',               weight: 4, element: 'Soul', grade: 'C', statBonusGrants: { durability: 'statBonus' }, statBonus: 1.0 },
      { label: 'Centuries Old',              weight: 3, element: 'Soul', grade: 'B', statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, statBonus: 1.3 },
      { label: 'Ancient Revenant',           weight: 2, element: 'Soul', grade: 'A', statBonusGrants: { durability: 'statBonus', strength: 'statBonus', potential: 'statBonus' }, statBonus: 1.6 },
      { label: 'Death Itself, Personified',  weight: 1, element: 'Soul', grade: 'SS', statBonus: 2.0, statBonusGrants: { durability: 'statBonus', strength: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 2 }, { label: "5'4\"", weight: 4 }, { label: "5'6\"", weight: 6 },
      { label: "5'8\"", weight: 7 }, { label: "5'10\"", weight: 7 }, { label: "6'0\"", weight: 5 },
      { label: "6'2\"", weight: 3 }, { label: "6'4\"", weight: 2 }, { label: '(As in Life)', weight: 1 },
    ],

    abilities: [
      { label: "Death's Refusal", weight: 2 },
      { label: 'Spectral Touch', weight: 2, element: 'Soul', grade: 'SS' },
      { label: 'Grudge-Powered Strength', weight: 2, element: 'Soul', grade: 'SS' },
      { label: 'Fear Immunity', weight: 2, element: 'Psychic', grade: 'SS' },
      { label: 'Ethereal Step', weight: 1, element: 'Arcane', grade: 'SS' },
      { label: 'Undying Resolve', weight: 1, element: 'Soul', grade: 'SS' },
      { label: 'Vengeance Mark', weight: 1, element: 'Soul', grade: 'SS' },
    ],
  },
  {
    label: 'Dragon',
    spinIdentity: ['Evolution', 'Scaling'],
    limitBreakOdds: 54,
    weight: 5,
    abilitySpinCount: 3,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 0.5,
    minStatTier: 'C-',
    weaknessCount: 1,
    description: "Apex of nature's design. Infuriatingly aware of it.",
    statModifiers: { strength: 2.0, durability: 2.0, powerMastery: 1.7, charisma: 1.3 },
    injectedWheels: [
      { id: 'lineage', displayName: 'Draconic Lineage', order: 1, segments: [
        { label: 'Common Wyrm', weight: 5, description: 'Solid dragon. Standard hoard.' },
        { label: 'Wyrmling Royal', weight: 4, statBonusGrants: { strength: 'statBonus', potential: 'statBonus' }, description: 'Hatched on a throne. Will reclaim it.' },
        { label: 'Catastrophe Line', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Made to end ages.' },
        { label: 'Elder Wyrm', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Saw the first kingdom. Watched it fall.' },
        { label: 'Primal Drake', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Older than dragons. Older than the word for dragon.' },
      ]},
      { id: 'hoard', displayName: 'Hoard', order: 2, segments: [
        { label: 'Modest', weight: 5, description: 'A few choice pieces.' },
        { label: 'Treasure Pile', weight: 4, statBonusGrants: { charisma: 'statBonus', potential: 'statBonus' }, description: 'Sleeps on it. Wakes counting.' },
        { label: 'Reliquary', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, description: "Each piece a piece of someone's history." },
        { label: 'Cursed Wealth', weight: 2, statBonusGrants: { powerMastery: 'statBonus', durability: 'statBonus', charisma: 'statPenalty' }, description: 'Bad things happen to thieves. Slow ones.' },
        { label: 'World-Hoard', weight: 1, statBonusGrants: { strength: 'statBonus', iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'More wealth than nations.' },
      ]},
      { id: 'catastrophe', displayName: 'Catastrophe', order: 3, segments: [
        { label: 'Slumbering', weight: 6, description: 'The world has not provoked them yet.' },
        { label: 'Stirring', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Eyes opening. Tail twitching.' },
        { label: 'Sky-Cracker', weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Flight leaves storms behind.' },
        { label: 'World-Ender', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', fightingSkill: 'statBonus' }, description: 'The hero who slays this dragon is not yet born.' },
      ]},
    ],
    transformationPool: [
      { label: 'Hatchling Power',    weight: 4, element: 'Fire', grade: 'D', statBonus: 0.8,  statBonusGrants: { strength: 'statPenalty', durability: 'statPenalty' } },
      { label: 'Young Dragon',       weight: 3, element: 'Fire', grade: 'C', statBonusGrants: { strength: 'statBonus' }, statBonus: 1.0 },
      { label: 'Adult Dragon',       weight: 3, element: 'Fire', grade: 'B', statBonus: 1.3,  statBonusGrants: { strength: 'statBonus' } },
      { label: 'Elder Dragon',       weight: 2, element: 'Fire', grade: 'A', statBonus: 1.7,  statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      { label: 'Ancient Dragon',     weight: 1, element: 'Fire', grade: 'S', statBonus: 2.1,  statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Great Wyrm',         weight: 1, element: 'Fire', grade: 'SS', statBonus: 2.5,  statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', fightingSkill: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "15' (Hatchling)",  weight: 3 }, { label: "20' (Young)",       weight: 3 },
      { label: "30' (Adult)",      weight: 4 }, { label: "45' (Elder)",        weight: 2 },
      { label: "60' (Ancient)",    weight: 1 }, { label: "80' (Great Wyrm)",   weight: 1 },
      { label: 'City-Block-Sized', weight: 1 }, { label: 'Unmeasurable',       weight: 1 },
    ],
    subTypePool: [
      { label: 'Red Dragon',    weight: 2, element: 'Fire', grade: 'B' }, { label: 'Blue Dragon',  weight: 2, element: 'Lightning', grade: 'B' },
      { label: 'Green Dragon',  weight: 2, element: 'Poison', grade: 'B' }, { label: 'Black Dragon',  weight: 2, element: 'Shadow', grade: 'B' },
      { label: 'White Dragon',  weight: 2, element: 'Ice', grade: 'B' }, { label: 'Gold Dragon',   weight: 1, element: 'Fire', grade: 'A' },
      { label: 'Silver Dragon', weight: 1, element: 'Ice', grade: 'A' }, { label: 'Shadow Dragon', weight: 1, element: 'Shadow', grade: 'A' },
    ],
    abilities: [
      { label: 'Legendary Breath Weapon', weight: 2, element: 'Shadow', grade: 'A' },
      { label: 'Dragon Fear Aura', weight: 2, element: 'Psychic', grade: 'C' },
      { label: 'Wing Attack', weight: 2, element: 'Shadow', grade: 'A' },
      { label: 'Tail Swipe', weight: 2, element: 'Shadow', grade: 'A' },
      { label: 'Legendary Resistance', weight: 1, element: 'Shadow', grade: 'A' },
      { label: 'Hoard Sense', weight: 2, element: 'Shadow', grade: 'A' },
      { label: 'Ancient Cunning', weight: 1, element: 'Shadow', grade: 'A' },
    ],
  },
  {
    label: 'Sphinx',
    spinIdentity: ['FateManipulator'],
    limitBreakOdds: 52,
    weight: 4,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.6,
    minStatTier: 'C-',
    description: 'Ancient riddle-keeper. Answers questions with worse questions.',
    injectedWheels: [
      { id: 'riddle', displayName: 'Riddle Type', order: 1, segments: [
        { label: 'Common', weight: 5, statBonusGrants: { iq: 'statBonus' }, description: 'The riddle has a known answer. Solving it earns mercy.' },
        { label: 'Ancient', weight: 4, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, description: 'The riddle is older than civilisation. The answer reshapes the asker.' },
        { label: 'Personal', weight: 3, statBonusGrants: { iq: 'statBonus', charisma: 'statBonus' }, description: 'The riddle is about the person asked. They will not like the answer.' },
        { label: 'Cosmic', weight: 2, statBonusGrants: { iq: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' }, description: 'The riddle pertains to the structure of the universe.' },
        { label: 'Unanswerable', weight: 1, statBonusGrants: { iq: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'There is no answer. The riddle is the test.' },
      ]},
      { id: 'prophecy', displayName: 'Prophecy Granted', order: 2, segments: [
        { label: 'Riddle Withheld', weight: 5, description: 'No prophecy. The encounter passes.' },
        { label: 'Veiled', weight: 4, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, description: 'Cryptic verse. Useful in retrospect.' },
        { label: 'Specific', weight: 3, statBonusGrants: { iq: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' }, description: 'Names a future enemy. Names a future ally.' },
        { label: 'Devastating', weight: 2, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', charisma: 'statPenalty' }, description: "Tells of the asker's death. Date included." },
        { label: 'World-Changing', weight: 1, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: "The asker is now responsible for the world's fate." },
      ]},
    ],
    statModifiers: { iq: 2.0, potential: 1.7, charisma: 1.4 },
    subTypePool: [
      { label: 'Androsphinx',   weight: 3, element: 'Light', grade: 'B', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Legendary Roar (Passive)', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Claw Combat Mastery', weight: 2, element: 'Light', grade: 'C' }, { label: 'Lair Sense', weight: 2, element: 'Light', grade: 'B' }, { label: 'Fear Immunity', weight: 2, element: 'Psychic', grade: 'B' }, { label: "Champion's Presence", weight: 2 }, { label: 'Solar Bond', weight: 1, element: 'Fire', grade: 'B' }], powerPool: [{ label: 'Androsphinx Roar', weight: 3 }, { label: 'Riddle Binding', weight: 3 }, { label: 'Fear Projection', weight: 2 }, { label: 'Precognition', weight: 2 }, { label: 'Ancient Dominion', weight: 1 }] },
      { label: 'Gynosphinx',    weight: 3, element: 'Arcane', grade: 'B', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Riddle Mastery', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Future Thread Sight', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Ancient Library', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Divination Focus', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Ward Permanence', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Knowledge Lock', weight: 1, element: 'Arcane', grade: 'B' }], powerPool: [{ label: 'Riddle Binding', weight: 3 }, { label: 'Divination', weight: 3 }, { label: 'Prophetic Wing', weight: 2 }, { label: 'Precognition', weight: 2 }, { label: 'Tome of All Knowledge', weight: 1 }] },
      { label: 'Hieracosphinx', weight: 2, element: 'Wind', grade: 'C', statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, abilities: [{ label: 'Raptor Strike', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Aerial Predator', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Eyesight Precision', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Dive Attack', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Talon Lock', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Hunting Hymn', weight: 1, element: 'Wind', grade: 'C' }], powerPool: [{ label: 'Predator Stance', weight: 3 }, { label: 'Pounce Strike', weight: 3 }, { label: 'Androsphinx Roar', weight: 2 }, { label: 'Flight', weight: 2 }, { label: 'Hunter\'s Mark', weight: 1 }] },
      { label: 'Criosphinx',    weight: 2, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Ram Aura', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Force of Will', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Grounded Stance', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Charge Sense', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Territorial Roar', weight: 2, element: 'Sound', grade: 'C' }, { label: 'Petrify Gaze (Passive)', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Gaze of Stone', weight: 3 }, { label: 'Prophetic Wing', weight: 3 }, { label: 'Riddle Binding', weight: 2 }, { label: 'Fear Projection', weight: 2 }, { label: 'Petrification Touch', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "12' (Shoulder)", weight: 3 }, { label: "15' (Shoulder)", weight: 5 },
      { label: "18' (Shoulder)", weight: 5 }, { label: "20' (Shoulder)", weight: 4 },
      { label: "25' (Shoulder)", weight: 2 }, { label: "30' (Ancient)", weight: 1 },
    ],

    abilities: [
      { label: 'Riddle Compulsion', weight: 2, element: 'Earth', grade: 'C' },
      { label: 'Clairvoyance', weight: 2, element: 'Time', grade: 'C' },
      { label: 'Timeless Body', weight: 1, element: 'Earth', grade: 'C' },
      { label: "Sphinx's Gaze", weight: 2 },
      { label: 'Ancient Knowledge', weight: 2, element: 'Earth', grade: 'C' },
      { label: 'Prophetic Dream', weight: 1, element: 'Earth', grade: 'C' },
      { label: 'Ward Setting', weight: 1, element: 'Arcane', grade: 'C' },
    ],
  },
  {
    label: 'Saiyan',
    spinIdentity: ['Evolution', 'Scaling'],
    limitBreakOdds: 55,
    weight: 4,
    abilitySpinCount: 3,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 0.8,
    minStatTier: 'C',
    description: 'Elite warrior race from Planet Vegeta. Gets dramatically stronger every time they nearly die.',
    statModifiers: { strength: 1.9, speed: 1.7, fightingSkill: 1.9, durability: 1.5, armorStrength: 1.2 },
    // Evolution + Scaling identity: a Rage Threshold wheel that determines
    // how easily the character escalates mid-fight (lower threshold = more
    // transformations triggered). Stacks on top of the existing
    // transformationPool (Super Saiyan ladder) for double-axis growth.
    injectedWheels: [
      { id: 'rageThreshold', displayName: 'Rage Threshold', order: 2, segments: [
        { label: 'Stoic',             weight: 5, statBonusGrants: { iq: 'statBonus' },           description: 'Hard to provoke — slower transformation triggers.' },
        { label: 'Tempered',          weight: 6, statBonusGrants: { fightingSkill: 'statBonus' }, description: 'Standard Saiyan baseline.' },
        { label: 'Volatile',          weight: 4, statBonusGrants: { strength: 'statBonus', charisma: 'statPenalty' }, description: 'Powers up quickly — but loses control.' },
        { label: 'Berserker Heart',   weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', iq: 'statPenalty' }, description: 'Always one bad day from Oozaru.' },
        { label: 'Battle-Lust',       weight: 1, statBonusGrants: { strength: 'statBonus', potential: 'statBonus' }, description: 'Lives for the next fight. Each near-death pushes the curve.' },
      ]},
      { id: 'powerLevel', displayName: 'Power Level', order: 3, segments: [
        { label: 'Low Reading',    weight: 5, statBonusGrants: { fightingSkill: 'statBonus' }, description: 'Scouters dismiss them. A mistake.' },
        { label: 'Mid-Tier Class', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Read by scouters as solid. Saiyan-pride.' },
        { label: 'Elite Tier',     weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Top of the standard scouter range. Scouters break.' },
        { label: 'Off the Charts', weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', potential: 'statBonus' }, description: 'Reading is impossible. Scouters explode trying.' },
        { label: 'Legendary',      weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Legendary Super Saiyan — born once every thousand years.' },
      ]},
    ],
    classPool: [
      { label: 'Low-Class Warrior',  weight: 5, element: 'Fire', grade: 'D', statBonusGrants: { fightingSkill: 'statPenalty' }, abilities: [{ label: 'Battle Instinct', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Ki Control Foundation', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Combat Grit', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Underdog Push', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Hardened by Loss', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Street-Level Combat', weight: 1, element: 'Fire', grade: 'C' }], powerPool: [{ label: 'Ki Blast', weight: 3 }, { label: 'Flight (Saiyan)', weight: 3 }, { label: 'Zenkai Surge', weight: 2 }, { label: 'Combat Flow State', weight: 2 }, { label: 'Battle Precognition', weight: 1 }] },
      { label: 'Mid-Class Warrior',  weight: 3, element: 'Fire', grade: 'C', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Tactical Combat', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Efficient Ki Use', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Squad Coordination', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Combat Speed Increase', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Veteran Endurance', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Mid-Tier Surge', weight: 1, element: 'Fire', grade: 'C' }], powerPool: [{ label: 'Ki Blast', weight: 3 }, { label: 'Flight (Saiyan)', weight: 3 }, { label: 'Zenkai Surge', weight: 2 }, { label: 'Warrior Trance', weight: 2 }, { label: 'Super Strength', weight: 1 }] },
      { label: 'Elite Warrior',      weight: 2, element: 'Fire', grade: 'B', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'Superior Battle Sense', weight: 2, element: 'Fire', grade: 'C' }, { label: 'High Ki Capacity', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Elite Reflex', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Pride of the Elite', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Advanced Ki Technique', weight: 2, element: 'Fire', grade: 'B' }, { label: "Warrior's Inheritance", weight: 1 }], powerPool: [{ label: 'Ki Blast', weight: 3 }, { label: 'Flight (Saiyan)', weight: 3 }, { label: 'Zenkai Surge', weight: 2 }, { label: 'Hakai (Destruction)', weight: 2 }, { label: 'Super Strength', weight: 1 }] },
      { label: 'Royal Blood (Prince / King Lineage)', weight: 1, element: 'Fire', grade: 'A', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus' }, abilities: [{ label: 'Royal Ki Aura', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Command Presence', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Legendary Battle Potential', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Ruling Combat Style', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Pride Amplification', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Bloodline Awakening', weight: 1, element: 'Blood', grade: 'A' }], powerPool: [{ label: 'Hakai (Destruction)', weight: 3 }, { label: 'Ki Blast', weight: 3 }, { label: 'Flight (Saiyan)', weight: 2 }, { label: 'Zenkai Surge', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Base Saiyan',             weight: 5, element: 'Fire', grade: 'C', statBonus: 1.0,  grantedPowers: ['Ki Blast'] },
      { label: 'Super Saiyan',            weight: 4, element: 'Fire', grade: 'B', statBonus: 1.4,  statBonusGrants: { strength: 'statBonus' }, grantedPowers: ['Ki Blast', 'Flight (Saiyan)'] },
      { label: 'Super Saiyan 2',          weight: 3, element: 'Fire', grade: 'A', statBonus: 1.7,  statBonusGrants: { strength: 'statBonus', speed: 'statBonus' }, grantedPowers: ['Ki Blast', 'Flight (Saiyan)'] },
      { label: 'Super Saiyan 3',          weight: 2, element: 'Fire', grade: 'S', statBonus: 2.0,  statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus' }, grantedPowers: ['Ki Blast', 'Flight (Saiyan)', 'Zenkai Surge'] },
      { label: 'Super Saiyan God',        weight: 2, element: 'Fire', grade: 'SS', statBonus: 2.4,  statBonusGrants: { strength: 'statBonus', speed: 'statBonus', durability: 'statBonus' }, grantedPowers: ['Ki Blast', 'Flight (Saiyan)', 'Zenkai Surge'] },
      { label: 'Super Saiyan Blue',       weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 2.7,  statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus', agility: 'statBonus' }, grantedPowers: ['Ki Blast', 'Flight (Saiyan)', 'Zenkai Surge'] },
      { label: 'Ultra Instinct',          weight: 1, element: 'Cosmic', grade: 'SSS', statBonus: 3.0,  statBonusGrants: { agility: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus', strength: 'statBonus', durability: 'statBonus' }, grantedPowers: ['Ki Blast', 'Flight (Saiyan)', 'Zenkai Surge', 'Hakai (Destruction)'] },
    ],
    customHeightPool: [
      { label: "5'2\"", weight: 3 }, { label: "5'4\"", weight: 6 }, { label: "5'6\"", weight: 7 },
      { label: "5'8\"", weight: 7 }, { label: "5'10\"", weight: 6 }, { label: "6'0\"", weight: 4 },
      { label: "6'2\"", weight: 2 }, { label: "6'4\"", weight: 1 },
    ],

    abilities: [
      { label: 'Zenkai Surge', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Ki Blast', weight: 3, element: 'Cosmic', grade: 'C' },
      { label: 'Super Saiyan Transformation', weight: 1, element: 'Cosmic', grade: 'D' },
      { label: 'Combat Instinct', weight: 3, element: 'Cosmic', grade: 'C' },
      { label: 'Oozaru Form (Full Moon)', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Battle-Hardened Will', weight: 2, element: 'Earth', grade: 'C' },
      { label: 'Power Level: Unmeasurable', weight: 1, element: 'Cosmic', grade: 'SSS' },
    ],
  },
  {
    label: 'Githyanki',
    spinIdentity: ['Combo'],
    limitBreakOdds: 44,
    weight: 4,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.1,
    minStatTier: 'C-',
    description: 'Astral plane warriors who find your dimension deeply underwhelming.',
    injectedWheels: [
      { id: 'astral', displayName: 'Astral Calling', order: 1, segments: [
        { label: 'Border Patrol', weight: 4, statBonusGrants: { agility: 'statBonus', fightingSkill: 'statBonus' }, description: 'Watches the edges of the realm.' },
        { label: 'Knight', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, description: 'Trained from childhood for combat.' },
        { label: 'Astral Pirate', weight: 3, statBonusGrants: { agility: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Boards passing dreams. Steals what is owed.' },
        { label: "Lich Queen's Chosen", weight: 2, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Personal champion. Bound to the throne.' },
        { label: 'Renegade', weight: 1, statBonusGrants: { fightingSkill: 'statBonus', iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Cut ties. Hunted by their own. Stronger for it.' },
      ]},
      { id: 'psionic', displayName: 'Psionic Discipline', order: 2, segments: [
        { label: 'Telekinesis', weight: 4, statBonusGrants: { powerMastery: 'statBonus', agility: 'statBonus' }, description: 'Lifts. Throws. Pins.' },
        { label: 'Telepathy', weight: 4, statBonusGrants: { iq: 'statBonus', charisma: 'statBonus' }, description: 'Hears thoughts. Sends thoughts.' },
        { label: 'Shaper', weight: 3, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Builds psionic constructs. Weapons. Armour. Walls.' },
        { label: 'Soul Knife', weight: 2, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Blade made of thought. Cuts what physical weapons cannot.' },
        { label: 'Mind-Lord', weight: 1, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', charisma: 'statBonus', potential: 'statBonus' }, description: 'All disciplines. Dominates rooms before entering them.' },
      ]},
    ],
    statModifiers: { fightingSkill: 1.6, iq: 1.4 },
    classPool: [
      { label: 'Gith Warrior',       weight: 4, element: 'Psychic', grade: 'C', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Psionic Blade Form', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Astral Discipline', weight: 2, element: 'Cosmic', grade: 'C' }, { label: 'Silver Sword Bond', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Spatial Awareness', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Gith Battle Art', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Planar Strike', weight: 1, element: 'Psychic', grade: 'C' }], powerPool: [{ label: 'Astral Strike', weight: 3 }, { label: 'Mind Blade Conjuration', weight: 3 }, { label: 'Silver Sword Throw', weight: 2 }, { label: 'Combat Flow State', weight: 2 }, { label: 'Psionic Leap', weight: 1 }] },
      { label: 'Gish (Warrior-Mage)', weight: 3, element: 'Psychic', grade: 'B', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Spell-Blade Integration', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Battle Counterspell', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Arcane Combat Flow', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Psionic Spell Blend', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Runic Weapon', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Mind-Edge Technique', weight: 1, element: 'Psychic', grade: 'B' }], powerPool: [{ label: 'Astral Strike', weight: 3 }, { label: 'Arcane Barrage', weight: 3 }, { label: 'Mind Blade Conjuration', weight: 2 }, { label: 'Counterspell', weight: 2 }, { label: 'Psionic Leap', weight: 1 }] },
      { label: 'Psionic Adept',      weight: 2, element: 'Psychic', grade: 'A', statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Psionic Precision', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Empathic Shield', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Thought Projection', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Mind Probe', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Psychic Field', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Psi-Resonance', weight: 1, element: 'Sound', grade: 'B' }], powerPool: [{ label: 'Telepathy', weight: 3 }, { label: 'Telekinesis', weight: 3 }, { label: 'Psionic Leap', weight: 2 }, { label: 'Neural Hijack', weight: 2 }, { label: 'Mind Shatter', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'8\"", weight: 3 }, { label: "5'10\"", weight: 5 }, { label: "6'0\"", weight: 6 },
      { label: "6'2\"", weight: 6 }, { label: "6'4\"", weight: 5 }, { label: "6'6\"", weight: 3 },
      { label: "6'8\"", weight: 2 }, { label: "7'0\" (Psionic Brute)", weight: 1 },
    ],

    abilities: [
      { label: 'Psionic Blade', weight: 2, element: 'Psychic', grade: 'A' },
      { label: 'Astral Projection', weight: 2, element: 'Cosmic', grade: 'A' },
      { label: 'Psionic Resistance', weight: 2, element: 'Psychic', grade: 'A' },
      { label: 'Planar Awareness', weight: 2, element: 'Psychic', grade: 'A' },
      { label: 'Silver Sword Mastery', weight: 1, element: 'Metal', grade: 'C' },
      { label: 'Mindlink', weight: 1, element: 'Psychic', grade: 'A' },
      { label: 'Nullify Magic Field', weight: 1, element: 'Arcane', grade: 'A' },
    ],
  },
  {
    label: 'Mindflayer',
    spinIdentity: ['Corruption', 'Summoner'],
    limitBreakOdds: 48,
    weight: 4,
    abilitySpinCount: 3,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 1.3,
    minStatTier: 'C-',
    description: 'Eldritch intelligence. Does not respect your personal space.',
    injectedWheels: [
      { id: 'brainConsumption', displayName: 'Brain Consumption', order: 1, segments: [
        { label: 'Reserved', weight: 4, statBonusGrants: { iq: 'statBonus' }, description: 'Selective diet.' },
        { label: 'Common Mind', weight: 4, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, description: 'One per cycle. Maintains baseline genius.' },
        { label: 'Specialist', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Hunts experts. Inherits skill.' },
        { label: 'Royal Cuisine', weight: 2, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Only the most refined minds. Sovereign palate.' },
        { label: 'Insatiable', weight: 1, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' }, description: 'Devours indiscriminately. Mind stacked twenty deep.' },
      ]},
      { id: 'psychicEvolution', displayName: 'Psychic Evolution', order: 2, segments: [
        { label: 'Standard', weight: 4, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, description: 'Stage 1 mindflayer. Standard arsenal.' },
        { label: 'Refined', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', fightingSkill: 'statBonus' }, description: 'Learnt to fight in the body. Not just the mind.' },
        { label: 'Ascended', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Lifecycle accelerated. Psionics expanded.' },
        { label: 'Elder Brain', weight: 2, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Final stage. No body. All minds.' },
        { label: 'Singular', weight: 1, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'One being. Many minds. Existential threat.' },
      ]},
    ],
    statModifiers: { iq: 2.0, potential: 1.8, strength: 0.5, charisma: 0.4 },
    subTypePool: [
      { label: 'Standard Mindflayer',          weight: 4, element: 'Psychic', grade: 'C', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Tentacle Probe', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Neural Feed', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Psionic Ping', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Memory Siphon', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Mind Screech', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Psychic Lock', weight: 1, element: 'Psychic', grade: 'C' }], powerPool: [{ label: 'Neural Hijack', weight: 3 }, { label: 'Telepathy', weight: 3 }, { label: 'Mind Shatter', weight: 2 }, { label: 'Tentacle Barrage', weight: 2 }, { label: 'Psychic Shield', weight: 1 }] },
      { label: 'Elder Brain Fragment',          weight: 3, element: 'Psychic', grade: 'B', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Hivemind Trace', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Elder Directive', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Collective Knowledge', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Brain Parasite Resistance', weight: 2, element: 'Water', grade: 'B' }, { label: 'Psionic Relay', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Vast Memory Pool', weight: 1, element: 'Psychic', grade: 'B' }], powerPool: [{ label: 'Elder Brain Link', weight: 3 }, { label: 'Psychic Consumption', weight: 3 }, { label: 'Neural Hijack', weight: 2 }, { label: 'Mind Shatter', weight: 2 }, { label: 'Hivemind Creation', weight: 1 }] },
      { label: 'Ulitharid (Noble Strain)',      weight: 2, element: 'Psychic', grade: 'A', statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Noble Psi', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Command Aura', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Elevated Psyche', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Crown Presence', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Glyph of Domination', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Psychic Immunity (Partial)', weight: 1, element: 'Psychic', grade: 'A' }], powerPool: [{ label: 'Elder Brain Link', weight: 3 }, { label: 'Psychic Dominion', weight: 3 }, { label: 'Mind Shatter', weight: 2 }, { label: 'Psychic Consumption', weight: 2 }, { label: 'Hivemind Creation', weight: 1 }] },
      { label: 'Rogue Mindflayer',              weight: 3, element: 'Psychic', grade: 'C', statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Independent Thought', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Survival Psi', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Loner Tactics', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Unpredictable Feed', weight: 2, element: 'Chaos', grade: 'C' }, { label: 'Feral Mind Blast', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Self-Optimization', weight: 1, element: 'Psychic', grade: 'C' }], powerPool: [{ label: 'Tentacle Barrage', weight: 3 }, { label: 'Neural Hijack', weight: 3 }, { label: 'Telepathy', weight: 2 }, { label: 'Mind Shatter', weight: 2 }, { label: 'Shadow Step', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Isolated Psionic',       weight: 5, element: 'Psychic', grade: 'C', statBonusGrants: { iq: 'statBonus' }, statBonus: 1.0 },
      { label: 'Networked Mind',         weight: 4, element: 'Psychic', grade: 'B', statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, statBonus: 1.2 },
      { label: 'Hivemind Node',          weight: 3, element: 'Psychic', grade: 'A', statBonusGrants: { iq: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' }, statBonus: 1.5 },
      { label: 'Elder Brain Vessel',     weight: 2, element: 'Psychic', grade: 'S', statBonusGrants: { iq: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, statBonus: 1.8 },
      { label: 'Absolute Psionic',       weight: 1, element: 'Psychic', grade: 'SS', statBonus: 2.3, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'6\"", weight: 3 }, { label: "5'8\"", weight: 6 }, { label: "5'10\"", weight: 8 },
      { label: "6'0\"", weight: 7 }, { label: "6'2\"", weight: 5 }, { label: "6'4\"", weight: 3 },
      { label: '(Tentacles Not Included)', weight: 1 },
    ],

    customGenderPool: [
      { label: 'Genderless (Colony Organism)', weight: 1 },
    ],

    abilities: [
      { label: 'Mind Blast', weight: 2, element: 'Psychic', grade: 'SS' },
      { label: 'Tentacle Grab', weight: 2, element: 'Psychic', grade: 'SS' },
      { label: 'Telepathic Bond', weight: 2, element: 'Psychic', grade: 'SS' },
      { label: 'Elder Brain Connection', weight: 1, element: 'Water', grade: 'SS' },
      { label: 'Psionic Defense', weight: 2, element: 'Psychic', grade: 'SS' },
      { label: 'Cerebral Parasite', weight: 1, element: 'Psychic', grade: 'SS' },
      { label: 'Consume Memories', weight: 1, element: 'Psychic', grade: 'SS' },
    ],
  },
  // Symbiote (Marvel)
  {
    label: 'Symbiote',
    spinIdentity: ['Evolution', 'Scaling'],
    limitBreakOdds: 46,
    weight: 4,
    abilitySpinCount: 3,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 1.5,
    minStatTier: 'C-',
    description: 'An alien parasite bonded to a host. The relationship is complicated. Benefits include web-swinging and poor impulse control.',
    injectedWheels: [
      { id: 'host', displayName: 'Host Compatibility', order: 1, segments: [
        { label: 'Rejected', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', charisma: 'statPenalty' }, description: 'Body fights it. Bond is constant struggle.' },
        { label: 'Tolerated', weight: 5, statBonusGrants: { strength: 'statBonus', agility: 'statBonus' }, description: 'Standard bond. Each side maintains identity.' },
        { label: 'Compatible', weight: 3, statBonusGrants: { strength: 'statBonus', agility: 'statBonus', durability: 'statBonus' }, description: 'Symbiote and host work in tandem.' },
        { label: 'Synchronized', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', agility: 'statBonus', powerMastery: 'statBonus' }, description: 'Two minds. One body. Same goal.' },
        { label: 'Perfect Bond', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Indistinguishable. One being now.' },
      ]},
      { id: 'symMutation', displayName: 'Mutation', order: 2, segments: [
        { label: 'Tendril Manipulation', weight: 5, statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus' }, description: 'Reach extended. Strikes from angles.' },
        { label: 'Shape Memory', weight: 4, statBonusGrants: { agility: 'statBonus', iq: 'statBonus' }, description: 'Body becomes weapons on call.' },
        { label: 'Power Absorb', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Eats enemy techniques. Adds them.' },
        { label: 'Multi-Spawn', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Splits off. Each piece fights independently.' },
        { label: 'True Form', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', charisma: 'statPenalty' }, description: "Drops the disguise. Whatever you thought it was, it's worse." },
      ]},
    ],
    statModifiers: { strength: 1.8, agility: 1.6, durability: 1.5, charisma: 0.6 },
    subTypePool: [
      { label: 'Venom Symbiote',    weight: 4, element: 'Void', grade: 'B', abilities: [{ label: 'We Are Venom Aura', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Tongue Lash', weight: 2, element: 'Void', grade: 'B' }, { label: 'Spider-Sense Block', weight: 2, element: 'Void', grade: 'B' }, { label: 'Lethal Protector Mode', weight: 2, element: 'Void', grade: 'B' }, { label: 'Klyntar Merge Control', weight: 2, element: 'Void', grade: 'B' }, { label: 'Hunger Surge', weight: 1, element: 'Void', grade: 'B' }], grantedPowers: ['Venom Injection', 'Web Slinging'] },
      { label: 'Carnage Symbiote',  weight: 3, element: 'Blood', grade: 'B', abilities: [{ label: 'Chaotic Shard Launch', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Unhinged Bond', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Frenzy Mode', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Spawn Tendrils (Instant)', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Rage Amplification', weight: 2, element: 'Time', grade: 'B' }, { label: 'No Restraint Protocol', weight: 1, element: 'Water', grade: 'B' }], grantedPowers: ['Symbiote Tendrils'] },
      { label: 'Anti-Venom Symbiote', weight: 2, element: 'Light', grade: 'B', abilities: [{ label: 'Toxin Cleanse', weight: 2, element: 'Light', grade: 'B' }, { label: 'Healing Surge', weight: 2, element: 'Light', grade: 'B' }, { label: 'Pathogen Immunity', weight: 2, element: 'Light', grade: 'B' }, { label: 'White Symbiote Form', weight: 2, element: 'Light', grade: 'B' }, { label: 'Anti-Lethal Field', weight: 2, element: 'Light', grade: 'B' }, { label: 'Purity Burst', weight: 1, element: 'Light', grade: 'B' }] },
      { label: 'Toxin Symbiote',    weight: 2, element: 'Poison', grade: 'B', abilities: [{ label: 'Venom Resistance', weight: 2, element: 'Poison', grade: 'B' }, { label: 'Poison Adaptation', weight: 2, element: 'Poison', grade: 'B' }, { label: 'Toxin Injection (Passive)', weight: 2, element: 'Poison', grade: 'B' }, { label: 'Dangerous Balance', weight: 2, element: 'Poison', grade: 'B' }, { label: 'Erratic Combat', weight: 2, element: 'Poison', grade: 'C' }, { label: 'Unstable Bond Power', weight: 1, element: 'Chaos', grade: 'B' }], grantedPowers: ['Venom Injection'] },
      { label: 'Scream Symbiote',   weight: 2, element: 'Sound', grade: 'B', abilities: [{ label: 'Sonic Immunity (Partial)', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Sonic Burst Weapon', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Pheromone Manipulation', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Chaotic Frenzy', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Predator Call', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Sound Shaping', weight: 1, element: 'Sound', grade: 'B' }] },
      { label: 'Knull-Blessed (King in Black Fragment)', weight: 1, element: 'Void', grade: 'S', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Necrosymbiosis', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Dark Construct', weight: 2, element: 'Shadow', grade: 'S' }, { label: 'Void Blade', weight: 2, element: 'Void', grade: 'S' }, { label: 'Shadow Corruption (Passive)', weight: 2, element: 'Shadow', grade: 'S' }, { label: 'King in Black Trace', weight: 2, element: 'Shadow', grade: 'S' }, { label: 'Absolute Darkness', weight: 1, element: 'Shadow', grade: 'S' }], grantedPowers: ['Shadow Corruption'] },
    ],
    transformationPool: [
      { label: 'Partial Bond',             weight: 5, element: 'Void', grade: 'D', statBonusGrants: { strength: 'statPenalty' }, statBonus: 0.8 },
      { label: 'Stable Bond',              weight: 4, element: 'Void', grade: 'C', statBonusGrants: { strength: 'statBonus' }, statBonus: 1.0 },
      { label: 'Deep Merge',               weight: 3, element: 'Void', grade: 'B', statBonusGrants: { strength: 'statBonus', agility: 'statBonus' }, statBonus: 1.4 },
      { label: 'Perfect Symbiosis',        weight: 2, element: 'Void', grade: 'A', statBonusGrants: { strength: 'statBonus', agility: 'statBonus', durability: 'statBonus' }, statBonus: 1.8 },
      { label: 'Hive-Aware (Full Klyntar)', weight: 1, element: 'Void', grade: 'SS', statBonus: 2.2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
    ],
    customHeightPool: [
      { label: 'Host-Dependent', weight: 6 }, { label: 'Host +6" (Bonded Mass)', weight: 4 },
      { label: 'Host +1\' (Full Form)', weight: 3 }, { label: 'Variable (Terrifying)', weight: 2 },
    ],

    abilities: [
      { label: 'Symbiote Tendrils', weight: 3, element: 'Void', grade: 'SS' },
      { label: 'Shapeshifting Armor', weight: 3, element: 'Void', grade: 'SS' },
      { label: 'Spider-Sense Nullification', weight: 2, element: 'Void', grade: 'SS' },
      { label: 'Lethal Bite', weight: 2, element: 'Void', grade: 'SS' },
      { label: 'Klyntar Camouflage', weight: 2, element: 'Shadow', grade: 'SS' },
      { label: 'Healing Factor (Shared)', weight: 1, element: 'Void', grade: 'SS' },
      { label: 'Sound/Fire Weakness (Mutual)', weight: 1, element: 'Fire', grade: 'SS' },
    ],
  },
  // Hollow / Arrancar (Bleach)
  {
    label: 'Hollow / Arrancar',
    spinIdentity: ['Evolution', 'Corruption'],
    limitBreakOdds: 52,
    weight: 4,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.2,
    minStatTier: 'C-',
    description: 'A corrupted soul with a hole in its chest and an axe to grind. Arrancar have removed their mask for more human form and power.',
    injectedWheels: [
      { id: 'mask', displayName: 'Mask Evolution', order: 1, segments: [
        { label: 'Crude Mask', weight: 5, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Whole mask. Pure hollow.' },
        { label: 'Cracked Mask', weight: 4, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus' }, description: 'Stage of arrancar. Power expanding.' },
        { label: 'Half Mask', weight: 3, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', iq: 'statBonus' }, description: 'Form approaches human. Strength does not drop.' },
        { label: 'Fragment Only', weight: 2, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus', iq: 'statBonus' }, description: 'Identity recovered. Power refined.' },
        { label: 'Vasto Lorde', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Above captain-class. Each one a kingdom alone.' },
      ]},
      { id: 'hollowStage', displayName: 'Hollow Stage', order: 2, segments: [
        { label: 'Hollow', weight: 4, statBonusGrants: { strength: 'statBonus' }, description: 'Pure hunger. No technique.' },
        { label: 'Gillian', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Many souls. One body.' },
        { label: 'Adjuchas', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Refined. Personalised.' },
        { label: 'Vasto Lorde', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Apex evolution. Civilisation-tier threat.' },
      ]},
    ],
    statModifiers: { energyLevel: 1.7, strength: 1.5, fightingSkill: 1.4 },
    classPool: [
      { label: 'Gillian (menos grande)', weight: 4, element: 'Shadow', grade: 'D', statBonusGrants: { energyLevel: 'statPenalty', iq: 'statPenalty' }, abilities: [{ label: 'Cero Burst (Basic)', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Mass Hollow Presence', weight: 2, element: 'Psychic', grade: 'D' }, { label: 'Spiritual Pressure (Low)', weight: 2, element: 'Arcane', grade: 'D' }, { label: 'Hollow Armor', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Instinct Combat', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Mindless Stampede', weight: 1, element: 'Shadow', grade: 'D' }], grantedPowers: ['Cero Blast'] },
      { label: 'Adjuchas',              weight: 3, element: 'Shadow', grade: 'C', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Enhanced Cero', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Vasto Potential', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Partial Regeneration', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Predator Mode', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Mask Strength', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Hollow Evolution Trace', weight: 1, element: 'Shadow', grade: 'C' }], grantedPowers: ['Cero Blast'] },
      { label: 'Vasto Lorde',           weight: 2, element: 'Shadow', grade: 'B', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Spiritual Perfection', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Cero Mastery', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Humanoid Hollow Form', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Combat Genius (Instinct)', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Power Resonance', weight: 2, element: 'Sound', grade: 'B' }, { label: "King's Pressure", weight: 1 }], grantedPowers: ['Cero Blast', 'Sonido Flash Step'] },
      { label: 'Arrancar',              weight: 3, element: 'Shadow', grade: 'B', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Resurreccion Trace', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Sword Form', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Hierro Mastery', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Sonido Reflex', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Hollow Hole Power', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Aspect of Death', weight: 1, element: 'Soul', grade: 'B' }], grantedPowers: ['Bone Manipulation'] },
      { label: 'Espada (Top 10)',       weight: 1, element: 'Shadow', grade: 'A', statBonusGrants: { energyLevel: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Number Carved Power', weight: 2, element: 'Shadow', grade: 'A' }, { label: 'Aspect of Death Mastery', weight: 2, element: 'Soul', grade: 'C' }, { label: 'Army Command', weight: 2, element: 'Shadow', grade: 'A' }, { label: 'Res Stage Unlock', weight: 2, element: 'Time', grade: 'A' }, { label: 'Terror Aura', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Espada Rivalry Bond', weight: 1, element: 'Shadow', grade: 'A' }], grantedPowers: ['Cero Blast', 'Bone Manipulation', 'Sonido Flash Step'] },
    ],
    transformationPool: [
      { label: 'Suppressed Reiatsu',    weight: 4, element: 'Shadow', grade: 'D', statBonusGrants: { energyLevel: 'statPenalty', strength: 'statPenalty' }, statBonus: 0.8 },
      { label: 'Base Form',             weight: 5, element: 'Shadow', grade: 'C', statBonusGrants: { energyLevel: 'statBonus' }, statBonus: 1.0 },
      { label: 'Resurreccion',          weight: 3, element: 'Shadow', grade: 'A', statBonusGrants: { energyLevel: 'statBonus', strength: 'statBonus', fightingSkill: 'statBonus' }, statBonus: 1.6 },
      { label: 'Segunda Etapa',         weight: 1, element: 'Shadow', grade: 'SS', statBonus: 2.4, statBonusGrants: { energyLevel: 'statBonus', strength: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'4\"", weight: 3 }, { label: "5'6\"", weight: 4 }, { label: "5'8\"", weight: 6 },
      { label: "5'10\"", weight: 7 }, { label: "6'0\"", weight: 6 }, { label: "6'2\"", weight: 5 },
      { label: "6'4\"", weight: 3 }, { label: "6'6\"", weight: 2 }, { label: "6'8\"", weight: 1 },
      { label: '(Gillian: 20m+)', weight: 1 },
    ],

    abilities: [
      { label: 'Cero (Spiritual Beam)', weight: 3, element: 'Arcane', grade: 'SS' },
      { label: 'Hierro (Iron Skin)', weight: 3, element: 'Earth', grade: 'SS' },
      { label: 'Sonido (Speed Burst)', weight: 2, element: 'Shadow', grade: 'SS' },
      { label: 'Pesquisa (Reiatsu Detection)', weight: 2, element: 'Shadow', grade: 'SS' },
      { label: 'Bala (Rapid Strike)', weight: 2, element: 'Shadow', grade: 'SS' },
      { label: 'Hollow Hole (Void Resilience)', weight: 1, element: 'Void', grade: 'SS' },
      { label: 'Mask Fragment (Power Reservoir)', weight: 1, element: 'Shadow', grade: 'SS' },
    ],
  },
  // Demon (Demon Slayer / Blue Exorcist / general anime)
  {
    label: 'Demon',
    spinIdentity: ['Corruption'],
    limitBreakOdds: 50,
    weight: 5,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.3,
    minStatTier: 'C-',
    description: 'Born or transformed into a being of supernatural evil. Varies from "slightly ominous" to "literal apocalypse engine".',
    injectedWheels: [
      { id: 'sin', displayName: 'Sin Domain', order: 1, segments: [
        { label: 'Wrath', weight: 4, statBonusGrants: { strength: 'statBonus', charisma: 'statPenalty' }, description: 'Always burning.' },
        { label: 'Pride', weight: 4, statBonusGrants: { charisma: 'statBonus', fightingSkill: 'statBonus' }, description: 'First in. Loudest. Right.' },
        { label: 'Greed', weight: 3, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, description: 'Wants what you have. Then what they have.' },
        { label: 'Envy', weight: 3, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', charisma: 'statPenalty' }, description: 'Wants to be them. Will settle for being above them.' },
        { label: 'Lust', weight: 2, statBonusGrants: { charisma: 'statBonus', powerMastery: 'statBonus' }, description: 'Pulls without pulling.' },
        { label: 'Sloth', weight: 2, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus', speed: 'statPenalty' }, description: 'Patient. Outlast everything.' },
        { label: 'Gluttony', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Consumes. Stops only when there is nothing left.' },
      ]},
      { id: 'pact', displayName: 'Pact', order: 2, segments: [
        { label: 'Loose', weight: 5, description: 'Bound to no one in particular.' },
        { label: 'Family Curse', weight: 4, statBonusGrants: { powerMastery: 'statBonus', durability: 'statPenalty' }, description: 'Sealed at birth. Mortal life paid the deposit.' },
        { label: 'Soul Trade', weight: 3, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statPenalty' }, description: 'Direct exchange. Power-for-essence.' },
        { label: 'Domain Pact', weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Sworn to a specific Hell.' },
        { label: 'Sovereign Pact', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus', charisma: 'statPenalty' }, description: 'Sworn to one of the seven. Rises with their throne.' },
      ]},
      { id: 'hellfire', displayName: 'Hellfire', order: 3, segments: [
        { label: 'Faint Ember', weight: 5, statBonusGrants: { energyLevel: 'statBonus' }, description: 'Always slightly too warm. People notice.' },
        { label: 'Glowing Veins', weight: 4, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Light beneath the skin.' },
        { label: 'Brimstone Aura', weight: 3, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus' }, description: 'Wrong heat. Wrong smell.' },
        { label: "Hell's Heart", weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Chest is a forge that opens occasionally.' },
        { label: 'Crowned in Flame', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', charisma: 'statBonus' }, description: 'The fire kneels. The fire chose them.' },
      ]},
    ],
    statModifiers: { strength: 1.7, speed: 1.5, durability: 1.4, charisma: 0.7 },
    subTypePool: [
      { label: 'Lesser Demon',    weight: 5, element: 'Fire', grade: 'D', statBonusGrants: { strength: 'statPenalty' }, abilities: [{ label: 'Demon Resistance (Basic)', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Corrupting Touch', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Night Vision', weight: 2, element: 'Shadow', grade: 'D' }, { label: 'Infernal Tenacity', weight: 2, element: 'Fire', grade: 'D' }, { label: 'Demonic Fear (Minor)', weight: 2, element: 'Psychic', grade: 'D' }, { label: 'Hunger Drive', weight: 1, element: 'Fire', grade: 'D' }] },
      { label: 'Greater Demon',   weight: 4, element: 'Fire', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Commanding Presence', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Nether Flame Control', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Infernal Durability', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Curse Aura', weight: 2, element: 'Soul', grade: 'C' }, { label: 'Demonic Resilience', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Fear Projection', weight: 1, element: 'Psychic', grade: 'C' }], grantedPowers: ['Nether Flame'] },
      { label: 'Demon King Lineage', weight: 2, element: 'Fire', grade: 'B', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', charisma: 'statBonus' }, abilities: [{ label: 'Royal Demon Blood', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Lineage Power Boost', weight: 2, element: 'Time', grade: 'B' }, { label: 'Blood Demon Command', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Infernal Crown Aura', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Domination Field', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Demon King Echo', weight: 1, element: 'Sound', grade: 'B' }], grantedPowers: ['Nether Flame', 'Soul Corruption'] },
      { label: 'Blood Demon Art User (Kibutsuji Clan)', weight: 2, element: 'Blood', grade: 'B', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Art Awakening', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Blood Art Precision', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Technique Evolution', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Regeneration Speed', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Combat Art', weight: 2, element: 'Blood', grade: 'C' }, { label: 'Blood Memory', weight: 1, element: 'Blood', grade: 'B' }] },
      { label: 'Half-Demon',      weight: 3, element: 'Fire', grade: 'C', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Dual Nature', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Human Emotion Boost', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Demon Power Burst', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Balance Mastery', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Cross-Blood Adaptation', weight: 2, element: 'Blood', grade: 'C' }, { label: 'Crisis Surge', weight: 1, element: 'Fire', grade: 'C' }] },
      { label: 'Demon of Tartarus (True Form)', weight: 1, element: 'Fire', grade: 'S', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'True Form Fragment', weight: 2, element: 'Fire', grade: 'S' }, { label: 'Tartarus Pressure', weight: 2, element: 'Gravity', grade: 'S' }, { label: 'Primordial Inferno', weight: 2, element: 'Fire', grade: 'SSS' }, { label: 'Ancient Grudge', weight: 2, element: 'Fire', grade: 'S' }, { label: 'World-End Aura', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Chaos Incarnate', weight: 1, element: 'Chaos', grade: 'S' }], grantedPowers: ['Nether Flame', 'Soul Corruption', 'Infernal Contract'] },
    ],
    transformationPool: [
      { label: 'Suppressed Form',       weight: 5, element: 'Fire', grade: 'D', statBonus: 0.8 },
      { label: 'Awakened Demon',        weight: 4, element: 'Fire', grade: 'C', statBonus: 1.1 },
      { label: 'True Form Partial',     weight: 3, element: 'Fire', grade: 'B', statBonus: 1.5 },
      { label: 'Blood Art Mastery',     weight: 2, element: 'Blood', grade: 'A', statBonus: 1.8 },
      { label: 'Demon Lord Ascension',  weight: 1, element: 'Fire', grade: 'SS', statBonus: 2.4, statBonusGrants: { strength: 'statBonus', speed: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'4\" (Suppressed Form)", weight: 3 }, { label: "5'8\"", weight: 4 }, { label: "6'0\"", weight: 5 },
      { label: "6'4\"", weight: 5 }, { label: "6'8\"", weight: 4 }, { label: "7'0\"", weight: 3 },
      { label: "7'6\"", weight: 2 }, { label: "8'0\" (True Form)", weight: 2 },
      { label: "9'0\" (Demon Lord)", weight: 1 }, { label: '(True Form: Immeasurable)', weight: 1 },
    ],

    abilities: [
      { label: 'Demonic Regeneration', weight: 3, element: 'Nature', grade: 'SS' },
      { label: 'Blood Art Technique', weight: 2, element: 'Blood', grade: 'SS' },
      { label: 'Infernal Strength', weight: 3, element: 'Fire', grade: 'SS' },
      { label: 'Soul Corruption Aura', weight: 2, element: 'Soul', grade: 'C' },
      { label: 'Hellfire Conjuration', weight: 2, element: 'Fire', grade: 'SS' },
      { label: 'Sunlight Weakness (Double-Edged)', weight: 1, element: 'Fire', grade: 'SS' },
      { label: 'Demonic Perception', weight: 2, element: 'Fire', grade: 'SS' },
    ],
  },
  // ── Half-Dragon (Tier 4 — F+E+D locked) ──
  {
    label: 'Half-Dragon',
    spinIdentity: ['Evolution'],
    limitBreakOdds: 50,
    weight: 4,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.7,
    minStatTier: 'C-',
    description: 'One draconic parent, one mortal parent. The dragon parent had opinions about this.',
    injectedWheels: [
      { id: 'dragonBlood', displayName: 'Dragon Blood', order: 1, segments: [
        { label: 'Latent', weight: 5, description: 'Lineage mostly forgotten.' },
        { label: 'Quickened', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Scale patches. Slight breath.' },
        { label: 'Awakened', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Functional breath. Visible aspect.' },
        { label: 'Ascendant', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Most of the way to dragon. Past the human ceiling.' },
        { label: 'True Half', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' }, description: 'Genuinely both. Cannot choose to be one.' },
      ]},
      { id: 'ascension', displayName: 'Ascension Path', order: 2, segments: [
        { label: 'Stable', weight: 5, description: 'Holds the line of being half.' },
        { label: 'Toward Dragon', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Becoming more, slowly.' },
        { label: 'Toward Hybrid', weight: 3, statBonusGrants: { agility: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, description: 'Refining both halves at once.' },
        { label: 'Will Ascend', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Endgame is dragon. Knows it. Patient about it.' },
      ]},
    ],
    statModifiers: { strength: 1.6, durability: 1.5, charisma: 1.3 },
    subTypePool: [
      { label: 'Chromatic Heritage (Evil)',                       weight: 4, element: 'Fire', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Elemental Resistance', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Predatory Instinct', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Scale Toughening', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Dominance Aura', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Territorial Rage', weight: 2, element: 'Time', grade: 'C' }, { label: 'Wyrm Blood', weight: 1, element: 'Blood', grade: 'C' }], powerPool: [{ label: 'Dragon Fear Aura', weight: 3 }, { label: 'Legendary Breath Weapon', weight: 3 }, { label: 'Chromatic Resistance', weight: 2 }, { label: 'Berserker Frenzy', weight: 2 }, { label: 'Scale Armor', weight: 1 }] },
      { label: 'Metallic Heritage (Noble)',                       weight: 4, element: 'Light', grade: 'B', statBonusGrants: { charisma: 'statBonus' }, abilities: [{ label: 'Honor Bloodline', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Elemental Breath (Noble)', weight: 2, element: 'Light', grade: 'C' }, { label: 'Draconic Grace', weight: 2, element: 'Light', grade: 'B' }, { label: 'Ancient Wisdom Echo', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Noble Scale', weight: 2, element: 'Light', grade: 'B' }, { label: 'Metallic Presence', weight: 1, element: 'Psychic', grade: 'B' }], powerPool: [{ label: 'Radiant Soul', weight: 3 }, { label: 'Legendary Breath Weapon', weight: 3 }, { label: 'Courage Aura', weight: 2 }, { label: 'Ancient Cunning', weight: 2 }, { label: 'Dragon Fear Aura', weight: 1 }] },
      { label: 'Draconic Awakening (True Dragon Blood Surfaces)', weight: 2, element: 'Fire', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Full Dragon Fear', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Wing Emergence', weight: 2, element: 'Fire', grade: 'A' }, { label: 'True Breath Weapon', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Ancient Dragon Echo', weight: 2, element: 'Sound', grade: 'A' }, { label: 'Scale Hardening (Full)', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Draconic Transcendence', weight: 1, element: 'Fire', grade: 'SS' }], powerPool: [{ label: 'Dragon Form', weight: 3 }, { label: 'Legendary Breath Weapon', weight: 3 }, { label: 'Dragon Fear Aura', weight: 2 }, { label: 'Ancient Dominion', weight: 2 }, { label: 'Flight', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "6'0\"", weight: 3 }, { label: "6'2\"", weight: 5 }, { label: "6'4\"", weight: 6 },
      { label: "6'6\"", weight: 6 }, { label: "6'8\"", weight: 5 }, { label: "6'10\"", weight: 4 },
      { label: "7'0\"", weight: 3 }, { label: "7'4\"", weight: 2 }, { label: "7'8\"", weight: 1 },
    ],

    abilities: [
      { label: 'Breath Weapon (Partial)', weight: 3, element: 'Fire', grade: 'A' },
      { label: 'Scale Skin', weight: 3, element: 'Fire', grade: 'A' },
      { label: 'Draconic Roar', weight: 2, element: 'Sound', grade: 'A' },
      { label: 'Dragon Fear (Minor)', weight: 2, element: 'Psychic', grade: 'A' },
      { label: 'Elemental Resistance', weight: 2, element: 'Fire', grade: 'C' },
      { label: 'Ancient Blood Surge', weight: 1, element: 'Blood', grade: 'A' },
      { label: 'Wing Stumps (Decorative, Currently)', weight: 1, element: 'Fire', grade: 'A' },
    ],
  },
  // ── Angel (Tier 4 — F+E+D locked) ──
  {
    label: 'Angel',
    spinIdentity: ['FateManipulator'],
    limitBreakOdds: 56,
    weight: 4,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.4,
    minStatTier: 'C-',
    description: 'Divine messenger and warrior. Handles the smiting personally.',
    injectedWheels: [
      { id: 'choir', displayName: 'Choir', order: 1, segments: [
        { label: 'Common', weight: 5, statBonusGrants: { potential: 'statBonus' }, description: 'Foot-soldier. Messenger.' },
        { label: 'Cherubim', weight: 4, statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Guardian rank. Many-faced. Stands at gates.' },
        { label: 'Thrones', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'Wheels and eyes. Carries divine judgement.' },
        { label: 'Seraphim', weight: 2, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus', fightingSkill: 'statBonus' }, description: 'Six-winged. Closest to the source. Burns.' },
        { label: 'Principal', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus', iq: 'statBonus' }, description: 'Leads a choir. Negotiates with creation.' },
      ]},
      { id: 'divineDuty', displayName: 'Divine Duty', order: 2, segments: [
        { label: 'Messenger', weight: 5, statBonusGrants: { speed: 'statBonus', charisma: 'statBonus' }, description: 'Carries word. Trusted with secrets.' },
        { label: 'Guardian', weight: 4, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Bound to protect a place. A person. A thing.' },
        { label: 'Warrior', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, description: 'First into the breach. Wing-blades drawn.' },
        { label: 'Judge', weight: 2, statBonusGrants: { iq: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Hears the case. Decides the fate.' },
        { label: 'Executor', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Calls down sentences. Has not been overruled.' },
      ]},
    ],
    statModifiers: { charisma: 1.7, potential: 1.5, fightingSkill: 1.4, durability: 1.3 },
    subTypePool: [
      { label: 'Guardian Angel', weight: 4, element: 'Light', grade: 'B', abilities: [{ label: 'Divine Shield', weight: 2, element: 'Light', grade: 'C' }, { label: 'Protective Aura', weight: 2, element: 'Light', grade: 'C' }, { label: 'Holy Ward', weight: 2, element: 'Light', grade: 'C' }, { label: 'Charge Sense', weight: 2, element: 'Light', grade: 'B' }, { label: 'Celestial Bond', weight: 2, element: 'Light', grade: 'B' }, { label: 'Undying Devotion', weight: 1, element: 'Light', grade: 'B' }], powerPool: [{ label: 'Radiant Soul', weight: 3 }, { label: 'Angelic Wings', weight: 3 }, { label: 'Sacred Heal', weight: 2 }, { label: 'Courage Aura', weight: 2 }, { label: 'Aura of Retribution', weight: 1 }] },
      { label: 'Warrior Angel',   weight: 3, element: 'Light', grade: 'A', statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Holy Blade Mastery', weight: 2, element: 'Light', grade: 'C' }, { label: 'Divine Combat Form', weight: 2, element: 'Light', grade: 'C' }, { label: 'Heaven-Sent Strike', weight: 2, element: 'Light', grade: 'A' }, { label: 'Celestial Martial Art', weight: 2, element: 'Light', grade: 'A' }, { label: 'Smite Expert', weight: 2, element: 'Light', grade: 'A' }, { label: 'Seraph Strike', weight: 1, element: 'Light', grade: 'A' }], powerPool: [{ label: 'Divine Smite', weight: 3 }, { label: 'Radiant Strike', weight: 3 }, { label: 'Angelic Wings', weight: 2 }, { label: 'Holy Strike', weight: 2 }, { label: 'Consecrated Ground', weight: 1 }] },
      { label: 'Seraphim',        weight: 2, element: 'Light', grade: 'A', statBonusGrants: { charisma: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Six-Wing Flight', weight: 2, element: 'Wind', grade: 'A' }, { label: 'Hymn of Power', weight: 2, element: 'Light', grade: 'A' }, { label: 'Holy Presence', weight: 2, element: 'Light', grade: 'A' }, { label: 'Celestial Song', weight: 2, element: 'Sound', grade: 'A' }, { label: 'Divine Fire', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Burning Holiness', weight: 1, element: 'Fire', grade: 'A' }], powerPool: [{ label: 'Radiant Soul', weight: 3 }, { label: 'Scourge Burst', weight: 3 }, { label: 'Angelic Wings', weight: 2 }, { label: 'Sacred Heal', weight: 2 }, { label: 'Consecrated Ground', weight: 1 }] },
      // ~10% chance to land Fallen Angel — dark power set replaces divine
      { label: 'Fallen Angel',    weight: 1, element: 'Shadow', grade: 'S', statBonusGrants: { strength: 'statBonus', speed: 'statBonus' }, abilities: [{ label: 'Dark Wings', weight: 2, element: 'Shadow', grade: 'S' }, { label: 'Corrupted Grace', weight: 2, element: 'Shadow', grade: 'S' }, { label: 'Shadow-Light', weight: 2, element: 'Shadow', grade: 'S' }, { label: 'Fallen Authority', weight: 2, element: 'Shadow', grade: 'S' }, { label: 'Forbidden Knowledge', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Sin Domain', weight: 1, element: 'Shadow', grade: 'S' }], powerPool: [{ label: 'Shadow Corruption', weight: 3 }, { label: 'Fallen Angel Strike', weight: 3 }, { label: 'Darkness Veil', weight: 2 }, { label: 'Fear Projection', weight: 2 }, { label: 'Soul Corruption', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Mortal Vessel',           weight: 4, element: 'Light', grade: 'C', statBonusGrants: { charisma: 'statPenalty' }, statBonus: 1.0 },
      { label: 'Wings Manifested',        weight: 3, element: 'Light', grade: 'B', statBonusGrants: { charisma: 'statBonus', speed: 'statBonus' }, statBonus: 1.3 },
      { label: 'Full Divine Form',        weight: 3, element: 'Light', grade: 'A', statBonusGrants: { charisma: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' }, statBonus: 1.7 },
      { label: 'Throne-Level (Ophanim)', weight: 1, element: 'Light', grade: 'SS', statBonus: 2.5, statBonusGrants: { charisma: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "6'0\"", weight: 3 }, { label: "6'2\"", weight: 5 }, { label: "6'4\"", weight: 7 },
      { label: "6'6\"", weight: 7 }, { label: "6'8\"", weight: 5 }, { label: "7'0\"", weight: 4 },
      { label: "7'4\"", weight: 2 }, { label: "7'8\"", weight: 1 }, { label: '(Seraphim: Variable)', weight: 1 },
      { label: '(Wings Not Included)', weight: 1 },
    ],

    customGenderPool: [
      { label: 'Male', weight: 3 }, { label: 'Female', weight: 3 }, { label: 'Androgynous', weight: 2 },
    ],

    abilities: [
      { label: 'Celestial Wings', weight: 3, element: 'Light', grade: 'SS' },
      { label: 'Holy Smite', weight: 2, element: 'Light', grade: 'SS' },
      { label: 'Divine Aura', weight: 2, element: 'Light', grade: 'C' },
      { label: 'Radiant Healing', weight: 2, element: 'Light', grade: 'SS' },
      { label: 'Heavenly Intervention', weight: 2, element: 'Light', grade: 'SS' },
      { label: 'Celestial Sight', weight: 1, element: 'Light', grade: 'SS' },
      { label: 'Immune to Corruption (Unless Fallen)', weight: 1, element: 'Light', grade: 'SS' },
    ],
  },
  // ── Beast (Tier 4 — F+E+D locked; rare subtype upgrades to Mythological Creature) ──
  {
    label: 'Beast',
    spinIdentity: ['Summoner', 'Scaling'],
    limitBreakOdds: 40,
    weight: 5,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 1.2,
    minStatTier: 'C-',
    description: 'A powerful creature of the natural world. Possibly the apex predator. Possibly much more.',
    injectedWheels: [
      { id: 'apex', displayName: 'Apex Trait', order: 1, segments: [
        { label: 'Tracker', weight: 5, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'Follows a scent for days.' },
        { label: 'Ambusher', weight: 4, statBonusGrants: { agility: 'statBonus', fightingSkill: 'statBonus' }, description: 'Strikes from cover. First. Always.' },
        { label: 'Pack-Leader', weight: 3, statBonusGrants: { charisma: 'statBonus', fightingSkill: 'statBonus', strength: 'statBonus' }, description: 'Others follow. Even other species.' },
        { label: 'Solo Killer', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus' }, description: 'Needs no pack. The territory is theirs.' },
        { label: 'Mythic Beast', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Sung about by villagers. Hunted by heroes.' },
      ]},
      { id: 'pack', displayName: 'Pack', order: 2, segments: [
        { label: 'Solo', weight: 5, statBonusGrants: { strength: 'statBonus', charisma: 'statPenalty' }, description: 'No companions. Trusts none.' },
        { label: 'Pair', weight: 3, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'A mate. A constant.' },
        { label: 'Small Pack', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Three or four. A working unit.' },
        { label: 'Hunting Pack', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus' }, description: 'A dozen. Coordinated. Ruthless.' },
        { label: 'Migrating Horde', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', potential: 'statBonus' }, description: 'Hundreds. The shape of the land changes around them.' },
      ]},
    ],
    statModifiers: { strength: 1.6, speed: 1.5, agility: 1.4, iq: 0.7, charisma: 0.5 },
    subTypePool: [
      { label: 'Great Cat',                                     weight: 3, element: 'Nature', grade: 'C', statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, abilities: [{ label: 'Predator Sprint', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Pack Instinct', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Ambush Trigger', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Pride Bond', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Stealth Hunter', weight: 2, element: 'Shadow', grade: 'C' }, { label: 'Claw Mastery', weight: 1, element: 'Nature', grade: 'C' }], powerPool: [{ label: 'Pounce Strike', weight: 3 }, { label: "Hunter's Mark", weight: 3 }, { label: 'Predator Stance', weight: 2 }, { label: 'Beast Bond', weight: 2 }, { label: 'Super Speed', weight: 1 }] },
      { label: 'Great Ape',                                     weight: 2, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Primal Strength', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Tool Use', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Social Hierarchy', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Terrain Climbing', weight: 2, element: 'Water', grade: 'C' }, { label: 'Intimidating Display', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Knuckle Walk', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Super Strength', weight: 3 }, { label: 'Titan Grip', weight: 3 }, { label: 'Mountain Crash', weight: 2 }, { label: 'Berserker Frenzy', weight: 2 }, { label: 'Indomitable Rage', weight: 1 }] },
      { label: 'Sea Monster',                                   weight: 2, element: 'Water', grade: 'B', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Aquatic Supremacy', weight: 2, element: 'Water', grade: 'B' }, { label: 'Pressure Immunity', weight: 2, element: 'Gravity', grade: 'B' }, { label: 'Deep Sea Terror', weight: 2, element: 'Water', grade: 'B' }, { label: 'Echolocation', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Crushing Grip', weight: 2, element: 'Gravity', grade: 'B' }, { label: 'Ancient Sea Memory', weight: 1, element: 'Water', grade: 'B' }], powerPool: [{ label: 'Hydrokinesis', weight: 3 }, { label: 'Tidal Burst', weight: 3 }, { label: 'Aqua Form', weight: 2 }, { label: 'Stone Endurance', weight: 2 }, { label: 'Tentacle Barrage', weight: 1 }] },
      // ~10% chance: Mythical Beast — fully upgrades to Mythological Creature power level
      { label: 'Mythical Beast → Mythological Creature',        weight: 1, element: 'Cosmic', grade: 'S', statBonusGrants: { strength: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Mythic Presence', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Legend-Tier Power', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Reality-Adjacent', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Apex of Apex', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Mythic Aura', weight: 2, element: 'Cosmic', grade: 'C' }, { label: 'Transcendent Beast', weight: 1, element: 'Cosmic', grade: 'SS' }], powerPool: [{ label: 'Phoenix Rebirth', weight: 3 }, { label: 'Dragon Form', weight: 3 }, { label: 'Reality Warping', weight: 2 }, { label: 'Ancient Dominion', weight: 2 }, { label: 'Legendary Breath Weapon', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "4' (Small Beast)", weight: 3 }, { label: "6' (Medium Beast)", weight: 5 },
      { label: "8' (Large Beast)", weight: 5 }, { label: "10' (Great Beast)", weight: 4 },
      { label: "12' (Apex)", weight: 3 }, { label: "15' (Sea Monster)", weight: 2 },
      { label: "20'+ (Mythical Scale)", weight: 1 },
    ],

    abilities: [
      { label: 'Natural Weapons (Claws/Fangs/Horns)', weight: 3, element: 'Cosmic', grade: 'S' },
      { label: 'Predator Instinct', weight: 3, element: 'Cosmic', grade: 'C' },
      { label: 'Thick Hide', weight: 2, element: 'Cosmic', grade: 'S' },
      { label: 'Enhanced Senses', weight: 2, element: 'Cosmic', grade: 'C' },
      { label: 'Territorial Rage', weight: 2, element: 'Time', grade: 'S' },
      { label: 'Pack Call', weight: 1, element: 'Cosmic', grade: 'S' },
      { label: 'Apex Predator Status', weight: 1, element: 'Cosmic', grade: 'S' },
    ],
  },

  // ── Eldritch Being (Tier 5 — F+E+D+C locked) ──
  {
    label: 'Eldritch Being',
    spinIdentity: ['Corruption', 'RuleBreaker'],
    limitBreakOdds: 60,
    weight: 3,
    abilitySpinCount: 3,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 0.3,
    minStatTier: 'B-',
    description: "A non-Euclidean entity whose existence defies comprehension. You are the bad ending of someone else's story.",
    statModifiers: { iq: 2.0, powerMastery: 2.0, potential: 1.8, strength: 0.7, charisma: 0.3 },
    injectedWheels: [
      { id: 'madness', displayName: 'Madness Touch', order: 1, segments: [
        { label: 'Subtle', weight: 5, statBonusGrants: { iq: 'statBonus', charisma: 'statPenalty' }, description: 'Faint wrongness. Others stay away without knowing why.' },
        { label: 'Visible', weight: 4, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' }, description: 'Reality bends in nearby objects.' },
        { label: 'Overwhelming', weight: 3, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', durability: 'statBonus', charisma: 'statPenalty' }, description: 'Witnesses crack. Architecture warps.' },
        { label: 'Ego Death', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus', charisma: 'statPenalty' }, description: 'Anyone who meets their eye loses themselves a little.' },
        { label: 'Reality Solvent', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus', energyLevel: 'statBonus', charisma: 'statPenalty' }, description: 'Nearby reality goes liquid. Slowly.' },
      ]},
      { id: 'voidAspect', displayName: 'Void Aspect', order: 2, segments: [
        { label: 'Hollow', weight: 5, statBonusGrants: { durability: 'statBonus', iq: 'statBonus' }, description: 'Empty inside. The empty is not weakness.' },
        { label: 'Echo of Void', weight: 4, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Sound dampens. Light dampens. Hope dampens.' },
        { label: 'Void-Touched', weight: 3, statBonusGrants: { powerMastery: 'statBonus', durability: 'statBonus' }, description: 'Pieces of nothing inside the body.' },
        { label: 'Cosmic Negation', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Cancels matter on contact.' },
        { label: 'True Void', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus' }, description: 'The being is the absence. Cannot be removed. Not present.' },
      ]},
      { id: 'realityFracture', displayName: 'Reality Fracture', order: 3, segments: [
        { label: 'Stable', weight: 5, description: 'The local laws hold. For now.' },
        { label: 'Cracked', weight: 4, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Future wheels arrive slightly wrong.' },
        { label: 'Bleeding', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statPenalty' }, description: 'Segments visibly shift on inspection.' },
        { label: 'Glitched', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'Impossible outcomes appear on later wheels.' },
        { label: 'Architecture Broken', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus' }, description: 'The spinner is part of the problem now.' },
      ]},
    ],
    subTypePool: [
      { label: 'Great Old One Fragment',              weight: 3, element: 'Void', grade: 'A', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Madness Aura', weight: 2, element: 'Void', grade: 'C' }, { label: 'Dimensional Bleed', weight: 2, element: 'Void', grade: 'A' }, { label: 'Sanity Drain', weight: 2, element: 'Water', grade: 'A' }, { label: 'Ancient Language Touch', weight: 2, element: 'Time', grade: 'A' }, { label: 'Reality Adjacent', weight: 2, element: 'Cosmic', grade: 'A' }, { label: 'Non-Euclidean Form', weight: 1, element: 'Void', grade: 'A' }], powerPool: [{ label: 'Eldritch Blast (Advanced)', weight: 3 }, { label: 'Psychic Dominion', weight: 3 }, { label: 'Reality Warping', weight: 2 }, { label: 'Causality Violation', weight: 2 }, { label: 'Mind Shatter', weight: 1 }] },
      { label: 'Outer God Shard',                     weight: 2, element: 'Void', grade: 'S', statBonusGrants: { potential: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Infinite Hunger', weight: 2, element: 'Void', grade: 'S' }, { label: 'Cosmic Indifference', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Concept Corruption', weight: 2, element: 'Void', grade: 'S' }, { label: 'Beyond-Sight', weight: 2, element: 'Void', grade: 'S' }, { label: 'Star Road Access', weight: 2, element: 'Cosmic', grade: 'S' }, { label: "Azathoth's Echo", weight: 1 }], powerPool: [{ label: 'Reality Warping', weight: 3 }, { label: 'Causality Violation', weight: 3 }, { label: 'Matter Disintegration', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 2 }, { label: 'Fate Threading', weight: 1 }] },
      { label: 'Spawn of the Void',                   weight: 2, element: 'Void', grade: 'B', abilities: [{ label: 'Void Touch', weight: 2, element: 'Void', grade: 'B' }, { label: 'Eldritch Mimicry', weight: 2, element: 'Void', grade: 'B' }, { label: 'Horror Form', weight: 2, element: 'Void', grade: 'B' }, { label: 'Anti-Existence Aura', weight: 2, element: 'Void', grade: 'C' }, { label: 'Predatory Thought', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Incomprehensible', weight: 1, element: 'Void', grade: 'B' }], powerPool: [{ label: 'Shadow Corruption', weight: 3 }, { label: 'Neural Hijack', weight: 3 }, { label: 'Darkness Veil', weight: 2 }, { label: 'Tentacle Barrage', weight: 2 }, { label: 'Hex Curse', weight: 1 }] },
      { label: 'Lovecraftian Horror (True Form)',      weight: 1, element: 'Void', grade: 'SS', statBonusGrants: { iq: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Absolute Cosmic Horror', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Reality Is Wrong Here', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Indescribable', weight: 2, element: 'Void', grade: 'SS' }, { label: 'Geometry-Defying', weight: 2, element: 'Void', grade: 'SS' }, { label: 'Exists Wrongly', weight: 2, element: 'Void', grade: 'SS' }, { label: 'Cannot Be Perceived Accurately', weight: 1, element: 'Void', grade: 'SS' }], powerPool: [{ label: 'Reality Warping', weight: 3 }, { label: 'Causality Violation', weight: 3 }, { label: 'Omniscience (Partial)', weight: 2 }, { label: 'Psychic Consumption', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Mostly Comprehensible',  weight: 4, element: 'Void', grade: 'D', statBonusGrants: { iq: 'statPenalty' }, statBonus: 0.9 },
      { label: 'Eldritch Awakening',     weight: 3, element: 'Void', grade: 'B', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, statBonus: 1.3 },
      { label: 'True Nature Surfaces',   weight: 2, element: 'Void', grade: 'A', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, statBonus: 1.8 },
      { label: 'Full Manifestation',     weight: 1, element: 'Void', grade: 'SS', statBonus: 2.5, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: 'Approximately Human', weight: 3 }, { label: 'Something Larger', weight: 3 },
      { label: 'Fills the Room', weight: 3 }, { label: 'Non-Euclidean', weight: 3 },
      { label: 'City-Block Entity', weight: 1 }, { label: 'Incomprehensible Scale', weight: 1 },
    ],

    customGenderPool: [
      { label: 'Concept Does Not Apply', weight: 1 },
    ],

    abilities: [
      { label: 'Sanity Drain Aura', weight: 2, element: 'Water', grade: 'C' },
      { label: 'Eldritch Sight', weight: 2, element: 'Void', grade: 'SS' },
      { label: 'Non-Euclidean Body', weight: 2, element: 'Void', grade: 'SS' },
      { label: 'Incomprehensible Voice', weight: 2, element: 'Ice', grade: 'SS' },
      { label: 'Reality Bleed', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Ancient Language', weight: 1, element: 'Time', grade: 'SS' },
      { label: 'Madness Immunity', weight: 1, element: 'Void', grade: 'SS' },
      { label: 'Cosmic Indifference (Passive)', weight: 1, element: 'Cosmic', grade: 'SS' },
    ],
  },
  // ── Mythological Creature (Tier 5 — F+E+D+C locked) ──
  {
    label: 'Mythological Creature',
    spinIdentity: ['Summoner', 'Combo'],
    limitBreakOdds: 56,
    weight: 3,
    abilitySpinCount: 3,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 0.4,
    minStatTier: 'B-',
    description: 'A creature of legend. The myths got most of the details wrong. You were so much worse.',
    injectedWheels: [
      { id: 'mythType', displayName: 'Myth Species', order: 1, segments: [
        { label: 'Lesser Spirit', weight: 5, statBonusGrants: { agility: 'statBonus', potential: 'statBonus' }, description: 'Brownie. Pixie. Lar. Hearth-tier myth.' },
        { label: 'Beast Myth', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Manticore. Chimera. Predatory legend.' },
        { label: 'Wise Myth', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Sphinx-adjacent. Oracle-adjacent.' },
        { label: 'Royal Myth', weight: 2, statBonusGrants: { charisma: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' }, description: 'Unicorn court. Phoenix court.' },
        { label: 'World-Myth', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Cited in every culture. Survives every retelling.' },
      ]},
      { id: 'legacy', displayName: 'Legacy', order: 2, segments: [
        { label: 'Half-Forgotten', weight: 5, description: 'Tales survive. The being barely.' },
        { label: 'Still Hunted', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Heroes keep coming. They keep failing.' },
        { label: 'Worshipped', weight: 3, statBonusGrants: { charisma: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'An order or cult endures. Belief feeds them.' },
        { label: 'Living Legend', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' }, description: 'Their actual deeds, ongoing. Tomorrow they make more legend.' },
        { label: 'Primordial Myth', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Older than the stories. The stories explain them.' },
      ]},
    ],
    statModifiers: { strength: 1.8, durability: 1.7, powerMastery: 1.6, charisma: 1.5, potential: 1.5 },
    subTypePool: [
      { label: 'Phoenix',    weight: 3, element: 'Fire', grade: 'A', statBonusGrants: { energyLevel: 'statBonus' }, abilities: [{ label: 'Rebirth Cycle', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Flame Immortality', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Ash Reform', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Solar Attunement', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Healing Fire', weight: 2, element: 'Fire', grade: 'A' }, { label: 'Eternal Return', weight: 1, element: 'Fire', grade: 'A' }], powerPool: [{ label: 'Phoenix Rebirth', weight: 3 }, { label: 'Pyrokinesis', weight: 3 }, { label: 'Sunfire Aura', weight: 2 }, { label: 'Healing Factor', weight: 2 }, { label: 'Radiant Soul', weight: 1 }] },
      { label: 'Leviathan', weight: 2, element: 'Water', grade: 'S', statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'World-Sea Body', weight: 2, element: 'Water', grade: 'S' }, { label: 'Tidal Control', weight: 2, element: 'Water', grade: 'S' }, { label: 'World Serpent Echo', weight: 2, element: 'Sound', grade: 'S' }, { label: 'Crushing Depth', weight: 2, element: 'Gravity', grade: 'S' }, { label: 'Ancient Terror', weight: 2, element: 'Water', grade: 'S' }, { label: 'End-Times Aspect', weight: 1, element: 'Water', grade: 'S' }], powerPool: [{ label: 'Tidal Burst', weight: 3 }, { label: 'Mountain Crash', weight: 3 }, { label: 'Aqua Form', weight: 2 }, { label: 'Stone Endurance', weight: 2 }, { label: 'Ancient Dominion', weight: 1 }] },
      { label: 'Unicorn',   weight: 2, element: 'Light', grade: 'A', statBonusGrants: { charisma: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Pure Aura', weight: 2, element: 'Light', grade: 'C' }, { label: 'Corruption Cleanse', weight: 2, element: 'Light', grade: 'A' }, { label: 'Horn Magic', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Holy Blessing', weight: 2, element: 'Light', grade: 'A' }, { label: 'Myth Presence', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Sacred Horn', weight: 1, element: 'Light', grade: 'A' }], powerPool: [{ label: 'Sacred Heal', weight: 3 }, { label: 'Radiant Soul', weight: 3 }, { label: 'Purifying Aura', weight: 2 }, { label: 'Healing Factor', weight: 2 }, { label: 'Consecrated Ground', weight: 1 }] },
      { label: 'Basilisk',  weight: 1, element: 'Earth', grade: 'B', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Petrifying Gaze', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Lethal Venom', weight: 2, element: 'Poison', grade: 'B' }, { label: 'Armored Hide', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Death Aura', weight: 2, element: 'Soul', grade: 'C' }, { label: 'King of Serpents', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Legend Terror', weight: 1, element: 'Earth', grade: 'B' }], powerPool: [{ label: 'Gaze of Stone', weight: 3 }, { label: 'Petrification Touch', weight: 3 }, { label: 'Venom Injection', weight: 2 }, { label: 'Fear Projection', weight: 2 }, { label: 'Ancient Dominion', weight: 1 }] },
      { label: 'Behemoth',  weight: 2, element: 'Earth', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Immovable Force', weight: 2, element: 'Earth', grade: 'A' }, { label: 'Mountain Step', weight: 2, element: 'Earth', grade: 'A' }, { label: 'Existence-Level Presence', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Ancient Being', weight: 2, element: 'Earth', grade: 'A' }, { label: 'Elemental Integration', weight: 2, element: 'Earth', grade: 'C' }, { label: 'World-Shaker', weight: 1, element: 'Earth', grade: 'A' }], powerPool: [{ label: 'Stone Endurance', weight: 3 }, { label: 'Mountain Crash', weight: 3 }, { label: 'Geokinesis', weight: 2 }, { label: 'Titan Form', weight: 2 }, { label: 'Ancient Dominion', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Myth Dormant',    weight: 4, element: 'Neutral', grade: 'C', statBonusGrants: { strength: 'statPenalty', powerMastery: 'statPenalty' }, statBonus: 1.0 },
      { label: 'Legend Awakened', weight: 3, element: 'Neutral', grade: 'A', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, statBonus: 1.4 },
      { label: 'Mythic Form',     weight: 2, element: 'Cosmic', grade: 'S', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, statBonus: 1.9 },
      { label: 'Living Legend',   weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 2.8, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: '3\' (Fairy-Sized)', weight: 1 }, { label: "5' (Unicorn)", weight: 2 },
      { label: "15' (Phoenix)", weight: 3 }, { label: "30' (Behemoth)", weight: 3 },
      { label: '100\' (Leviathan Class)', weight: 2 }, { label: 'Ocean-Spanning', weight: 1 },
    ],

    abilities: [
      { label: 'Mythic Presence Aura', weight: 2, element: 'Psychic', grade: 'C' },
      { label: 'Legendary Resilience', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Ancient Dominion', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Apex Mythic Ability', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Untameable', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Impossible Biology', weight: 1, element: 'Cosmic', grade: 'SS' },
      { label: 'Exist Outside Time (Partially)', weight: 1, element: 'Time', grade: 'SS' },
    ],
  },

  // ── Legendary (weight 1–2, abilitySpinCount 3–4) ──
  {
    label: 'Viltrumite',
    spinIdentity: ['Scaling', 'Evolution'],
    limitBreakOdds: 70,
    weight: 3,
    abilitySpinCount: 4,
    extraPowerSpins: 3,
    weaknessProbabilityModifier: 0.1,
    minStatTier: 'B',
    weaknessCount: 0,
    description: 'Biologically perfect alien conquerors. No weaknesses on record. Technically a few. They don\'t discuss them.',
    injectedWheels: [
      { id: 'conquest', displayName: 'Conquest Standing', order: 1, segments: [
        { label: 'Outpost Guard', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Holds a forgotten edge of the empire.' },
        { label: 'Field Officer', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Commands sectors. Reports up the chain.' },
        { label: 'Conquest Lord', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Owns a planet. Several, depending.' },
        { label: 'Imperial Champion', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Personal blade of the emperor.' },
        { label: 'Renegade', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Walked away from the empire. Did not lose.' },
      ]},
      { id: 'bloodlinePurity', displayName: 'Bloodline Purity', order: 2, segments: [
        { label: 'Mixed', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Half-Viltrumite. Hides among colonised species.' },
        { label: 'Pure', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Standard Viltrumite blood.' },
        { label: 'Royal', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Descended from a Conquest Lord.' },
        { label: 'Founding Line', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: "Traces back to the species' first generation. Each near-death sharpens them." },
      ]},
      { id: 'survival', displayName: 'Survival Index', order: 3, segments: [
        { label: 'Uninjured', weight: 5, description: 'Has not yet been tested.' },
        { label: 'Battle-Tested', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Several near-deaths. Recovery learned.' },
        { label: 'Maimed', weight: 3, statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Lost something. Came back twice as ready.' },
        { label: "Death's Edge", weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Has been killed. Did not stay killed.' },
        { label: 'Awakened', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Viltrumite Awakening — the entire build escalates. Inevitable.' },
      ]},
    ],
    statModifiers: { strength: 2.8, durability: 2.6, speed: 2.5, fightingSkill: 2.8, potential: 1.8 },
    classPool: [
      { label: 'Viltrum Soldier',   weight: 4, element: 'Neutral', grade: 'A', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'Viltrum Combat Doctrine', weight: 2, element: 'Neutral', grade: 'A' }, { label: 'Conqueror Mentality', weight: 2, element: 'Neutral', grade: 'A' }, { label: 'Endurance Beyond Limit', weight: 2, element: 'Neutral', grade: 'A' }, { label: 'Atmospheric Combat Mastery', weight: 2, element: 'Wind', grade: 'A' }, { label: 'Physical Perfection Drive', weight: 2, element: 'Neutral', grade: 'SS' }, { label: 'Immortal Body', weight: 1, element: 'Neutral', grade: 'SSS' }], powerPool: [{ label: 'Super Strength', weight: 3 }, { label: 'Flight', weight: 3 }, { label: 'Invulnerability', weight: 2 }, { label: 'Regeneration (Total)', weight: 2 }, { label: 'Combat Flow State', weight: 1 }] },
      { label: 'High Commander',    weight: 3, element: 'Neutral', grade: 'S', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Planetary Threat Level', weight: 2, element: 'Neutral', grade: 'S' }, { label: 'War Doctrine Master', weight: 2, element: 'Neutral', grade: 'S' }, { label: 'Viltrum Elite Combat', weight: 2, element: 'Neutral', grade: 'SS' }, { label: 'Sovereign Strike', weight: 2, element: 'Neutral', grade: 'SS' }, { label: 'Authority Aura', weight: 2, element: 'Psychic', grade: 'S' }, { label: "Empire's Champion", weight: 1, element: 'Neutral', grade: 'SS' }], powerPool: [{ label: 'Kryptonian Martial Arts', weight: 3 }, { label: 'Super Strength', weight: 3 }, { label: 'Invulnerability', weight: 2 }, { label: 'War God Strike', weight: 2 }, { label: 'Solar Flare', weight: 1 }] },
      { label: 'Grand Regent',      weight: 2, element: 'Neutral', grade: 'SS', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Apex Combat Mastery', weight: 2, element: 'Neutral', grade: 'SS' }, { label: "Empire's Will (Absolute)", weight: 2, element: 'Psychic', grade: 'SS' }, { label: 'Sovereignty Aura', weight: 2, element: 'Neutral', grade: 'SSS' }, { label: 'Planetary Submission', weight: 2, element: 'Psychic', grade: 'SS' }, { label: 'Viltrum Legend', weight: 2, element: 'Neutral', grade: 'SSS' }, { label: "Conqueror's Birthright", weight: 1, element: 'Neutral', grade: 'SSS' }], powerPool: [{ label: 'Solar Flare', weight: 3 }, { label: 'Kryptonian Martial Arts', weight: 3 }, { label: 'Invulnerability', weight: 2 }, { label: 'War God Strike', weight: 2 }, { label: 'True Immortality', weight: 1 }] },
      { label: 'Viltrumite Anomaly (Invincible-Level)', weight: 1, element: 'Cosmic', grade: 'SSS', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus', durability: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Beyond Viltrum Peak', weight: 2, element: 'Cosmic', grade: 'SSS' }, { label: 'Emotional Power Surge', weight: 2, element: 'Chaos', grade: 'SSS' }, { label: 'Inheritor of Two Worlds', weight: 2, element: 'Cosmic', grade: 'SSS' }, { label: 'Unstoppable Growth', weight: 2, element: 'Cosmic', grade: 'SSS' }, { label: 'Fight Through Anything', weight: 2, element: 'Neutral', grade: 'SSS' }, { label: 'Atom Eve Bond (Power Multiplier)', weight: 1, element: 'Cosmic', grade: 'God' }], powerPool: [{ label: 'True Immortality', weight: 3 }, { label: 'Invulnerability', weight: 3 }, { label: 'War God Strike', weight: 2 }, { label: 'Reality Warping', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Half-Viltrumite',                      weight: 3, element: 'Neutral', grade: 'A',   statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, statBonus: 1.5 },
      { label: 'Pure-Blood',                           weight: 4, element: 'Neutral', grade: 'SS',  statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus' }, statBonus: 2.0 },
      { label: 'Battle-Hardened (Century of Combat)',  weight: 3, element: 'Neutral', grade: 'SS',  statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus' }, statBonus: 2.5 },
      { label: 'Conquerer-Ranked',                     weight: 2, element: 'Neutral', grade: 'SSS', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus' }, statBonus: 3.0 },
      { label: 'Omni-Man / Grand Regent Level',        weight: 1, element: 'Neutral', grade: 'SSS', statBonus: 4.0, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'10\"", weight: 2 }, { label: "6'0\"", weight: 3 }, { label: "6'2\"", weight: 5 },
      { label: "6'4\"", weight: 5 }, { label: "6'6\"", weight: 4 }, { label: "6'8\"", weight: 2 },
      { label: "7'0\" (Rare)", weight: 1 },
    ],
    abilities: [
      { label: 'Superhuman Flight (Interstellar)', weight: 3, element: 'Wind', grade: 'SSS' },
      { label: 'Imperviousness (Near-Absolute)', weight: 3, element: 'Neutral', grade: 'SSS' },
      { label: 'Viltrum Regeneration (Lethal Healing)', weight: 2, element: 'Neutral', grade: 'SSS' },
      { label: 'Atmospheric Combat Mastery', weight: 2, element: 'Wind', grade: 'SSS' },
      { label: 'Prehensile Tail (Combat Grade)', weight: 2, element: 'Neutral', grade: 'SS' },
      { label: 'Millenia of Combat Memory', weight: 2, element: 'Neutral', grade: 'SSS' },
      { label: 'Species-Level Combat Intuition', weight: 2, element: 'Neutral', grade: 'SS' },
      { label: 'Sound Resonance Vulnerability (Hidden)', weight: 1, element: 'Sound', grade: 'SSS' },
    ],
  },
  {
    label: 'Asgardian',
    spinIdentity: ['Evolution'],
    limitBreakOdds: 65,
    weight: 3,
    abilitySpinCount: 4,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 0.4,
    minStatTier: 'B-',
    description: 'Realm-hopper from the Nine Realms. Significantly more durable than they let on.',
    injectedWheels: [
      { id: 'realm', displayName: 'Realm', order: 1, segments: [
        { label: 'Asgard', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', charisma: 'statBonus' }, description: 'Home court. Throne city.' },
        { label: 'Vanaheim', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Magic-bent. Older arts.' },
        { label: 'Alfheim', weight: 3, statBonusGrants: { charisma: 'statBonus', agility: 'statBonus' }, description: 'Light-elf court. Beautiful. Lethal.' },
        { label: 'Jotunheim', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Frost realm. Hardy survivors.' },
        { label: 'Niflheim', weight: 2, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Cold mist. Old dead. Patient.' },
        { label: 'Muspelheim', weight: 2, statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus', powerMastery: 'statBonus' }, description: "Fire realm. Surt's domain." },
        { label: 'Yggdrasil', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'The Tree itself acknowledges you.' },
      ]},
      { id: 'worthiness', displayName: 'Worthiness', order: 2, segments: [
        { label: 'Mortal-Hearted', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Not yet worthy. Working toward it.' },
        { label: 'Warrior-Proven', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus' }, description: 'Mjolnir would not refuse you.' },
        { label: 'Wise', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Wins by knowing more than the enemy.' },
        { label: 'Worthy', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus', charisma: 'statBonus', potential: 'statBonus' }, description: 'An enchanted weapon recognises you. Reliably.' },
        { label: "All-Father's Eye", weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Odin watches with interest.' },
      ]},
    ],
    statModifiers: { strength: 1.8, durability: 1.6, charisma: 1.5, potential: 1.4, armorStrength: 1.5 },
    classPool: [
      { label: 'Warrior',       weight: 4, element: 'Earth', grade: 'D', abilities: [{ label: 'Einherjar Training', weight: 2, element: 'Water', grade: 'D' }, { label: 'Weapon Bond', weight: 2, element: 'Metal', grade: 'D' }, { label: 'Battlefield Honor', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Skirmish Mastery', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Courage in Death', weight: 2, element: 'Time', grade: 'D' }, { label: 'Valhalla-Bound', weight: 1, element: 'Earth', grade: 'D' }], powerPool: [{ label: 'Ancestral Weapon', weight: 3 }, { label: 'Berserker Rage', weight: 3 }, { label: 'Einherjar Blessing', weight: 2 }, { label: 'Lightning Hammer', weight: 2 }, { label: 'Warrior Trance', weight: 1 }] },
      { label: 'Valkyrie',      weight: 3, element: 'Light', grade: 'A', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Chooser of the Slain', weight: 2, element: 'Light', grade: 'A' }, { label: 'Bifrost Rider', weight: 2, element: 'Ice', grade: 'A' }, { label: 'Combat Grace', weight: 2, element: 'Light', grade: 'C' }, { label: 'Death Touch (Optional)', weight: 2, element: 'Soul', grade: 'A' }, { label: 'Fallen Knight Reclaim', weight: 2, element: 'Shadow', grade: 'A' }, { label: 'Soul Guidance', weight: 1, element: 'Soul', grade: 'A' }], powerPool: [{ label: 'Valkyrie Escort', weight: 3 }, { label: 'Einherjar Blessing', weight: 3 }, { label: 'Angelic Wings', weight: 2 }, { label: 'Flight', weight: 2 }, { label: 'Radiant Strike', weight: 1 }] },
      { label: 'Seiðr Mage',    weight: 3, element: 'Arcane', grade: 'B', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Runic Script', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Fate Reading', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Ward Binding', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Seiðr Trace', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Vólva Path', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Ancient Tongue', weight: 1, element: 'Arcane', grade: 'B' }], powerPool: [{ label: "Odin's Wisdom", weight: 3 }, { label: 'Ancient Seiðr (Conjure)', weight: 3 }, { label: 'Arcane Mastery', weight: 2 }, { label: 'Divination', weight: 2 }, { label: 'Reality Warping', weight: 1 }] },
      { label: 'Berserker (Úlfhéðinn)', weight: 2, element: 'Fire', grade: 'B', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Wolf Bond', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Primal Fury', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Pain Suppress', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Frenzied State', weight: 2, element: 'Fire', grade: 'B' }, { label: "Nature's Rage", weight: 2 }, { label: 'Ulfr Bite', weight: 1, element: 'Fire', grade: 'B' }], powerPool: [{ label: 'Berserker Rage', weight: 3 }, { label: 'Berserker Frenzy', weight: 3 }, { label: 'Indomitable Rage', weight: 2 }, { label: 'Einherjar Blessing', weight: 2 }, { label: 'Super Strength', weight: 1 }] },
      { label: "All-Father's Chosen", weight: 1, element: 'Neutral', grade: 'C', statBonusGrants: { potential: 'statBonus', strength: 'statBonus' }, abilities: [{ label: "Odin's Mark", weight: 2 }, { label: 'Wisdom Touch', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Fate Woven', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Cosmic Awareness (Minor)', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'All-Seeing Eye (Partial)', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Legend Born', weight: 1, element: 'Neutral', grade: 'C' }], powerPool: [{ label: "Odin's Wisdom", weight: 3 }, { label: 'Lightning Hammer', weight: 3 }, { label: 'Einherjar Blessing', weight: 2 }, { label: 'Reality Warping', weight: 2 }, { label: 'Omniscience (Partial)', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Mortal Vessel',        weight: 4, element: 'Light', grade: 'C', statBonus: 1.0 },
      { label: 'Battle-Ready Form',    weight: 3, element: 'Light', grade: 'B', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, statBonus: 1.3 },
      { label: "Warrior's Peak",       weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus' }, statBonus: 1.6 },
      { label: 'Warrior Reborn',       weight: 2, element: 'Light', grade: 'S', statBonus: 2.0 },
      { label: 'God of [Chosen Domain]', weight: 1, element: 'Light', grade: 'SS', statBonus: 2.5, statBonusGrants: { strength: 'statBonus', charisma: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'10\"", weight: 2 }, { label: "6'0\"", weight: 4 }, { label: "6'2\"", weight: 6 },
      { label: "6'4\"", weight: 6 }, { label: "6'6\"", weight: 5 }, { label: "6'8\"", weight: 4 },
      { label: "7'0\"", weight: 2 }, { label: "7'4\" (Jotun Heritage)", weight: 1 },
    ],

    abilities: [
      { label: 'Asgardian Might', weight: 2, element: 'Light', grade: 'SS' },
      { label: 'Bifrost Access', weight: 1, element: 'Ice', grade: 'SS' },
      { label: 'Ancient Seiðr Magic', weight: 2, element: 'Arcane', grade: 'SS' },
      { label: 'Battle-Rage', weight: 2, element: 'Time', grade: 'C' },
      { label: 'Realm-Walker', weight: 1, element: 'Light', grade: 'SS' },
      { label: 'Divine Constitution', weight: 2, element: 'Light', grade: 'SS' },
      { label: "All-Father's Blessing", weight: 1 },
      { label: "Warriors' Honor", weight: 1 },
    ],
  },
  {
    label: 'Kryptonian',
    spinIdentity: ['Evolution', 'Scaling'],
    limitBreakOdds: 70,
    weight: 3,
    abilitySpinCount: 4,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 0.4,
    minStatTier: 'B',
    description: 'Last of a lost world. Under a yellow sun, becomes the most dangerous being alive.',
    injectedWheels: [
      { id: 'sunExposure', displayName: 'Sun Exposure', order: 1, segments: [
        { label: 'Red Sun', weight: 2, statBonusGrants: { strength: 'statPenalty', durability: 'statPenalty' }, description: 'Powerless. Mortal. Vulnerable.' },
        { label: 'Distant Yellow', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Limited yellow-sun exposure. Working toward full power.' },
        { label: 'Yellow Sun', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus' }, description: 'Full powers. Standard kryptonian.' },
        { label: 'Blue Sun', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Power levels exceed normal. Gravity bends.' },
        { label: 'Solar-Engorged', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Walking sun-battery. Glows visibly.' },
      ]},
      { id: 'geneticPotential', displayName: 'Genetic Potential', order: 2, segments: [
        { label: 'Standard', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Default kryptonian genome.' },
        { label: 'Bred-Line', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Designed for combat. Generations refined.' },
        { label: 'Hybrid Genome', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', potential: 'statBonus' }, description: 'Adapted to non-Krypton conditions.' },
        { label: 'Cloned Champion', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Synthesized in a vat. Each batch better than the last.' },
        { label: 'Genesis-Born', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Pre-cataclysm Krypton. Original genome. Untouched.' },
      ]},
    ],
    statModifiers: { strength: 2.0, speed: 2.0, durability: 2.0, fightingSkill: 1.5, armorStrength: 1.3 },
    classPool: [
      { label: 'Warrior-Caste',         weight: 3, element: 'Neutral', grade: 'B', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Kryptonian Battle Art', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Physical Peak Training', weight: 2, element: 'Water', grade: 'D' }, { label: 'Combat Honor', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'War-Form', weight: 2, element: 'Neutral', grade: 'B' }, { label: "Soldier's Bond", weight: 2 }, { label: 'House of Zod Echo', weight: 1, element: 'Sound', grade: 'B' }], powerPool: [{ label: 'Kryptonian Martial Arts', weight: 3 }, { label: 'Super Strength', weight: 3 }, { label: 'Invulnerability', weight: 2 }, { label: 'Flight', weight: 2 }, { label: 'Solar Flare', weight: 1 }] },
      { label: 'Science-Caste',         weight: 3, element: 'Arcane', grade: 'B', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Analytical Combat', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Technology Interface', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Scientific Precision', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Fortress Knowledge', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Bio-Analysis', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'House of El Science', weight: 1, element: 'Arcane', grade: 'B' }], powerPool: [{ label: 'Fortress of Solitude', weight: 3 }, { label: 'Freeze Breath', weight: 3 }, { label: 'Solar Energy Absorption', weight: 2 }, { label: 'X-Ray Vision', weight: 2 }, { label: 'Kryptonian Martial Arts', weight: 1 }] },
      { label: 'Military-Guild',        weight: 3, element: 'Neutral', grade: 'B', abilities: [{ label: 'Tactical Superiority', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'Military Discipline', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'Squad Formation', weight: 2, element: 'Neutral', grade: 'D' }, { label: 'Speed Combat', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Guild Seal', weight: 2, element: 'Water', grade: 'B' }, { label: 'Guild Loyalty', weight: 1, element: 'Neutral', grade: 'B' }], powerPool: [{ label: 'Solar Flare', weight: 3 }, { label: 'Super Speed', weight: 3 }, { label: 'Flight', weight: 2 }, { label: 'Invulnerability', weight: 2 }, { label: 'Heat Vision', weight: 1 }] },
      { label: 'House of El Legacy',    weight: 2, element: 'Light', grade: 'A', statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, abilities: [{ label: 'El Crest Power', weight: 2, element: 'Light', grade: 'A' }, { label: 'Hope Aura', weight: 2, element: 'Light', grade: 'C' }, { label: 'Compassion Surge', weight: 2, element: 'Light', grade: 'A' }, { label: 'Legacy Potential', weight: 2, element: 'Light', grade: 'A' }, { label: "Last Son's Will", weight: 2 }, { label: 'Kryptonian Heritage', weight: 1, element: 'Time', grade: 'A' }], powerPool: [{ label: 'Solar Flare', weight: 3 }, { label: 'Fortress of Solitude', weight: 3 }, { label: 'Invulnerability', weight: 2 }, { label: 'Kryptonian Martial Arts', weight: 2 }, { label: 'Reality Warping', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Under Red Sun (Depowered)',    weight: 3, element: 'Fire', grade: 'D', statBonus: 0.6, statBonusGrants: { strength: 'statPenalty', durability: 'statPenalty' } },
      { label: 'Under Yellow Sun',            weight: 4, element: 'Light', grade: 'A', statBonusGrants: { strength: 'statBonus', speed: 'statBonus', durability: 'statBonus' }, statBonus: 1.5 },
      { label: 'Under Blue Sun (Amplified)',  weight: 2, element: 'Cosmic', grade: 'SS', statBonus: 2.2, statBonusGrants: { strength: 'statBonus', speed: 'statBonus' } },
      { label: 'White Sun Overcharge',        weight: 1, element: 'Cosmic', grade: 'SSS', statBonus: 3.0, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'6\"", weight: 3 }, { label: "5'8\"", weight: 6 }, { label: "5'10\"", weight: 7 },
      { label: "6'0\"", weight: 7 }, { label: "6'2\"", weight: 6 }, { label: "6'4\"", weight: 4 },
      { label: "6'6\"", weight: 2 },
    ],

    abilities: [
      { label: 'Heat Vision', weight: 2, element: 'Fire', grade: 'SSS' },
      { label: 'Super Speed', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Invulnerability', weight: 1, element: 'Cosmic', grade: 'SSS' },
      { label: 'Flight', weight: 2, element: 'Wind', grade: 'SSS' },
      { label: 'Arctic Breath', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'X-Ray Vision', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Super Hearing', weight: 1, element: 'Cosmic', grade: 'SSS' },
      { label: 'Solar Energy Absorption', weight: 1, element: 'Fire', grade: 'SSS' },
    ],
  },
  {
    label: 'Kaiju',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 60,
    weight: 3,
    abilitySpinCount: 4,
    extraPowerSpins: 3,
    weaknessProbabilityModifier: 0.4,
    minStatTier: 'B-',
    weaknessCount: 1,
    description: 'Building-sized apex predator. Multiple military branches exist specifically because of you.',
    injectedWheels: [
      { id: 'kaijuMutation', displayName: 'Kaiju Mutation', order: 1, segments: [
        { label: 'Standard', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Skyscraper-tall. Walks through cities.' },
        { label: 'Armored', weight: 4, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus', strength: 'statBonus' }, description: "Plating that artillery doesn't dent." },
        { label: 'Atomic', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Breath weapon vaporises city blocks.' },
        { label: 'Hivemind', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, description: 'Coordinates with other kaiju. Strategy detected.' },
        { label: 'Apex Predator', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'King of the Monsters. Alpha kaiju.' },
      ]},
      { id: 'disaster', displayName: 'Disaster Footprint', order: 2, segments: [
        { label: 'Containable', weight: 5, description: 'Military can hold the line. Eventually.' },
        { label: 'City-Level', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Wipes urban centres.' },
        { label: 'Coastal', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Tsunamis follow them inland.' },
        { label: 'Continental', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Tectonic rearrangement. Map redrawn.' },
        { label: 'Extinction Class', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Species-ending threat. Plural species.' },
      ]},
    ],
    statModifiers: { strength: 2.5, durability: 2.5, speed: 0.4, agility: 0.3 },
    transformationPool: [
      { label: 'Category I',    weight: 5, element: 'Earth', grade: 'C', statBonus: 1.0 },
      { label: 'Category II',   weight: 4, element: 'Earth', grade: 'B', statBonus: 1.3,  statBonusGrants: { durability: 'statBonus' } },
      { label: 'Category III',  weight: 3, element: 'Earth', grade: 'A', statBonus: 1.6,  statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      { label: 'Category IV',   weight: 2, element: 'Earth', grade: 'S', statBonus: 2.0,  statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      { label: 'Apex Predator', weight: 1, element: 'Earth', grade: 'SS', statBonus: 2.5,  statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'World-Ender',   weight: 1, element: 'Earth', grade: 'SSS', statBonus: 3.0,  statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "50' (Small)",           weight: 3 }, { label: "100' (Medium)",         weight: 3 },
      { label: "200' (Large)",          weight: 2 }, { label: "500' (Colossal)",        weight: 1 },
      { label: 'Skyscraper-Sized',      weight: 1 }, { label: 'City-Block-Sized',       weight: 1 },
      { label: 'Godzilla-Sized',        weight: 1 },
    ],
    subTypePool: [
      { label: 'Godzilla-Type (Atomic)',      weight: 2, element: 'Fire', grade: 'A' },
      { label: 'Pacific Rim-Type (Category IV)', weight: 2, element: 'Earth', grade: 'A' },
      { label: 'Cloverfield-Type (Ancient)', weight: 2, element: 'Void', grade: 'A' },
      { label: 'Mothra-Type (Divine)',        weight: 1, element: 'Light', grade: 'S' },
      { label: 'King Ghidorah-Type (Alien)',  weight: 1, element: 'Cosmic', grade: 'S' },
    ],
    customGenderPool: [
      { label: 'Male', weight: 3 }, { label: 'Female', weight: 3 }, { label: 'N/A (Apex Organism)', weight: 2 },
    ],

    abilities: [
      { label: 'Atomic Breath', weight: 2, element: 'Cosmic', grade: 'S' },
      { label: 'Regeneration Factor', weight: 2, element: 'Nature', grade: 'S' },
      { label: 'Seismic Stomp', weight: 2, element: 'Cosmic', grade: 'S' },
      { label: 'EMP Pulse', weight: 1, element: 'Cosmic', grade: 'S' },
      { label: 'Hardened Carapace', weight: 2, element: 'Earth', grade: 'C' },
      { label: 'Apex Predator Instinct', weight: 1, element: 'Cosmic', grade: 'C' },
      { label: 'Kaiju Roar (Mass Fear)', weight: 1, element: 'Psychic', grade: 'S' },
      { label: 'Ancient Resilience', weight: 1, element: 'Cosmic', grade: 'S' },
    ],
  },
  // Time Lord (Doctor Who)
  {
    label: 'Time Lord',
    spinIdentity: ['FateManipulator', 'RuleBreaker'],
    limitBreakOdds: 65,
    weight: 3,
    abilitySpinCount: 4,
    extraPowerSpins: 2,
    weaknessProbabilityModifier: 0.5,
    minStatTier: 'B-',
    description: 'Ancient beings from Gallifrey who master time itself. Can regenerate into a new body 12 times. Has seen everything. Tired.',
    injectedWheels: [
      { id: 'timeline', displayName: 'Timeline Authority', order: 1, segments: [
        { label: 'Apprentice', weight: 4, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, description: 'Still in the academy. Brilliant but green.' },
        { label: 'Walker', weight: 4, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Moves between when, freely.' },
        { label: 'Architect', weight: 3, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Designs timeline branches.' },
        { label: 'Guardian', weight: 2, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' }, description: 'Enforces fixed points. Hunts breakers.' },
        { label: 'Lord President', weight: 1, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus', energyLevel: 'statBonus' }, description: 'Rules Gallifrey-equivalent. Many incarnations deep.' },
      ]},
      { id: 'regeneration', displayName: 'Regeneration', order: 2, segments: [
        { label: 'First Body', weight: 5, description: 'Original incarnation. New to the burden.' },
        { label: 'Three Lives', weight: 4, statBonusGrants: { iq: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' }, description: 'Has died and remade themselves multiple times.' },
        { label: 'Many-Faced', weight: 3, statBonusGrants: { iq: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Loses count past seven. Personality variants stacked.' },
        { label: 'Final Regeneration', weight: 2, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Cycle ending. Power burning.' },
        { label: 'Cycle-Broken', weight: 1, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', durability: 'statBonus' }, description: 'Found a way past the limit. Will outlast Gallifrey.' },
      ]},
    ],
    statModifiers: { iq: 2.2, potential: 2.0, charisma: 1.4 },
    classPool: [
      { label: 'Renegade',       weight: 4, element: 'Time', grade: 'B', abilities: [{ label: 'Maverick Initiative', weight: 2, element: 'Time', grade: 'D' }, { label: 'Rule-Break Protocol', weight: 2, element: 'Time', grade: 'B' }, { label: 'Temporal Exploit', weight: 2, element: 'Time', grade: 'B' }, { label: 'Free Agent Status', weight: 2, element: 'Time', grade: 'B' }, { label: 'Renegade Regeneration', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Lone Variable', weight: 1, element: 'Time', grade: 'B' }], powerPool: [{ label: 'TARDIS Pocket Space', weight: 3 }, { label: 'Time Stop', weight: 3 }, { label: 'Trickster Gambit', weight: 2 }, { label: 'Temporal Paradox', weight: 2 }, { label: 'Regeneration Burst', weight: 1 }] },
      { label: 'Warrior',        weight: 3, element: 'Earth', grade: 'D', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'War-Form Regeneration', weight: 2, element: 'Nature', grade: 'D' }, { label: 'Battle-Hardened Time Sense', weight: 2, element: 'Time', grade: 'C' }, { label: 'Temporal Strike', weight: 2, element: 'Time', grade: 'D' }, { label: 'Combat Regeneration', weight: 2, element: 'Nature', grade: 'C' }, { label: 'War Doctor Precision', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Zero-Point Combat', weight: 1, element: 'Earth', grade: 'C' }], powerPool: [{ label: 'Regeneration Burst', weight: 3 }, { label: 'Time Scream', weight: 3 }, { label: 'Temporal Stasis', weight: 2 }, { label: 'Time Stop', weight: 2 }, { label: 'Temporal Paradox', weight: 1 }] },
      { label: 'Guardian',       weight: 3, element: 'Time', grade: 'B', statBonusGrants: { potential: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Temporal Ward', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Protected Timeline', weight: 2, element: 'Time', grade: 'B' }, { label: 'Fixed Point Awareness', weight: 2, element: 'Time', grade: 'B' }, { label: "Guardian's Mark", weight: 2 }, { label: 'Timeless Stand', weight: 2, element: 'Time', grade: 'B' }, { label: 'Paradox Shield', weight: 1, element: 'Time', grade: 'C' }], powerPool: [{ label: 'Temporal Stasis', weight: 3 }, { label: 'Chronolock', weight: 3 }, { label: 'TARDIS Pocket Space', weight: 2 }, { label: 'Regeneration Burst', weight: 2 }, { label: 'Timeline Navigation', weight: 1 }] },
      { label: 'Scholar',        weight: 2, element: 'Time', grade: 'A', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Gallifreyan Archive Access', weight: 2, element: 'Time', grade: 'A' }, { label: 'Temporal Theory Combat', weight: 2, element: 'Time', grade: 'C' }, { label: 'Multi-Timeline Computation', weight: 2, element: 'Time', grade: 'A' }, { label: 'Academic Combat', weight: 2, element: 'Time', grade: 'C' }, { label: 'Time Equation Solve', weight: 2, element: 'Time', grade: 'A' }, { label: 'Historical Pattern Read', weight: 1, element: 'Time', grade: 'A' }], powerPool: [{ label: "Odin's Wisdom", weight: 3 }, { label: 'Tome of All Knowledge', weight: 3 }, { label: 'Precognition', weight: 2 }, { label: 'Temporal Paradox', weight: 2 }, { label: 'Omniscience (Partial)', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'First Regeneration Cycle',      weight: 4, element: 'Time', grade: 'C', statBonusGrants: { iq: 'statPenalty' }, statBonus: 1.0 },
      { label: 'Mid-Cycle (Experienced)',       weight: 3, element: 'Time', grade: 'B', statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, statBonus: 1.3 },
      { label: 'Late Cycle (Ancient Wisdom)',   weight: 3, element: 'Time', grade: 'A', statBonusGrants: { iq: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, statBonus: 1.6 },
      { label: 'War Doctor (Battle-Hardened)',  weight: 2, element: 'Time', grade: 'S', statBonusGrants: { iq: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' }, statBonus: 1.9 },
      { label: 'Timeless Child (No Limit)',     weight: 1, element: 'Time', grade: 'SS', statBonus: 2.8, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'2\"", weight: 2 }, { label: "5'4\"", weight: 4 }, { label: "5'6\"", weight: 6 },
      { label: "5'8\"", weight: 7 }, { label: "5'10\"", weight: 7 }, { label: "6'0\"", weight: 5 },
      { label: "6'2\"", weight: 3 }, { label: "6'4\"", weight: 2 }, { label: '(Regenerates to New Height)', weight: 1 },
    ],

    abilities: [
      { label: 'Regeneration (Body Reset)', weight: 3, element: 'Nature', grade: 'SS' },
      { label: 'Time Sense (Accurate to Milliseconds)', weight: 2, element: 'Time', grade: 'SS' },
      { label: 'TARDIS Symbiosis', weight: 2, element: 'Time', grade: 'SS' },
      { label: 'Gallifreyan Mind (Two Brains)', weight: 2, element: 'Water', grade: 'SS' },
      { label: 'Fixed Point Recognition', weight: 1, element: 'Time', grade: 'SS' },
      { label: 'Psychic Paper Mastery', weight: 1, element: 'Psychic', grade: 'C' },
      { label: 'Temporal Loophole Detection', weight: 1, element: 'Time', grade: 'SS' },
      { label: 'Artron Energy Reserves', weight: 1, element: 'Time', grade: 'SS' },
    ],
  },
  {
    label: 'Demi-god',
    spinIdentity: ['Combo', 'Summoner'],
    limitBreakOdds: 70,
    weight: 3,
    abilitySpinCount: 3,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.5,
    minStatTier: 'B-',
    description: 'Half mortal, half divine. Fully aware of which half is better.',
    injectedWheels: [
      { id: 'divineParent', displayName: 'Divine Parent', order: 1, segments: [
        { label: 'Minor Deity', weight: 5, statBonusGrants: { powerMastery: 'statBonus' }, description: 'A small god. A local one.' },
        { label: 'War God', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Ares. Tyr. Sekhmet. Take your pick.' },
        { label: 'Trickster', weight: 3, statBonusGrants: { iq: 'statBonus', charisma: 'statBonus', agility: 'statBonus' }, description: 'Loki. Hermes. Anansi. Chaos by inheritance.' },
        { label: 'Storm/Sky', weight: 3, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Zeus. Thor. Indra. Lightning is the heritage.' },
        { label: 'Death/Underworld', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', durability: 'statBonus' }, description: 'Hades. Hel. Anubis. Walks the dark.' },
        { label: 'All-Father', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Direct child of the chief god. Inheritance maximal.' },
      ]},
      { id: 'blessing', displayName: 'Divine Blessing', order: 2, segments: [
        { label: 'Quiet', weight: 4, statBonusGrants: { potential: 'statBonus' }, description: 'The god watches. Sometimes.' },
        { label: 'Direct', weight: 4, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'The god intervenes regularly.' },
        { label: 'Favoured', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' }, description: "Hand-picked. The god's chosen one." },
        { label: 'Chosen Heir', weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Slated to inherit the godhood eventually.' },
        { label: 'Apotheosis-Bound', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus', energyLevel: 'statBonus' }, description: 'Will become a god in their lifetime.' },
      ]},
    ],
    statModifiers: { strength: 1.5, durability: 1.3, charisma: 1.4, potential: 1.3 },
    classPool: [
      { label: 'God of War (Partial)',       weight: 3, element: 'Fire', grade: 'B', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'Battle Domain Echo', weight: 2, element: 'Sound', grade: 'C' }, { label: 'War Aura', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Martial Divinity', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Conflict Born', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Half-Blooded Wrath', weight: 2, element: 'Blood', grade: 'B' }, { label: "Demi's War Cry", weight: 1 }], powerPool: [{ label: 'War God Strike', weight: 3 }, { label: 'Berserker Frenzy', weight: 3 }, { label: 'Aura of Retribution', weight: 2 }, { label: 'Divine Smite', weight: 2 }, { label: 'Super Strength', weight: 1 }] },
      { label: 'God of Knowledge (Partial)', weight: 3, element: 'Arcane', grade: 'B', statBonusGrants: { iq: 'statBonus' }, abilities: [{ label: 'Library Echo', weight: 2, element: 'Sound', grade: 'B' }, { label: 'Partial Omniscience', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Revelation Burst', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Pattern Sight', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Inherited Prophecy', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Half-Seen Truth', weight: 1, element: 'Arcane', grade: 'B' }], powerPool: [{ label: 'Tome of All Knowledge', weight: 3 }, { label: "Odin's Wisdom", weight: 3 }, { label: 'Precognition', weight: 2 }, { label: 'Omniscience (Partial)', weight: 2 }, { label: 'Divination', weight: 1 }] },
      { label: 'God of Trickery (Partial)',  weight: 3, element: 'Chaos', grade: 'B', statBonusGrants: { iq: 'statBonus', charisma: 'statBonus' }, abilities: [{ label: 'Illusion Echo', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Inherited Mischief', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Misdirection', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Mortal Gambit', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Probability Nudge', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Divine Prank', weight: 1, element: 'Light', grade: 'B' }], powerPool: [{ label: 'Trickster Gambit', weight: 3 }, { label: 'Illusion Mastery', weight: 3 }, { label: 'Probability Manipulation', weight: 2 }, { label: 'Reality Warping', weight: 2 }, { label: 'Perfect Bluff', weight: 1 }] },
      { label: 'God of Nature (Partial)',    weight: 2, element: 'Nature', grade: 'B', statBonusGrants: { potential: 'statBonus' }, abilities: [{ label: 'Nature Bond', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Elemental Echo', weight: 2, element: 'Sound', grade: 'C' }, { label: 'Life Sense', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Seasonal Attunement', weight: 2, element: 'Water', grade: 'B' }, { label: 'Animal Bond (Partial)', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Domain Flicker', weight: 1, element: 'Nature', grade: 'B' }], powerPool: [{ label: "Nature's Wrath", weight: 3 }, { label: 'Druidic Wild Shape', weight: 3 }, { label: 'Weather Dominion', weight: 2 }, { label: 'Elemental Mastery', weight: 2 }, { label: 'Storm Circle', weight: 1 }] },
      { label: 'God of Death (Partial)',     weight: 1, element: 'Soul', grade: 'A', statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, abilities: [{ label: 'Death Sense', weight: 2, element: 'Soul', grade: 'A' }, { label: 'Soul Weight (Partial)', weight: 2, element: 'Soul', grade: 'A' }, { label: 'Judgment Touch', weight: 2, element: 'Soul', grade: 'A' }, { label: 'Death Resistance', weight: 2, element: 'Soul', grade: 'A' }, { label: 'Grim Clarity', weight: 2, element: 'Soul', grade: 'A' }, { label: 'Half-Claim', weight: 1, element: 'Soul', grade: 'A' }], powerPool: [{ label: 'Death Mark', weight: 3 }, { label: 'Soul Absorption', weight: 3 }, { label: 'Life Force Drain', weight: 2 }, { label: 'Necromancy', weight: 2 }, { label: 'Death Defiance', weight: 1 }] },
    ],
    customHeightPool: [
      { label: "5'6\"", weight: 2 }, { label: "5'8\"", weight: 4 }, { label: "5'10\"", weight: 5 },
      { label: "6'0\"", weight: 6 }, { label: "6'2\"", weight: 6 }, { label: "6'4\"", weight: 5 },
      { label: "6'6\"", weight: 3 }, { label: "6'8\"", weight: 2 }, { label: "7'0\"", weight: 1 },
      { label: "7'4\" (Divine Surge)", weight: 1 },
    ],

    abilities: [
      { label: 'Divine Heritage', weight: 3, element: 'Light', grade: 'A' },
      { label: 'Mortal Anchor', weight: 3, element: 'Soul', grade: 'A' },
      { label: 'Ichor Blood', weight: 2, element: 'Blood', grade: 'A' },
      { label: 'Godly Smite (Half-Powered)', weight: 2, element: 'Soul', grade: 'SS' },
      { label: 'Domain Echo', weight: 2, element: 'Sound', grade: 'A' },
      { label: 'Heroic Lineage', weight: 2, element: 'Time', grade: 'A' },
      { label: 'Selective Omniscience', weight: 1, element: 'Soul', grade: 'A' },
    ],
  },
  // ── Legendary / Divine (weight 1, minStatTier A- — F through B all locked) ──
  {
    label: 'God',
    spinIdentity: ['RuleBreaker'],
    weight: 2,
    abilitySpinCount: 4,
    extraPowerSpins: 3,
    weaknessProbabilityModifier: 0.2,
    weaknessCount: 0,
    minStatTier: 'A',
    description: 'An actual god. Not a partial, not a demi. THE god. Or at least A god. The paperwork is non-negotiable.',
    injectedWheels: [
      { id: 'divineDomain', displayName: 'Divine Domain', order: 1, segments: [
        { label: 'War', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus' }, description: 'Battles answer to them.' },
        { label: 'Death', weight: 4, statBonusGrants: { powerMastery: 'statBonus', durability: 'statBonus', potential: 'statBonus' }, description: 'Endings answer to them.' },
        { label: 'Light', weight: 3, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus', potential: 'statBonus' }, description: 'Suns answer to them.' },
        { label: 'Chaos', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Storms answer to them.' },
        { label: 'Nature', weight: 3, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Forests answer to them.' },
        { label: 'Storm', weight: 3, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus', speed: 'statBonus' }, description: 'Thunder answers to them.' },
        { label: 'Knowledge', weight: 2, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Libraries answer to them.' },
        { label: 'Fate', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus', charisma: 'statBonus' }, description: 'Outcomes answer to them. Can override weaknesses.' },
      ]},
      { id: 'worship', displayName: 'Worship', order: 2, segments: [
        { label: 'Forgotten', weight: 4, statBonusGrants: { durability: 'statBonus', iq: 'statBonus' }, description: 'Cult disbanded. Power waning but not gone.' },
        { label: 'Cult', weight: 4, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Small, devoted. Power proportional.' },
        { label: 'Faith', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Established religion. Power constant.' },
        { label: 'Pantheon-Held', weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Major god. Multiple nations worship.' },
        { label: 'Universal', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus', energyLevel: 'statBonus' }, description: 'Worshipped across worlds. Power approaches absolute.' },
      ]},
    ],
    statModifiers: { strength: 2.0, durability: 2.0, iq: 2.0, potential: 2.0, charisma: 2.0, powerMastery: 2.0, armorStrength: 1.8 },
    classPool: [
      { label: 'God of War',         weight: 3, element: 'Fire', grade: 'S', statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'War Domain Absolute', weight: 2, element: 'Fire', grade: 'S' }, { label: 'Battlefield Omniscience', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Divine Martial Form', weight: 2, element: 'Light', grade: 'S' }, { label: 'Conflict Incarnate', weight: 2, element: 'Fire', grade: 'S' }, { label: 'Godly Battle Cry', weight: 2, element: 'Fire', grade: 'SS' }, { label: "War God's Absolute Wrath", weight: 1 }], powerPool: [{ label: 'War God Strike', weight: 3 }, { label: 'Indomitable Rage', weight: 3 }, { label: 'Aura of Retribution', weight: 2 }, { label: 'Divine Smite', weight: 2 }, { label: 'Reality Warping', weight: 1 }] },
      { label: 'God of Knowledge',   weight: 3, element: 'Arcane', grade: 'S', statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'True Omniscience', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'All Truths Known', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Revelation Domain', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Pattern of Everything', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Prophecy Mastery', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Archive Domain Absolute', weight: 1, element: 'Arcane', grade: 'S' }], powerPool: [{ label: 'Tome of All Knowledge', weight: 3 }, { label: 'Omniscience (Partial)', weight: 3 }, { label: 'Precognition', weight: 2 }, { label: 'Divination', weight: 2 }, { label: 'Reality Warping', weight: 1 }] },
      { label: 'God of Destruction', weight: 2, element: 'Void', grade: 'S', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Hakai Authority', weight: 2, element: 'Void', grade: 'S' }, { label: 'Absolute Erasure', weight: 2, element: 'Void', grade: 'S' }, { label: 'Entropy Domain', weight: 2, element: 'Void', grade: 'S' }, { label: 'Destruction Aura', weight: 2, element: 'Void', grade: 'C' }, { label: 'Unmake', weight: 2, element: 'Void', grade: 'S' }, { label: 'End Decree', weight: 1, element: 'Void', grade: 'S' }], powerPool: [{ label: 'Hakai (Destruction)', weight: 3 }, { label: 'Matter Disintegration', weight: 3 }, { label: 'Reality Warping', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 2 }, { label: 'Causality Violation', weight: 1 }] },
      { label: 'God of Creation',    weight: 2, element: 'Light', grade: 'S', statBonusGrants: { potential: 'statBonus', iq: 'statBonus' }, abilities: [{ label: 'Ex Nihilo Touch', weight: 2, element: 'Light', grade: 'S' }, { label: 'Life Weaving', weight: 2, element: 'Light', grade: 'S' }, { label: 'World Seed', weight: 2, element: 'Light', grade: 'S' }, { label: 'Creation Domain', weight: 2, element: 'Light', grade: 'SSS' }, { label: 'Genesis Aura', weight: 2, element: 'Light', grade: 'C' }, { label: 'Divine Blueprint', weight: 1, element: 'Light', grade: 'S' }], powerPool: [{ label: 'Conjuration', weight: 3 }, { label: 'Reality Warping', weight: 3 }, { label: 'Environmental Control', weight: 2 }, { label: 'Golem Forging', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 1 }] },
      { label: 'God of Death',       weight: 1, element: 'Soul', grade: 'S', statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, abilities: [{ label: 'Death Domain Absolute', weight: 2, element: 'Soul', grade: 'S' }, { label: 'True Soul Weight', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Final Judgment', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Death Immunity', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Inevitable Claim', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Reaper Absolute', weight: 1, element: 'Soul', grade: 'S' }], powerPool: [{ label: 'Death Mark', weight: 3 }, { label: 'Soul Absorption', weight: 3 }, { label: 'Life Force Drain', weight: 2 }, { label: 'Necromancy', weight: 2 }, { label: 'Causality Violation', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Manifested Avatar',   weight: 4, element: 'Light', grade: 'B', statBonusGrants: { strength: 'statPenalty', charisma: 'statPenalty', powerMastery: 'statPenalty' }, statBonus: 1.0 },
      { label: 'Partial Incarnation', weight: 3, element: 'Light', grade: 'A', statBonusGrants: { strength: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' }, statBonus: 1.5 },
      { label: 'Full Incarnation',    weight: 2, element: 'Light', grade: 'S', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, statBonus: 2.0 },
      { label: 'True Divine Form',    weight: 1, element: 'Light', grade: 'SSS', statBonus: 3.0, statBonusGrants: { strength: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' } },
    ],
    customHeightPool: [
      { label: '5\'10\" (Mortal Vessel)', weight: 4 }, { label: '6\'4\" (Preferred Form)', weight: 5 },
      { label: '7\'0\" (Divine Presence)', weight: 4 }, { label: '8\'0\" (Full Manifestation)', weight: 3 },
      { label: 'Building-Sized', weight: 1 }, { label: 'Variable (Chooses)', weight: 2 },
      { label: 'Immeasurable', weight: 1 },
    ],

    customGenderPool: [
      { label: 'Male', weight: 3 }, { label: 'Female', weight: 3 }, { label: 'Genderless (Divine)', weight: 2 },
    ],

    abilities: [
      { label: 'Omnipotence (Domain)', weight: 2, element: 'Light', grade: 'SSS' },
      { label: 'Divine Will', weight: 3, element: 'Light', grade: 'SSS' },
      { label: 'True Immortality', weight: 2, element: 'Light', grade: 'SSS' },
      { label: 'Worshipper Network', weight: 2, element: 'Light', grade: 'SSS' },
      { label: 'Reality Write Access', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Smite (No Cooldown)', weight: 2, element: 'Light', grade: 'SSS' },
      { label: 'Domain Absolute', weight: 1, element: 'Light', grade: 'SSS' },
      { label: 'The Paperwork of Power (Godly)', weight: 1, element: 'Light', grade: 'SS' },
    ],
  },
  {
    label: 'Primordial',
    spinIdentity: ['RuleBreaker'],
    weight: 2,
    abilitySpinCount: 4,
    extraPowerSpins: 3,
    weaknessProbabilityModifier: 0.1,
    weaknessCount: 0,
    minStatTier: 'A',
    description: 'A being older than gods, older than worlds. You predate the concept of "before."',
    injectedWheels: [
      { id: 'creationElement', displayName: 'Creation Element', order: 1, segments: [
        { label: 'Air', weight: 3, statBonusGrants: { speed: 'statBonus', powerMastery: 'statBonus' }, description: 'The first breath.' },
        { label: 'Fire', weight: 3, statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus' }, description: 'The first warmth.' },
        { label: 'Water', weight: 3, statBonusGrants: { durability: 'statBonus', potential: 'statBonus' }, description: 'The first tide.' },
        { label: 'Earth', weight: 3, statBonusGrants: { durability: 'statBonus', strength: 'statBonus', armorStrength: 'statBonus' }, description: 'The first ground.' },
        { label: 'Light', weight: 2, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus', iq: 'statBonus' }, description: 'The first dawn.' },
        { label: 'Shadow', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'The first absence.' },
        { label: 'Void', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus' }, description: 'The first emptiness. From which everything came.' },
      ]},
      { id: 'primordialCatastrophe', displayName: 'Catastrophe Domain', order: 2, segments: [
        { label: 'Witness', weight: 5, description: 'Watches the cycle. Does not interfere.' },
        { label: 'Reshaper', weight: 4, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Bends matter to remembered shapes.' },
        { label: 'Unmaker', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Returns things to before they were.' },
        { label: 'Cycle-Keeper', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus', charisma: 'statBonus' }, description: 'Resets civilisations on schedule.' },
        { label: 'Origin-Force', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus' }, description: 'Predates causality. Is the source the others draw from.' },
      ]},
    ],
    statModifiers: { strength: 2.5, durability: 2.5, iq: 2.0, potential: 2.5, energyLevel: 2.5, powerMastery: 2.5, armorStrength: 2.0 },
    subTypePool: [
      { label: 'Primordial of Chaos',  weight: 3, element: 'Chaos', grade: 'S', statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, abilities: [{ label: 'Chaos Incarnate', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Reality Flux', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Entropic Aura', weight: 2, element: 'Chaos', grade: 'C' }, { label: 'Dissolution Touch', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Probability Void', weight: 2, element: 'Void', grade: 'S' }, { label: 'Unmaking', weight: 1, element: 'Chaos', grade: 'S' }], powerPool: [{ label: 'Causality Violation', weight: 3 }, { label: 'Reality Warping', weight: 3 }, { label: 'Matter Disintegration', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 2 }, { label: 'Entropy Field', weight: 1 }] },
      { label: 'Primordial of Order',  weight: 2, element: 'Arcane', grade: 'S', statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Law Absolute', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Structure Mandate', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Reality Stabilization', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Cosmic Balance', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Pattern Lock', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Absolute Rule', weight: 1, element: 'Arcane', grade: 'S' }], powerPool: [{ label: 'Chronolock', weight: 3 }, { label: 'Temporal Stasis', weight: 3 }, { label: 'Reality Warping', weight: 2 }, { label: 'Omniscience (Partial)', weight: 2 }, { label: 'Time Stop', weight: 1 }] },
      { label: 'Primordial of Void',   weight: 2, element: 'Void', grade: 'S', statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Void Immunity', weight: 2, element: 'Void', grade: 'S' }, { label: 'Absolute Null', weight: 2, element: 'Void', grade: 'S' }, { label: 'Existence Erasure', weight: 2, element: 'Void', grade: 'S' }, { label: 'Nothingness Aura', weight: 2, element: 'Void', grade: 'C' }, { label: 'Anti-Existence', weight: 2, element: 'Void', grade: 'S' }, { label: 'The Nothing', weight: 1, element: 'Void', grade: 'S' }], powerPool: [{ label: 'Matter Disintegration', weight: 3 }, { label: 'Dimensional Pocket', weight: 3 }, { label: 'Causality Violation', weight: 2 }, { label: 'Shadow Corruption', weight: 2 }, { label: 'Reality Warping', weight: 1 }] },
      { label: 'Primordial of Life',   weight: 2, element: 'Nature', grade: 'S', statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, abilities: [{ label: 'Life Domain Absolute', weight: 2, element: 'Nature', grade: 'S' }, { label: 'Genesis Touch', weight: 2, element: 'Nature', grade: 'S' }, { label: 'Eternal Regeneration', weight: 2, element: 'Nature', grade: 'S' }, { label: 'All Life Connection', weight: 2, element: 'Nature', grade: 'S' }, { label: 'World Soul', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Seed of Everything', weight: 1, element: 'Nature', grade: 'S' }], powerPool: [{ label: 'Healing Factor', weight: 3 }, { label: 'Phoenix Rebirth', weight: 3 }, { label: 'Conjuration', weight: 2 }, { label: 'Environmental Control', weight: 2 }, { label: 'Omnipotence (Weekend Only)', weight: 1 }] },
      { label: 'Primordial of Time',   weight: 1, element: 'Time', grade: 'SS', statBonusGrants: { iq: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, abilities: [{ label: 'Temporal Absolute', weight: 2, element: 'Time', grade: 'SS' }, { label: 'All-Moments Sight', weight: 2, element: 'Time', grade: 'SS' }, { label: 'Causality Master', weight: 2, element: 'Time', grade: 'SS' }, { label: 'Timeline Authority', weight: 2, element: 'Time', grade: 'SS' }, { label: 'Pre-Existence Memory', weight: 2, element: 'Time', grade: 'SS' }, { label: 'The First Tick', weight: 1, element: 'Time', grade: 'SS' }], powerPool: [{ label: 'Time Stop', weight: 3 }, { label: 'Temporal Paradox', weight: 3 }, { label: 'Chronolock', weight: 2 }, { label: 'Causality Violation', weight: 2 }, { label: 'Fate Threading', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Diminished Form',     weight: 4, element: 'Cosmic', grade: 'B', statBonusGrants: { strength: 'statPenalty', energyLevel: 'statPenalty', powerMastery: 'statPenalty' }, statBonus: 1.0 },
      { label: 'Stirring',            weight: 3, element: 'Cosmic', grade: 'A', statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus', powerMastery: 'statBonus' }, statBonus: 1.5 },
      { label: 'Partially Woken',     weight: 2, element: 'Cosmic', grade: 'S', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', energyLevel: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, statBonus: 2.0 },
      { label: 'Fully Manifested',    weight: 1, element: 'Cosmic', grade: 'SSS', statBonus: 3.0, statBonusGrants: { strength: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' } },
    ],
    customHeightPool: [
      { label: 'Planet-Sized', weight: 3 }, { label: 'Star-Sized', weight: 3 },
      { label: 'Galaxy-Spanning', weight: 2 }, { label: 'Fills a Dimension', weight: 2 },
      { label: 'Beyond Measurement', weight: 2 }, { label: 'All Sizes Simultaneously', weight: 1 },
    ],

    customGenderPool: [
      { label: 'Beyond Gender', weight: 1 },
    ],

    abilities: [
      { label: 'Pre-Cosmic Existence', weight: 2, element: 'Cosmic', grade: 'SS' },
      { label: 'Concept Manipulation', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Ageless Beyond Ageless', weight: 2, element: 'Time', grade: 'SSS' },
      { label: 'Reality Substrate Access', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Primordial Language', weight: 2, element: 'Time', grade: 'SSS' },
      { label: 'The First Memory', weight: 1, element: 'Cosmic', grade: 'SSS' },
      { label: 'Foundation of All Things', weight: 1, element: 'Cosmic', grade: 'D' },
      { label: 'Beyond Comprehension Aura', weight: 1, element: 'Cosmic', grade: 'C' },
    ],
  },
  {
    label: 'Creator',
    spinIdentity: ['FateManipulator', 'RuleBreaker', 'Summoner'],
    weight: 1,
    abilitySpinCount: 4,
    extraPowerSpins: 4,
    weaknessProbabilityModifier: 0.05,
    weaknessCount: 0,
    minStatTier: 'A+',
    secretEventBias: 2.5,
    description: 'The one who made everything. Still occasionally surprised by the results.',
    statModifiers: { strength: 3.0, durability: 3.0, iq: 3.0, potential: 3.0, charisma: 3.0, powerMastery: 3.0, energyLevel: 3.0, armorStrength: 2.5 },
    // RuleBreaker identity at full strength: two injected wheels that
    // actually mutate the run. Reality Law sets a meta-rule on the spin
    // engine itself (filtered out weaknesses, doubled stat picks, etc.).
    // Creation Domain is the Creator's signature theme — which kind of
    // making they perform — and biases power/weapon pools heavily.
    injectedWheels: [
      { id: 'realityLaw', displayName: 'Reality Law', order: 1, segments: [
        { label: 'Original Pattern',    weight: 3, description: 'The rules apply as written. Standard run.' },
        { label: 'No Weaknesses',       weight: 1, statBonusGrants: { durability: 'statBonus', potential: 'statBonus' }, description: 'The character has no rolled weaknesses.' },
        { label: 'Doubled Powers',      weight: 1, statBonusGrants: { powerMastery: 'statBonus' }, description: 'Both power spins land for one slot.' },
        { label: 'Override Caps',       weight: 1, statBonusGrants: { potential: 'statBonus', iq: 'statBonus' }, description: 'Stat caps for this character disabled.' },
        { label: 'Merged Stats',        weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Two stat scores fuse into one (the higher).' },
        { label: 'Inverted Spin',       weight: 1, statBonusGrants: { charisma: 'statBonus' }, description: 'Lowest-weight segments are most likely. Chaos rewarded.' },
      ]},
      { id: 'creationDomain', displayName: 'Creation Domain', order: 2, segments: [
        { label: 'Cosmos',     weight: 3, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus' }, description: 'They made the stars.' },
        { label: 'Life',       weight: 3, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' }, description: 'They made the breath.' },
        { label: 'Order',      weight: 2, statBonusGrants: { iq: 'statBonus', durability: 'statBonus' }, description: 'They made the laws.' },
        { label: 'Chaos',      weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'They made the storm.' },
        { label: 'Time',       weight: 2, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, description: 'They made the river.' },
        { label: 'Concept',    weight: 1, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, description: 'They made the idea itself.' },
      ]},
    ],
    transformationPool: [
      { label: 'Observer Mode',       weight: 4, element: 'Cosmic', grade: 'A', statBonusGrants: { strength: 'statPenalty', powerMastery: 'statPenalty', energyLevel: 'statPenalty' }, statBonus: 1.0 },
      { label: 'Active Participant',  weight: 3, element: 'Cosmic', grade: 'SS', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus' }, statBonus: 2.0 },
      { label: 'Full Creative Mode',  weight: 2, element: 'Cosmic', grade: 'SSS', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, statBonus: 3.0 },
      { label: 'True Omnipotence',    weight: 1, element: 'Cosmic', grade: 'SSS', statBonus: 5.0, statBonusGrants: { strength: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' } },
    ],
    customHeightPool: [
      { label: 'All Sizes', weight: 3 }, { label: 'No Size', weight: 3 },
      { label: 'The Concept of Size', weight: 2 }, { label: 'Pre-dates the concept of height', weight: 2 },
    ],

    customGenderPool: [
      { label: 'All / None', weight: 1 },
    ],

    abilities: [
      { label: 'Omnipotence', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Omniscience', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Omnipresence', weight: 2, element: 'Psychic', grade: 'SSS' },
      { label: 'Reality Write/Read/Execute', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Uncaused First Cause', weight: 1, element: 'Cosmic', grade: 'SSS' },
      { label: 'Made It All', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Can End It All', weight: 2, element: 'Cosmic', grade: 'SSS' },
      { label: 'Technically Responsible for Goblins', weight: 1, element: 'Cosmic', grade: 'SSS' },
    ],
  },

  // ── 12 NEW RACES ──

  // Alien — Extraterrestrial beings with advanced technology and bizarre biology
  {
    label: 'Alien',
    spinIdentity: ['HighVariance', 'Summoner'],
    limitBreakOdds: 50,
    weight: 5,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    extraWeaponSpins: 1,
    weaknessProbabilityModifier: 1.0,
    minStatTier: 'C-',
    description: 'Not from around here. Understatement of the millennium.',
    injectedWheels: [
      { id: 'planetOrigin', displayName: 'Planet Origin', order: 1, segments: [
        { label: 'Lost Colony', weight: 5, statBonusGrants: { agility: 'statBonus' }, description: 'Cut off generations ago. Adapted.' },
        { label: 'Harsh World', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Heavy gravity. Thin atmosphere. Survivors are tough.' },
        { label: 'Hive World', weight: 3, statBonusGrants: { iq: 'statBonus', charisma: 'statBonus' }, description: 'Networked civilisation. Group-mind threads.' },
        { label: 'Imperial World', weight: 2, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' }, description: 'Sent out conquerors. Trained ones.' },
        { label: 'Living Planet', weight: 1, statBonusGrants: { strength: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'The planet itself was sentient. They are a thought of it.' },
      ]},
      { id: 'adaptation', displayName: 'Adaptation', order: 2, segments: [
        { label: 'Eats Pain', weight: 4, statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Damage refines them.' },
        { label: 'Eats Element', weight: 4, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Absorbs one elemental energy type.' },
        { label: 'Resonates', weight: 3, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' }, description: 'Reads other alien bio-fields.' },
        { label: 'Mimics', weight: 2, statBonusGrants: { powerMastery: 'statBonus', agility: 'statBonus', charisma: 'statBonus' }, description: 'Copies abilities they witness.' },
        { label: 'Auto-Evolves', weight: 1, statBonusGrants: { strength: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus', durability: 'statBonus' }, description: 'Becomes whatever the environment requires.' },
      ]},
      { id: 'alienMutation', displayName: 'Bio-Form', order: 3, segments: [
        { label: 'Bipedal', weight: 5, description: 'Recognisable. Mostly.' },
        { label: 'Hexapodal', weight: 4, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, description: 'Six limbs. Versatile.' },
        { label: 'Sessile', weight: 3, statBonusGrants: { durability: 'statBonus', iq: 'statBonus' }, description: 'Rooted. Mind extends instead.' },
        { label: 'Swarm', weight: 2, statBonusGrants: { agility: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'Many bodies. One pattern.' },
        { label: 'Unknowable', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus', charisma: 'statPenalty' }, description: 'No category. Witnesses disagree on basic shape.' },
      ]},
    ],
    statModifiers: { iq: 1.6, powerMastery: 1.4, potential: 1.3 },
    classPool: [
      { label: 'Grey (Scientist)',      weight: 5, element: 'Psychic', grade: 'C', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Probe Sight', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Neural Interface', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Dimensional Pocket', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Hive Signal Access', weight: 1, element: 'Psychic', grade: 'B' }], powerPool: [{ label: 'Mind Control', weight: 3 }, { label: 'Telekinesis', weight: 3 }, { label: 'Psychic Amplifier', weight: 2 }, { label: 'Memory Wipe', weight: 2 }, { label: 'Astral Projection', weight: 1 }] },
      { label: 'Warrior Caste',         weight: 4, element: 'Metal', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Exo-Armor Integration', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Combat Protocol', weight: 2, element: 'Metal', grade: 'C' }, { label: 'War Cry (Alien)', weight: 2, element: 'Sound', grade: 'C' }, { label: 'Adaptive Carapace', weight: 1, element: 'Metal', grade: 'B' }], powerPool: [{ label: 'Super Strength', weight: 3 }, { label: 'Energy Blast', weight: 3 }, { label: 'Plasma Breath', weight: 2 }, { label: 'Quantum Speed', weight: 2 }, { label: 'Teleportation', weight: 1 }] },
      { label: 'Shapeshifter',          weight: 3, element: 'Chaos', grade: 'B', statBonusGrants: { agility: 'statBonus', charisma: 'statBonus' }, abilities: [{ label: 'Perfect Mimicry', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Scent Masking', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'Form Lock', weight: 2, element: 'Chaos', grade: 'B' }, { label: 'Identity Core', weight: 1, element: 'Psychic', grade: 'B' }], powerPool: [{ label: 'Shapeshifting', weight: 3 }, { label: 'Biomimicry', weight: 3 }, { label: 'Cellular Control', weight: 2 }, { label: 'Stealth Field', weight: 2 }, { label: 'Perfect Disguise', weight: 1 }] },
      { label: 'Ancient One (Pre-Universe)', weight: 2, element: 'Cosmic', grade: 'A', statBonusGrants: { iq: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Cosmic Awareness', weight: 2, element: 'Cosmic', grade: 'A' }, { label: 'Pre-Universe Memory', weight: 2, element: 'Cosmic', grade: 'A' }, { label: 'Energy Singularity', weight: 2, element: 'Cosmic', grade: 'A' }, { label: 'Galaxy Brain', weight: 1, element: 'Psychic', grade: 'S' }], powerPool: [{ label: 'Cosmic Power', weight: 3 }, { label: 'Reality Perception', weight: 3 }, { label: 'Gravity Manipulation', weight: 2 }, { label: 'Time Sight', weight: 2 }, { label: 'Dimensional Travel', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Standard Xenotype',     weight: 5, element: 'Neutral', grade: 'C', statBonusGrants: { iq: 'statBonus' }, statBonus: 1.0 },
      { label: 'Augmented Alien',       weight: 4, element: 'Metal', grade: 'B', statBonusGrants: { strength: 'statBonus', iq: 'statBonus' }, statBonus: 1.4 },
      { label: 'Hive Mind Link',        weight: 3, element: 'Psychic', grade: 'A', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, statBonus: 1.8 },
      { label: 'Apex Xenomorph',        weight: 1, element: 'Cosmic', grade: 'S', statBonus: 2.5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', iq: 'statBonus', powerMastery: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "3'0\" (Tentacled)", weight: 2 }, { label: "4'5\"", weight: 3 }, { label: "5'6\"", weight: 5 },
      { label: "6'0\"", weight: 5 }, { label: "7'0\"", weight: 3 }, { label: "12'0\" (Multi-Limbed)", weight: 2 },
    ],
    abilities: [
      { label: 'Telepathy (Long Range)', weight: 3, element: 'Psychic', grade: 'B' },
      { label: 'Anti-Gravity Field', weight: 3, element: 'Gravity', grade: 'B' },
      { label: 'Energy Absorption', weight: 2, element: 'Cosmic', grade: 'B' },
      { label: 'Stellar Navigation', weight: 2, element: 'Cosmic', grade: 'C' },
      { label: 'Alien Metabolism', weight: 2, element: 'Nature', grade: 'C' },
      { label: 'Technological Attunement', weight: 2, element: 'Metal', grade: 'B' },
      { label: 'Universal Translator (Biological)', weight: 1, element: 'Sound', grade: 'B' },
    ],
  },

  // Immortals — Truly deathless beings whose bodies regenerate indefinitely
  {
    label: 'Immortal',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 65,
    weight: 3,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.5,
    weaknessCount: 1,
    minStatTier: 'B-',
    description: 'Cannot die. Has been alive long enough to have regrets about that.',
    injectedWheels: [
      { id: 'eternalAge', displayName: 'Eternal Age', order: 1, segments: [
        { label: 'Centuries', weight: 5, statBonusGrants: { durability: 'statBonus', iq: 'statBonus' }, description: 'Has seen empires rise and fall. Cannot remember every name.' },
        { label: 'Millennia', weight: 4, statBonusGrants: { durability: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, description: 'Multiple ages. Multiple personalities, abandoned and adopted.' },
        { label: 'Pre-History', weight: 3, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Older than recorded time.' },
        { label: 'Cosmic Age', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Stars have died and rebirthed during their lifetime.' },
        { label: 'Eternal Constant', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'Has always existed. Will always exist. A law, not a being.' },
      ]},
      { id: 'deathCounter', displayName: 'Death Counter', order: 2, segments: [
        { label: 'Never Died', weight: 4, statBonusGrants: { potential: 'statBonus' }, description: 'First life. Inexperienced.' },
        { label: 'Died Once', weight: 4, statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Learned the lesson. Permanent now.' },
        { label: 'Many Deaths', weight: 3, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Death is a phase. They return each time.' },
        { label: 'Death-Proof', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Cannot be killed by ordinary means. Each death extends them.' },
        { label: "Death's Friend", weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: "Knows Death personally. They've had drinks." },
      ]},
    ],
    statModifiers: { durability: 2.0, potential: 1.8, powerMastery: 1.5 },
    classPool: [
      { label: 'True Immortal',         weight: 4, element: 'Light', grade: 'A', statBonusGrants: { durability: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Total Regeneration', weight: 2, element: 'Light', grade: 'A' }, { label: 'Undying Will', weight: 2, element: 'Light', grade: 'A' }, { label: 'Time Resistance', weight: 2, element: 'Time', grade: 'A' }, { label: 'Ancient Endurance', weight: 1, element: 'Light', grade: 'S' }], powerPool: [{ label: 'Immortality', weight: 3 }, { label: 'Healing Factor (Absolute)', weight: 3 }, { label: 'Age Immunity', weight: 2 }, { label: 'Death Nullification', weight: 2 }, { label: 'Soul Lock', weight: 1 }] },
      { label: 'Cursed Immortal',       weight: 4, element: 'Shadow', grade: 'B', statBonusGrants: { durability: 'statBonus' }, abilities: [{ label: 'Curse of Eternity', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Pain Tolerance (Max)', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Death Memory', weight: 2, element: 'Soul', grade: 'B' }, { label: 'Grudge Storage', weight: 1, element: 'Shadow', grade: 'B' }], powerPool: [{ label: 'Dark Regeneration', weight: 3 }, { label: 'Curse Channeling', weight: 3 }, { label: 'Shadow Walk', weight: 2 }, { label: 'Soul Anchor', weight: 2 }, { label: 'Death Feedback', weight: 1 }] },
      { label: 'Chosen of a God',       weight: 3, element: 'Light', grade: 'S', statBonusGrants: { potential: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Divine Protection', weight: 2, element: 'Light', grade: 'S' }, { label: 'God\'s Favor', weight: 2, element: 'Light', grade: 'S' }, { label: 'Holy Regeneration', weight: 2, element: 'Light', grade: 'S' }, { label: 'Destined Path', weight: 1, element: 'Cosmic', grade: 'S' }], powerPool: [{ label: 'Healing Factor (Absolute)', weight: 3 }, { label: 'Blessed Combat', weight: 3 }, { label: 'Holy Aura', weight: 2 }, { label: 'Divine Empowerment', weight: 2 }, { label: 'God Touch', weight: 1 }] },
      { label: 'Ancient Undying (Pre-History)', weight: 2, element: 'Cosmic', grade: 'SS', statBonusGrants: { potential: 'statBonus', iq: 'statBonus', powerMastery: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Pre-Historical Knowledge', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Reality Memory', weight: 2, element: 'Time', grade: 'SS' }, { label: 'Entropy Immunity', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Ancient Bloodline Mastery', weight: 1, element: 'Cosmic', grade: 'SSS' }], powerPool: [{ label: 'True Immortality', weight: 3 }, { label: 'Reality Rift', weight: 3 }, { label: 'Dimensional Anchor', weight: 2 }, { label: 'Time Loop Immunity', weight: 2 }, { label: 'Primordial Awakening', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Still Mortal-Looking',  weight: 5, element: 'Neutral', grade: 'B', statBonusGrants: { durability: 'statBonus' }, statBonus: 1.0 },
      { label: 'Ageless Form',          weight: 4, element: 'Light', grade: 'A', statBonusGrants: { durability: 'statBonus', potential: 'statBonus' }, statBonus: 1.5 },
      { label: 'Ancient Body',          weight: 2, element: 'Cosmic', grade: 'SS', statBonusGrants: { durability: 'statBonus', strength: 'statBonus', powerMastery: 'statBonus' }, statBonus: 2.0 },
      { label: 'Eternal Form (True)',   weight: 1, element: 'Light', grade: 'SSS', statBonus: 3.0, statBonusGrants: { potential: 'statBonus', energyLevel: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'4\"", weight: 3 }, { label: "5'8\"", weight: 5 }, { label: "6'0\"", weight: 5 },
      { label: "6'2\"", weight: 4 }, { label: "6'6\"", weight: 2 }, { label: 'Unknown (Timeless)', weight: 1 },
    ],
    abilities: [
      { label: 'Regeneration (Total)', weight: 3, element: 'Light', grade: 'S' },
      { label: 'Timeless Constitution', weight: 3, element: 'Time', grade: 'A' },
      { label: 'Death Experience Archive', weight: 2, element: 'Soul', grade: 'A' },
      { label: 'Undying Resolve', weight: 2, element: 'Light', grade: 'A' },
      { label: 'Ancient Wisdom', weight: 2, element: 'Arcane', grade: 'A' },
      { label: 'Wound Memory', weight: 1, element: 'Soul', grade: 'S' },
    ],
  },

  // Dinosaur — Prehistoric apex predators given sentient form
  {
    label: 'Dinosaur',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 38,
    weight: 4,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 1.3,
    minStatTier: 'D-',
    description: 'Evolution gave you a second chance. You are using it to bite everything.',
    injectedWheels: [
      { id: 'predator', displayName: 'Predator Type', order: 1, segments: [
        { label: 'Pack Hunter', weight: 5, statBonusGrants: { speed: 'statBonus', agility: 'statBonus', fightingSkill: 'statBonus' }, description: 'Velociraptor-class. Coordinated.' },
        { label: 'Apex Solo', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', durability: 'statBonus' }, description: 'T-Rex-class. Top of its food chain.' },
        { label: 'Armored Tank', weight: 3, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus', strength: 'statBonus' }, description: 'Ankylosaur-class. Walking fortress.' },
        { label: 'Aerial', weight: 3, statBonusGrants: { speed: 'statBonus', agility: 'statBonus', fightingSkill: 'statBonus' }, description: 'Pterosaur-class. Dives from the sky.' },
        { label: 'Megafauna', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', armorStrength: 'statBonus', potential: 'statBonus' }, description: 'Diplodocus-or-larger. Geographic threat.' },
      ]},
      { id: 'ancientInstinct', displayName: 'Ancient Instinct', order: 2, segments: [
        { label: 'Hunt', weight: 5, statBonusGrants: { fightingSkill: 'statBonus', speed: 'statBonus' }, description: 'Tracks. Stalks. Kills.' },
        { label: 'Survive', weight: 4, statBonusGrants: { durability: 'statBonus', potential: 'statBonus' }, description: 'Eats. Avoids. Endures.' },
        { label: 'Migrate', weight: 3, statBonusGrants: { speed: 'statBonus', durability: 'statBonus', potential: 'statBonus' }, description: 'Reads land. Knows weather. Moves with the season.' },
        { label: 'Dominate', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' }, description: 'Claims territory. Defends it from anything.' },
        { label: 'Awaken', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus' }, description: 'Modern world cannot contain them. Will not contain them.' },
      ]},
    ],
    statModifiers: { strength: 2.0, durability: 1.8, speed: 1.4, iq: 0.7 },
    subTypePool: [
      { label: 'T-Rex',          weight: 4, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Bite Force (World Record)', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Seismic Footstep', weight: 2, element: 'Earth', grade: 'C' }, { label: 'Terror Roar', weight: 2, element: 'Sound', grade: 'C' }, { label: 'Tunnel Vision Focus', weight: 1, element: 'Neutral', grade: 'D' }] },
      { label: 'Velociraptor',   weight: 4, element: 'Wind', grade: 'C', statBonusGrants: { agility: 'statBonus', speed: 'statBonus' }, abilities: [{ label: 'Pack Hunter Sense', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Claw Precision', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Leaping Strike', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Nest Memory', weight: 1, element: 'Earth', grade: 'D' }] },
      { label: 'Triceratops',    weight: 3, element: 'Earth', grade: 'B', statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Horn Charge', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Frill Display (Intimidation)', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'Thick Hide', weight: 2, element: 'Earth', grade: 'B' }, { label: 'Herd Leader', weight: 1, element: 'Nature', grade: 'B' }] },
      { label: 'Spinosaurus',    weight: 3, element: 'Water', grade: 'B', statBonusGrants: { strength: 'statBonus', speed: 'statBonus' }, abilities: [{ label: 'Aquatic Adaptation', weight: 2, element: 'Water', grade: 'B' }, { label: 'Sail Energy Absorption', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Dual Domain Mastery', weight: 2, element: 'Water', grade: 'B' }, { label: 'Ancient Predator Instinct', weight: 1, element: 'Nature', grade: 'B' }] },
      { label: 'Ancient Titan Dinosaur', weight: 2, element: 'Earth', grade: 'S', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Prehistoric Dominance', weight: 2, element: 'Earth', grade: 'S' }, { label: 'World-Shaking Step', weight: 2, element: 'Earth', grade: 'S' }, { label: 'Extinction Aura', weight: 2, element: 'Void', grade: 'S' }, { label: 'Ancient Apex', weight: 1, element: 'Nature', grade: 'S' }] },
    ],
    transformationPool: [
      { label: 'Feral Mode',           weight: 5, element: 'Nature', grade: 'C', statBonusGrants: { strength: 'statBonus' }, statBonus: 1.0 },
      { label: 'Evolved Predator',      weight: 4, element: 'Earth', grade: 'B', statBonusGrants: { strength: 'statBonus', speed: 'statBonus' }, statBonus: 1.5 },
      { label: 'Apex Ancient',          weight: 2, element: 'Earth', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus' }, statBonus: 2.0 },
      { label: 'Kaiju Threshold',       weight: 1, element: 'Chaos', grade: 'S', statBonus: 3.0, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "6'0\"", weight: 3 }, { label: "8'0\"", weight: 4 }, { label: "12'0\"", weight: 4 },
      { label: "20'0\"", weight: 3 }, { label: "40'0\"", weight: 2 }, { label: "City-Sized", weight: 1 },
    ],
    abilities: [
      { label: 'Natural Armor (Thick Scale)', weight: 3, element: 'Earth', grade: 'B' },
      { label: 'Prehistoric Instinct', weight: 3, element: 'Nature', grade: 'B' },
      { label: 'Apex Predator Aura', weight: 2, element: 'Earth', grade: 'B' },
      { label: 'Territorial Roar', weight: 2, element: 'Sound', grade: 'C' },
      { label: 'Primal Regeneration', weight: 2, element: 'Nature', grade: 'C' },
      { label: 'Extinction Resistance', weight: 1, element: 'Nature', grade: 'A' },
    ],
  },

  // Cybertronian — Living mechanical lifeforms, transforming war machines
  {
    label: 'Cybertronian',
    spinIdentity: ['Evolution', 'Combo'],
    limitBreakOdds: 60,
    weight: 3,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    extraWeaponSpins: 1,
    weaknessProbabilityModifier: 0.8,
    minStatTier: 'C-',
    description: 'More than meets the eye. Significantly more. Also considerably heavier.',
    injectedWheels: [
      { id: 'altForm', displayName: 'Alt Form', order: 1, segments: [
        { label: 'Civilian Vehicle', weight: 5, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, description: 'Truck, car, motorcycle. Blends in.' },
        { label: 'Military Vehicle', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', armorStrength: 'statBonus' }, description: 'Tank. Jet. Built for combat.' },
        { label: 'Aerial', weight: 3, statBonusGrants: { speed: 'statBonus', agility: 'statBonus', energyLevel: 'statBonus' }, description: 'Flight-capable. Sky superiority.' },
        { label: 'Industrial', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Construction equipment. Multi-tool body.' },
        { label: 'Beast Mode', weight: 2, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus' }, description: 'Organic-mimicking. Predator. Wild.' },
        { label: 'Triple-Changer', weight: 1, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, description: 'Three alt forms. Switches mid-fight. Rare bloodline.' },
      ]},
      { id: 'energon', displayName: 'Energon Tier', order: 2, segments: [
        { label: 'Standard', weight: 5, description: 'Standard fuel rations.' },
        { label: 'Refined', weight: 4, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus' }, description: 'Premium energon. Better burns.' },
        { label: 'Cybertronium', weight: 3, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus', strength: 'statBonus' }, description: 'Plating reinforced with home-world alloy.' },
        { label: 'Sparked', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Spark touched by Primus. Or the AllSpark.' },
        { label: 'Prime-Class', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Carries the Matrix of Leadership.' },
      ]},
    ],
    statModifiers: { strength: 1.8, durability: 1.8, iq: 1.4, speed: 1.3 },
    classPool: [
      { label: 'Autobot (Guardian)',    weight: 4, element: 'Light', grade: 'B', statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' }, abilities: [{ label: 'Shield Matrix', weight: 2, element: 'Light', grade: 'B' }, { label: 'Energon Storage (High)', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Combat Protocol Alpha', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Autobot Honor Code', weight: 1, element: 'Light', grade: 'B' }], powerPool: [{ label: 'Energy Blast', weight: 3 }, { label: 'Invulnerability', weight: 3 }, { label: 'Plasma Cannon', weight: 2 }, { label: 'Repair Field', weight: 2 }, { label: 'Rocket Thrust', weight: 1 }] },
      { label: 'Decepticon (Warmonger)', weight: 4, element: 'Shadow', grade: 'B', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Energon Cannon', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Deceptive Protocol', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Tactical Override', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Cybertron Aggression Field', weight: 1, element: 'Chaos', grade: 'B' }], powerPool: [{ label: 'Plasma Cannon', weight: 3 }, { label: 'Super Strength', weight: 3 }, { label: 'Teleportation', weight: 2 }, { label: 'Energy Absorption', weight: 2 }, { label: 'Anti-Gravity Field', weight: 1 }] },
      { label: 'Prime (Leader Class)',   weight: 2, element: 'Cosmic', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Matrix of Leadership', weight: 2, element: 'Cosmic', grade: 'A' }, { label: 'Prime Aura', weight: 2, element: 'Cosmic', grade: 'A' }, { label: 'Cybertron Will', weight: 2, element: 'Light', grade: 'A' }, { label: 'All Spark Fragment', weight: 1, element: 'Cosmic', grade: 'SS' }], powerPool: [{ label: 'Divine Strength', weight: 3 }, { label: 'Energy Mastery', weight: 3 }, { label: 'Telekinesis', weight: 2 }, { label: 'Flight', weight: 2 }, { label: 'Reality Rift', weight: 1 }] },
      { label: 'Quintesson Construct',   weight: 1, element: 'Chaos', grade: 'S', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Multi-Vector Processing', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Ancient Machine Code', weight: 2, element: 'Metal', grade: 'S' }, { label: 'Recursion Loop', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Fabrication Field', weight: 1, element: 'Metal', grade: 'S' }], powerPool: [{ label: 'Matter Manipulation', weight: 3 }, { label: 'Molecular Control', weight: 3 }, { label: 'Cybernetic Mastery', weight: 2 }, { label: 'Machine Control', weight: 2 }, { label: 'Dimensional Rift', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Alt Mode Active (Vehicle)', weight: 5, element: 'Metal', grade: 'C', statBonusGrants: { speed: 'statBonus' }, statBonus: 1.0 },
      { label: 'Battle Mode',              weight: 4, element: 'Metal', grade: 'B', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, statBonus: 1.5 },
      { label: 'Combiner Component',       weight: 3, element: 'Metal', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', energyLevel: 'statBonus' }, statBonus: 2.0 },
      { label: 'Titan Class',              weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 3.0, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "6'0\" (Alt Mode Compact)", weight: 3 }, { label: "15'0\" (Standard)", weight: 5 },
      { label: "30'0\" (Commander Class)", weight: 4 }, { label: "60'0\" (Titan)", weight: 2 }, { label: "City-Scale", weight: 1 },
    ],
    abilities: [
      { label: 'Transformation Protocol', weight: 3, element: 'Metal', grade: 'B' },
      { label: 'Energon Core', weight: 3, element: 'Fire', grade: 'B' },
      { label: 'Titanium Chassis', weight: 2, element: 'Metal', grade: 'B' },
      { label: 'Combat Algorithm', weight: 2, element: 'Metal', grade: 'C' },
      { label: 'Sensor Array', weight: 2, element: 'Psychic', grade: 'C' },
      { label: 'Repair Nano-Bots', weight: 2, element: 'Metal', grade: 'C' },
      { label: 'All Spark Resonance', weight: 1, element: 'Cosmic', grade: 'A' },
    ],
  },

  // Spirit — Incorporeal beings of pure spiritual energy
  {
    label: 'Spirit',
    spinIdentity: ['Summoner'],
    limitBreakOdds: 55,
    weight: 5,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.7,
    minStatTier: 'D-',
    description: 'Pure spiritual energy with unfinished business. Probably several.',
    injectedWheels: [
      { id: 'soul', displayName: 'Soul Anchor', order: 1, segments: [
        { label: 'Untethered', weight: 5, statBonusGrants: { agility: 'statBonus', durability: 'statPenalty' }, description: 'No body to return to. Drifts.' },
        { label: 'Object-Bound', weight: 4, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus' }, description: 'An item carries them. Cannot stray far.' },
        { label: 'Place-Bound', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'A house. A grove. A grave. Theirs.' },
        { label: 'Person-Bound', weight: 2, statBonusGrants: { agility: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Following someone. Helping or haunting, unclear.' },
        { label: 'Self-Bound', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Refused to fade. Anchored themselves to themselves.' },
      ]},
      { id: 'possession', displayName: 'Possession', order: 2, segments: [
        { label: 'None', weight: 5, description: 'Stays in their own shape.' },
        { label: 'Briefly', weight: 4, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Steps in. Steps back. Knows things now.' },
        { label: 'Long-Term', weight: 3, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus', durability: 'statPenalty' }, description: 'Wears a body for years.' },
        { label: 'Fragment', weight: 2, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, description: 'Lives partially in many people.' },
        { label: 'Reincarnation', weight: 1, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus' }, description: 'Already lived this life. And the one before.' },
      ]},
    ],
    statModifiers: { powerMastery: 1.8, potential: 1.6, agility: 1.5, durability: 0.6 },
    subTypePool: [
      { label: 'Nature Spirit',    weight: 5, element: 'Nature', grade: 'C', statBonusGrants: { powerMastery: 'statBonus' }, abilities: [{ label: 'Forest Bond', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Seasonal Shift', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Animal Pact', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Growth Pulse', weight: 1, element: 'Nature', grade: 'B' }] },
      { label: 'War Spirit',       weight: 4, element: 'Fire', grade: 'B', statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Battle Memory', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Combat Ghost', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Warrior Echo', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Rage Beyond Death', weight: 1, element: 'Fire', grade: 'A' }] },
      { label: 'Ancestor Spirit',  weight: 3, element: 'Soul', grade: 'B', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Lineage Wisdom', weight: 2, element: 'Soul', grade: 'B' }, { label: 'Guidance Aura', weight: 2, element: 'Light', grade: 'B' }, { label: 'Memory Archive', weight: 2, element: 'Time', grade: 'B' }, { label: 'Blood Blessing', weight: 1, element: 'Blood', grade: 'A' }] },
      { label: 'Calamity Spirit',  weight: 2, element: 'Chaos', grade: 'A', statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, abilities: [{ label: 'Calamity Aura', weight: 2, element: 'Chaos', grade: 'A' }, { label: 'Disaster Sense', weight: 2, element: 'Chaos', grade: 'A' }, { label: 'Event Shaping', weight: 2, element: 'Time', grade: 'A' }, { label: 'Doom Embodiment', weight: 1, element: 'Chaos', grade: 'SS' }] },
    ],
    transformationPool: [
      { label: 'Ethereal Form',    weight: 5, element: 'Soul', grade: 'C', statBonusGrants: { powerMastery: 'statBonus' }, statBonus: 1.0 },
      { label: 'Semi-Corporeal',   weight: 4, element: 'Soul', grade: 'B', statBonusGrants: { powerMastery: 'statBonus', agility: 'statBonus' }, statBonus: 1.4 },
      { label: 'Manifest Form',    weight: 2, element: 'Soul', grade: 'A', statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', strength: 'statBonus' }, statBonus: 1.8 },
      { label: 'Fully Embodied God Spirit', weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 2.5, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' } },
    ],
    customHeightPool: [
      { label: 'Varies (Spiritual)', weight: 3 }, { label: "5'4\"", weight: 4 }, { label: "5'8\"", weight: 4 },
      { label: "6'0\"", weight: 3 }, { label: 'Enormous (Manifested)', weight: 2 },
    ],
    abilities: [
      { label: 'Phase Shift (Intangibility)', weight: 3, element: 'Soul', grade: 'A' },
      { label: 'Spiritual Sight', weight: 3, element: 'Soul', grade: 'B' },
      { label: 'Emotion Feeding', weight: 2, element: 'Psychic', grade: 'B' },
      { label: 'Telekinesis (Spirit-Fueled)', weight: 2, element: 'Psychic', grade: 'B' },
      { label: 'Possession Aura', weight: 2, element: 'Soul', grade: 'B' },
      { label: 'Consecrated Ground Sense', weight: 2, element: 'Light', grade: 'C' },
      { label: 'Fear Inducement', weight: 1, element: 'Shadow', grade: 'A' },
    ],
  },

  // Ghoul — Flesh-devouring monsters with regeneration and a RC cell kagune
  {
    label: 'Ghoul',
    spinIdentity: ['Corruption', 'Scaling'],
    limitBreakOdds: 42,
    weight: 7,
    abilitySpinCount: 2,
    extraWeaponSpins: 1,
    weaknessProbabilityModifier: 1.2,
    weaknessCount: 1,
    minStatTier: 'D-',
    description: 'Looks human. Isn\'t. Has strong opinions about the menu.',
    injectedWheels: [
      { id: 'hunger', displayName: 'Hunger', order: 1, segments: [
        { label: 'Sated', weight: 5, description: 'Recently fed. Calm-ish.' },
        { label: 'Aching', weight: 4, statBonusGrants: { speed: 'statBonus', charisma: 'statPenalty' }, description: 'Hours since the last bite.' },
        { label: 'Starving', weight: 3, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', iq: 'statPenalty' }, description: 'Lights out. Hunt mode on.' },
        { label: 'Devouring', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'The fight feeds. Heals on hit.' },
        { label: 'Endless Maw', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', charisma: 'statPenalty' }, description: 'Whatever falls in does not come out.' },
      ]},
      { id: 'mutation', displayName: 'Mutation', order: 2, segments: [
        { label: 'Pale Skin', weight: 5, statBonusGrants: { agility: 'statBonus' }, description: 'Sun is hard. Shadows are home.' },
        { label: 'Sharp Teeth', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Each bite tears.' },
        { label: 'Long Claws', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', speed: 'statBonus' }, description: 'Reach extended.' },
        { label: 'Toughened', weight: 2, statBonusGrants: { durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Surgery has been performed. Repeatedly.' },
        { label: 'Hollowed', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', durability: 'statBonus', charisma: 'statPenalty' }, description: 'More appetite than person.' },
      ]},
    ],
    statModifiers: { strength: 1.6, speed: 1.5, agility: 1.5, durability: 1.4 },
    subTypePool: [
      { label: 'Rinkaku (Tentacle Kagune)', weight: 4, element: 'Blood', grade: 'C', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Tentacle Extension', weight: 2, element: 'Blood', grade: 'C' }, { label: 'Rapid Regeneration', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Kagune Crush', weight: 2, element: 'Blood', grade: 'C' }, { label: 'Unstable Power (High Reward)', weight: 1, element: 'Chaos', grade: 'B' }] },
      { label: 'Ukaku (Wing Kagune)',       weight: 4, element: 'Wind', grade: 'C', statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, abilities: [{ label: 'Crystal Shard Volley', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Flight Burst', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Kagune Wings', weight: 2, element: 'Blood', grade: 'C' }, { label: 'Ghoul Sprint', weight: 1, element: 'Wind', grade: 'B' }] },
      { label: 'Koukaku (Armored Kagune)',  weight: 3, element: 'Metal', grade: 'B', statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Hardened Carapace', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Blade Kagune', weight: 2, element: 'Blood', grade: 'B' }, { label: 'Shield Form', weight: 2, element: 'Metal', grade: 'B' }, { label: 'Immovable Defense', weight: 1, element: 'Metal', grade: 'A' }] },
      { label: 'Bikaku (Tail Kagune)',      weight: 3, element: 'Blood', grade: 'C', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Balanced Combat Style', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Tail Lash', weight: 2, element: 'Blood', grade: 'C' }, { label: 'Tracking Sense', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Adaptability (Combat)', weight: 1, element: 'Neutral', grade: 'B' }] },
      { label: 'Chimera (Dual Kagune)',     weight: 2, element: 'Chaos', grade: 'S', statBonusGrants: { strength: 'statBonus', speed: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Dual Kagune Mastery', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Chimera Aura', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Overwhelming Presence', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Unstoppable Drive', weight: 1, element: 'Chaos', grade: 'S' }] },
    ],
    transformationPool: [
      { label: 'Kakuja (Incomplete)',    weight: 5, element: 'Blood', grade: 'B', statBonusGrants: { strength: 'statBonus' }, statBonus: 1.2 },
      { label: 'Half-Kakuja',           weight: 3, element: 'Blood', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, statBonus: 1.7 },
      { label: 'Full Kakuja',           weight: 2, element: 'Blood', grade: 'S', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus' }, statBonus: 2.4 },
      { label: 'Dragon Form (Kaneki)',   weight: 1, element: 'Chaos', grade: 'SS', statBonus: 3.5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'2\"", weight: 3 }, { label: "5'6\"", weight: 5 }, { label: "5'10\"", weight: 6 },
      { label: "6'0\"", weight: 5 }, { label: "6'4\"", weight: 2 }, { label: "Massive (Kakuja)", weight: 1 },
    ],
    abilities: [
      { label: 'Kagune (Awakened)', weight: 3, element: 'Blood', grade: 'B' },
      { label: 'Ghoul Regeneration', weight: 3, element: 'Nature', grade: 'A' },
      { label: 'Steel Skin (Partial)', weight: 2, element: 'Metal', grade: 'B' },
      { label: 'RC Cell Overdrive', weight: 2, element: 'Blood', grade: 'B' },
      { label: 'Predator Sense', weight: 2, element: 'Nature', grade: 'C' },
      { label: 'Kakuja Fragment', weight: 1, element: 'Blood', grade: 'S' },
    ],
  },

  // Shinigami — Death gods who wield soul-cutting blades and reiatsu
  {
    label: 'Shinigami',
    spinIdentity: ['Combo', 'Evolution'],
    limitBreakOdds: 60,
    weight: 4,
    abilitySpinCount: 3,
    extraWeaponSpins: 1,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.8,
    minStatTier: 'C-',
    description: 'Guardian of souls. Wields a sword that cuts the soul itself.',
    injectedWheels: [
      { id: 'zanpakuto', displayName: 'Zanpakutō Spirit', order: 1, segments: [
        { label: 'Sealed', weight: 5, statBonusGrants: { fightingSkill: 'statBonus', weaponMastery: 'statBonus' }, description: 'Standard wakizashi form. Sword still mute.' },
        { label: 'Shikai', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', weaponMastery: 'statBonus' }, description: 'Sword speaks. Personal release form unlocked.' },
        { label: 'Dual-Spirit', weight: 3, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Two spirits in one blade. Rare phenomenon.' },
        { label: 'Bankai', weight: 2, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', weaponMastery: 'statBonus', strength: 'statBonus', potential: 'statBonus' }, description: 'Second release. Captain-level.' },
        { label: 'Soul-Bond', weight: 1, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', weaponMastery: 'statBonus', strength: 'statBonus', potential: 'statBonus', iq: 'statBonus' }, description: 'Spirit and shinigami fused. Cannot tell where one ends.' },
      ]},
      { id: 'bankaiPotential', displayName: 'Bankai Potential', order: 2, segments: [
        { label: 'Latent', weight: 5, description: 'The potential is there. Untrained.' },
        { label: 'Combat-Coded', weight: 4, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, description: 'Bankai shape leans toward direct combat.' },
        { label: 'Field-Coded', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' }, description: 'Bankai shape rewrites the battlefield.' },
        { label: 'Time/Soul', weight: 2, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, description: 'Bankai operates on souls or time directly.' },
        { label: 'Reality-Tier', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus', fightingSkill: 'statBonus' }, description: 'Bankai breaks the rules. Sou-King-class threat.' },
      ]},
    ],
    statModifiers: { fightingSkill: 1.8, powerMastery: 1.7, speed: 1.5, potential: 1.4 },
    classPool: [
      { label: 'Academy Graduate',      weight: 5, element: 'Soul', grade: 'C', statBonusGrants: { fightingSkill: 'statBonus' }, abilities: [{ label: 'Shunpo (Basic)', weight: 2, element: 'Wind', grade: 'C' }, { label: 'Zanjutsu Foundation', weight: 2, element: 'Soul', grade: 'C' }, { label: 'Kido Basics', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Reiatsu Control', weight: 1, element: 'Soul', grade: 'C' }], powerPool: [{ label: 'Flash Step', weight: 3 }, { label: 'Soul Slash', weight: 3 }, { label: 'Kido Binding', weight: 2 }, { label: 'Spiritual Pressure', weight: 2 }, { label: 'Zanpakuto Bond', weight: 1 }] },
      { label: 'Seated Officer',         weight: 4, element: 'Soul', grade: 'B', statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Shikai Release', weight: 2, element: 'Soul', grade: 'B' }, { label: 'Shunpo (Mastered)', weight: 2, element: 'Wind', grade: 'B' }, { label: 'Advanced Kido', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Spiritual Pressure (Mid)', weight: 1, element: 'Soul', grade: 'B' }], powerPool: [{ label: 'Flash Step', weight: 3 }, { label: 'Kido Mastery', weight: 3 }, { label: 'Shikai Power', weight: 2 }, { label: 'Spiritual Pressure', weight: 2 }, { label: 'Soul Purification', weight: 1 }] },
      { label: 'Captain Class',          weight: 2, element: 'Soul', grade: 'S', statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', speed: 'statBonus' }, abilities: [{ label: 'Bankai (Achieved)', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Bankai Mastery', weight: 2, element: 'Soul', grade: 'S' }, { label: 'Haoshoku (Suppressed)', weight: 2, element: 'Psychic', grade: 'S' }, { label: 'Captain-Level Shunpo', weight: 1, element: 'Wind', grade: 'S' }], powerPool: [{ label: 'Bankai', weight: 3 }, { label: 'Flash Step (God-Speed)', weight: 3 }, { label: 'Spiritual Pressure (Crushing)', weight: 2 }, { label: 'Kido Grandmaster', weight: 2 }, { label: 'Zanpakuto True Form', weight: 1 }] },
      { label: 'Royal Guard',            weight: 1, element: 'Cosmic', grade: 'SS', statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', speed: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Ouken (Soul King Blessing)', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Royal Bankai', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Soul World Anchor', weight: 2, element: 'Cosmic', grade: 'SS' }, { label: 'Transcendent Shunpo', weight: 1, element: 'Wind', grade: 'SSS' }], powerPool: [{ label: 'Soul Mastery', weight: 3 }, { label: 'Reality Slice', weight: 3 }, { label: 'Time-Space Slash', weight: 2 }, { label: 'Dimensional Blade', weight: 2 }, { label: 'True Bankai', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Shikai (First Release)',  weight: 5, element: 'Soul', grade: 'B', statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus' }, statBonus: 1.3 },
      { label: 'Bankai (Second Release)', weight: 3, element: 'Soul', grade: 'S', statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', speed: 'statBonus' }, statBonus: 2.0 },
      { label: 'Hollow Awakening',        weight: 2, element: 'Shadow', grade: 'SS', statBonusGrants: { strength: 'statBonus', speed: 'statBonus', powerMastery: 'statBonus', durability: 'statBonus' }, statBonus: 2.8 },
      { label: 'Transcendence (Beyond Bankai)', weight: 1, element: 'Cosmic', grade: 'SSS', statBonus: 4.0, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'2\"", weight: 2 }, { label: "5'6\"", weight: 4 }, { label: "5'10\"", weight: 5 },
      { label: "6'0\"", weight: 5 }, { label: "6'3\"", weight: 4 },
    ],
    abilities: [
      { label: 'Reiatsu (Spiritual Pressure)', weight: 3, element: 'Soul', grade: 'A' },
      { label: 'Shunpo (Flash Step)', weight: 3, element: 'Wind', grade: 'A' },
      { label: 'Zanpakuto Bond', weight: 2, element: 'Soul', grade: 'B' },
      { label: 'Hollow Suppression', weight: 2, element: 'Shadow', grade: 'B' },
      { label: 'Kido Arts', weight: 2, element: 'Arcane', grade: 'B' },
      { label: 'Soul Perception', weight: 2, element: 'Psychic', grade: 'C' },
      { label: 'Hollow Mask (Hidden)', weight: 1, element: 'Shadow', grade: 'S' },
    ],
  },

  // Sea King — Gargantuan monsters of the deep ocean
  {
    label: 'Sea King',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 50,
    weight: 3,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 0.6,
    weaknessCount: 1,
    minStatTier: 'B-',
    description: 'The ocean\'s apex nightmare. Everything in the sea fears you, and rightfully so.',
    injectedWheels: [
      { id: 'abyss', displayName: 'Depth Domain', order: 1, segments: [
        { label: 'Shallows', weight: 4, statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, description: 'Coastal terror. Beach towns evacuate.' },
        { label: 'Reef', weight: 4, statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Coral kingdom. Coordinated hunting.' },
        { label: 'Open Ocean', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', speed: 'statBonus' }, description: 'Surface fleet level threat.' },
        { label: 'Trench', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Crush depth normal. Daylight feared.' },
        { label: 'Abyss', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' }, description: 'Lives where nothing should. Older than oceans.' },
      ]},
      { id: 'leviathan', displayName: 'Leviathan Class', order: 2, segments: [
        { label: 'Adolescent', weight: 5, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Still growing. Already dangerous.' },
        { label: 'Mature', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Full size. Continental waters claimed.' },
        { label: 'Ancient', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Saw the first sailors. Outlasted them.' },
        { label: 'Mythic', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Cited in scripture. Drowned saints.' },
        { label: 'Sea-Lord', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Other sea kings bow.' },
      ]},
    ],
    statModifiers: { strength: 2.5, durability: 2.2, speed: 1.6, iq: 0.7 },
    subTypePool: [
      { label: 'Leviathan Class',    weight: 4, element: 'Water', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Pressure Immunity (Absolute)', weight: 2, element: 'Water', grade: 'A' }, { label: 'Crushing Jaw', weight: 2, element: 'Water', grade: 'A' }, { label: 'Tsunami Body', weight: 2, element: 'Water', grade: 'A' }, { label: 'Deep Ocean Call', weight: 1, element: 'Sound', grade: 'S' }] },
      { label: 'Serpent King',       weight: 3, element: 'Poison', grade: 'S', statBonusGrants: { strength: 'statBonus', speed: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Venom Tide', weight: 2, element: 'Poison', grade: 'S' }, { label: 'Serpent Coil', weight: 2, element: 'Earth', grade: 'S' }, { label: 'Scale Armor (Legend Grade)', weight: 2, element: 'Metal', grade: 'S' }, { label: 'Abyss Roar', weight: 1, element: 'Sound', grade: 'S' }] },
      { label: 'Abyssal Horror',     weight: 2, element: 'Void', grade: 'SS', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Reality Bend (Abyss)', weight: 2, element: 'Void', grade: 'SS' }, { label: 'Sanity Shatter Aura', weight: 2, element: 'Psychic', grade: 'SS' }, { label: 'Void Current', weight: 2, element: 'Void', grade: 'SS' }, { label: 'Abyss Incarnation', weight: 1, element: 'Void', grade: 'SSS' }] },
    ],
    transformationPool: [
      { label: 'Juvenile Sea King',  weight: 4, element: 'Water', grade: 'A', statBonusGrants: { strength: 'statBonus' }, statBonus: 1.5 },
      { label: 'Adult Sea King',     weight: 3, element: 'Water', grade: 'S', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, statBonus: 2.5 },
      { label: 'Ancient Sea King',   weight: 2, element: 'Void', grade: 'SS', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, statBonus: 3.5 },
      { label: 'Progenitor God Form', weight: 1, element: 'Cosmic', grade: 'SSS', statBonus: 5.0, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "30'0\" (Juvenile)", weight: 3 }, { label: "100'0\" (Standard)", weight: 4 },
      { label: "500'0\" (Elder)", weight: 3 }, { label: "Mile-Long", weight: 2 }, { label: "Ocean-Sized", weight: 1 },
    ],
    abilities: [
      { label: 'Aquatic Supremacy', weight: 3, element: 'Water', grade: 'S' },
      { label: 'Pressure Wave', weight: 3, element: 'Water', grade: 'A' },
      { label: 'Size Terror Aura', weight: 2, element: 'Psychic', grade: 'A' },
      { label: 'Deep Sea Armor', weight: 2, element: 'Metal', grade: 'A' },
      { label: 'Sonar Hunting', weight: 2, element: 'Sound', grade: 'B' },
      { label: 'Abyss Sense', weight: 1, element: 'Void', grade: 'S' },
    ],
  },

  // Atlantean — Children of the sunken kingdom, masters of the sea
  {
    label: 'Atlantean',
    spinIdentity: ['Combo', 'Summoner'],
    limitBreakOdds: 48,
    weight: 4,
    abilitySpinCount: 2,
    extraWeaponSpins: 1,
    weaknessProbabilityModifier: 0.9,
    minStatTier: 'D-',
    description: 'Heir to the greatest civilization ever sunk. It was fine. Totally intentional.',
    injectedWheels: [
      { id: 'tide', displayName: 'Tide Affinity', order: 1, segments: [
        { label: 'Surface-Walker', weight: 4, statBonusGrants: { agility: 'statBonus', charisma: 'statBonus' }, description: 'Lives mostly above water. City-dweller.' },
        { label: 'Coastal', weight: 4, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Bridges both worlds.' },
        { label: 'Deep-Born', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Never above water for long. Pressure-adapted.' },
        { label: 'Court Noble', weight: 2, statBonusGrants: { charisma: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Born to the throne court. Royal training.' },
        { label: 'Trident-Bearer', weight: 1, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus', potential: 'statBonus' }, description: 'Wields a relic of the founding.' },
      ]},
      { id: 'seaKingPath', displayName: 'Sea-King Path', order: 2, segments: [
        { label: 'Civilian', weight: 5, description: 'Ordinary Atlantean. Lives a life.' },
        { label: 'Warrior', weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Royal guard. Trained from youth.' },
        { label: 'Mage', weight: 3, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, description: 'Sea-magic. Ancient arts. Whirlpools at will.' },
        { label: 'Heir', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Crown coming.' },
        { label: 'Ocean Master', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' }, description: 'Bends every sea to their will. Mythic king.' },
      ]},
    ],
    statModifiers: { strength: 1.5, durability: 1.5, iq: 1.4, powerMastery: 1.3 },
    classPool: [
      { label: 'Royal Lineage',     weight: 3, element: 'Water', grade: 'B', statBonusGrants: { charisma: 'statBonus', strength: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Atlantean Command', weight: 2, element: 'Water', grade: 'B' }, { label: 'Trident Mastery', weight: 2, element: 'Water', grade: 'B' }, { label: 'Sea Life Bond (Advanced)', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Tidal Crown Aura', weight: 1, element: 'Water', grade: 'A' }], powerPool: [{ label: 'Hydrokinesis', weight: 3 }, { label: 'Sea Life Command', weight: 3 }, { label: 'Tidal Wave Generation', weight: 2 }, { label: 'Water Breathing', weight: 2 }, { label: 'Trident Mastery', weight: 1 }] },
      { label: 'Deep Sea Warrior',  weight: 4, element: 'Water', grade: 'C', statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Pressure Strike', weight: 2, element: 'Water', grade: 'C' }, { label: 'Underwater Combat Mastery', weight: 2, element: 'Water', grade: 'C' }, { label: 'Depth Charge', weight: 2, element: 'Water', grade: 'C' }, { label: 'Sea Steel Skin', weight: 1, element: 'Metal', grade: 'B' }], powerPool: [{ label: 'Super Strength', weight: 3 }, { label: 'Hydrokinesis', weight: 3 }, { label: 'Aqua Strike', weight: 2 }, { label: 'Current Surf', weight: 2 }, { label: 'Marine Sense', weight: 1 }] },
      { label: 'Sorcerer of the Deep', weight: 3, element: 'Arcane', grade: 'B', statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Atlantean Rune Casting', weight: 2, element: 'Arcane', grade: 'B' }, { label: 'Lost Magic Access', weight: 2, element: 'Arcane', grade: 'A' }, { label: 'Current Weaving', weight: 2, element: 'Water', grade: 'B' }, { label: 'Bioluminescent Channeling', weight: 1, element: 'Light', grade: 'B' }], powerPool: [{ label: 'Ancient Magic', weight: 3 }, { label: 'Hydrokinesis', weight: 3 }, { label: 'Tide Control', weight: 2 }, { label: 'Water Scrying', weight: 2 }, { label: 'Atlantean Blast', weight: 1 }] },
    ],
    transformationPool: [
      { label: 'Hybrid Atlantean',  weight: 5, element: 'Water', grade: 'C', statBonusGrants: { strength: 'statBonus' }, statBonus: 1.0 },
      { label: 'Full Atlantean',    weight: 4, element: 'Water', grade: 'B', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, statBonus: 1.5 },
      { label: 'Ancient Bloodline Manifested', weight: 2, element: 'Water', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, statBonus: 2.0 },
      { label: 'Ocean King Form',   weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 3.0, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'4\"", weight: 3 }, { label: "5'8\"", weight: 5 }, { label: "6'0\"", weight: 5 },
      { label: "6'4\"", weight: 4 }, { label: "7'0\" (Royal Guard)", weight: 2 },
    ],
    abilities: [
      { label: 'Aquatic Mastery', weight: 3, element: 'Water', grade: 'B' },
      { label: 'Marine Telepathy', weight: 3, element: 'Psychic', grade: 'B' },
      { label: 'Trident Bond', weight: 2, element: 'Water', grade: 'B' },
      { label: 'Pressure Immunity', weight: 2, element: 'Water', grade: 'A' },
      { label: 'Lost Atlantean Knowledge', weight: 2, element: 'Arcane', grade: 'B' },
      { label: 'Bioluminescence (Combat)', weight: 1, element: 'Light', grade: 'B' },
    ],
  },

  // Hybrid — Dual heritage, draws on two bloodlines simultaneously
  {
    label: 'Hybrid',
    spinIdentity: ['Combo', 'HighVariance'],
    limitBreakOdds: 40,
    weight: 3,
    abilitySpinCount: 0,
    extraPowerSpins: 0,
    weaknessProbabilityModifier: 1.0,
    minStatTier: 'D-',
    description: 'Born of two worlds. The wheel spins twice more — your bloodline is whatever fate decides.',
    injectedWheels: [
      { id: 'heritage', displayName: 'Heritage', order: 1, segments: [
        { label: 'Distant Mix', weight: 5, description: 'Two bloodlines, one barely present.' },
        { label: 'Balanced', weight: 4, statBonusGrants: { potential: 'statBonus', iq: 'statBonus' }, description: 'Equal parts. Both heritages active.' },
        { label: 'Dominant Heritage', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, description: "One parent's gift dominates. The other lingers." },
        { label: 'Conflicted', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statPenalty' }, description: 'Two natures at war inside. Powerful, unstable.' },
        { label: 'Synthesis', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus', charisma: 'statBonus' }, description: "Both heritages refined into something new. The species hasn't been named yet." },
      ]},
      { id: 'conflict', displayName: 'Inner Conflict', order: 2, segments: [
        { label: 'Resolved', weight: 5, statBonusGrants: { potential: 'statBonus' }, description: 'At peace with both halves.' },
        { label: 'Suppressed', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'One half locked away. Disciplined.' },
        { label: 'Cyclical', weight: 3, statBonusGrants: { agility: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Each half rises and falls in seasons.' },
        { label: 'Volatile', weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', charisma: 'statPenalty' }, description: 'Snap-switches between heritages mid-fight.' },
        { label: 'Awakened', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus' }, description: 'Both selves conscious simultaneously. Two-mind combat.' },
      ]},
    ],
    statModifiers: { potential: 1.8, agility: 1.4, powerMastery: 1.3 },
    subTypePool: [
      { label: 'Half-Elf / Half-Human',       weight: 5, element: 'Nature', grade: 'C', statBonusGrants: { agility: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Elven Grace', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Human Adaptability', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Dual Heritage Affinity', weight: 2, element: 'Arcane', grade: 'C' }, { label: 'Cross-Blood Insight', weight: 1, element: 'Nature', grade: 'B' }] },
      { label: 'Half-Demon / Half-Human',      weight: 4, element: 'Fire', grade: 'C', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Demon Power Burst', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Human Emotion Amplifier', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Suppressed Demon Form', weight: 2, element: 'Shadow', grade: 'B' }, { label: 'Dual Nature Mastery', weight: 1, element: 'Chaos', grade: 'B' }] },
      { label: 'Half-Dragon / Half-Other',     weight: 4, element: 'Fire', grade: 'B', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Draconic Partial Shift', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Scale Flare', weight: 2, element: 'Fire', grade: 'B' }, { label: 'Dragon Sense', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Ancestry Surge', weight: 1, element: 'Fire', grade: 'A' }] },
      { label: 'Ancient Hybrid (Legendary Mix)', weight: 2, element: 'Cosmic', grade: 'S', statBonusGrants: { strength: 'statBonus', potential: 'statBonus', powerMastery: 'statBonus', agility: 'statBonus' }, abilities: [{ label: 'Blood Harmony', weight: 2, element: 'Cosmic', grade: 'S' }, { label: 'Ancestral Synthesis', weight: 2, element: 'Arcane', grade: 'S' }, { label: 'Dual Form Mastery', weight: 2, element: 'Chaos', grade: 'S' }, { label: 'Bloodline Echo', weight: 1, element: 'Cosmic', grade: 'SS' }] },
    ],
    transformationPool: [
      { label: 'Suppressed Heritage',  weight: 5, element: 'Neutral', grade: 'C', statBonusGrants: { potential: 'statBonus' }, statBonus: 1.0 },
      { label: 'Balanced Form',        weight: 4, element: 'Neutral', grade: 'B', statBonusGrants: { strength: 'statBonus', agility: 'statBonus' }, statBonus: 1.4 },
      { label: 'True Heritage Surge',  weight: 2, element: 'Chaos', grade: 'A', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, statBonus: 2.0 },
      { label: 'Transcendent Hybrid',  weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 3.0, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'0\"", weight: 2 }, { label: "5'4\"", weight: 4 }, { label: "5'8\"", weight: 6 },
      { label: "6'0\"", weight: 5 }, { label: "6'4\"", weight: 3 }, { label: "Variable (Dual Form)", weight: 1 },
    ],
    abilities: [
      { label: 'Dual Heritage Resonance', weight: 3, element: 'Arcane', grade: 'B' },
      { label: 'Bloodline Surge', weight: 3, element: 'Blood', grade: 'B' },
      { label: 'Adaptive Form', weight: 2, element: 'Chaos', grade: 'B' },
      { label: 'Heritage Switch', weight: 2, element: 'Neutral', grade: 'B' },
      { label: 'Mixed Blood Immunity', weight: 2, element: 'Nature', grade: 'C' },
      { label: 'Ancestry Echo', weight: 2, element: 'Soul', grade: 'C' },
      { label: 'True Form Glimpse', weight: 1, element: 'Cosmic', grade: 'S' },
    ],
  },

  // Giant — Massively oversized humanoids of immense strength
  {
    label: 'Giant',
    spinIdentity: ['Scaling'],
    limitBreakOdds: 42,
    weight: 4,
    abilitySpinCount: 2,
    weaknessProbabilityModifier: 1.2,
    weaknessCount: 1,
    minStatTier: 'C-',
    description: 'Large. Very large. Furniture is a constant problem.',
    injectedWheels: [
      { id: 'titanGrowth', displayName: 'Titan Growth', order: 1, segments: [
        { label: 'Hill Tier', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Big. Strong. Standard giant.' },
        { label: 'Mountain Tier', weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', armorStrength: 'statBonus' }, description: 'Geographic feature. Casts shadows.' },
        { label: 'Storm Tier', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Cloud-class giant. Weather follows.' },
        { label: 'Fire Tier', weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', fightingSkill: 'statBonus' }, description: 'Volcanic. Walks with smoke.' },
        { label: 'Primal Titan', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', armorStrength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Pre-creation tier. The old giants who shaped continents.' },
      ]},
      { id: 'earthshaker', displayName: 'Earthshaker', order: 2, segments: [
        { label: 'Heavy Step', weight: 5, statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, description: 'Each step a tremor.' },
        { label: 'Crater Walker', weight: 4, statBonusGrants: { strength: 'statBonus', armorStrength: 'statBonus' }, description: 'Leaves footprints visible from above.' },
        { label: 'Quake Caller', weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, description: 'Calls earthquakes. Coordinated, deliberate.' },
        { label: 'Mountain Sundered', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Sundered a mountain in living memory.' },
        { label: 'Continental Tread', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', armorStrength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Walks far enough that continents drift apart.' },
      ]},
    ],
    statModifiers: { strength: 2.2, durability: 2.0, armorStrength: 1.4, speed: 0.7, agility: 0.6, iq: 0.8 },
    subTypePool: [
      { label: 'Hill Giant',       weight: 5, element: 'Earth', grade: 'D', statBonusGrants: { strength: 'statBonus' }, abilities: [{ label: 'Club Mastery', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Stone Throw', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Ground Tremor', weight: 2, element: 'Earth', grade: 'D' }, { label: 'Iron Gut', weight: 1, element: 'Earth', grade: 'D' }] },
      { label: 'Fire Giant',       weight: 4, element: 'Fire', grade: 'C', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, abilities: [{ label: 'Flame Body', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Forge Mastery', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Fire Roar', weight: 2, element: 'Fire', grade: 'C' }, { label: 'Molten Core', weight: 1, element: 'Fire', grade: 'B' }] },
      { label: 'Frost Giant',      weight: 4, element: 'Ice', grade: 'C', statBonusGrants: { durability: 'statBonus', strength: 'statBonus' }, abilities: [{ label: 'Frost Skin', weight: 2, element: 'Ice', grade: 'C' }, { label: 'Blizzard Breath', weight: 2, element: 'Ice', grade: 'C' }, { label: 'Cold Immunity', weight: 2, element: 'Ice', grade: 'C' }, { label: 'Permafrost Aura', weight: 1, element: 'Ice', grade: 'B' }] },
      { label: 'Storm Giant',      weight: 3, element: 'Lightning', grade: 'B', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Lightning Control', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Weather Sense', weight: 2, element: 'Wind', grade: 'B' }, { label: 'Thunder Step', weight: 2, element: 'Lightning', grade: 'B' }, { label: 'Stormcall', weight: 1, element: 'Lightning', grade: 'A' }] },
      { label: 'Ancient Giant (Primordial)', weight: 2, element: 'Earth', grade: 'S', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Earth Shattering Blow', weight: 2, element: 'Earth', grade: 'S' }, { label: 'Primordial Titan Form', weight: 2, element: 'Earth', grade: 'S' }, { label: 'Mountain Crusher', weight: 2, element: 'Earth', grade: 'S' }, { label: 'Ancient Colossus', weight: 1, element: 'Cosmic', grade: 'S' }] },
    ],
    transformationPool: [
      { label: 'Standing Up (Normal)', weight: 5, element: 'Earth', grade: 'C', statBonusGrants: { strength: 'statBonus' }, statBonus: 1.0 },
      { label: 'Berserker Mode',       weight: 4, element: 'Fire', grade: 'B', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, statBonus: 1.7 },
      { label: 'Colossus Form',        weight: 2, element: 'Earth', grade: 'A', statBonusGrants: { strength: 'statBonus', durability: 'statBonus' }, statBonus: 2.5 },
      { label: 'Titan Awakening',      weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 4.0, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "9'0\" (Small Giant)", weight: 3 }, { label: "15'0\" (Standard)", weight: 5 },
      { label: "25'0\" (Elder)", weight: 4 }, { label: "60'0\" (Ancient)", weight: 3 }, { label: "Mountain-Scale", weight: 1 },
    ],
    abilities: [
      { label: 'Titanic Strength', weight: 3, element: 'Earth', grade: 'A' },
      { label: 'Ground Shaker', weight: 3, element: 'Earth', grade: 'B' },
      { label: 'Stone Skin (Natural)', weight: 2, element: 'Earth', grade: 'B' },
      { label: 'Size Intimidation (Passive)', weight: 2, element: 'Psychic', grade: 'B' },
      { label: 'Weapon Mastery (Oversized)', weight: 2, element: 'Metal', grade: 'C' },
      { label: 'Endurance Core', weight: 1, element: 'Earth', grade: 'A' },
    ],
  },

  // Parasite — Symbiotic organism that bonds with and enhances its host
  {
    label: 'Parasite',
    spinIdentity: ['Corruption', 'HighVariance'],
    limitBreakOdds: 44,
    weight: 5,
    abilitySpinCount: 2,
    extraPowerSpins: 1,
    weaknessProbabilityModifier: 0.9,
    weaknessCount: 1,
    minStatTier: 'D-',
    description: 'Something else is in here too. It pays rent in combat effectiveness.',
    injectedWheels: [
      { id: 'host', displayName: 'Host', order: 1, segments: [
        { label: 'Weak Host', weight: 4, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' }, description: 'Easy to control. Limited reach.' },
        { label: 'Average Host', weight: 5, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' }, description: 'Working tool. Lasts a while.' },
        { label: 'Strong Host', weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus' }, description: 'Powerful template. Hard to maintain.' },
        { label: 'Hero Host', weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' }, description: 'Hijacked a champion. Wearing them right now.' },
        { label: 'Apex Host', weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Inside something that should not exist. Eating it from the centre.' },
      ]},
      { id: 'paraMutation', displayName: 'Mutation', order: 2, segments: [
        { label: 'Tendril Replacement', weight: 5, statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus' }, description: 'Limbs become claws when needed.' },
        { label: 'Sensory Override', weight: 4, statBonusGrants: { iq: 'statBonus', agility: 'statBonus' }, description: 'All five senses, sharpened. Plus one more.' },
        { label: 'Power Steal', weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' }, description: 'Each victim contributes something.' },
        { label: 'Body Replacement', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, description: 'Host long gone. Form maintained.' },
        { label: 'Hive Spread', weight: 1, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus' }, description: 'Several bodies. One mind. Growing.' },
      ]},
    ],
    statModifiers: { strength: 1.5, agility: 1.5, powerMastery: 1.6, fightingSkill: 1.4 },
    subTypePool: [
      { label: 'Migi-Style (Rational)',     weight: 4, element: 'Nature', grade: 'C', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Rational Negotiation', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Blade Hand', weight: 2, element: 'Metal', grade: 'C' }, { label: 'Survival Calculus', weight: 2, element: 'Neutral', grade: 'C' }, { label: 'Host Sync', weight: 1, element: 'Nature', grade: 'B' }] },
      { label: 'Feral Parasite',            weight: 4, element: 'Chaos', grade: 'C', statBonusGrants: { strength: 'statBonus', agility: 'statBonus' }, abilities: [{ label: 'Predator Drive', weight: 2, element: 'Nature', grade: 'C' }, { label: 'Frenzied Mutation', weight: 2, element: 'Chaos', grade: 'C' }, { label: 'Host Domination', weight: 2, element: 'Psychic', grade: 'C' }, { label: 'Consuming Rage', weight: 1, element: 'Chaos', grade: 'B' }] },
      { label: 'Symbiotic Harmony',         weight: 3, element: 'Nature', grade: 'B', statBonusGrants: { strength: 'statBonus', agility: 'statBonus', powerMastery: 'statBonus' }, abilities: [{ label: 'Perfect Host Sync', weight: 2, element: 'Nature', grade: 'B' }, { label: 'Shared Consciousness', weight: 2, element: 'Psychic', grade: 'B' }, { label: 'Combined Combat', weight: 2, element: 'Neutral', grade: 'B' }, { label: 'Mutual Enhancement', weight: 1, element: 'Nature', grade: 'A' }] },
      { label: 'Hive Parasite (Network)',   weight: 2, element: 'Psychic', grade: 'A', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, abilities: [{ label: 'Hive Mind Link', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Swarm Intelligence', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Distributed Consciousness', weight: 2, element: 'Psychic', grade: 'A' }, { label: 'Network Evolution', weight: 1, element: 'Chaos', grade: 'S' }] },
    ],
    transformationPool: [
      { label: 'Suppressed (Host Dominant)', weight: 5, element: 'Neutral', grade: 'C', statBonusGrants: { iq: 'statBonus' }, statBonus: 1.0 },
      { label: 'Shared Control',             weight: 4, element: 'Nature', grade: 'B', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' }, statBonus: 1.5 },
      { label: 'Parasite Dominant',          weight: 2, element: 'Chaos', grade: 'A', statBonusGrants: { strength: 'statBonus', agility: 'statBonus', powerMastery: 'statBonus' }, statBonus: 2.2 },
      { label: 'Perfect Synthesis',          weight: 1, element: 'Cosmic', grade: 'SS', statBonus: 3.0, statBonusGrants: { strength: 'statBonus', agility: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' } },
    ],
    customHeightPool: [
      { label: "5'2\"", weight: 3 }, { label: "5'6\"", weight: 5 }, { label: "5'10\"", weight: 6 },
      { label: "6'0\"", weight: 4 }, { label: "Variable (Parasite Controlled)", weight: 2 },
    ],
    abilities: [
      { label: 'Blade Limb Shift', weight: 3, element: 'Metal', grade: 'B' },
      { label: 'Rapid Cellular Restructuring', weight: 3, element: 'Nature', grade: 'A' },
      { label: 'Parasite Sense (Danger)', weight: 2, element: 'Psychic', grade: 'B' },
      { label: 'Host Regeneration Boost', weight: 2, element: 'Nature', grade: 'B' },
      { label: 'Biomass Absorption', weight: 2, element: 'Nature', grade: 'B' },
      { label: 'Dual Consciousness', weight: 2, element: 'Psychic', grade: 'C' },
      { label: 'Parasite Dominance (Emergency)', weight: 1, element: 'Chaos', grade: 'S' },
    ],
  },
]

// O(1) lookup map — avoids races.find(r => r.label === X) linear scans across
// 35+ races for hot paths in spin/battle/character build code.
export const racesByLabel: Map<string, Race> = new Map(races.map(r => [r.label, r]))
export const getRace = (label: string | undefined | null): Race | undefined =>
  label ? racesByLabel.get(label) : undefined

// ── Content augmentation (runs once at module load, before the lookups) ──────
// 1. Rarer racial spin outcomes (weight ≤ 2) that don't already grant stats get
//    a derived stat boost/debuff — so the rare ones DO something beyond their
//    wheel effect, for every race. The rarest (weight 1) grant two; "dark"
//    elements buy power with a stat PENALTY.
// 2. Every racial ability inherits an element + grade from its parent pool
//    entry when missing, so each fires a meaningful elemental projectile/beam.
const _ELEMENT_STATS: Record<string, [string, string]> = {
  Fire: ['strength', 'durability'], Earth: ['durability', 'strength'], Metal: ['durability', 'fightingSkill'],
  Lightning: ['speed', 'energyLevel'], Wind: ['agility', 'speed'], Water: ['agility', 'potential'],
  Arcane: ['powerMastery', 'iq'], Cosmic: ['powerMastery', 'potential'], Time: ['speed', 'iq'],
  Psychic: ['iq', 'powerMastery'], Soul: ['potential', 'charisma'], Void: ['powerMastery', 'potential'],
  Light: ['charisma', 'potential'], Sound: ['charisma', 'iq'], Nature: ['potential', 'durability'],
  Shadow: ['agility', 'powerMastery'], Poison: ['durability', 'agility'], Chaos: ['potential', 'powerMastery'],
  Blood: ['strength', 'durability'], Neutral: ['fightingSkill', 'strength'],
}
const _DARK_ELEMENTS = new Set(['Shadow', 'Void', 'Blood', 'Chaos', 'Poison'])

function _deriveStatGrants(element: string | undefined, weight: number): Record<string, 'statBonus' | 'statPenalty'> {
  const [a, b] = _ELEMENT_STATS[element ?? 'Neutral'] ?? _ELEMENT_STATS.Neutral
  const grants: Record<string, 'statBonus' | 'statPenalty'> = { [a]: 'statBonus' }
  if (weight <= 1) grants[b] = _DARK_ELEMENTS.has(element ?? '') ? 'statPenalty' : 'statBonus'
  return grants
}

type _AugPoolEntry = {
  label: string
  weight: number
  element?: import('./types').ElementType
  grade?: import('./types').ItemGrade
  statBonusGrants?: Record<string, 'statBonus' | 'statPenalty'>
  grantedPowers?: string[]
  bonusSpins?: { category: string; displayName: string }[]
  powerPool?: { label: string; weight: number }[]
  abilities?: Array<{ element?: import('./types').ElementType; grade?: import('./types').ItemGrade }>
}
for (const race of races) {
  for (const pool of [race.subTypePool, race.classPool, race.transformationPool]) {
    for (const entry of (pool ?? []) as _AugPoolEntry[]) {
      // Give rarer outcomes (weight ≤ 2) a reward beyond the wheel effect, with
      // VARIETY: a signature power/ability, a stat boost/debuff, a bonus
      // weapon/armor spin, or an innate weakness (powerful but flawed).
      // Entries that already define a reward are left untouched.
      const hasReward = entry.statBonusGrants || entry.grantedPowers?.length || entry.bonusSpins?.length
      if (entry.weight <= 2 && !hasReward) {
        const seed = entry.label.length + (entry.label.charCodeAt(0) ?? 0) + (entry.label.charCodeAt(entry.label.length - 1) ?? 0)
        const sig = entry.powerPool?.length ? entry.powerPool[entry.powerPool.length - 1].label : null
        switch (seed % 5) {
          case 0:
            if (sig) { entry.grantedPowers = [sig]; break }
            entry.statBonusGrants = _deriveStatGrants(entry.element, entry.weight); break
          case 1:
            entry.bonusSpins = [{ category: 'weapon', displayName: 'Signature Weapon' }]; break
          case 2:
            entry.bonusSpins = [{ category: 'armor', displayName: 'Natural Armor' }]; break
          case 3:
            // Rarest get power with a cost: a bonus weakness baked in.
            entry.bonusSpins = entry.weight <= 1
              ? [{ category: 'weakness', displayName: 'Innate Flaw' }]
              : [{ category: 'armor', displayName: 'Natural Armor' }]
            break
          default:
            entry.statBonusGrants = _deriveStatGrants(entry.element, entry.weight)
        }
      }
      for (const ab of entry.abilities ?? []) {
        if (!ab.element) ab.element = entry.element ?? 'Neutral'
        if (!ab.grade) ab.grade = entry.grade ?? 'C'
      }
    }
  }
  for (const ab of (race.abilities ?? []) as Array<{ element?: import('./types').ElementType; grade?: import('./types').ItemGrade }>) {
    if (!ab.element) ab.element = 'Neutral'
    if (!ab.grade) ab.grade = 'C'
  }
}

// Flat lookup from every race subType/class/transformation entry → element + grade.
// Previously rebuilt at +page.svelte module init on every page load; lifting it here
// means the Map is computed once when the races chunk is loaded.
type _PoolEntry = { element?: import('./types').ElementType; grade?: import('./types').ItemGrade }
export const racePoolLookup: Map<string, _PoolEntry> = (() => {
  const m = new Map<string, _PoolEntry>()
  for (const race of races) {
    const entries: { label: string; element?: import('./types').ElementType; grade?: import('./types').ItemGrade }[] = [
      ...(race.subTypePool ?? []),
      ...(race.classPool ?? []),
      ...(race.transformationPool ?? []),
    ]
    for (const entry of entries) {
      if (entry.element || entry.grade) m.set(entry.label, { element: entry.element, grade: entry.grade })
    }
  }
  return m
})()

// Flat lookup for ability labels across all races (top-level + nested in pool entries).
// Archetype abilities are appended in archetypes.ts via mergeAbilityLookup() so each
// content module can populate the shared map without circular imports.
export const abilityLookup: Map<string, _PoolEntry> = (() => {
  const m = new Map<string, _PoolEntry>()
  for (const race of races) {
    const all: { label: string; element?: import('./types').ElementType; grade?: import('./types').ItemGrade }[] = [
      ...race.abilities,
      ...(race.subTypePool ?? []).flatMap(e => e.abilities ?? []),
      ...(race.classPool ?? []).flatMap(e => e.abilities ?? []),
      ...(race.transformationPool ?? []).flatMap(e => e.abilities ?? []),
    ]
    for (const entry of all) {
      if ((entry.element || entry.grade) && !m.has(entry.label)) {
        m.set(entry.label, { element: entry.element, grade: entry.grade })
      }
    }
  }
  return m
})()


// Register every race's injected wheels with the central registry at module
// load. Consumers (race-extras splice in +page.svelte / StorySpinView) look
// up segments by (raceLabel, wheelId) and may have them mutated by the
// archetype overlay before rendering.
for (const r of races) {
  bulkRegisterRaceWheels(r.label, r.injectedWheels)
}
