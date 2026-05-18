#!/usr/bin/env python3
"""
Comprehensive races.ts updater:
1. Add customHeightPool to races missing them
2. Add customGenderPool to specific races (genderless + special)
3. Add statBonusGrants to pool entries based on grade, where missing
4. Add more statBonusGrants to high-tier transformation entries
"""
import re, json

SRC = "src/lib/content/races.ts"

with open(SRC) as f:
    content = f.read()

# ─── Height pools by race ──────────────────────────────────────────────────────
HEIGHT_POOLS = {
    'Human':         "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 2 }, { label: \"5'2\\\"\", weight: 4 }, { label: \"5'4\\\"\", weight: 6 },\n      { label: \"5'6\\\"\", weight: 7 }, { label: \"5'8\\\"\", weight: 8 }, { label: \"5'10\\\"\", weight: 8 },\n      { label: \"6'0\\\"\", weight: 7 }, { label: \"6'2\\\"\", weight: 5 }, { label: \"6'4\\\"\", weight: 3 },\n      { label: \"6'6\\\"\", weight: 1 },\n    ],",
    'Orc':           "customHeightPool: [\n      { label: \"6'0\\\"\", weight: 2 }, { label: \"6'2\\\"\", weight: 3 }, { label: \"6'4\\\"\", weight: 4 },\n      { label: \"6'6\\\"\", weight: 5 }, { label: \"6'8\\\"\", weight: 5 }, { label: \"6'10\\\"\", weight: 4 },\n      { label: \"7'0\\\"\", weight: 3 }, { label: \"7'2\\\"\", weight: 2 }, { label: \"7'6\\\"\", weight: 1 },\n      { label: \"8'0\\\" (Giant-Blooded)\", weight: 1 },\n    ],",
    'Goblin':        "customHeightPool: [\n      { label: \"3'2\\\"\", weight: 2 }, { label: \"3'4\\\"\", weight: 3 }, { label: \"3'6\\\"\", weight: 5 },\n      { label: \"3'8\\\"\", weight: 6 }, { label: \"3'10\\\"\", weight: 6 }, { label: \"4'0\\\"\", weight: 5 },\n      { label: \"4'2\\\"\", weight: 3 }, { label: \"4'4\\\"\", weight: 2 }, { label: \"4'6\\\"\", weight: 1 },\n      { label: 'Suspiciously Small', weight: 1 },\n    ],",
    'Half-Elf':      "customHeightPool: [\n      { label: \"5'4\\\"\", weight: 3 }, { label: \"5'6\\\"\", weight: 5 }, { label: \"5'8\\\"\", weight: 7 },\n      { label: \"5'10\\\"\", weight: 8 }, { label: \"6'0\\\"\", weight: 7 }, { label: \"6'2\\\"\", weight: 5 },\n      { label: \"6'4\\\"\", weight: 3 }, { label: \"6'6\\\"\", weight: 1 },\n    ],",
    'Half-Orc':      "customHeightPool: [\n      { label: \"5'10\\\"\", weight: 3 }, { label: \"6'0\\\"\", weight: 4 }, { label: \"6'2\\\"\", weight: 5 },\n      { label: \"6'4\\\"\", weight: 6 }, { label: \"6'6\\\"\", weight: 5 }, { label: \"6'8\\\"\", weight: 4 },\n      { label: \"6'10\\\"\", weight: 3 }, { label: \"7'0\\\"\", weight: 2 }, { label: \"7'2\\\"\", weight: 1 },\n    ],",
    'Robot':         "customHeightPool: [\n      { label: \"5'0\\\" (Compact Unit)\", weight: 2 }, { label: \"5'6\\\"\", weight: 4 }, { label: \"6'0\\\"\", weight: 5 },\n      { label: \"6'4\\\"\", weight: 4 }, { label: \"6'8\\\"\", weight: 3 }, { label: \"7'0\\\"\", weight: 3 },\n      { label: \"7'6\\\" (Heavy Unit)\", weight: 2 }, { label: \"8'0\\\" (Siege Frame)\", weight: 1 },\n    ],",
    'Elf':           "customHeightPool: [\n      { label: \"5'6\\\"\", weight: 2 }, { label: \"5'8\\\"\", weight: 4 }, { label: \"5'10\\\"\", weight: 6 },\n      { label: \"6'0\\\"\", weight: 7 }, { label: \"6'2\\\"\", weight: 7 }, { label: \"6'4\\\"\", weight: 5 },\n      { label: \"6'6\\\"\", weight: 3 }, { label: \"6'8\\\"\", weight: 1 },\n    ],",
    'Tiefling':      "customHeightPool: [\n      { label: \"5'2\\\"\", weight: 2 }, { label: \"5'4\\\"\", weight: 4 }, { label: \"5'6\\\"\", weight: 6 },\n      { label: \"5'8\\\"\", weight: 7 }, { label: \"5'10\\\"\", weight: 7 }, { label: \"6'0\\\"\", weight: 5 },\n      { label: \"6'2\\\"\", weight: 3 }, { label: \"6'4\\\"\", weight: 1 },\n      { label: 'Horns Not Included in Height', weight: 1 },\n    ],",
    'Dragonborn':    "customHeightPool: [\n      { label: \"6'0\\\"\", weight: 2 }, { label: \"6'2\\\"\", weight: 4 }, { label: \"6'4\\\"\", weight: 6 },\n      { label: \"6'6\\\"\", weight: 7 }, { label: \"6'8\\\"\", weight: 6 }, { label: \"6'10\\\"\", weight: 4 },\n      { label: \"7'0\\\"\", weight: 3 }, { label: \"7'2\\\"\", weight: 2 }, { label: \"7'4\\\"\", weight: 1 },\n    ],",
    'Aasimar':       "customHeightPool: [\n      { label: \"5'6\\\"\", weight: 2 }, { label: \"5'8\\\"\", weight: 4 }, { label: \"5'10\\\"\", weight: 6 },\n      { label: \"6'0\\\"\", weight: 7 }, { label: \"6'2\\\"\", weight: 6 }, { label: \"6'4\\\"\", weight: 4 },\n      { label: \"6'6\\\"\", weight: 2 }, { label: '(Halo Radiates Upward)', weight: 1 },\n    ],",
    'Lizardfolk':    "customHeightPool: [\n      { label: \"5'8\\\"\", weight: 3 }, { label: \"6'0\\\"\", weight: 5 }, { label: \"6'2\\\"\", weight: 6 },\n      { label: \"6'4\\\"\", weight: 6 }, { label: \"6'6\\\"\", weight: 5 }, { label: \"6'8\\\"\", weight: 4 },\n      { label: \"7'0\\\"\", weight: 2 }, { label: \"7'4\\\" (Tail Counted)\", weight: 1 },\n    ],",
    'Tabaxi':        "customHeightPool: [\n      { label: \"5'8\\\"\", weight: 3 }, { label: \"5'10\\\"\", weight: 5 }, { label: \"6'0\\\"\", weight: 6 },\n      { label: \"6'2\\\"\", weight: 6 }, { label: \"6'4\\\"\", weight: 5 }, { label: \"6'6\\\"\", weight: 4 },\n      { label: \"6'8\\\"\", weight: 2 }, { label: \"7'0\\\"\", weight: 1 },\n      { label: '(Tail Not Included)', weight: 1 },\n    ],",
    'Genasi (Fire)': "customHeightPool: [\n      { label: \"5'2\\\"\", weight: 3 }, { label: \"5'4\\\"\", weight: 5 }, { label: \"5'6\\\"\", weight: 7 },\n      { label: \"5'8\\\"\", weight: 7 }, { label: \"5'10\\\"\", weight: 6 }, { label: \"6'0\\\"\", weight: 4 },\n      { label: \"6'2\\\"\", weight: 2 }, { label: \"6'4\\\"\", weight: 1 },\n    ],",
    'Genasi (Water)': "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 3 }, { label: \"5'2\\\"\", weight: 5 }, { label: \"5'4\\\"\", weight: 7 },\n      { label: \"5'6\\\"\", weight: 7 }, { label: \"5'8\\\"\", weight: 6 }, { label: \"5'10\\\"\", weight: 4 },\n      { label: \"6'0\\\"\", weight: 2 }, { label: \"6'2\\\"\", weight: 1 },\n    ],",
    'Genasi (Air)':  "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 3 }, { label: \"5'2\\\"\", weight: 5 }, { label: \"5'4\\\"\", weight: 7 },\n      { label: \"5'6\\\"\", weight: 7 }, { label: \"5'8\\\"\", weight: 5 }, { label: \"5'10\\\"\", weight: 3 },\n      { label: \"6'0\\\"\", weight: 2 }, { label: '(Technically Weightless)', weight: 1 },\n    ],",
    'Genasi (Earth)': "customHeightPool: [\n      { label: \"5'4\\\"\", weight: 3 }, { label: \"5'6\\\"\", weight: 5 }, { label: \"5'8\\\"\", weight: 6 },\n      { label: \"5'10\\\"\", weight: 6 }, { label: \"6'0\\\"\", weight: 5 }, { label: \"6'2\\\"\", weight: 4 },\n      { label: \"6'4\\\"\", weight: 3 }, { label: \"6'6\\\"\", weight: 2 }, { label: \"6'8\\\"\", weight: 1 },\n    ],",
    'Warforged':     "customHeightPool: [\n      { label: \"5'8\\\" (Scout)\", weight: 3 }, { label: \"6'0\\\"\", weight: 5 }, { label: \"6'2\\\"\", weight: 6 },\n      { label: \"6'4\\\"\", weight: 6 }, { label: \"6'6\\\"\", weight: 5 }, { label: \"6'8\\\"\", weight: 4 },\n      { label: \"7'0\\\" (Battle Chassis)\", weight: 2 }, { label: \"7'4\\\" (Siege Unit)\", weight: 1 },\n    ],",
    'Cyborg':        "customHeightPool: [\n      { label: \"5'6\\\"\", weight: 3 }, { label: \"5'8\\\"\", weight: 4 }, { label: \"6'0\\\"\", weight: 6 },\n      { label: \"6'2\\\"\", weight: 6 }, { label: \"6'4\\\"\", weight: 5 }, { label: \"6'6\\\"\", weight: 4 },\n      { label: \"6'8\\\"\", weight: 3 }, { label: \"7'0\\\" (Full Conversion)\", weight: 2 },\n      { label: \"7'6\\\" (Siege Frame)\", weight: 1 },\n    ],",
    'Bender':        "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 3 }, { label: \"5'2\\\"\", weight: 5 }, { label: \"5'4\\\"\", weight: 7 },\n      { label: \"5'6\\\"\", weight: 7 }, { label: \"5'8\\\"\", weight: 6 }, { label: \"5'10\\\"\", weight: 5 },\n      { label: \"6'0\\\"\", weight: 3 }, { label: \"6'2\\\"\", weight: 2 }, { label: \"6'4\\\"\", weight: 1 },\n    ],",
    'Shinobi':       "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 3 }, { label: \"5'2\\\"\", weight: 6 }, { label: \"5'4\\\"\", weight: 8 },\n      { label: \"5'6\\\"\", weight: 8 }, { label: \"5'8\\\"\", weight: 6 }, { label: \"5'10\\\"\", weight: 4 },\n      { label: \"6'0\\\"\", weight: 2 }, { label: \"6'2\\\"\", weight: 1 },\n    ],",
    'Mutant':        "customHeightPool: [\n      { label: \"4'6\\\" (Mutation Stunted)\", weight: 1 }, { label: \"5'0\\\"\", weight: 3 }, { label: \"5'4\\\"\", weight: 5 },\n      { label: \"5'8\\\"\", weight: 7 }, { label: \"6'0\\\"\", weight: 7 }, { label: \"6'4\\\"\", weight: 5 },\n      { label: \"6'8\\\"\", weight: 3 }, { label: \"7'0\\\"\", weight: 2 }, { label: \"7'6\\\"\", weight: 1 },\n      { label: \"8'0\\\" (Omega Growth Mutation)\", weight: 1 },\n    ],",
    'Nen User':      "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 3 }, { label: \"5'2\\\"\", weight: 5 }, { label: \"5'4\\\"\", weight: 7 },\n      { label: \"5'6\\\"\", weight: 7 }, { label: \"5'8\\\"\", weight: 6 }, { label: \"5'10\\\"\", weight: 5 },\n      { label: \"6'0\\\"\", weight: 3 }, { label: \"6'2\\\"\", weight: 2 }, { label: \"6'4\\\"\", weight: 1 },\n    ],",
    'Namekian':      "customHeightPool: [\n      { label: \"6'8\\\"\", weight: 2 }, { label: \"7'0\\\"\", weight: 4 }, { label: \"7'4\\\"\", weight: 6 },\n      { label: \"7'8\\\"\", weight: 6 }, { label: \"8'0\\\"\", weight: 5 }, { label: \"8'4\\\"\", weight: 4 },\n      { label: \"8'8\\\"\", weight: 2 }, { label: \"9'0\\\" (Elder)\", weight: 1 },\n      { label: 'Giant Form (30+)', weight: 1 },\n    ],",
    'Titan Shifter': "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 3 }, { label: \"5'2\\\"\", weight: 5 }, { label: \"5'4\\\"\", weight: 7 },\n      { label: \"5'6\\\"\", weight: 7 }, { label: \"5'8\\\"\", weight: 6 }, { label: \"5'10\\\"\", weight: 4 },\n      { label: \"6'0\\\"\", weight: 2 }, { label: '(Titan Form: 4m–60m)', weight: 1 },\n    ],",
    'Vampire':       "customHeightPool: [\n      { label: \"5'4\\\"\", weight: 2 }, { label: \"5'6\\\"\", weight: 4 }, { label: \"5'8\\\"\", weight: 6 },\n      { label: \"5'10\\\"\", weight: 7 }, { label: \"6'0\\\"\", weight: 7 }, { label: \"6'2\\\"\", weight: 5 },\n      { label: \"6'4\\\"\", weight: 3 }, { label: \"6'6\\\"\", weight: 2 }, { label: '(Preserved From Death)', weight: 1 },\n    ],",
    'Werewolf':      "customHeightPool: [\n      { label: \"5'8\\\" (Human Form)\", weight: 3 }, { label: \"5'10\\\"\", weight: 5 }, { label: \"6'0\\\"\", weight: 6 },\n      { label: \"6'2\\\"\", weight: 6 }, { label: \"6'4\\\"\", weight: 5 }, { label: \"6'6\\\"\", weight: 3 },\n      { label: \"6'8\\\"\", weight: 2 }, { label: '7\\'0\\\" (War Form: 8-9\\')', weight: 1 },\n    ],",
    'Undead (Revenant)': "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 2 }, { label: \"5'4\\\"\", weight: 4 }, { label: \"5'6\\\"\", weight: 6 },\n      { label: \"5'8\\\"\", weight: 7 }, { label: \"5'10\\\"\", weight: 7 }, { label: \"6'0\\\"\", weight: 5 },\n      { label: \"6'2\\\"\", weight: 3 }, { label: \"6'4\\\"\", weight: 2 }, { label: '(As in Life)', weight: 1 },\n    ],",
    'Sphinx':        "customHeightPool: [\n      { label: \"12' (Shoulder)\", weight: 3 }, { label: \"15' (Shoulder)\", weight: 5 },\n      { label: \"18' (Shoulder)\", weight: 5 }, { label: \"20' (Shoulder)\", weight: 4 },\n      { label: \"25' (Shoulder)\", weight: 2 }, { label: \"30' (Ancient)\", weight: 1 },\n    ],",
    'Saiyan':        "customHeightPool: [\n      { label: \"5'2\\\"\", weight: 3 }, { label: \"5'4\\\"\", weight: 6 }, { label: \"5'6\\\"\", weight: 7 },\n      { label: \"5'8\\\"\", weight: 7 }, { label: \"5'10\\\"\", weight: 6 }, { label: \"6'0\\\"\", weight: 4 },\n      { label: \"6'2\\\"\", weight: 2 }, { label: \"6'4\\\"\", weight: 1 },\n    ],",
    'Githyanki':     "customHeightPool: [\n      { label: \"5'8\\\"\", weight: 3 }, { label: \"5'10\\\"\", weight: 5 }, { label: \"6'0\\\"\", weight: 6 },\n      { label: \"6'2\\\"\", weight: 6 }, { label: \"6'4\\\"\", weight: 5 }, { label: \"6'6\\\"\", weight: 3 },\n      { label: \"6'8\\\"\", weight: 2 }, { label: \"7'0\\\" (Psionic Brute)\", weight: 1 },\n    ],",
    'Mindflayer':    "customHeightPool: [\n      { label: \"5'6\\\"\", weight: 3 }, { label: \"5'8\\\"\", weight: 6 }, { label: \"5'10\\\"\", weight: 8 },\n      { label: \"6'0\\\"\", weight: 7 }, { label: \"6'2\\\"\", weight: 5 }, { label: \"6'4\\\"\", weight: 3 },\n      { label: '(Tentacles Not Included)', weight: 1 },\n    ],",
    'Symbiote':      "customHeightPool: [\n      { label: 'Host-Dependent', weight: 6 }, { label: 'Host +6\" (Bonded Mass)', weight: 4 },\n      { label: 'Host +1\\' (Full Form)', weight: 3 }, { label: 'Variable (Terrifying)', weight: 2 },\n    ],",
    'Hollow / Arrancar': "customHeightPool: [\n      { label: \"5'4\\\"\", weight: 3 }, { label: \"5'6\\\"\", weight: 4 }, { label: \"5'8\\\"\", weight: 6 },\n      { label: \"5'10\\\"\", weight: 7 }, { label: \"6'0\\\"\", weight: 6 }, { label: \"6'2\\\"\", weight: 5 },\n      { label: \"6'4\\\"\", weight: 3 }, { label: \"6'6\\\"\", weight: 2 }, { label: \"6'8\\\"\", weight: 1 },\n      { label: '(Gillian: 20m+)', weight: 1 },\n    ],",
    'Devil Fruit User': "customHeightPool: [\n      { label: \"5'0\\\"\", weight: 3 }, { label: \"5'2\\\"\", weight: 5 }, { label: \"5'4\\\"\", weight: 7 },\n      { label: \"5'6\\\"\", weight: 8 }, { label: \"5'8\\\"\", weight: 7 }, { label: \"5'10\\\"\", weight: 5 },\n      { label: \"6'0\\\"\", weight: 3 }, { label: \"6'2\\\"\", weight: 2 }, { label: \"7'0\\\" (Giant Fruit)\", weight: 1 },\n    ],",
    'Demon':         "customHeightPool: [\n      { label: \"5'4\\\" (Suppressed Form)\", weight: 3 }, { label: \"5'8\\\"\", weight: 4 }, { label: \"6'0\\\"\", weight: 5 },\n      { label: \"6'4\\\"\", weight: 5 }, { label: \"6'8\\\"\", weight: 4 }, { label: \"7'0\\\"\", weight: 3 },\n      { label: \"7'6\\\"\", weight: 2 }, { label: \"8'0\\\" (True Form)\", weight: 2 },\n      { label: \"9'0\\\" (Demon Lord)\", weight: 1 }, { label: '(True Form: Immeasurable)', weight: 1 },\n    ],",
    'Half-Dragon':   "customHeightPool: [\n      { label: \"6'0\\\"\", weight: 3 }, { label: \"6'2\\\"\", weight: 5 }, { label: \"6'4\\\"\", weight: 6 },\n      { label: \"6'6\\\"\", weight: 6 }, { label: \"6'8\\\"\", weight: 5 }, { label: \"6'10\\\"\", weight: 4 },\n      { label: \"7'0\\\"\", weight: 3 }, { label: \"7'4\\\"\", weight: 2 }, { label: \"7'8\\\"\", weight: 1 },\n    ],",
    'Angel':         "customHeightPool: [\n      { label: \"6'0\\\"\", weight: 3 }, { label: \"6'2\\\"\", weight: 5 }, { label: \"6'4\\\"\", weight: 7 },\n      { label: \"6'6\\\"\", weight: 7 }, { label: \"6'8\\\"\", weight: 5 }, { label: \"7'0\\\"\", weight: 4 },\n      { label: \"7'4\\\"\", weight: 2 }, { label: \"7'8\\\"\", weight: 1 }, { label: '(Seraphim: Variable)', weight: 1 },\n      { label: '(Wings Not Included)', weight: 1 },\n    ],",
    'Beast':         "customHeightPool: [\n      { label: \"4' (Small Beast)\", weight: 3 }, { label: \"6' (Medium Beast)\", weight: 5 },\n      { label: \"8' (Large Beast)\", weight: 5 }, { label: \"10' (Great Beast)\", weight: 4 },\n      { label: \"12' (Apex)\", weight: 3 }, { label: \"15' (Sea Monster)\", weight: 2 },\n      { label: \"20'+ (Mythical Scale)\", weight: 1 },\n    ],",
    'Eldritch Being': "customHeightPool: [\n      { label: 'Approximately Human', weight: 3 }, { label: 'Something Larger', weight: 3 },\n      { label: 'Fills the Room', weight: 3 }, { label: 'Non-Euclidean', weight: 3 },\n      { label: 'City-Block Entity', weight: 1 }, { label: 'Incomprehensible Scale', weight: 1 },\n    ],",
    'Mythological Creature': "customHeightPool: [\n      { label: '3\\' (Fairy-Sized)', weight: 1 }, { label: \"5' (Unicorn)\", weight: 2 },\n      { label: \"15' (Phoenix)\", weight: 3 }, { label: \"30' (Behemoth)\", weight: 3 },\n      { label: '100\\' (Leviathan Class)', weight: 2 }, { label: 'Ocean-Spanning', weight: 1 },\n    ],",
    'Asgardian':     "customHeightPool: [\n      { label: \"5'10\\\"\", weight: 2 }, { label: \"6'0\\\"\", weight: 4 }, { label: \"6'2\\\"\", weight: 6 },\n      { label: \"6'4\\\"\", weight: 6 }, { label: \"6'6\\\"\", weight: 5 }, { label: \"6'8\\\"\", weight: 4 },\n      { label: \"7'0\\\"\", weight: 2 }, { label: \"7'4\\\" (Jotun Heritage)\", weight: 1 },\n    ],",
    'Kryptonian':    "customHeightPool: [\n      { label: \"5'6\\\"\", weight: 3 }, { label: \"5'8\\\"\", weight: 6 }, { label: \"5'10\\\"\", weight: 7 },\n      { label: \"6'0\\\"\", weight: 7 }, { label: \"6'2\\\"\", weight: 6 }, { label: \"6'4\\\"\", weight: 4 },\n      { label: \"6'6\\\"\", weight: 2 },\n    ],",
    'Time Lord':     "customHeightPool: [\n      { label: \"5'2\\\"\", weight: 2 }, { label: \"5'4\\\"\", weight: 4 }, { label: \"5'6\\\"\", weight: 6 },\n      { label: \"5'8\\\"\", weight: 7 }, { label: \"5'10\\\"\", weight: 7 }, { label: \"6'0\\\"\", weight: 5 },\n      { label: \"6'2\\\"\", weight: 3 }, { label: \"6'4\\\"\", weight: 2 }, { label: '(Regenerates to New Height)', weight: 1 },\n    ],",
    'Demi-god':      "customHeightPool: [\n      { label: \"5'6\\\"\", weight: 2 }, { label: \"5'8\\\"\", weight: 4 }, { label: \"5'10\\\"\", weight: 5 },\n      { label: \"6'0\\\"\", weight: 6 }, { label: \"6'2\\\"\", weight: 6 }, { label: \"6'4\\\"\", weight: 5 },\n      { label: \"6'6\\\"\", weight: 3 }, { label: \"6'8\\\"\", weight: 2 }, { label: \"7'0\\\"\", weight: 1 },\n      { label: \"7'4\\\" (Divine Surge)\", weight: 1 },\n    ],",
    'God':           "customHeightPool: [\n      { label: '5\\'10\\\" (Mortal Vessel)', weight: 4 }, { label: '6\\'4\\\" (Preferred Form)', weight: 5 },\n      { label: '7\\'0\\\" (Divine Presence)', weight: 4 }, { label: '8\\'0\\\" (Full Manifestation)', weight: 3 },\n      { label: 'Building-Sized', weight: 1 }, { label: 'Variable (Chooses)', weight: 2 },\n      { label: 'Immeasurable', weight: 1 },\n    ],",
    'Primordial':    "customHeightPool: [\n      { label: 'Planet-Sized', weight: 3 }, { label: 'Star-Sized', weight: 3 },\n      { label: 'Galaxy-Spanning', weight: 2 }, { label: 'Fills a Dimension', weight: 2 },\n      { label: 'Beyond Measurement', weight: 2 }, { label: 'All Sizes Simultaneously', weight: 1 },\n    ],",
    'Creator':       "customHeightPool: [\n      { label: 'All Sizes', weight: 3 }, { label: 'No Size', weight: 3 },\n      { label: 'The Concept of Size', weight: 2 }, { label: 'Pre-dates the concept of height', weight: 2 },\n    ],",
}

