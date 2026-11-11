import { createApp, h, nextTick, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeLoader, finishLoading, fromFrame, resetPage } from './fake-loader';

let vue: typeof import('../src/vue');
let fake: ReturnType<typeof fakeLoader>;

beforeEach(async () => {
  resetPage();
  vi.resetModules();
  vue = await import('../src/vue');
  fake = fakeLoader();
});

describe('<InspektEmbed> for Vue', () => {
  it('mounts the frame, emits events, follows prop changes and removes the frame on unmount', async () => {
    const root = document.body.appendChild(document.createElement('div'));
    const view = ref<'front' | 'back'>('front');
    const onLoaded = vi.fn();
    const app = createApp({
      render: () => h(vue.InspektEmbed, { s: 'ak47_cu_ak47_cobra_gen', publishableKey: 'cs2pk_your_key_here', view: view.value, onLoaded }),
    });
    app.mount(root);
    finishLoading(fake);
    await vi.waitFor(() => expect(root.querySelector('iframe')).not.toBeNull());
    expect(fake.mount.mock.calls[0]?.[1]).toMatchObject({ s: 'ak47_cu_ak47_cobra_gen', key: 'cs2pk_your_key_here', view: 'front' });
    expect(fake.mount.mock.calls[0]?.[1]).not.toHaveProperty('autorotate');

    fromFrame(fake.handles[0]!, 'loaded', { id: 'ak47_cu_ak47_cobra_gen', name: 'AK-47 | Redline', ms: 700, notes: [] });
    expect(onLoaded).toHaveBeenCalledOnce();
    expect(onLoaded.mock.calls[0]?.[0]).toMatchObject({ ms: 700 });

    view.value = 'back';
    await nextTick();
    await vi.waitFor(() => expect(fake.handles[0]?.commands).toEqual([{ type: 'setView', view: 'back' }]));

    app.unmount();
    expect(root.querySelector('iframe')).toBeNull();
    expect(fake.handles[0]?.destroyed).toBe(true);
  });
});
