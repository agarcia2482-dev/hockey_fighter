// Fictional identity data for procedurally generated fighters.
//
// IMPORTANT: Everything here is invented for this game. None of these teams,
// cities, names, or colors are affiliated with, endorsed by, or derived from
// the NHL or any real professional hockey organization or player. Any
// resemblance to real people or teams is coincidental.

export const FIRST_NAMES = [
  'Brock', 'Dmitri', 'Sven', 'Tuukka', 'Mathis', 'Cale', 'Rourke', 'Niko',
  'Aksel', 'Bo', 'Cody', 'Ragnar', 'Lars', 'Emil', 'Gunnar', 'Knox',
  'Tate', 'Viktor', 'Yuri', 'Marek', 'Anton', 'Joonas', 'Reid', 'Hutch',
  'Beau', 'Cy', 'Dane', 'Flip', 'Grit', 'Hawk', 'Ivar', 'Jett',
  'Kazimir', 'Lev', 'Magnus', 'Nils', 'Ozzy', 'Pyotr', 'Quill', 'Roan',
];

export const LAST_NAMES = [
  'Halvorsen', 'Brakefield', 'Voronov', 'Maddox', 'Kowalczyk', 'Stenberg',
  'Dragunov', 'Thornbury', 'Larsson', 'McGraw', 'Petrov', 'Vandermeer',
  'Holloway', 'Castellano', 'Novak', 'Bjornson', 'Reaper', 'Slatter',
  'Korhonen', 'Vasiliev', 'Cudmore', 'Hagen', 'Ironside', 'Mortensen',
  'Brisko', 'Tkachenko', 'Wolfe', 'Doyle', 'Falk', 'Grimaldi',
  'Hjalmarsson', 'Krause', 'Lindholm', 'Magnusson', 'Pohl', 'Renaud',
];

// Fictional teams: { city, name, abbr, jersey, jerseyAlt, trim }
// Colors are chosen to be visually distinct on the rink.
export const TEAMS = [
  { city: 'Gravel Pit', name: 'Goons', abbr: 'GPG', jersey: '#c0392b', jerseyAlt: '#7b241c', trim: '#f5d76e' },
  { city: 'Frostbyte', name: 'Yetis', abbr: 'FRY', jersey: '#2e86de', jerseyAlt: '#1b4f72', trim: '#ecf0f1' },
  { city: 'Tundra', name: 'Mammoths', abbr: 'TUN', jersey: '#5b3a1f', jerseyAlt: '#3d2713', trim: '#e0c097' },
  { city: 'Steeltown', name: 'Riveters', abbr: 'STR', jersey: '#566573', jerseyAlt: '#2c3e50', trim: '#f39c12' },
  { city: 'Maple Hollow', name: 'Lumberjacks', abbr: 'MHL', jersey: '#1e8449', jerseyAlt: '#145a32', trim: '#f7dc6f' },
  { city: 'Cinder Lake', name: 'Infernos', abbr: 'CLI', jersey: '#e67e22', jerseyAlt: '#a04000', trim: '#2c3e50' },
  { city: 'Nightfall', name: 'Reapers', abbr: 'NFR', jersey: '#34313a', jerseyAlt: '#1c1b20', trim: '#9b59b6' },
  { city: 'Ironbound', name: 'Anvils', abbr: 'IRA', jersey: '#7f8c8d', jerseyAlt: '#515a5a', trim: '#e74c3c' },
  { city: 'Saltwater', name: 'Krakens', abbr: 'SWK', jersey: '#0e6655', jerseyAlt: '#0b5345', trim: '#48c9b0' },
  { city: 'Crownridge', name: 'Royals', abbr: 'CRR', jersey: '#6c3483', jerseyAlt: '#4a235a', trim: '#f4d03f' },
  { city: 'Boomtown', name: 'Dynamite', abbr: 'BMD', jersey: '#d4ac0d', jerseyAlt: '#9a7d0a', trim: '#1c2833' },
  { city: 'Permafrost', name: 'Wolverines', abbr: 'PFW', jersey: '#2471a3', jerseyAlt: '#1a5276', trim: '#f8f9f9' },
];

// Nicknames occasionally appended to make a fighter pop, e.g. "The Hammer".
export const NICKNAMES = [
  'The Hammer', 'Mad Dog', 'The Anvil', 'Sasquatch', 'Cement Hands',
  'The Freight Train', 'Knuckles', 'The Bear', 'Wrecking Ball', 'The Wall',
  'Buzzsaw', 'The Outlaw', 'Thunderfist', 'The Grinder', 'Mountain',
  'The Enforcer', 'Sledge', 'Riptide', 'The Surgeon', 'Avalanche',
];

// Skin tone palette for sprite variety.
export const SKIN_TONES = ['#f1c9a5', '#e0ac8b', '#c68642', '#8d5524', '#ffdbac', '#a86b3c'];

// Hair colors for the brawler's flow.
export const HAIR_COLORS = ['#2b1d0e', '#5a3210', '#a8641f', '#d9b35c', '#7a7a7a', '#1a1a1a', '#c0392b'];
