// backstories.ts — Backstory content pool for Wheel of Fate.
// Every backstory grants at least one statBonusGrants entry (positive or negative).
// No default export. No functions. Static const array only.

import type { SimpleItem } from './types'

export const backstories: SimpleItem[] = [
  { label: 'Raised by wolves (they have complicated feelings about it)',
    weight: 1, statBonusGrants: { agility: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Former accountant — the darkness chose them',
    weight: 1, statBonusGrants: { iq: 'statBonus', fightingSkill: 'statPenalty' } },

  { label: 'Bit by a radioactive middle manager',
    weight: 1, statBonusGrants: { charisma: 'statPenalty', durability: 'statBonus' } },

  { label: 'Survived by being too stubborn to die',
    weight: 1, statBonusGrants: { durability: 'statBonus', speed: 'statPenalty' } },

  { label: 'Woke up in a field with no memory and excellent posture',
    weight: 1, statBonusGrants: { agility: 'statBonus', iq: 'statPenalty' } },

  { label: 'Prophecy child (the prophecy was vague and possibly about someone else)',
    weight: 1, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' } },

  { label: 'Built different — literally, in a lab',
    weight: 1, statBonusGrants: { iq: 'statBonus', strength: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Lost everything to a villain who monologued for too long',
    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Just passing through and got involved somehow',
    weight: 1, statBonusGrants: { potential: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Studied abroad; dimension was unspecified',
    weight: 1, statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' } },

  { label: 'Grew up on the wrong side of a pocket dimension',
    weight: 1, statBonusGrants: { agility: 'statBonus', iq: 'statBonus' } },

  { label: 'Professional adventurer (tax purposes)',
    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Failed hero of a different story',
    weight: 1, statBonusGrants: { potential: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Reluctant chosen one',
    weight: 1, statBonusGrants: { potential: 'statBonus', fightingSkill: 'statBonus' } },

  { label: 'Lived in a tower; asked zero questions',
    weight: 1, statBonusGrants: { iq: 'statPenalty', potential: 'statBonus' } },

  { label: 'Escaped a fate worse than death (the estate planning)',
    weight: 1, statBonusGrants: { speed: 'statBonus', charisma: 'statBonus' } },

  { label: 'Technically dead, but working on it',
    weight: 1, statBonusGrants: { durability: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Revenge quest that somehow became a career',
    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Touched by a god who immediately regretted it',
    weight: 1, statBonusGrants: { charisma: 'statBonus', potential: 'statBonus' } },

  { label: 'Made a deal at a crossroads; still unclear on the terms',
    weight: 1, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Found in a meteor crater wrapped in mystery (and a weird blanket)',
    weight: 1, statBonusGrants: { energyLevel: 'statBonus', strength: 'statBonus' } },

  { label: 'Heir to a kingdom nobody told them about until adulthood',
    weight: 1, statBonusGrants: { charisma: 'statBonus', fightingSkill: 'statPenalty' } },

  { label: 'Last survivor of a tragedy they caused accidentally',
    weight: 1, statBonusGrants: { strength: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Retired assassin (three more jobs, then retired assassin)',
    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus' } },

  { label: 'Former child prodigy, now average adult, extremely bitter',
    weight: 1, statBonusGrants: { iq: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Chose power over love; now has both and neither is satisfying',
    weight: 1, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' } },

  { label: "The villain in someone else's story",
    weight: 1, statBonusGrants: { strength: 'statBonus', charisma: 'statBonus' } },

  { label: 'Saved the world; nobody knows; they have feelings about that',
    weight: 1, statBonusGrants: { potential: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Clone of someone legendary with absolutely none of their skills',
    weight: 1, statBonusGrants: { potential: 'statBonus', fightingSkill: 'statPenalty' } },

  { label: 'Time traveller who messed up and is now stuck in the present',
    weight: 1, statBonusGrants: { iq: 'statBonus', speed: 'statPenalty' } },

  { label: 'Survived the apocalypse because they were in the bathroom',
    weight: 1, statBonusGrants: { durability: 'statBonus', agility: 'statPenalty' } },

  { label: "Accidentally absorbed a god's power at an open-buffet divine feast",
    weight: 1, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', iq: 'statPenalty' } },

  { label: 'Born at the exact moment of a prophecy, the wrong prophecy',
    weight: 1, statBonusGrants: { potential: 'statBonus', charisma: 'statPenalty' } },

  { label: 'The one who got away (from multiple factions, simultaneously)',
    weight: 1, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' } },

  { label: 'Left home seeking fortune; found chaos; considering the fortune',
    weight: 1, statBonusGrants: { charisma: 'statBonus', iq: 'statPenalty' } },

  { label: 'Wrongly imprisoned; correctly escaped; technically a fugitive',
    weight: 1, statBonusGrants: { agility: 'statBonus', fightingSkill: 'statBonus' } },

  { label: 'Raised by a library (the books were very formative)',
    weight: 1, statBonusGrants: { iq: 'statBonus', strength: 'statPenalty' } },

  { label: 'Was a potato farmer until the potato farmer chosen by prophecy was unavailable',
    weight: 1, statBonusGrants: { potential: 'statBonus', fightingSkill: 'statPenalty' } },

  { label: 'Literally fell into this from a portal while trying to get to work',
    weight: 1, statBonusGrants: { agility: 'statPenalty', potential: 'statBonus' } },

  { label: 'Wrote a strongly-worded letter that changed the course of history',
    weight: 1, statBonusGrants: { charisma: 'statBonus', iq: 'statBonus' } },

  // ── New backstories ──
  { label: 'Trained in secret for a decade, still lost the tournament',
    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Raised from the dead by someone who had no idea what they were doing',
    weight: 1, statBonusGrants: { durability: 'statBonus', iq: 'statPenalty' } },

  { label: 'Blessed by a dying god who was clearly improvising',
    weight: 1, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus' } },

  { label: 'Orphaned, trained, orphaned again, trained again, beginning to see a pattern',
    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' } },

  { label: 'Found an ancient artifact in a garage sale; paid three gold for it',
    weight: 1, statBonusGrants: { powerMastery: 'statBonus', iq: 'statPenalty' } },

  { label: 'Born under a blood moon; parents were furious at the inconvenience',
    weight: 1, statBonusGrants: { energyLevel: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Survived a doomsday cult by selling them better snacks',
    weight: 1, statBonusGrants: { charisma: 'statBonus', fightingSkill: 'statPenalty' } },

  { label: 'Trained under a master who died immediately after imparting full wisdom',
    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', potential: 'statBonus' } },

  { label: 'Emerged from the wilderness with skills no one asked about',
    weight: 1, statBonusGrants: { agility: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Was a nobody until the nobody turned out to matter',
    weight: 1, statBonusGrants: { potential: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Accidentally killed the final boss at level one; trauma ensued',
    weight: 1, statBonusGrants: { strength: 'statBonus', iq: 'statPenalty' } },

  { label: 'Signed a contract they could not read; power came with it anyway',
    weight: 1, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' } },

  { label: 'Got the hero\'s power by accident; the hero was very upset',
    weight: 1, statBonusGrants: { potential: 'statBonus', strength: 'statBonus' } },

  { label: 'Former royal who abdicated for adventure and deeply regrets nothing',
    weight: 1, statBonusGrants: { charisma: 'statBonus', fightingSkill: 'statBonus' } },

  { label: 'Was the villain\'s henchman; quit; now a hero by technicality',
    weight: 1, statBonusGrants: { fightingSkill: 'statBonus', charisma: 'statPenalty' } },

  { label: 'The chosen one was busy; they got the call by mistake',
    weight: 1, statBonusGrants: { potential: 'statBonus', iq: 'statPenalty' } },
]
