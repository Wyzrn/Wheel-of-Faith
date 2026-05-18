#!/usr/bin/env python3
"""
tag_abilities.py — Add element and grade to every ability entry in the game.
Processes: src/lib/game/spinQueue.ts, src/lib/content/archetypes.ts,
           src/lib/content/races.ts
"""
import re

# ─── Element keyword inference ──────────────────────────────────────────────

ELEMENT_KEYWORDS = [
    ('Shadow',    r'shadow|dark(?:ness)?|night(?!fall)|umbra|stealth|assassin|backstab|poison blade|cursed blade|black|smoke|camouflage|unseen'),
    ('Fire',      r'fire|flame|burn|blaze|inferno|ember|scorch|ignite|heat|pyro|solar|sunfire|dragon.*breath|breath.*fire|flare|combustion|volcanic'),
    ('Ice',       r'ice|frost|frozen|cold|cryo|glacial|winter|blizzard|tundra|absolute zero|freezing'),
    ('Lightning', r'lightning|thunder|electric|volt|shock|spark|storm(?! of |ing)|zap|discharge|plasma'),
    ('Light',     r'\blight\b|divine|holy|sacred|blessed|radiant|luminous|angelic|celestial aura|aurora|halo|purif|consecrat|exorcism|banish'),
    ('Water',     r'\bwater\b|aqua|tidal|flood|wave|ocean|sea(?! of )|river|mist|rain|drench|hydro'),
    ('Arcane',    r'arcane|magic|mana|spell|rune|mystic|sorcery|ether|ritual|enchant|counterspell|ley line|arcana|formula|sigil|ward(?!robe)|scroll'),
    ('Blood',     r'blood|hemato|crimson|sanguine|gore|vital strike|lifeforce|transfusion|hemorrhage'),
    ('Poison',    r'poison|venom|toxic|acid|corros|plague|blight|miasma|neurotoxin|paralyzing'),
    ('Psychic',   r'psychic|\bmental\b|\bmind\b|telepat|telekin|psion|thought|illusion|fear(?! of )|phantom|hallucin|confusion|brain|cognitive'),
    ('Time',      r'\btime\b|temporal|chrono|haste|stasis|rewind|slow(?:ing)?|accelerat|age|timestop|prediction|foresight|precognition|clairvoyance'),
    ('Wind',      r'\bwind\b|gust|breeze|tempest|cyclone|tornado|air(?:born|blast)|zephyr|gale|swift(?! blade)|aerial|flight(?! of)'),
    ('Nature',    r'nature|plant|vine|forest|feral|wild(?!card)|growth|root|bark|regen|beast sense|animal|flora|fauna|camouflage of nature|healing herb'),
    ('Earth',     r'earth|stone|ground|rock|quake|mountain|granite|iron skin|hardened|tough|fortif|fortress|tremor|geomancy'),
    ('Soul',      r'soul|spirit(?:ual)?|death(?! mark| wish)|undead|necro|ghost|spectral|haunt|wrath|curse(?!d blade)|reaper|elegy|requiem|drain(?:ing)? life|life force'),
    ('Metal',     r'\bmetal\b|\biron\b(?! will|\s*resolve|\s*gut|\s*discipline)|steel|alloy|forge|blade mastery|sword mastery|weapon bond|gunslinger|firearm|bullet|caliber'),
    ('Sound',     r'sound|sonic|echo|resonan|vibrat|chorus|music|song|ballad|melody|voice|wail|screech|roar'),
    ('Void',      r'\bvoid\b|\babyss\b|nothingness|null|negation|erase|unmake|annihilat'),
    ('Gravity',   r'gravit|weight(?:less)?|crush|press(?:ure)|pull(?! of )|mass distort|singularity'),
    ('Chaos',     r'chaos|berserk|rampage|frenzy|unstable|wild(?:card)|unpredictable|random|mayhem|berserker rage'),
    ('Cosmic',    r'cosmic|universe|galactic|stellar|star(?:born)?|astral|infinity|omnipotent|multiversal|reality(?! fracture)'),
    ('Psychic',   r'esper|nen|aura read|killing intent|presence|bloodlust detection|sixth sense'),
]