# ─── Gender pools by race ──────────────────────────────────────────────────────
GENDER_POOLS = {
    # Genderless races
    'Robot':          "customGenderPool: [\n      { label: 'Genderless (Unit)', weight: 4 }, { label: 'Male-Presenting', weight: 2 }, { label: 'Female-Presenting', weight: 2 },\n    ],",
    'Warforged':      "customGenderPool: [\n      { label: 'Genderless (Construct)', weight: 5 }, { label: 'Male-Presenting', weight: 2 }, { label: 'Female-Presenting', weight: 2 },\n    ],",
    'Mindflayer':     "customGenderPool: [\n      { label: 'Genderless (Colony Organism)', weight: 1 },\n    ],",
    'Namekian':       "customGenderPool: [\n      { label: 'Genderless (Asexual Species)', weight: 1 },\n    ],",
    'Eldritch Being': "customGenderPool: [\n      { label: 'Concept Does Not Apply', weight: 1 },\n    ],",
    'Primordial':     "customGenderPool: [\n      { label: 'Beyond Gender', weight: 1 },\n    ],",
    'Creator':        "customGenderPool: [\n      { label: 'All / None', weight: 1 },\n    ],",
    # Special gender pools
    'Angel':          "customGenderPool: [\n      { label: 'Male', weight: 3 }, { label: 'Female', weight: 3 }, { label: 'Androgynous', weight: 2 },\n    ],",
    'God':            "customGenderPool: [\n      { label: 'Male', weight: 3 }, { label: 'Female', weight: 3 }, { label: 'Genderless (Divine)', weight: 2 },\n    ],",
    'Kaiju':          "customGenderPool: [\n      { label: 'Male', weight: 3 }, { label: 'Female', weight: 3 }, { label: 'N/A (Apex Organism)', weight: 2 },\n    ],",
}

