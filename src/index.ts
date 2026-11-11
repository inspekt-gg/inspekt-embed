import type { Background, Light, View } from './types';

export type { Background, Light, View, RarityTier } from './types';

/** The official loader script. */
export const LOADER_URL = 'https://inspekt.gg/cs2embed.js';

export interface EmbedOptions {
  /** Publishable key (`cs2pk_...`) or a short-lived token. `/^[a-z0-9_-]{4,64}$/i`. Required. A secret key throws. */
  key: string;
  /** A Steam inspect link with the item as hex, up to 1,024 characters. Wins over `s`. */
  inspect?: string;
  /** A catalog id, `/^[a-z0-9][a-z0-9_.-]*$/i`, up to 128 characters. Used when `inspect` is absent. */
  s?: string;
  /** Float, 0 to 1. */
  wear?: number;
  /** Pattern seed, whole number 0 to 1000. Default 0. */
  seed?: number;
  /** Up to 5 stickers, comma-separated, each `slot:stickerId:wear[:offsetX:offsetY:rotation]`. */
  st?: string;
  /** `defIndex[:offsetX:offsetY:offsetZ][@seed][~stickerId]`. */
  charm?: string;
  /** Kill counter, whole number 0 to 999999. Any value makes the item StatTrak. */
  stattrak?: number;
  /** Name tag, up to 20 printable characters. */
  name?: string;
  /** A backdrop id such as `plate_train_video`: `/^(plate|pano|bg)_[a-z0-9_]{1,58}$/i`. */
  scene?: string;
  /** Background. Default `rarity`. Overrides `scene`. */
  bg?: Background;
  /** Lighting. Default set by `view`. */
  light?: Light;
  /** Starting camera framing. Default `front`. */
  view?: View;
  /** Visitor controls. Default `basic`. */
  controls?: 'none' | 'basic' | 'poses' | 'full';
  /** Default off. */
  autorotate?: boolean;
  /** `none` hides the name plate. Default `minimal`. */
  ui?: 'minimal' | 'none';
  /** Default `dark`. */
  theme?: 'dark' | 'light';
  /** The iframe's accessible title. Default `3D skin viewer`. */
  title?: string;
  /** `false` loads the frame eagerly. Default `true`. */
  lazy?: boolean;
}

/** Embed events and their payloads. */
export interface EmbedEvents {
  ready: { backend: string };
  loaded: { id: string; name: string | null; ms: number; notes: string[] };
  interactive: { id: string; ms: number; notes: string[] };
  /** Access refused, such as `origin_not_allowed` or `quota_exceeded`. */
  error: { code: string; message: string };
  /** The item could not be drawn, such as `no-webgpu` or `bad-inspect`. */
  fallback: { code: string; message: string; id: string | null };
  progress: { value: number; label: string };
  state: { id: string | null; wear: number; seed: number; nametag: string };
  view: { view: View | 'close' };
  mode: { mode: 'item' | 'first'; ok: boolean };
}

export type EmbedEventName = keyof EmbedEvents;

export const EMBED_EVENTS = ['ready', 'loaded', 'interactive', 'error', 'fallback', 'progress', 'state', 'view', 'mode'] as const;

/** The handle `CS2Embed.mount()` returns. */
export interface LoaderHandle {
  iframe: HTMLIFrameElement;
  on<E extends EmbedEventName>(type: E, handler: (event: EmbedEvents[E]) => void): void;
  off<E extends EmbedEventName>(type: E, handler: (event: EmbedEvents[E]) => void): void;
  setItem(item: Partial<Pick<EmbedOptions, 'inspect' | 's' | 'wear' | 'seed' | 'st' | 'charm' | 'stattrak' | 'name'>>): void;
  setScene(scene: string): void;
  setView(view: View | 'close'): void;
  setMode(mode: 'item' | 'first'): void;
  inspect(): void;
  setAutorotate(on: boolean): void;
  setQuality(quality: { renderScale: number }): void;
  resetView(): void;
  screenshot(options?: { width?: number; height?: number; format?: string; quality?: number }): Promise<Blob>;
  destroy(): void;
}

interface Loader {
  mount(el: HTMLElement, options: Record<string, unknown>): LoaderHandle;
}

export interface EmbedHandle {
  /**
   * Item fields, `scene`, `view` and `autorotate` apply live. Any other option reloads the frame.
   * `undefined` clears an option.
   */
  update(options: Partial<EmbedOptions>): void;
  /** Subscribes to an event. Returns an unsubscribe function. */
  on<E extends EmbedEventName>(event: E, handler: (payload: EmbedEvents[E]) => void): () => void;
  /**
   * Resolves with the loader handle (`screenshot`, `setMode`, `inspect`, `resetView`). Rejects if
   * the script fails to load, `mount` throws, or the embed is destroyed.
   */
  loader(): Promise<LoaderHandle>;
  /** Removes the iframe and every handler. */
  destroy(): void;
}

