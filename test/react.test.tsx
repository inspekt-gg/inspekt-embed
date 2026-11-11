import { createRef } from 'react';
import { StrictMode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeLoader, finishLoading, fromFrame, loaderScripts, resetPage } from './fake-loader';
import type { EmbedHandle } from '../src/index';

type React = typeof import('../src/react');

let react: React;
let fake: ReturnType<typeof fakeLoader>;

beforeEach(async () => {
  resetPage();
  vi.resetModules();
  react = await import('../src/react');
  fake = fakeLoader();
});

afterEach(() => {
  cleanup();
});

const INSPECT = 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview 001807209A0228043004388F85D7F30340950512E67D72';

describe('<InspektEmbed />', () => {
  it('mounts the frame, passes the props to the loader and removes the frame on unmount', async () => {
    const { InspektEmbed } = react;
    const { container, unmount } = render(<InspektEmbed inspect={INSPECT} publishableKey="cs2pk_your_key_here" view="front" autorotate style={{ height: 400 }} className="viewer" />);
    expect(loaderScripts()).toHaveLength(1);
    finishLoading(fake);
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    expect(fake.mount).toHaveBeenCalledOnce();
    expect(fake.mount.mock.calls[0]?.[1]).toEqual({ inspect: INSPECT, key: 'cs2pk_your_key_here', view: 'front', autorotate: true });
    const host = container.firstElementChild as HTMLElement;
    expect(host.className).toBe('viewer');
    expect(host.style.height).toBe('400px');
    expect(host.contains(container.querySelector('iframe'))).toBe(true);
    unmount();
    expect(container.querySelector('iframe')).toBeNull();
    expect(fake.handles[0]?.destroyed).toBe(true);
  });

  it('forwards events to the on<Event> callbacks, using the latest callback', async () => {
    const { InspektEmbed } = react;
    const first = vi.fn();
    const second = vi.fn();
    const onError = vi.fn();
    const { container, rerender } = render(<InspektEmbed s="ak47_cu_ak47_cobra_gen" publishableKey="cs2pk_your_key_here" onLoaded={first} onError={onError} />);
    finishLoading(fake);
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    rerender(<InspektEmbed s="ak47_cu_ak47_cobra_gen" publishableKey="cs2pk_your_key_here" onLoaded={second} onError={onError} />);
    fromFrame(fake.handles[0]!, 'loaded', { id: 'ak47_cu_ak47_cobra_gen', name: 'AK-47 | Redline', ms: 800, notes: [] });
    fromFrame(fake.handles[0]!, 'error', { code: 'origin_not_allowed', message: 'not registered' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(second.mock.calls[0]?.[0]).toMatchObject({ id: 'ak47_cu_ak47_cobra_gen', ms: 800 });
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ code: 'origin_not_allowed' });
    expect(fake.mount).toHaveBeenCalledOnce();
  });

  it('sends changed props to the live frame and reloads for the ones the loader reads once', async () => {
    const { InspektEmbed } = react;
    const key = 'cs2pk_your_key_here';
    const { container, rerender } = render(<InspektEmbed s="ak47_cu_ak47_cobra_gen" publishableKey={key} view="front" wear={0.2} />);
    finishLoading(fake);
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    rerender(<InspektEmbed s="ak47_cu_ak47_cobra_gen" publishableKey={key} view="back" wear={0.5} />);
    await waitFor(() => expect(fake.handles[0]?.commands).toHaveLength(2));
    expect(fake.handles[0]?.commands).toEqual([
      { type: 'setItem', s: 'ak47_cu_ak47_cobra_gen', wear: 0.5 },
      { type: 'setView', view: 'back' },
    ]);
    expect(fake.mount).toHaveBeenCalledOnce();
    rerender(<InspektEmbed s="ak47_cu_ak47_cobra_gen" publishableKey={key} view="back" wear={0.5} theme="light" />);
    await waitFor(() => expect(fake.mount).toHaveBeenCalledTimes(2));
    expect(fake.mount.mock.calls[1]?.[1]).toMatchObject({ theme: 'light', view: 'back', wear: 0.5 });
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('gives a ref the EmbedHandle', async () => {
    const { InspektEmbed } = react;
    const ref = createRef<EmbedHandle | null>();
    const { container, unmount } = render(<InspektEmbed ref={ref} s="ak47_cu_ak47_cobra_gen" publishableKey="cs2pk_your_key_here" />);
    expect(typeof ref.current?.update).toBe('function');
    finishLoading(fake);
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    await expect(ref.current?.loader()).resolves.toHaveProperty('iframe');
    unmount();
    expect(ref.current).toBeNull();
  });

  it('leaves one frame behind under StrictMode, which mounts effects twice', async () => {
    const { InspektEmbed } = react;
    const { container } = render(
      <StrictMode>
        <InspektEmbed s="ak47_cu_ak47_cobra_gen" publishableKey="cs2pk_your_key_here" />
      </StrictMode>,
    );
    finishLoading(fake);
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
    expect(fake.mount).toHaveBeenCalledOnce();
    expect(loaderScripts()).toHaveLength(1);
  });
});