# ─── Stat bonus grants to add to pool entries that don't have them ─────────────
# Format: 'Race Label' -> 'Pool Type' -> 'Entry Label' -> statBonusGrants dict
# We'll add these by finding the specific text patterns and inserting before the closing }
# Only adding where statBonusGrants is NOT already present

STAT_BONUS_ADDITIONS = {
    # COMMON RACES - class entries getting stat bonuses
    'Human': {
        'classPool': {
            'Knight':    { 'fightingSkill': 'statBonus' },
            'Wizard':    { 'powerMastery': 'statBonus' },
            'Ranger':    { 'agility': 'statBonus' },
            'Cleric':    { 'potential': 'statBonus' },
            'Barbarian': { 'strength': 'statBonus' },
            'Bard':      { 'charisma': 'statBonus' },
            'Shaman':    { 'powerMastery': 'statBonus', 'potential': 'statBonus' },
        }
    },
    'Orc': {
        'classPool': {
            'Berserker':  { 'strength': 'statBonus' },
            'Warrior':    { 'strength': 'statBonus' },
            'Gladiator':  { 'fightingSkill': 'statBonus' },
            'Shaman':     { 'energyLevel': 'statBonus' },
        }
    },
    'Half-Orc': {
        'classPool': {
            'Berserker': { 'strength': 'statBonus' },
            'Fighter':   { 'fightingSkill': 'statBonus' },
            'Scout':     { 'agility': 'statBonus' },
        }
    },
    'Goblin': {
        'classPool': {
            'Alchemist': { 'iq': 'statBonus' },
            'Tinkerer':  { 'iq': 'statBonus' },
        }
    },
    'Half-Elf': {
        'subTypePool': {
            'High Elf Heritage':  { 'iq': 'statBonus' },
            'Sea Elf Heritage':   { 'agility': 'statBonus' },
        }
    },
    'Gnome': {
        'subTypePool': {
            'Deep Gnome': { 'iq': 'statBonus' },
            'Rock Gnome': { 'iq': 'statBonus' },
        }
    },
    # UNCOMMON
    'Elf': {
        'subTypePool': {
            'Wood Elf': { 'agility': 'statBonus' },
            'Sea Elf':  { 'agility': 'statBonus' },
        }
    },
    'Dragonborn': {
        'subTypePool': {
            'Red Dragonborn (Fire)':         { 'strength': 'statBonus' },
            'Blue Dragonborn (Lightning)':   { 'energyLevel': 'statBonus' },
            'Green Dragonborn (Poison)':     { 'durability': 'statBonus' },
            'Black Dragonborn (Acid)':       { 'strength': 'statBonus' },
            'White Dragonborn (Ice)':        { 'durability': 'statBonus' },
        }
    },
    'Aasimar': {
        'subTypePool': {
            'Protector Aasimar': { 'durability': 'statBonus' },
        }
    },
    'Lizardfolk': {
        'subTypePool': {
            'Komodo Lizardfolk':  { 'strength': 'statBonus' },
            'Basilisk Lizardfolk': { 'strength': 'statBonus', 'durability': 'statBonus' },
            'Crocodilian Lizardfolk': { 'strength': 'statBonus' },
            'Sea Serpent Lizardfolk': { 'agility': 'statBonus' },
            'Gecko Lizardfolk':   { 'agility': 'statBonus' },
            'Chameleon Lizardfolk': { 'agility': 'statBonus', 'speed': 'statBonus' },
            'Frilled Dragon Lizardfolk': { 'strength': 'statBonus' },
            'Skink Lizardfolk':   { 'speed': 'statBonus' },
        }
    },
    'Tabaxi': {
        'classPool': {
            'Hunter':         { 'speed': 'statBonus' },
            'Shadow Dancer':  { 'agility': 'statBonus' },
        }
    },
    'Genasi (Fire)': {
        'classPool': {
            'Flamecaller':  { 'energyLevel': 'statBonus' },
            'Emberwarden':  { 'durability': 'statBonus' },
        }
    },
    'Genasi (Water)': {
        'classPool': {
            'Tidecaller':  { 'agility': 'statBonus' },
            'Frostweaver': { 'durability': 'statBonus' },
        }
    },
    'Genasi (Air)': {
        'classPool': {
            'Stormcaller': { 'energyLevel': 'statBonus' },
            'Windrunner':  { 'speed': 'statBonus' },
        }
    },
    'Genasi (Earth)': {
        'classPool': {
            'Stonebinder':  { 'durability': 'statBonus' },
            'Quake Walker': { 'strength': 'statBonus' },
        }
    },
    'Warforged': {
        'subTypePool': {
            'Battle Chassis':             { 'strength': 'statBonus', 'durability': 'statBonus' },
            'Scout Unit':                 { 'speed': 'statBonus', 'agility': 'statBonus' },
            'Infiltrator Frame':          { 'agility': 'statBonus', 'speed': 'statBonus' },
            'Labor-Class Construct':      { 'strength': 'statBonus' },
            'Experimental Prototype':     { 'iq': 'statBonus', 'powerMastery': 'statBonus' },
            'Siege Platform':             { 'strength': 'statBonus', 'durability': 'statBonus' },
            'Medic Unit':                 { 'durability': 'statBonus' },
            'Diplomatic Envoy Model':     { 'charisma': 'statBonus' },
        }
    },
    'Bender': {
        'subTypePool': {
            'Waterbender':      { 'agility': 'statBonus' },
            'Earthbender':      { 'durability': 'statBonus' },
            'Firebender':       { 'energyLevel': 'statBonus' },
            'Airbender':        { 'speed': 'statBonus', 'agility': 'statBonus' },
            'Metalbender':      { 'strength': 'statBonus', 'iq': 'statBonus' },
            'Lavabender':       { 'strength': 'statBonus', 'powerMastery': 'statBonus' },
            'Bloodbender':      { 'powerMastery': 'statBonus', 'potential': 'statBonus' },
            'Lightning Bender': { 'energyLevel': 'statBonus', 'speed': 'statBonus' },
        }
    },
    'Shinobi': {
        'subTypePool': {
            'Konohagakure Shinobi (Hidden Leaf)': { 'fightingSkill': 'statBonus' },
            'Sunagakure Shinobi (Hidden Sand)':   { 'agility': 'statBonus' },
            'Kirigakure Shinobi (Hidden Mist)':   { 'agility': 'statBonus' },
            'Kumogakure Shinobi (Hidden Cloud)':  { 'speed': 'statBonus', 'fightingSkill': 'statBonus' },
            'Missing-Nin (Rogue)':               { 'fightingSkill': 'statBonus', 'agility': 'statBonus' },
            'Akatsuki Member':                   { 'powerMastery': 'statBonus', 'fightingSkill': 'statBonus' },
            'ANBU Black Ops':                    { 'fightingSkill': 'statBonus', 'agility': 'statBonus', 'speed': 'statBonus' },
        },
        'classPool': {
            'Academy Student (Genin Potential)': { 'fightingSkill': 'statPenalty' },
            'Chunin':      { 'fightingSkill': 'statBonus' },
            'Jonin':       { 'fightingSkill': 'statBonus', 'speed': 'statBonus' },
            'Jonin Commander': { 'fightingSkill': 'statBonus', 'iq': 'statBonus' },
        }
    },
    'Namekian': {
        'subTypePool': {
            'Warrior-Type Namekian': { 'strength': 'statBonus', 'durability': 'statBonus' },
            'Dragon Clan Namekian':  { 'potential': 'statBonus', 'powerMastery': 'statBonus' },
        }
    },
    'Titan Shifter': {
        'subTypePool': {
            'Attack Titan':    { 'strength': 'statBonus', 'fightingSkill': 'statBonus' },
            'Armored Titan':   { 'durability': 'statBonus', 'strength': 'statBonus' },
            'Female Titan':    { 'agility': 'statBonus', 'fightingSkill': 'statBonus' },
            'Jaw Titan':       { 'speed': 'statBonus', 'agility': 'statBonus' },
            'Cart Titan':      { 'durability': 'statBonus' },
            'Beast Titan':     { 'strength': 'statBonus', 'iq': 'statBonus' },
        }
    },
    'Vampire': {
        'transformationPool': {
            'Newly Turned':    { 'speed': 'statPenalty', 'strength': 'statPenalty' },
            'Young Vampire':   { 'charisma': 'statBonus' },
            'Ancient':         { 'charisma': 'statBonus', 'speed': 'statBonus' },
            'Elder':           { 'charisma': 'statBonus', 'speed': 'statBonus', 'strength': 'statBonus' },
        }
    },
    'Werewolf': {
        'transformationPool': {
            'Half Moon':    { 'strength': 'statBonus' },
            'Full Moon':    { 'strength': 'statBonus', 'speed': 'statBonus' },
            'Blood Moon':   { 'strength': 'statBonus', 'speed': 'statBonus', 'fightingSkill': 'statBonus' },
        }
    },
    'Undead (Revenant)': {
        'transformationPool': {
            'Recently Deceased': { 'durability': 'statPenalty' },
            'Decades Dead':      { 'durability': 'statBonus' },
            'Centuries Old':     { 'durability': 'statBonus', 'strength': 'statBonus' },
            'Ancient Revenant':  { 'durability': 'statBonus', 'strength': 'statBonus', 'potential': 'statBonus' },
        }
    },
    'Saiyan': {
        'classPool': {
            'Low-Class Warrior':  { 'fightingSkill': 'statPenalty' },
            'Mid-Class Warrior':  { 'fightingSkill': 'statBonus' },
        }
    },
    'Mutant': {
        'classPool': {
            'Gamma Level Mutant': { 'powerMastery': 'statBonus' },
            'Beta Level Mutant':  { 'powerMastery': 'statBonus', 'potential': 'statBonus' },
        }
    },
    'Nen User': {
        'transformationPool': {
            'Nen Awakening (Basic)': { 'energyLevel': 'statPenalty' },
            'Nen Refined':           { 'energyLevel': 'statBonus' },
            'Zetsu / Gyo Mastery':   { 'energyLevel': 'statBonus', 'fightingSkill': 'statBonus' },
            'Hatsu Developed':       { 'energyLevel': 'statBonus', 'powerMastery': 'statBonus', 'fightingSkill': 'statBonus' },
        }
    },
    'Hollow / Arrancar': {
        'classPool': {
            'Gillian (menos grande)': { 'energyLevel': 'statPenalty', 'iq': 'statPenalty' },
            'Adjuchas':               { 'energyLevel': 'statBonus' },
        },
        'transformationPool': {
            'Suppressed Reiatsu': { 'energyLevel': 'statPenalty', 'strength': 'statPenalty' },
            'Base Form':          { 'energyLevel': 'statBonus' },
            'Resurreccion':       { 'energyLevel': 'statBonus', 'strength': 'statBonus', 'fightingSkill': 'statBonus' },
        }
    },
    'Devil Fruit User': {
        'transformationPool': {
            'Fruit Newbie (Still Learning)': { 'powerMastery': 'statPenalty' },
            'Haki-Augmented':                { 'powerMastery': 'statBonus', 'fightingSkill': 'statBonus' },
            'Mastered Fruit':                { 'powerMastery': 'statBonus', 'energyLevel': 'statBonus', 'potential': 'statBonus' },
        }
    },
    'Demon': {
        'subTypePool': {
            'Lesser Demon':    { 'strength': 'statPenalty' },
            'Greater Demon':   { 'strength': 'statBonus', 'durability': 'statBonus' },
            'Demon King Lineage': { 'strength': 'statBonus', 'durability': 'statBonus', 'charisma': 'statBonus' },
            'Half-Demon':      { 'strength': 'statBonus' },
        }
    },
    'Half-Dragon': {
        'subTypePool': {
            'Chromatic Heritage (Evil)': { 'strength': 'statBonus', 'durability': 'statBonus' },
        }
    },
    'Angel': {
        'transformationPool': {
            'Mortal Vessel':     { 'charisma': 'statPenalty' },
            'Wings Manifested':  { 'charisma': 'statBonus', 'speed': 'statBonus' },
            'Full Divine Form':  { 'charisma': 'statBonus', 'potential': 'statBonus', 'fightingSkill': 'statBonus' },
        }
    },
    'Githyanki': {
        'classPool': {
            'Gith Warrior': { 'fightingSkill': 'statBonus' },
        }
    },
    'Mindflayer': {
        'subTypePool': {
            'Standard Mindflayer': { 'iq': 'statBonus' },
            'Rogue Mindflayer':    { 'iq': 'statBonus', 'potential': 'statBonus' },
        },
        'transformationPool': {
            'Isolated Psionic': { 'iq': 'statBonus' },
            'Networked Mind':   { 'iq': 'statBonus', 'potential': 'statBonus' },
            'Hivemind Node':    { 'iq': 'statBonus', 'potential': 'statBonus', 'powerMastery': 'statBonus' },
            'Elder Brain Vessel': { 'iq': 'statBonus', 'potential': 'statBonus', 'powerMastery': 'statBonus', 'energyLevel': 'statBonus' },
        }
    },
    'Symbiote': {
        'transformationPool': {
            'Partial Bond':    { 'strength': 'statPenalty' },
            'Stable Bond':     { 'strength': 'statBonus' },
            'Deep Merge':      { 'strength': 'statBonus', 'agility': 'statBonus' },
            'Perfect Symbiosis': { 'strength': 'statBonus', 'agility': 'statBonus', 'durability': 'statBonus' },
        }
    },
    'Beast': {
        'subTypePool': {
            'Great Cat': { 'speed': 'statBonus', 'agility': 'statBonus' },
        }
    },
    'Eldritch Being': {
        'transformationPool': {
            'Mostly Comprehensible': { 'iq': 'statPenalty' },
            'Eldritch Awakening':    { 'iq': 'statBonus', 'powerMastery': 'statBonus' },
            'True Nature Surfaces':  { 'iq': 'statBonus', 'powerMastery': 'statBonus', 'potential': 'statBonus' },
        }
    },
    'Mythological Creature': {
        'transformationPool': {
            'Myth Dormant':     { 'strength': 'statPenalty', 'powerMastery': 'statPenalty' },
            'Legend Awakened':  { 'strength': 'statBonus', 'powerMastery': 'statBonus' },
            'Mythic Form':      { 'strength': 'statBonus', 'durability': 'statBonus', 'powerMastery': 'statBonus' },
        }
    },
    'Viltrumite': {
        'transformationPool': {
            'Half-Viltrumite':   { 'strength': 'statPenalty', 'durability': 'statPenalty' },
            'Pure-Blood (Full Viltrum)': { 'strength': 'statBonus', 'durability': 'statBonus' },
            'Battle-Hardened':   { 'strength': 'statBonus', 'durability': 'statBonus', 'fightingSkill': 'statBonus' },
            "Conquerer-Ranked":  { 'strength': 'statBonus', 'durability': 'statBonus', 'fightingSkill': 'statBonus', 'speed': 'statBonus' },
        }
    },
    'Asgardian': {
        'classPool': {
            'Warrior': { 'strength': 'statBonus', 'fightingSkill': 'statBonus' },
        },
        'transformationPool': {
            'Mortal Vessel':     { 'strength': 'statPenalty', 'durability': 'statPenalty' },
            'Battle-Ready Form': { 'strength': 'statBonus', 'durability': 'statBonus' },
            "Warrior's Peak":    { 'strength': 'statBonus', 'durability': 'statBonus', 'fightingSkill': 'statBonus' },
        }
    },
    'Kryptonian': {
        'transformationPool': {
            'Under Yellow Sun':  { 'strength': 'statBonus', 'speed': 'statBonus', 'durability': 'statBonus' },
        }
    },
    'Time Lord': {
        'classPool': {
            'Warrior':  { 'fightingSkill': 'statBonus' },
            'Guardian': { 'potential': 'statBonus', 'durability': 'statBonus' },
        },
        'transformationPool': {
            'First Regeneration Cycle':   { 'iq': 'statPenalty' },
            'Mid-Cycle (Experienced)':    { 'iq': 'statBonus', 'potential': 'statBonus' },
            'Late Cycle (Ancient Wisdom)': { 'iq': 'statBonus', 'potential': 'statBonus', 'charisma': 'statBonus' },
            'War Doctor (Battle-Hardened)': { 'iq': 'statBonus', 'potential': 'statBonus', 'fightingSkill': 'statBonus' },
        }
    },
    'Demi-god': {
        'classPool': {
            'God of War (Partial)': { 'strength': 'statBonus', 'fightingSkill': 'statBonus' },
            'God of Knowledge (Partial)': { 'iq': 'statBonus', 'potential': 'statBonus' },
            'God of Trickery (Partial)': { 'iq': 'statBonus', 'charisma': 'statBonus' },
            'God of Nature (Partial)': { 'potential': 'statBonus', 'energyLevel': 'statBonus' },
        }
    },
    'God': {
        'transformationPool': {
            'Manifested Avatar':   { 'strength': 'statPenalty', 'charisma': 'statPenalty', 'powerMastery': 'statPenalty' },
            'Partial Incarnation': { 'strength': 'statBonus', 'charisma': 'statBonus', 'powerMastery': 'statBonus' },
            'Full Incarnation':    { 'strength': 'statBonus', 'durability': 'statBonus', 'charisma': 'statBonus', 'powerMastery': 'statBonus', 'potential': 'statBonus' },
        }
    },
    'Primordial': {
        'transformationPool': {
            'Diminished Form': { 'strength': 'statPenalty', 'energyLevel': 'statPenalty', 'powerMastery': 'statPenalty' },
            'Stirring':        { 'strength': 'statBonus', 'energyLevel': 'statBonus', 'powerMastery': 'statBonus' },
            'Partially Woken': { 'strength': 'statBonus', 'durability': 'statBonus', 'energyLevel': 'statBonus', 'powerMastery': 'statBonus', 'potential': 'statBonus' },
        }
    },
    'Creator': {
        'transformationPool': {
            'Observer Mode':      { 'strength': 'statPenalty', 'powerMastery': 'statPenalty', 'energyLevel': 'statPenalty' },
            'Active Participant': { 'strength': 'statBonus', 'powerMastery': 'statBonus', 'energyLevel': 'statBonus', 'iq': 'statBonus' },
            'Full Creative Mode': { 'strength': 'statBonus', 'durability': 'statBonus', 'powerMastery': 'statBonus', 'energyLevel': 'statBonus', 'iq': 'statBonus', 'potential': 'statBonus' },
        }
    },
    'Dragon': {
        'transformationPool': {
            'Young Dragon': { 'strength': 'statBonus' },
        }
    },
    'Sphinx': {
        'transformationPool': {
            # No transformation pool, use subTypePool
        },
        'subTypePool': {
            'Hieracosphinx': { 'speed': 'statBonus', 'agility': 'statBonus' },
            'Criosphinx':    { 'strength': 'statBonus', 'durability': 'statBonus' },
        }
    },
}