GRADE_KEYWORDS = [
    ('SSS', r'primordial|creation|omnipotent|absolute zero mastery|infinity gauntlet|one for all awakened|god force|divine mandate|universe'),
    ('SS',  r'cosmic|godly|transcend|celestial.*power|perfect.*form|beyond.*limit|six paths|ultra instinct|awakened.*full|complete mastery'),
    ('S',   r'perfected|supreme|sovereign|ultimate.*form|legendary.*technique|immortal.*technique|one for all|detroit smash|moon breathing|sun breathing|hinokami'),
    ('A',   r'molecular|dimensional|gravity.*mastery|time.*stop|phantom|void.*manipulation|domain.*expansion|full.*mastery|hollow.*flash|gran rey|cero oscuras|tusk act|love train|notorious|scary monsters|sage mode|six paths|eight gates'),
    ('B',   r'soul.*drain|time.*fracture|dimensional.*anchor|arcane.*pulse|gravity.*shift|divine.*ward|venomous|berserk.*surge|forbidden|reality.*fracture|blade storm|unbreakable will|resonance|unseen strike|death mark|kill intent'),
    ('C',   r'enhanced|elemental|ki blast|chakra|aura|shield|ward(?!robe)|battle|combat|warrior|fighter|soldier|mastery|hardened|endurance|instinct|mana|arcane.*pulse'),
    ('D',   r'basic|training|formation|initiat|recruit|academy|foundation|entry.level|standard.*issue|conventional'),
]

def infer_element(label, default_el='Neutral'):
    for el, pat in ELEMENT_KEYWORDS:
        if re.search(pat, label, re.I):
            return el
    return default_el

def infer_grade(label, parent_grade=None, context_grade='C'):
    if parent_grade:
        return parent_grade
    for grade, pat in GRADE_KEYWORDS:
        if re.search(pat, label, re.I):
            return grade
    return context_grade

# ─── Context defaults per archetype ────────────────────────────────────────

ARCHETYPE_ELEMENT = {
    'Warrior':           'Neutral',
    'Mage':              'Arcane',
    'Rogue':             'Shadow',
    'Superhero':         'Neutral',
    'Paladin':           'Light',
    'Ranger':            'Nature',
    'Bard':              'Sound',
    'Cleric':            'Light',
    'Anti-Hero':         'Shadow',
    'Demon Slayer':      'Fire',
    'Shinobi':           'Wind',
    'Berserker':         'Fire',
    'Monk':              'Neutral',
    'Dual Wielder':      'Metal',
    'Supervillain':      'Shadow',
    'Bounty Hunter':     'Neutral',
    'Stand User':        'Neutral',
    'Nen Hunter':        'Arcane',
    'Esper':             'Psychic',
    'Cursed Sorcerer':   'Shadow',
    'Necromancer':       'Soul',
    'Druid':             'Nature',
    'Artificer':         'Metal',
    'Warlock':           'Void',
    'Exorcist':          'Light',
    'Alchemist':         'Arcane',
    'Devil Fruit User':  'Arcane',
    'Possessed':         'Shadow',
    'Sorcerer':          'Arcane',
    'Middle Manager':    'Neutral',
    'Professional Sneezer': 'Neutral',
    'Chaos Gremlin':     'Chaos',
    'Time Traveler':     'Time',
    'Titan Shifter':     'Earth',
    'Awakened':          'Arcane',
}

ARCHETYPE_GRADE = {
    'Warrior':           'C',
    'Mage':              'C',
    'Rogue':             'C',
    'Superhero':         'B',
    'Paladin':           'B',
    'Ranger':            'C',
    'Bard':              'C',
    'Cleric':            'C',
    'Anti-Hero':         'B',
    'Demon Slayer':      'A',
    'Shinobi':           'B',
    'Berserker':         'B',
    'Monk':              'B',
    'Dual Wielder':      'C',
    'Supervillain':      'B',
    'Bounty Hunter':     'C',
    'Stand User':        'A',
    'Nen Hunter':        'B',
    'Esper':             'B',
    'Cursed Sorcerer':   'B',
    'Necromancer':       'B',
    'Druid':             'C',
    'Artificer':         'C',
    'Warlock':           'B',
    'Exorcist':          'B',
    'Alchemist':         'C',
    'Devil Fruit User':  'A',
    'Possessed':         'B',
    'Sorcerer':          'B',
    'Middle Manager':    'D',
    'Professional Sneezer': 'D',
    'Chaos Gremlin':     'D',
    'Time Traveler':     'A',
    'Titan Shifter':     'A',
    'Awakened':          'S',
}

