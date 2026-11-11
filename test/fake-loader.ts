import { vi } from 'vitest';

export const BASE = 'https://inspekt.gg';
export const LOADER = `${BASE}/cs2embed.js`;

// The parameters the official loader copies into the iframe URL, per the embed docs.
const PARAMS = ['inspect', 's', 'wear', 'seed', 'st', 'charm', 'stattrak', 'name', 'scene', 'view', 'controls', 'autorotate', 'bg', 'light', 'ui', 'theme', 'key'];

export interface FakeHandle {
  iframe: HTMLIFrameElement;
  commands: Array<Record<string, unknown>>;
  destroyed: boolean;
}

/**
 * A small stand-in for cs2embed.js that follows the documented contract: mount() builds an
 * iframe with the documented attributes, on() subscribes to cs2embed-channel messages that come
 * from that iframe's window at the inspekt.gg origin, and the commands are recorded.
 * The real script is never fetched or bundled by the tests.
 */
export function fakeLoader() {
  const handles: FakeHandle[] = [];

  const mount = vi.fn((el: HTMLElement, opts: Record<string, unknown>) => {
    if (!opts.inspect && !opts.s) throw new Error('CS2Embed.mount: pass an inspect link (inspect) or a catalog id (s)');
    const q = new URLSearchParams();
    for (const k of PARAMS) {
      const v = opts[k];
      if (v === undefined || v === null || v === '') continue;
      q.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    q.set('origin', window.location.origin);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', `${BASE}/embed?${q.toString()}`);
    iframe.setAttribute('title', (opts.title as string) || '3D skin viewer');
    iframe.setAttribute('loading', opts.lazy === false ? 'eager' : 'lazy');
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    iframe.setAttribute('referrerpolicy', 'strict-origin');
    el.appendChild(iframe);

    const subscribers: Record<string, Array<(e: unknown) => void>> = {};
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (e.origin !== BASE || e.source !== iframe.contentWindow) return;
      if (!d || d.channel !== 'cs2embed') return;
      (subscribers[d.type] ?? []).forEach((fn) => fn(d));
    };
    window.addEventListener('message', onMessage);

    const state: FakeHandle = { iframe, commands: [], destroyed: false };
    const send = (type: string, body: Record<string, unknown> = {}) => void state.commands.push({ type, ...body });
    const handle = {
      iframe,
      on(type: string, fn: (e: unknown) => void) {
        (subscribers[type] ??= []).push(fn);
        return handle;
      },
      off(type: string, fn: (e: unknown) => void) {
        subscribers[type] = (subscribers[type] ?? []).filter((f) => f !== fn);
        return handle;
      },
      setItem: (item: Record<string, unknown>) => send('setItem', item),
      setScene: (scene: string) => send('setScene', { scene }),
      setView: (view: string) => send('setView', { view }),
      setMode: (mode: string) => send('setMode', { mode }),
      inspect: () => send('inspect'),
      setAutorotate: (on: boolean) => send('setAutorotate', { on }),
      setQuality: (q: { renderScale: number }) => send('setQuality', q),
      resetView: () => send('resetView'),
      screenshot: () => Promise.resolve(new Blob()),
      destroy() {
        window.removeEventListener('message', onMessage);
        iframe.remove();
        state.destroyed = true;
      },
    };
    handles.push(state);
    return handle;
  });

  return { mount, handles };
}

/** Delivers a frame-to-host event the way the iframe would. */
export function fromFrame(handle: FakeHandle, type: string, payload: Record<string, unknown> = {}): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { channel: 'cs2embed', type, ...payload },
      origin: BASE,
      source: handle.iframe.contentWindow,
    }),
  );
}

export function loaderScripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>(`script[src="${LOADER}"]`));
}

/** Pretends the loader script finished loading: defines the global, then fires the script's load event. */
export function finishLoading(fake: ReturnType<typeof fakeLoader>): void {
  (window as unknown as { CS2Embed: unknown }).CS2Embed = { mount: fake.mount, origin: BASE };
  loaderScripts()[0]?.dispatchEvent(new Event('load'));
}

export function resetPage(): void {
  delete (window as unknown as { CS2Embed?: unknown }).CS2Embed;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
}