def make_stat_bonus_str(grants: dict) -> str:
    """Convert {'strength': 'statBonus', ...} to TypeScript statBonusGrants object string."""
    inner = ', '.join(f'{k}: \'{v}\'' for k, v in grants.items())
    return f'statBonusGrants: {{ {inner} }}'

def has_stat_bonus(entry_text: str) -> bool:
    return 'statBonusGrants' in entry_text

def add_stat_bonus_to_entry(content: str, pool_entry_label: str, grants: dict) -> str:
    """Find the pool entry with this label and add statBonusGrants if not already present."""
    # We look for the pattern: label: 'ENTRY_LABEL', weight: N, element: ..., grade: ...
    # and insert statBonusGrants after grade (or after weight if no grade)

    label_escaped = pool_entry_label.replace('(', r'\(').replace(')', r'\)').replace("'", r"\'").replace('/', r'\/')

    # Pattern: find the entry start
    # Look for: { label: 'LABEL', weight: N...  }
    pattern = r"\{ label: '" + re.escape(pool_entry_label) + r"',\s*weight: \d+"

    match = re.search(pattern, content)
    if not match:
        # Try with double quotes
        pattern2 = r'\{ label: "' + re.escape(pool_entry_label) + r'",\s*weight: \d+'
        match = re.search(pattern2, content)

    if not match:
        return content

    start = match.start()
    # Find the end of this entry (matching closing brace at same depth, accounting for nested braces)
    depth = 0
    i = start
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                entry_end = i + 1
                break
        i += 1
    else:
        return content

    entry_text = content[start:entry_end]

    # Don't add if already has statBonusGrants
    if has_stat_bonus(entry_text):
        return content

    # Find where to insert: after grade: 'X' or after element: 'X' or after weight: N
    # Look for grade: '...' first
    grant_str = make_stat_bonus_str(grants)

    # Find the insertion point: after grade (if exists), else after element, else after weight
    # We want to insert after the grade/element/weight value, before the next comma-separated field

    # Try inserting after grade: 'X'
    grade_m = re.search(r"(grade: '[^']*')", entry_text)
    if grade_m:
        insert_after = grade_m.end()
        new_entry = entry_text[:insert_after] + f', {grant_str}' + entry_text[insert_after:]
        return content[:start] + new_entry + content[entry_end:]

    # Try after element: 'X'
    elem_m = re.search(r"(element: '[^']*')", entry_text)
    if elem_m:
        insert_after = elem_m.end()
        new_entry = entry_text[:insert_after] + f', {grant_str}' + entry_text[insert_after:]
        return content[:start] + new_entry + content[entry_end:]

    # After weight: N
    weight_m = re.search(r"(weight: \d+)", entry_text)
    if weight_m:
        insert_after = weight_m.end()
        new_entry = entry_text[:insert_after] + f', {grant_str}' + entry_text[insert_after:]
        return content[:start] + new_entry + content[entry_end:]

    return content