# ─── Context defaults per race ──────────────────────────────────────────────

RACE_ELEMENT = {
    'Human':              'Neutral',
    'Orc':                'Earth',
    'Goblin':             'Poison',
    'Half-Elf':           'Nature',
    'Half-Orc':           'Earth',
    'Robot':              'Metal',
    'Elf':                'Nature',
    'Tiefling':           'Shadow',
    'Dragonborn':         'Fire',
    'Aasimar':            'Light',
    'Lizardfolk':         'Earth',
    'Tabaxi':             'Nature',
    'Genasi (Fire)':      'Fire',
    'Genasi (Water)':     'Water',
    'Genasi (Air)':       'Wind',
    'Genasi (Earth)':     'Earth',
    'Warforged':          'Metal',
    'Cyborg':             'Metal',
    'Bender':             'Arcane',
    'Shinobi':            'Wind',
    'Mutant':             'Arcane',
    'Nen User':           'Arcane',
    'Namekian':           'Nature',
    'Titan Shifter':      'Earth',
    'Vampire':            'Blood',
    'Werewolf':           'Nature',
    'Undead (Revenant)':  'Soul',
    'Sphinx':             'Arcane',
    'Saiyan':             'Chaos',
    'Githyanki':          'Arcane',
    'Mindflayer':         'Psychic',
    'Symbiote':           'Shadow',
    'Hollow / Arrancar':  'Soul',
    'Devil Fruit User':   'Arcane',
    'Demon':              'Shadow',
    'Half-Dragon':        'Fire',
    'Dragon':             'Fire',
    'Angel':              'Light',
    'Beast':              'Nature',
    'Eldritch Being':     'Void',
    'Mythological Creature': 'Arcane',
    'Asgardian':          'Lightning',
    'Kryptonian':         'Light',
    'Time Lord':          'Time',
    'Kaiju':              'Earth',
    'Demi-god':           'Light',
    'God':                'Light',
    'Primordial':         'Cosmic',
    'Creator':            'Arcane',
    'Viltrumite':         'Chaos',
    'Dwarf':              'Earth',
    'Halfling':           'Neutral',
    'Gnome':              'Arcane',
    'Githzerai':          'Psychic',
}

RACE_GRADE = {
    'Human':              'D',
    'Orc':                'C',
    'Goblin':             'D',
    'Half-Elf':           'D',
    'Half-Orc':           'C',
    'Robot':              'C',
    'Elf':                'C',
    'Tiefling':           'C',
    'Dragonborn':         'C',
    'Aasimar':            'C',
    'Lizardfolk':         'C',
    'Tabaxi':             'C',
    'Genasi (Fire)':      'C',
    'Genasi (Water)':     'C',
    'Genasi (Air)':       'C',
    'Genasi (Earth)':     'C',
    'Warforged':          'C',
    'Cyborg':             'C',
    'Bender':             'B',
    'Shinobi':            'B',
    'Mutant':             'B',
    'Nen User':           'B',
    'Namekian':           'B',
    'Titan Shifter':      'A',
    'Vampire':            'B',
    'Werewolf':           'C',
    'Undead (Revenant)':  'C',
    'Sphinx':             'B',
    'Saiyan':             'A',
    'Githyanki':          'B',
    'Mindflayer':         'B',
    'Symbiote':           'A',
    'Hollow / Arrancar':  'A',
    'Devil Fruit User':   'A',
    'Demon':              'B',
    'Half-Dragon':        'B',
    'Dragon':             'A',
    'Angel':              'A',
    'Beast':              'C',
    'Eldritch Being':     'SS',
    'Mythological Creature': 'A',
    'Asgardian':          'S',
    'Kryptonian':         'S',
    'Time Lord':          'A',
    'Kaiju':              'A',
    'Demi-god':           'A',
    'God':                'SS',
    'Primordial':         'SSS',
    'Creator':            'SSS',
    'Viltrumite':         'S',
    'Dwarf':              'C',
    'Halfling':           'D',
    'Gnome':              'C',
    'Githzerai':          'B',
}