let pending: Promise<Loader> | undefined;

/** Loads the official script once per page and resolves with the CS2Embed global. */
function loadLoader(): Promise<Loader> {
  const global = () => (window as unknown as { CS2Embed?: Loader }).CS2Embed;
  const ready = global();
  if (ready) return Promise.resolve(ready);
  pending ??= new Promise<Loader>((resolve, reject) => {
    const script =
      document.querySelector<HTMLScriptElement>(`script[src="${LOADER_URL}"]`) ??
      document.head.appendChild(Object.assign(document.createElement('script'), { src: LOADER_URL, async: true }));
    const fail = (message: string) => {
      pending = undefined;
      script.remove();
      reject(new Error(`@inspekt-gg/embed: ${message}`));
    };
    script.addEventListener('load', () => {
      const loader = global();
      if (loader) resolve(loader);
      else fail(`${LOADER_URL} did not define CS2Embed`);
    });
    script.addEventListener('error', () => fail(`could not load ${LOADER_URL}`));
  });
  return pending;
}

const ITEM_KEYS = ['inspect', 's', 'wear', 'seed', 'st', 'charm', 'stattrak', 'name'];
const LIVE_KEYS = [...ITEM_KEYS, 'scene', 'view', 'autorotate'];

/** The frame's URL carries the key, so a secret key there would reach every visitor. */
function refuseSecretKey(key: unknown): void {
  if (typeof key === 'string' && key.startsWith('cs2sk_')) {
    throw new TypeError('mountEmbed: key is a secret key (cs2sk_). Keep it on your server and pass the publishable key or a token.');
  }
}

/** Mounts the viewer in `container`. The container needs a height. */
export function mountEmbed(container: HTMLElement, options: EmbedOptions): EmbedHandle {
  if (!container || typeof container.appendChild !== 'function') throw new TypeError('mountEmbed: container must be an element');
  refuseSecretKey(options.key);

  // Props that a framework passes as undefined are left out, as an unset option is.
  let current: Record<string, unknown> = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  let destroyed = false;
  let generation = 0;
  let inner: LoaderHandle | undefined;
  const listeners = new Map<string, Set<(payload: never) => void>>();

  function create(): Promise<LoaderHandle | undefined> {
    const mine = ++generation;
    return loadLoader().then((loader) => {
      if (destroyed || mine !== generation) return undefined;
      const handle = loader.mount(container, { ...current });
      for (const name of EMBED_EVENTS) {
        handle.on(name, (payload) => {
          listeners.get(name)?.forEach((fn) => {
            try {
              fn(payload as never);
            } catch (err) {
              console.error('[@inspekt-gg/embed] handler failed:', err);
            }
          });
        });
      }
      inner = handle;
      return handle;
    });
  }

  let frame = create();

  const embed: EmbedHandle = {
    update(patch) {
      if (destroyed) return;
      refuseSecretKey(patch.key);
      const before = current;
      current = { ...before };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete current[k];
        else current[k] = v;
      }
      const changed = [...new Set([...Object.keys(before), ...Object.keys(current)])].filter((k) => before[k] !== current[k]);
      if (!changed.length) return;
      // With no frame mounted yet, or after a failed mount, a fresh mount takes the new options.
      // The loader reads everything outside LIVE_KEYS once, so those changes need a fresh frame.
      // Clearing scene or view has no command that restores the default, so it reloads too.
      const reload = !inner || changed.some((k) => !LIVE_KEYS.includes(k) || ((k === 'scene' || k === 'view') && current[k] === undefined));
      if (reload) {
        inner?.destroy();
        inner = undefined;
        frame = create();
        return;
      }
      const live = inner as LoaderHandle;
      const item = Object.fromEntries(ITEM_KEYS.filter((k) => k in current).map((k) => [k, current[k]]));
      if (changed.some((k) => ITEM_KEYS.includes(k))) live.setItem(item);
      if (changed.includes('scene')) live.setScene(current.scene as string);
      if (changed.includes('view')) live.setView(current.view as View);
      if (changed.includes('autorotate')) live.setAutorotate(Boolean(current.autorotate));
    },
    on(event, handler) {
      const fn = handler as (payload: never) => void;
      const set = listeners.get(event) ?? new Set<(payload: never) => void>();
      listeners.set(event, set.add(fn));
      return () => {
        set.delete(fn);
      };
    },
    // A frame replaced by update() before it mounted resolves undefined, so wait for its successor.
    loader: () => frame.then((handle) => handle ?? (destroyed ? Promise.reject(new Error('destroyed')) : embed.loader())),
    destroy() {
      destroyed = true;
      listeners.clear();
      inner?.destroy();
      inner = undefined;
    },
  };
  return embed;
}