def add_height_pool(content: str, race_label: str, height_str: str) -> str:
    """Add customHeightPool to a race if it doesn't already have one."""
    # Find the race entry
    race_pattern = r"label: '" + re.escape(race_label) + r"'"
    match = re.search(race_pattern, content)
    if not match:
        print(f"  WARNING: Could not find race '{race_label}'")
        return content

    # Find the race object start (go back to find the opening {)
    start = match.start()
    # Walk back to find the opening {
    i = start
    while i > 0 and content[i] != '{':
        i -= 1
    race_start = i

    # Find the closing } of this race
    depth = 0
    i = race_start
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                race_end = i + 1
                break
        i += 1
    else:
        return content

    race_text = content[race_start:race_end]

    # Check if already has customHeightPool
    if 'customHeightPool' in race_text:
        return content

    # Find the insertion point: before 'abilities:' array at the end of the race
    # We want to insert before the final 'abilities:' field
    abilities_match = list(re.finditer(r'\n    abilities:', race_text))
    if not abilities_match:
        print(f"  WARNING: No abilities field in race '{race_label}'")
        return content

    # Use the last 'abilities:' match (in case there are nested ones)
    last_abilities = abilities_match[-1]
    insert_pos = race_start + last_abilities.start()

    new_content = content[:insert_pos] + f'\n    {height_str}\n' + content[insert_pos:]
    return new_content