# ─── Processing helpers ─────────────────────────────────────────────────────

def get_nearest_grade(text_before):
    """Get the most recent grade: 'X' in the preceding ~1500 chars."""
    chunk = text_before[-1500:]
    matches = list(re.finditer(r"grade: '([^']+)'", chunk))
    if matches:
        return matches[-1].group(1)
    return None

def get_nearest_element(text_before):
    """Get the most recent element: 'X' in the preceding ~1500 chars."""
    chunk = text_before[-1500:]
    matches = list(re.finditer(r"element: '([^']+)'", chunk))
    if matches:
        return matches[-1].group(1)
    return None

def get_context_name(text_before, name_lookup):
    """Get the nearest matching race or archetype name."""
    chunk = text_before[-3000:]
    # Look for label: 'X' at 4-space indent (top-level definitions)
    matches = list(re.finditer(r"\n    label: '([^']+)'", chunk))
    for m in reversed(matches):
        name = m.group(1)
        if name in name_lookup:
            return name
    return None

def find_abilities_array_end(content, start):
    """Find the matching ] for an abilities array starting at start (the [ char)."""
    depth = 0
    i = start
    while i < len(content):
        if content[i] == '[':
            depth += 1
        elif content[i] == ']':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

def tag_entry(entry_text, default_element, default_grade):
    """
    Add element and grade to an ability entry that doesn't have them.
    Returns modified entry or original if already tagged.
    """
    if 'element:' in entry_text or 'grade:' in entry_text:
        return entry_text  # already tagged

    label_m = re.search(r"label: '([^']+)'", entry_text)
    if not label_m:
        return entry_text

    label = label_m.group(1)
    element = infer_element(label, default_element)
    grade = infer_grade(label, None, default_grade)

    # Insert element and grade before the closing }
    # Handle trailing comma and whitespace
    # Pattern: find last } possibly with trailing comma/newline
    insert_m = re.search(r'\s*\}(\s*,?\s*)$', entry_text)
    if not insert_m:
        return entry_text

    before_close = entry_text[:insert_m.start()]
    after = insert_m.group(0)
    return f"{before_close}, element: '{element}', grade: '{grade}'{after}"

def process_abilities_arrays(content, name_lookup_grade, name_lookup_element):
    """
    Find every 'abilities: [' in content and tag untagged entries inside.
    Processes from last to first to preserve character positions.
    """
    # Find all 'abilities: [' positions (exclude powerPool, subTypePool, etc.)
    # Only match the 'abilities:' key (not inside other pool array names)
    pattern = re.compile(r'(?<![a-zA-Z])abilities: \[')
    matches = list(pattern.finditer(content))

    # Process in reverse to keep positions valid
    for m in reversed(matches):
        bracket_pos = m.end() - 1  # position of '['
        bracket_end = find_abilities_array_end(content, bracket_pos)
        if bracket_end == -1:
            continue

        text_before = content[:m.start()]
        parent_grade = get_nearest_grade(text_before)
        parent_element = get_nearest_element(text_before)
        context_name = get_context_name(text_before, name_lookup_grade)

        context_grade = name_lookup_grade.get(context_name, 'C') if context_name else 'C'
        context_element = name_lookup_element.get(context_name, 'Neutral') if context_name else 'Neutral'

        effective_grade = parent_grade or context_grade
        effective_element = parent_element or context_element

        array_text = content[bracket_pos:bracket_end + 1]

        # Tag each { label: ... } entry within the array
        # Entries can be single or multi-line; use brace matching
        new_array = tag_entries_in_array(array_text, effective_element, effective_grade)

        if new_array != array_text:
            content = content[:bracket_pos] + new_array + content[bracket_end + 1:]

    return content

