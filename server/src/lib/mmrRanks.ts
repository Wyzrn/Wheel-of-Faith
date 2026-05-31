// Server mirror of src/lib/mmrRanks.ts. The client cannot import from server
// (and vice-versa), so the rank ladder is duplicated. Keep the two in sync;
// the ladder rarely changes and a small drift would be caught by anyone
// noticing rank labels differ between the API response and the UI.

export interface MmrRank {
  id: string
  label: string
  threshold: number
}

export const MMR_RANKS: MmrRank[] = [
  { id: 'copper',   label: 'Copper',   threshold: 100  },
  { id: 'steel',    label: 'Steel',    threshold: 200  },
  { id: 'gold',     label: 'Gold',     threshold: 300  },
  { id: 'ruby',     label: 'Ruby',     threshold: 400  },
  { id: 'diamond',  label: 'Diamond',  threshold: 500  },
  { id: 'emerald',  label: 'Emerald',  threshold: 600  },
  { id: 'sapphire', label: 'Sapphire', threshold: 700  },
  { id: 'hero',     label: 'Hero',     threshold: 800  },
  { id: 'legend',   label: 'Legend',   threshold: 900  },
  { id: 'paragon',  label: 'Paragon',  threshold: 1000 },
]

export const UNRANKED: MmrRank = { id: 'unranked', label: 'Unranked', threshold: 0 }

export function mmrRankFor(mmr: number): MmrRank {
  if (mmr < MMR_RANKS[0].threshold) return UNRANKED
  for (let i = MMR_RANKS.length - 1; i >= 0; i--) {
    if (mmr >= MMR_RANKS[i].threshold) return MMR_RANKS[i]
  }
  return UNRANKED
}
