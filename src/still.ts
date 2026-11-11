import type { Background, Light, View } from './types';

export type { Background, Light, View } from './types';

/** Parameters of `GET /api/still`. */
export interface StillOptions {
  /** Publishable key or short-lived token. `/^[a-z0-9_-]{4,64}$/i`. Required. A secret key throws. */
  key: string;
  /** A Steam inspect link with the item as hex. Required unless `id`, `sticker` or `charm` is set. */
  inspect?: string;
  /** A catalog id from https://inspekt.gg/assets/skins.json. `/^[a-z0-9][a-z0-9_.-]*$/i`. */
  id?: string;
  /** Float, 0 to 1. */
  wear?: number;
  /** Pattern seed, whole number 0 to 1000. */
  seed?: number;
  /** Up to 5 stickers, comma-separated, each `slot:stickerId:wear[:offsetX:offsetY:rotation]`. */
  st?: string;
  /** One sticker alone, by Steam definition index (1 to 999999). Use without `id` or `inspect`. */
  sticker?: number;
  /** `defIndex[:offsetX:offsetY:offsetZ][@seed][~stickerId]`. */
  charm?: string;
  /** Kill counter, whole number 0 to 999999. Any value makes the item StatTrak. */
  stattrak?: number;
  /** Name tag, up to 20 characters (an emoji counts as two), no control characters. */
  name?: string;
  /** Default `hero`. */
  view?: View;
  /** Default `steel`. */
  bg?: Background;
  /** Default set by `view`. */
  light?: Light;
  /** Width in pixels, whole number 160 to 1600, or up to 2560 with a key on a plan. Default 1200. */
  w?: number;
  /** Height in pixels, whole number 160 to 1600, or up to 2560 with a key on a plan. Default 630. */
  h?: number;
  /** `1` waits for the render, `0` answers at once with a placeholder on a miss. Default `1`. */
  wait?: 0 | 1;
}

const ORIGIN = 'https://inspekt.gg/api/still';
const KEY = /^[a-z0-9_-]{4,64}$/i;
const ID = /^[a-z0-9][a-z0-9_.-]*$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const VIEWS = ['hero', 'front', 'back', 'top'];
const LIGHTS = ['icon', 'inspect'];
const TIERS = ['stock', 'consumer', 'industrial', 'milspec', 'restricted', 'classified', 'covert', 'contraband'];
const BACKGROUNDS = ['steel', 'black', 'white', 'charcoal', 'ember', 'violet', 'rarity', 'transparent', ...TIERS.map((t) => `rarity-${t}`)];

function check(ok: boolean, name: string, rule: string): void {
  if (!ok) throw new RangeError(`${name} must be ${rule}`);
}

function whole(name: string, value: unknown, min: number, max: number): void {
  check(typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max, name, `a whole number from ${min} to ${max}`);
}

function oneOf(name: string, value: unknown, list: string[]): void {
  check(typeof value === 'string' && list.includes(value), name, `one of ${list.join(', ')}`);
}

const encode = encodeURIComponent;
/** The st and charm grammars use `:`, `,` and `@`, which the docs' own URLs leave unescaped. */
const encodeGrammar = (v: string) => encode(v).replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%40/g, '@');

/**
 * Returns a still image URL. Throws a `RangeError` for an out-of-range value. `st` and `charm` are
 * not checked. Works in Node 18+ and server components.
 */
export function stillUrl(options: StillOptions): string {
  const o = options;
  if (typeof o.key !== 'string') throw new TypeError('stillUrl: key is required');
  check(KEY.test(o.key), 'key', '4 to 64 characters of a-z, 0-9, _ and -');
  // A URL ends up in logs and in the page, so the secret key belongs in an x-cs2-key header.
  check(!o.key.startsWith('cs2sk_'), 'key', 'the publishable key or a token, not the secret key (cs2sk_)');
  if (o.inspect == null && o.id == null && o.sticker == null && o.charm == null) {
    throw new TypeError('stillUrl: pass inspect, id, sticker or charm');
  }

  const q: string[] = [];
  const add = (name: string, value: string | number | undefined | null) => {
    if (value != null) q.push(`${name}=${value}`);
  };

  if (o.inspect != null) {
    check(typeof o.inspect === 'string' && o.inspect.length > 0, 'inspect', 'a non-empty inspect link');
    add('inspect', encode(o.inspect));
  }
  if (o.id != null) {
    check(typeof o.id === 'string' && ID.test(o.id), 'id', 'a catalog id matching /^[a-z0-9][a-z0-9_.-]*$/i');
    add('id', o.id);
  }
  if (o.wear != null) {
    check(typeof o.wear === 'number' && o.wear >= 0 && o.wear <= 1, 'wear', 'a number from 0 to 1');
    add('wear', o.wear);
  }
  if (o.seed != null) {
    whole('seed', o.seed, 0, 1000);
    add('seed', o.seed);
  }
  if (o.st != null) {
    check(typeof o.st === 'string', 'st', 'a string');
    add('st', encodeGrammar(o.st));
  }
  if (o.sticker != null) {
    whole('sticker', o.sticker, 1, 999999);
    add('sticker', o.sticker);
  }
  if (o.charm != null) {
    check(typeof o.charm === 'string', 'charm', 'a string');
    add('charm', encodeGrammar(o.charm));
  }
  if (o.stattrak != null) {
    whole('stattrak', o.stattrak, 0, 999999);
    add('stattrak', o.stattrak);
  }
  if (o.name != null) {
    // The server trims the tag and counts UTF-16 units, so an emoji counts as two.
    const tag = typeof o.name === 'string' ? o.name.trim() : '';
    check(typeof o.name === 'string' && tag.length <= 20 && !CONTROL.test(tag), 'name', 'at most 20 characters with no control characters');
    add('name', encode(o.name));
  }
  if (o.view != null) {
    oneOf('view', o.view, VIEWS);
    add('view', o.view);
  }
  if (o.bg != null) {
    oneOf('bg', o.bg, BACKGROUNDS);
    add('bg', o.bg);
  }
  if (o.light != null) {
    oneOf('light', o.light, LIGHTS);
    add('light', o.light);
  }
  if (o.w != null) {
    whole('w', o.w, 160, 2560);
    add('w', o.w);
  }
  if (o.h != null) {
    whole('h', o.h, 160, 2560);
    add('h', o.h);
  }
  if (o.wait != null) {
    oneOf('wait', String(o.wait), ['0', '1']);
    add('wait', o.wait);
  }
  add('key', o.key);

  return `${ORIGIN}?${q.join('&')}`;
}
