/* =====================================================================
   ROSTER — this is the only file you need to edit to add your friends.
   7 women and 3 men, each with their own costume.

   For each fighter:
     name    : shown in menus, on the health bar, and spoken by the announcer
     title   : small tagline under the name
     gender  : 'm' or 'f' (changes the body build)
     costume : men   -> 'gi' (karate), 'boxer', 'ninja', 'commando', 'suit', 'hoodie'
               women -> 'dress', 'athlete', 'biker', 'armor'
               (any costume works on any fighter)
     shirt / pants / accent : costume colours. shirt = top / dress / jacket,
               pants = trousers / shorts, accent = belt, gloves, shoes, scarf,
               cape and the colour of their special attack
     skin    : arms, legs and the placeholder face
     hair    : hair colour
     hairStyle : hair hanging behind the head: 'long', 'wavy', 'ponytail', 'bun' or 'none'
     face    : the drawn avatar. All parts are optional:
               hair      'short', 'quiff', 'swept', 'messy', 'curly', 'parted', 'beanie', 'bald'
               tall      quiff height, e.g. 1.15     grey  1 = grey streaks in a quiff
               beard     'stubble', 'short', 'full', 'goatee'      moustache  1 or 'thin'
               glasses   'thin' or 'thick'           brows 'thick'
               smile     'teeth' or 'closed' (leave out for a fierce look)   lips 1 = lip colour
               earrings  'hoop', 'rect', 'stud'      bindi 1, nosePin 1, clip 1 (hair clip)
     build   : optional body bulk, 1 = normal, 1.2 = big, 0.9 = slim
     speed / power / health : 1 (low) to 5 (high). Keep the total near 9
               so nobody is overpowered.
     special : one of
               'fireball'  - projectile, can be ducked
               'quake'     - ground shockwave, must be jumped or crouch-blocked
               'dash'      - rushing strike across the screen
               'uppercut'  - rising anti-air, invincible on start
               'teleport'  - vanish and strike from behind
   ===================================================================== */

window.GAME_TITLE = 'SENTREX KOMBAT';

window.ROSTER = [
  // ---- women ----
  { name: 'MERIN', title: 'Cool Under Fire', gender: 'f', costume: 'dress', shirt: '#1976d2', pants: '#0d47a1', accent: '#80deea', skin: '#d2a27a', hair: '#15110f', hairStyle: 'wavy', speed: 3, power: 2, health: 4, face: { hair: 'curly', bindi: 1, nosePin: 1, smile: 'teeth', earrings: 'stud' }, special: 'fireball' },
  { name: 'REMYA', title: 'Sky Breaker', gender: 'f', costume: 'athlete', shirt: '#e91e63', pants: '#263238', accent: '#ffee58', skin: '#c68e63', hair: '#1a1310', hairStyle: 'ponytail', speed: 4, power: 3, health: 2, face: { hair: 'parted', lips: 1, smile: 'closed', earrings: 'stud' }, special: 'uppercut' },
  { name: 'SWETHA', title: 'Earth Shaker', gender: 'f', costume: 'armor', shirt: '#00796b', pants: '#4e342e', accent: '#ffca28', skin: '#b98a5e', hair: '#15110f', hairStyle: 'long', speed: 2, power: 3, health: 4, face: { hair: 'parted', lips: 1, bindi: 1, earrings: 'hoop' }, special: 'quake' },
  { name: 'PRINCY', title: 'Full Throttle', gender: 'f', costume: 'biker', shirt: '#6a1b9a', pants: '#1a1a1a', accent: '#40c4ff', skin: '#e0b08a', hair: '#3b2314', hairStyle: 'long', speed: 3, power: 4, health: 2, face: { hair: 'parted', glasses: 'thin', lips: 1, smile: 'closed' }, special: 'dash' },
  { name: 'LAUREN', title: 'The Black Belt', gender: 'f', costume: 'gi', shirt: '#f5f5f5', pants: '#f5f5f5', accent: '#d32f2f', skin: '#f1c9a5', hair: '#b8894f', hairStyle: 'bun', speed: 3, power: 3, health: 3, face: { hair: 'parted', lips: 1, smile: 'teeth' }, special: 'fireball' },
  // ---- women (continued) and men ----
  { name: 'JENI', title: 'Now You See Her', gender: 'f', costume: 'ninja', shirt: '#1b1b2f', pants: '#1b1b2f', accent: '#ff4081', skin: '#c99672', hair: '#101010', hairStyle: 'ponytail', build: 0.95, speed: 5, power: 2, health: 2, face: { hair: 'parted', lips: 1, clip: 1 }, special: 'teleport' },
  { name: 'ANNSHIA', title: 'Never Where You Look', gender: 'f', costume: 'hoodie', shirt: '#ffb74d', pants: '#37474f', accent: '#7c4dff', skin: '#a8744e', hair: '#1a1310', hairStyle: 'wavy', speed: 4, power: 2, health: 3, face: { hair: 'curly', lips: 1, smile: 'closed', earrings: 'hoop' }, special: 'teleport' },
  { name: 'CARLOS', title: 'The Immovable', gender: 'm', costume: 'boxer', shirt: '#5d4037', pants: '#c62828', accent: '#fdd835', skin: '#c58c5c', hair: '#1c1410', hairStyle: 'none', build: 1.2, speed: 1, power: 4, health: 5, face: { hair: 'short', beard: 'stubble' }, special: 'quake' },
  { name: 'VIRAJ', title: 'Sharp Dressed', gender: 'm', costume: 'suit', shirt: '#20232a', pants: '#20232a', accent: '#26c6da', skin: '#9a6a48', hair: '#17110d', hairStyle: 'none', speed: 4, power: 3, health: 2, face: { hair: 'quiff', beard: 'short', moustache: 1, glasses: 'thin' }, special: 'uppercut' },
  { name: 'PURAV', title: 'Unstoppable', gender: 'm', costume: 'commando', shirt: '#4b5320', pants: '#6b6b47', accent: '#ff7043', skin: '#8a5a3c', hair: '#17110d', hairStyle: 'none', build: 1.1, speed: 2, power: 4, health: 3, face: { hair: 'messy', beard: 'goatee', moustache: 'thin' }, special: 'dash' },
];
