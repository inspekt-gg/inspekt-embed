/** Camera framing. */
export type View = 'front' | 'back' | 'top' | 'hero';

/** Lighting. */
export type Light = 'icon' | 'inspect';

export type RarityTier =
  | 'stock'
  | 'consumer'
  | 'industrial'
  | 'milspec'
  | 'restricted'
  | 'classified'
  | 'covert'
  | 'contraband';

/** Background. */
export type Background =
  | 'steel'
  | 'black'
  | 'white'
  | 'charcoal'
  | 'ember'
  | 'violet'
  | 'rarity'
  | `rarity-${RarityTier}`
  | 'transparent';