def tag_entries_in_array(array_text, default_element, default_grade):
    """Find each { label: ... } entry in the array and tag it if untagged."""
    # Find each entry by brace matching, skipping the outer [ ]
    result = array_text
    # Process from right to left so positions stay valid
    # Find all entry start positions
    i = 1  # skip opening [
    positions = []
    while i < len(array_text) - 1:
        if array_text[i] == '{':
            # Find matching }
            depth = 0
            j = i
            while j < len(array_text):
                if array_text[j] == '{':
                    depth += 1
                elif array_text[j] == '}':
                    depth -= 1
                    if depth == 0:
                        positions.append((i, j))
                        i = j + 1
                        break
                j += 1
            else:
                i += 1
        else:
            i += 1

    # Process in reverse
    for start, end in reversed(positions):
        entry = array_text[start:end + 1]
        # Skip entries that don't have a label (shouldn't happen but be safe)
        if 'label:' not in entry:
            continue
        # Include any trailing comma and whitespace
        # Check for trailing comma after }
        after_end = end + 1
        trailing = ''
        while after_end < len(array_text) and array_text[after_end] in ', \n':
            trailing += array_text[after_end]
            after_end += 1

        new_entry = tag_entry(entry, default_element, default_grade)
        if new_entry != entry:
            array_text = array_text[:start] + new_entry + array_text[end + 1:]

    return array_text

# ─── Process spinQueue.ts GENERAL_ABILITY_POOL ─────────────────────────────

SPIN_QUEUE_FILE = 'src/lib/game/spinQueue.ts'

GENERAL_POOL_ENTRIES = [
    ('Enhanced Senses',     'Nature',   'C'),
    ('Regeneration',        'Nature',   'C'),
    ('Elemental Affinity',  'Arcane',   'C'),
    ('Telepathic Whisper',  'Psychic',  'B'),
    ('Shadow Step',         'Shadow',   'B'),
    ('Iron Skin',           'Earth',    'C'),
    ('Berserk Surge',       'Chaos',    'C'),
    ('Arcane Pulse',        'Arcane',   'C'),
    ('Venomous Touch',      'Poison',   'B'),
    ('Gravity Shift',       'Gravity',  'B'),
    ('Time Fracture',       'Time',     'A'),
    ('Soul Drain',          'Soul',     'B'),
    ('Divine Ward',         'Light',    'B'),
    ('Dimensional Anchor',  'Void',     'B'),
    ('Molecular Control',   'Arcane',   'A'),
]

print('Processing spinQueue.ts...')
with open(SPIN_QUEUE_FILE) as f:
    sq_content = f.read()

for label, element, grade in GENERAL_POOL_ENTRIES:
    old = f"{{ label: '{label}'"
    # Check if already tagged
    idx = sq_content.find(old)
    if idx == -1:
        continue
    entry_end = sq_content.find('}', idx)
    entry = sq_content[idx:entry_end + 1]
    if 'element:' in entry:
        print(f'  - Skipped (already tagged): {label}')
        continue
    # Replace: { label: 'X', weight: N } → { label: 'X', weight: N, element: 'Y', grade: 'Z' }
    new_entry = entry.rstrip().rstrip('}').rstrip() + f", element: '{element}', grade: '{grade}' }}"
    sq_content = sq_content[:idx] + new_entry + sq_content[entry_end + 1:]
    print(f'  ✓ Tagged: {label} → {element} / {grade}')

with open(SPIN_QUEUE_FILE, 'w') as f:
    f.write(sq_content)
print('  Done.\n')

# ─── Process archetypes.ts ──────────────────────────────────────────────────

ARCHETYPES_FILE = 'src/lib/content/archetypes.ts'

print('Processing archetypes.ts...')
with open(ARCHETYPES_FILE) as f:
    arc_content = f.read()

arc_before = arc_content
arc_content = process_abilities_arrays(arc_content, ARCHETYPE_GRADE, ARCHETYPE_ELEMENT)

changed = arc_content.count("element:") - arc_before.count("element:")
print(f'  Added {changed} element tags to archetypes.ts')

with open(ARCHETYPES_FILE, 'w') as f:
    f.write(arc_content)
print('  Done.\n')

# ─── Process races.ts ───────────────────────────────────────────────────────

RACES_FILE = 'src/lib/content/races.ts'

print('Processing races.ts...')
with open(RACES_FILE) as f:
    races_content = f.read()

races_before = races_content
races_content = process_abilities_arrays(races_content, RACE_GRADE, RACE_ELEMENT)

changed = races_content.count("element:") - races_before.count("element:")
print(f'  Added {changed} element tags to races.ts')

with open(RACES_FILE, 'w') as f:
    f.write(races_content)
print('  Done.\n')

print('✓ All ability entries tagged.')