def add_gender_pool(content: str, race_label: str, gender_str: str) -> str:
    """Add customGenderPool to a race if it doesn't already have one."""
    race_pattern = r"label: '" + re.escape(race_label) + r"'"
    match = re.search(race_pattern, content)
    if not match:
        print(f"  WARNING: Could not find race '{race_label}' for gender")
        return content

    start = match.start()
    i = start
    while i > 0 and content[i] != '{':
        i -= 1
    race_start = i

    depth = 0
    i = race_start
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                race_end = i + 1
                break
        i += 1
    else:
        return content

    race_text = content[race_start:race_end]

    if 'customGenderPool' in race_text:
        return content

    # Insert before the last 'abilities:' field
    abilities_match = list(re.finditer(r'\n    abilities:', race_text))
    if not abilities_match:
        return content

    last_abilities = abilities_match[-1]
    insert_pos = race_start + last_abilities.start()

    new_content = content[:insert_pos] + f'\n    {gender_str}\n' + content[insert_pos:]
    return new_content

# ─── Apply all changes ─────────────────────────────────────────────────────────

print("Adding custom height pools...")
for race_label, height_str in HEIGHT_POOLS.items():
    before = content
    content = add_height_pool(content, race_label, height_str)
    if content != before:
        print(f"  ✓ Added height pool to {race_label}")
    else:
        print(f"  - Skipped {race_label} (already has height pool or not found)")

print("\nAdding custom gender pools...")
for race_label, gender_str in GENDER_POOLS.items():
    before = content
    content = add_gender_pool(content, race_label, gender_str)
    if content != before:
        print(f"  ✓ Added gender pool to {race_label}")
    else:
        print(f"  - Skipped {race_label}")

print("\nAdding stat bonus grants...")
for race_label, pool_types in STAT_BONUS_ADDITIONS.items():
    for pool_type, entries in pool_types.items():
        for entry_label, grants in entries.items():
            before = content
            content = add_stat_bonus_to_entry(content, entry_label, grants)
            if content != before:
                print(f"  ✓ Added statBonusGrants to [{race_label}] {pool_type} '{entry_label}'")
            else:
                print(f"  - Skipped [{race_label}] '{entry_label}' (not found or already has grants)")

with open(SRC, 'w') as f:
    f.write(content)

print(f"\n✓ Done! Updated {SRC}")
