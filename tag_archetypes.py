#!/usr/bin/env python3
"""
tag_archetypes.py — Tag every remaining untagged ability/pool entry in archetypes.ts
with element and grade. Covers: stray abilities entries + all customAbilityPool entries.
"""

FILE = 'src/lib/content/archetypes.ts'

# Each tuple: (exact label string, element, grade)
TAGS = [
    # ── Warrior ──────────────────────────────────────────────────────────────
    ("Soldier's Endurance",                         'Earth',    'C'),

    # ── Ranger ───────────────────────────────────────────────────────────────
    ("Tracker's Eye",                               'Nature',   'C'),
    ("Hunter's Mark",                               'Nature',   'C'),
    ("Predator's Instinct",                         'Nature',   'B'),

    # ── Berserker ─────────────────────────────────────────────────────────────
    ("Death's Door Surge",                          'Chaos',    'B'),

    # ── Demon Slayer — Breathing Styles ──────────────────────────────────────
    ('Flame Breathing',                             'Fire',     'A'),
    ('Water Breathing',                             'Water',    'A'),
    ('Thunder Breathing',                           'Lightning','A'),
    ('Stone Breathing',                             'Earth',    'A'),
    ('Wind Breathing',                              'Wind',     'A'),
    ('Serpent Breathing',                           'Nature',   'B'),
    ('Insect Breathing',                            'Nature',   'B'),
    ('Love Breathing',                              'Light',    'B'),
    ('Sound Breathing',                             'Sound',    'B'),
    ('Mist Breathing',                              'Wind',     'B'),
    ('Beast Breathing',                             'Nature',   'B'),
    ('Flower Breathing',                            'Nature',   'B'),
    ('Moon Breathing',                              'Shadow',   'S'),
    ('Hinokami Kagura (Sun Breathing)',             'Fire',     'S'),

    # ── Stand User — JoJo Stands ──────────────────────────────────────────────
    ('Star Platinum',                              'Neutral',  'A'),
    ('The World',                                  'Time',     'A'),
    ('Crazy Diamond',                              'Light',    'B'),
    ('Gold Experience',                            'Nature',   'A'),
    ('King Crimson',                               'Time',     'A'),
    ('Sticky Fingers',                             'Shadow',   'B'),
    ('Moody Blues',                               'Time',     'C'),
    ('Sex Pistols',                               'Metal',    'C'),
    ('Purple Haze',                               'Poison',   'A'),
    ('White Album',                               'Ice',      'A'),
    ('Stone Free',                                'Neutral',  'B'),
    ('Weather Report',                            'Wind',     'A'),
    ('Diver Down',                                'Void',     'B'),
    ('D4C — Love Train',                     'Void',     'S'),
    ('Tusk Act 4',                                'Earth',    'S'),
    ('Soft & Wet',                                'Void',     'B'),
    ('The Hand',                                  'Void',     'A'),
    ('Echoes Act 3',                              'Sound',    'B'),
    ("Heaven's Door",                             'Psychic',  'A'),
    ('Hermit Purple',                             'Psychic',  'C'),
    ("Magician's Red",                            'Fire',     'B'),
    ('Hierophant Green',                          'Arcane',   'C'),
    ('Silver Chariot',                            'Metal',    'C'),
    ('Beach Boy',                                 'Water',    'C'),
    ('Notorious B.I.G.',                          'Chaos',    'S'),
    ('Grateful Dead',                             'Time',     'A'),
    ('Metallica',                                 'Metal',    'A'),
    ('Spice Girl',                                'Earth',    'B'),
    ('Scary Monsters',                            'Nature',   'A'),
    ('Bohemian Rhapsody',                         'Arcane',   'S'),
    ('Gold Experience Requiem',                   'Arcane',   'SS'),
    ('Made in Heaven',                            'Time',     'SS'),

    # ── Nen Hunter — Nen Types ────────────────────────────────────────────────
    ('Enhancer — Amplify Physical Ability',  'Neutral',  'B'),
    ('Transmuter — Alter Aura Properties',   'Arcane',   'B'),
    ('Emitter — Project Aura at Range',      'Arcane',   'B'),
    ('Conjurer — Materialize Objects',        'Arcane',   'B'),
    ('Manipulator — Control Living Things',   'Psychic',  'B'),
    ('Specialist — Unknown Nen Category',     'Arcane',   'A'),

    # ── Cursed Sorcerer — JJK Techniques ─────────────────────────────────────
    ('Limitless — Infinite Space',           'Arcane',   'SS'),
    ('Ten Shadows Technique',                     'Shadow',   'A'),
    ('Idle Transfiguration',                      'Arcane',   'A'),
    ('Cursed Speech',                             'Shadow',   'A'),
    ('Boogie Woogie',                             'Chaos',    'B'),
    ('Blood Manipulation',                        'Blood',    'A'),
    ('Projection Sorcery',                        'Arcane',   'B'),
    ('Collapse',                                  'Earth',    'B'),
    ('Ratio Technique',                           'Arcane',   'B'),
    ('Divergent Fist',                            'Neutral',  'B'),
    ('Contract King — Binding Vow',          'Shadow',   'B'),
    ('Reverse Cursed Technique',                  'Light',    'A'),
    ('Hollow — Purple (Six Eyes)',            'Arcane',   'SS'),

    # ── Necromancer ───────────────────────────────────────────────────────────
    ("Lich's Focus",                              'Soul',     'B'),

    # ── Druid ─────────────────────────────────────────────────────────────────
    ("Nature's Wrath",                            'Nature',   'B'),

    # ── Artificer ─────────────────────────────────────────────────────────────
    ("Tinker's Tools",                            'Metal',    'C'),

    # ── Warlock ───────────────────────────────────────────────────────────────
    ("Patron's Gift",                             'Arcane',   'B'),

    # ── Exorcist ──────────────────────────────────────────────────────────────
    ("Satan's Spawn Wrath",                       'Shadow',   'A'),

    # ── Alchemist ─────────────────────────────────────────────────────────────
    ("Flamel's Insight",                          'Arcane',   'B'),
    ("Philosopher's Stone Fragment",              'Arcane',   'A'),
    ("Truth's Gate Power",                        'Arcane',   'A'),

    # ── Devil Fruit User — Devil Fruits ───────────────────────────────────────
    ('Gomu Gomu no Mi — Rubber Body',        'Neutral',  'B'),
    ('Mera Mera no Mi — Fire Logia',         'Fire',     'A'),
    ('Hie Hie no Mi — Ice Logia',            'Ice',      'A'),
    ('Suna Suna no Mi — Sand Logia',         'Earth',    'A'),
    ('Pika Pika no Mi — Light Logia',        'Light',    'S'),
    ('Magu Magu no Mi — Magma Logia',        'Fire',     'S'),
    ('Goro Goro no Mi — Lightning Logia',    'Lightning','S'),
    ('Yuki Yuki no Mi — Snow Logia',         'Ice',      'B'),
    ('Ope Ope no Mi — Op-Op Paramecia',      'Arcane',   'S'),
    ('Gura Gura no Mi — Quake Paramecia',    'Earth',    'S'),
    ('Bari Bari no Mi — Barrier Paramecia',  'Arcane',   'B'),
    ('Baku Baku no Mi — Munch-Munch Paramecia', 'Neutral', 'C'),
    ('Yami Yami no Mi — Darkness Logia',     'Shadow',   'SS'),
    ('Tori Tori no Mi — Phoenix Mythical Zoan', 'Fire',  'S'),
    ('Uo Uo no Mi — Dragon Mythical Zoan',   'Fire',     'SS'),
    ('Hito Hito no Mi — Nika Mythical Zoan', 'Chaos',    'SS'),

    # ── Middle Manager ────────────────────────────────────────────────────────
    ("CC'd on Every Thread",                      'Neutral',  'D'),

    # ── Titan Shifter — Titan Forms ───────────────────────────────────────────
    ('Attack Titan',                              'Earth',    'A'),
    ('Armored Titan',                             'Earth',    'A'),
    ('Colossal Titan',                            'Fire',     'S'),
    ('Female Titan',                              'Neutral',  'A'),
    ('Beast Titan',                               'Nature',   'A'),
    ('Jaw Titan',                                 'Earth',    'A'),
    ('Cart Titan',                                'Earth',    'B'),
    ('War Hammer Titan',                          'Earth',    'A'),
    ('Founding Titan',                            'Arcane',   'SS'),
]

with open(FILE, encoding='utf-8') as f:
    content = f.read()

tagged = 0
skipped = 0
missing = []

for label, element, grade in TAGS:
    # Build the exact search string — label value with surrounding quotes
    needle = f"label: '{label}'"
    idx = content.find(needle)
    if idx == -1:
        # Try double-quote variant
        needle = f'label: "{label}"'
        idx = content.find(needle)
    if idx == -1:
        missing.append(label)
        continue

    # Find the closing } of this entry
    brace_end = content.find('}', idx)
    entry = content[idx:brace_end + 1]

    if 'element:' in entry or 'grade:' in entry:
        skipped += 1
        continue

    # Insert before the closing }
    insert = f", element: '{element}', grade: '{grade}'"
    new_entry = entry[:-1].rstrip() + insert + ' }'
    content = content[:idx] + new_entry + content[brace_end + 1:]
    tagged += 1
    print(f'  ✓ {label} → {element} / {grade}')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nTagged: {tagged}  |  Skipped (already tagged): {skipped}  |  Not found: {len(missing)}')
if missing:
    print('Missing labels:')
    for m in missing:
        print(f'  ! {m}')
