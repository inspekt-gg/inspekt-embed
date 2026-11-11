import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOADER, fakeLoader, finishLoading, fromFrame, loaderScripts, resetPage } from './fake-loader';

type Core = typeof import('../src/index');

let core: Core;
let fake: ReturnType<typeof fakeLoader>;
let box: HTMLElement;

beforeEach(async () => {
  resetPage();
  vi.resetModules(); // each test gets a fresh once-per-page loader state
  core = await import('../src/index');
  fake = fakeLoader();
  box = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const options = { inspect: 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview 001807209A0228043004388F85D7F30340950512E67D72', key: 'cs2pk_your_key_here' };

async function mounted(extra: Record<string, unknown> = {}) {
  const embed = core.mountEmbed(box, { ...options, ...extra });
  finishLoading(fake);
  const handle = await embed.loader();
  return { embed, handle };
}

describe('loader script', () => {
  it('is injected once, however many embeds mount', async () => {
    const a = core.mountEmbed(box, options);
    const b = core.mountEmbed(box, { ...options, s: 'ak47_cu_ak47_cobra_gen', inspect: undefined });
    expect(loaderScripts()).toHaveLength(1);
    expect(loaderScripts()[0]?.src).toBe(LOADER);
    finishLoading(fake);
    await Promise.all([a.loader(), b.loader()]);
    await core.mountEmbed(box, options).loader();
    expect(loaderScripts()).toHaveLength(1);
    expect(fake.mount).toHaveBeenCalledTimes(3);
  });

  it('is not injected when the page already has CS2Embed', async () => {
    (window as unknown as { CS2Embed: unknown }).CS2Embed = { mount: fake.mount };
    const embed = core.mountEmbed(box, options);
    await embed.loader();
    expect(loaderScripts()).toHaveLength(0);
  });

  it('reuses a script tag the page already has', async () => {
    const tag = document.head.appendChild(Object.assign(document.createElement('script'), { src: LOADER }));
    const embed = core.mountEmbed(box, options);
    expect(loaderScripts()).toEqual([tag]);
    finishLoading(fake);
    await embed.loader();
    expect(fake.mount).toHaveBeenCalledTimes(1);
  });

  it('rejects loader() and allows a later retry when the script fails to load', async () => {
    const embed = core.mountEmbed(box, options);
    const failed = embed.loader();
    loaderScripts()[0]?.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow(/could not load https:\/\/inspekt.gg\/cs2embed.js/);
    expect(loaderScripts()).toHaveLength(0);
    const retry = core.mountEmbed(box, options);
    expect(loaderScripts()).toHaveLength(1);
    finishLoading(fake);
    await retry.loader();
    expect(box.querySelector('iframe')).not.toBeNull();
  });

  it('tries again on the next update after the script failed to load', async () => {
    const embed = core.mountEmbed(box, options);
    const failed = embed.loader();
    loaderScripts()[0]?.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow(/could not load/);
    embed.update({ view: 'back' });
    expect(loaderScripts()).toHaveLength(1);
    finishLoading(fake);
    await embed.loader();
    expect(fake.mount).toHaveBeenCalledOnce();
    expect(fake.mount.mock.calls[0]?.[1]).toMatchObject({ view: 'back' });
  });
});

describe('mounting', () => {
  it('passes the options to CS2Embed.mount and resolves loader() with its handle', async () => {
    const { handle } = await mounted({ view: 'back', autorotate: true, title: 'AK-47 | Redline in 3D', lazy: false });
    expect(fake.mount).toHaveBeenCalledOnce();
    expect(fake.mount.mock.calls[0]?.[0]).toBe(box);
    expect(fake.mount.mock.calls[0]?.[1]).toEqual({ ...options, view: 'back', autorotate: true, title: 'AK-47 | Redline in 3D', lazy: false });
    expect(box.querySelector('iframe')).toBe(handle.iframe);
  });

  it('leaves out options passed as undefined', async () => {
    await mounted({ view: undefined, title: undefined });
    expect(fake.mount.mock.calls[0]?.[1]).toEqual(options);
  });

  it('throws at once when the container is not an element', () => {
    expect(() => core.mountEmbed(null as never, options)).toThrow(TypeError);
  });

  it('refuses a secret key before loading anything', () => {
    expect(() => core.mountEmbed(box, { ...options, key: 'cs2sk_abcdef' })).toThrow(/secret key/);
    expect(loaderScripts()).toHaveLength(0);
  });

  it('mounts on the next update after the loader refused the options', async () => {
    const embed = core.mountEmbed(box, { key: 'cs2pk_your_key_here' });
    finishLoading(fake);
    await expect(embed.loader()).rejects.toThrow(/pass an inspect link/);
    embed.update({ s: 'ak47_cu_ak47_cobra_gen' });
    await embed.loader();
    expect(box.querySelectorAll('iframe')).toHaveLength(1);
    expect(fake.mount.mock.calls[1]?.[1]).toEqual({ key: 'cs2pk_your_key_here', s: 'ak47_cu_ak47_cobra_gen' });
  });

  it('rejects loader() when the loader refuses the options', async () => {
    const embed = core.mountEmbed(box, { key: 'cs2pk_your_key_here' });
    finishLoading(fake);
    await expect(embed.loader()).rejects.toThrow(/pass an inspect link/);
    expect(box.querySelector('iframe')).toBeNull();
  });
});

describe('events', () => {
  const payloads: Record<string, Record<string, unknown>> = {
    ready: { backend: 'webgpu' },
    loaded: { id: 'ak47_cu_ak47_cobra_gen', name: 'AK-47 | Redline', ms: 812, notes: [] },
    interactive: { id: 'ak47_cu_ak47_cobra_gen', ms: 2400, notes: [] },
    error: { code: 'origin_not_allowed', message: 'This origin is not registered.' },
    fallback: { code: 'no-webgpu', message: 'The live 3D view needs WebGPU.', id: 'ak47_cu_ak47_cobra_gen' },
    progress: { value: 0.5, label: 'textures' },
    state: { id: 'ak47_cu_ak47_cobra_gen', wear: 0.24, seed: 661, nametag: '' },
    view: { view: 'back' },
    mode: { mode: 'first', ok: true },
  };

  it('lists the nine documented events', () => {
    expect([...core.EMBED_EVENTS].sort()).toEqual(Object.keys(payloads).sort());
  });

  it.each(Object.keys(payloads))('delivers %s to its handler with the payload', async (type) => {
    const { embed } = await mounted();
    const seen = vi.fn();
    embed.on(type as never, seen);
    fromFrame(fake.handles[0]!, type, payloads[type]);
    expect(seen).toHaveBeenCalledOnce();
    expect(seen.mock.calls[0]?.[0]).toMatchObject(payloads[type] as object);
  });

  it('registers handlers before the loader has finished', async () => {
    const embed = core.mountEmbed(box, options);
    const seen = vi.fn();
    embed.on('loaded', seen);
    finishLoading(fake);
    await embed.loader();
    fromFrame(fake.handles[0]!, 'loaded', payloads.loaded);
    expect(seen).toHaveBeenCalledOnce();
  });

  it('keeps events apart and supports several handlers and unsubscribing', async () => {
    const { embed } = await mounted();
    const loaded = vi.fn();
    const other = vi.fn();
    const errored = vi.fn();
    const off = embed.on('loaded', loaded);
    embed.on('loaded', other);
    embed.on('error', errored);
    fromFrame(fake.handles[0]!, 'loaded', payloads.loaded);
    off();
    fromFrame(fake.handles[0]!, 'loaded', payloads.loaded);
    expect(loaded).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(2);
    expect(errored).not.toHaveBeenCalled();
  });

  it('keeps delivering when one handler throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { embed } = await mounted();
    const second = vi.fn();
    embed.on('loaded', () => {
      throw new Error('boom');
    });
    embed.on('loaded', second);
    fromFrame(fake.handles[0]!, 'loaded', payloads.loaded);
    expect(second).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalled();
  });
});

describe('update', () => {
  it('sends view, scene and autorotate as commands to the same frame', async () => {
    const { embed } = await mounted();
    embed.update({ view: 'top', scene: 'plate_train_video', autorotate: true });
    await embed.loader();
    expect(fake.mount).toHaveBeenCalledOnce();
    expect(fake.handles[0]?.commands).toEqual([
      { type: 'setScene', scene: 'plate_train_video' },
      { type: 'setView', view: 'top' },
      { type: 'setAutorotate', on: true },
    ]);
  });

  it('sends the item fields in one setItem, keeping the ones that did not change', async () => {
    const { embed } = await mounted({ wear: 0.1, seed: 5 });
    embed.update({ wear: 0.3 });
    embed.update({ inspect: undefined, s: 'ak47_cu_ak47_cobra_gen' });
    await embed.loader();
    expect(fake.handles[0]?.commands).toEqual([
      { type: 'setItem', inspect: options.inspect, wear: 0.3, seed: 5 },
      { type: 'setItem', s: 'ak47_cu_ak47_cobra_gen', wear: 0.3, seed: 5 },
    ]);
  });

  it('sends nothing when no value changed', async () => {
    const { embed } = await mounted({ view: 'back' });
    embed.update({ view: 'back', key: options.key });
    await embed.loader();
    expect(fake.handles[0]?.commands).toEqual([]);
    expect(fake.mount).toHaveBeenCalledOnce();
  });

  it('turns autorotate off with a command when it is cleared', async () => {
    const { embed } = await mounted({ autorotate: true });
    embed.update({ autorotate: undefined });
    await embed.loader();
    expect(fake.handles[0]?.commands).toEqual([{ type: 'setAutorotate', on: false }]);
  });

  it('reloads the frame for options the loader reads once, and keeps the handlers', async () => {
    const { embed } = await mounted();
    const seen = vi.fn();
    embed.on('loaded', seen);
    embed.update({ theme: 'light', controls: 'poses' });
    await embed.loader();
    expect(fake.mount).toHaveBeenCalledTimes(2);
    expect(fake.handles[0]?.destroyed).toBe(true);
    expect(box.querySelectorAll('iframe')).toHaveLength(1);
    expect(fake.mount.mock.calls[1]?.[1]).toMatchObject({ theme: 'light', controls: 'poses', key: options.key });
    fromFrame(fake.handles[1]!, 'loaded', { id: 'x', name: 'x', ms: 1, notes: [] });
    expect(seen).toHaveBeenCalledOnce();
  });

  it('reloads the frame when a view or scene is cleared, with the other changes applied', async () => {
    const { embed } = await mounted({ view: 'back' });
    embed.update({ view: undefined });
    await embed.loader();
    expect(fake.mount).toHaveBeenCalledTimes(2);
    expect(fake.mount.mock.calls[1]?.[1]).not.toHaveProperty('view');
  });

  it('mounts one frame when updates arrive before the loader has finished', async () => {
    const embed = core.mountEmbed(box, options);
    embed.update({ theme: 'light' });
    embed.update({ key: 'cs2pk_other_key' });
    finishLoading(fake);
    await embed.loader();
    expect(fake.mount).toHaveBeenCalledTimes(1);
    expect(fake.mount.mock.calls[0]?.[1]).toMatchObject({ theme: 'light', key: 'cs2pk_other_key' });
    expect(box.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('mounts with live changes made before the loader finished, and sends them no command', async () => {
    const embed = core.mountEmbed(box, options);
    const early = embed.loader();
    embed.update({ view: 'back', wear: 0.3 });
    finishLoading(fake);
    const handle = await early;
    expect(handle.iframe).toBe(fake.handles[0]?.iframe);
    expect(fake.mount).toHaveBeenCalledOnce();
    expect(fake.mount.mock.calls[0]?.[1]).toEqual({ ...options, view: 'back', wear: 0.3 });
    expect(fake.handles[0]?.commands).toEqual([]);
  });

  it('refuses a secret key and keeps the frame', async () => {
    const { embed } = await mounted();
    expect(() => embed.update({ key: 'cs2sk_abcdef' })).toThrow(/secret key/);
    expect(fake.mount).toHaveBeenCalledOnce();
    expect(fake.handles[0]?.destroyed).toBe(false);
  });
});

describe('destroy', () => {
  it('removes the iframe, stops delivering events and keeps the shared script', async () => {
    const { embed } = await mounted();
    const seen = vi.fn();
    embed.on('loaded', seen);
    const frame = fake.handles[0]!;
    embed.destroy();
    expect(box.querySelector('iframe')).toBeNull();
    expect(frame.destroyed).toBe(true);
    fromFrame(frame, 'loaded', { id: 'x', name: 'x', ms: 1, notes: [] });
    expect(seen).not.toHaveBeenCalled();
    expect(loaderScripts()).toHaveLength(1);
  });

  it('ignores update() afterwards', async () => {
    const { embed } = await mounted();
    embed.destroy();
    embed.update({ theme: 'light' });
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.mount).toHaveBeenCalledOnce();
  });

  it('never creates a frame when called before the loader has finished', async () => {
    const embed = core.mountEmbed(box, options);
    embed.destroy();
    finishLoading(fake);
    await expect(embed.loader()).rejects.toThrow('destroyed');
    expect(fake.mount).not.toHaveBeenCalled();
    expect(box.querySelector('iframe')).toBeNull();
  });

  it('leaves a second embed on the page alone', async () => {
    const { embed } = await mounted();
    const other = core.mountEmbed(box, options);
    await other.loader();
    embed.destroy();
    expect(box.querySelectorAll('iframe')).toHaveLength(1);
  });
});
