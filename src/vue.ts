import { defineComponent, h, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { PropType } from 'vue';
import { EMBED_EVENTS, mountEmbed } from './index';
import type { Background, EmbedEvents, EmbedHandle, EmbedOptions, Light, View } from './index';

// Object-form emits, so a listener's payload has its type. `null` skips runtime validation.
const emits = Object.fromEntries(EMBED_EVENTS.map((name) => [name, null])) as unknown as {
  [E in keyof EmbedEvents]: (payload: EmbedEvents[E]) => true;
};

/** The viewer. Emits each embed event. Height is required. */
export const InspektEmbed = defineComponent({
  name: 'InspektEmbed',
  props: {
    // Vue reserves the prop name `key`, so the `key` parameter is `publishableKey`.
    publishableKey: { type: String, required: true },
    inspect: String,
    s: String,
    wear: Number,
    seed: Number,
    st: String,
    charm: String,
    stattrak: Number,
    name: String,
    scene: String,
    bg: String as PropType<Background>,
    light: String as PropType<Light>,
    view: String as PropType<View>,
    controls: String as PropType<EmbedOptions['controls']>,
    autorotate: { type: Boolean, default: undefined },
    ui: String as PropType<EmbedOptions['ui']>,
    theme: String as PropType<EmbedOptions['theme']>,
    title: String,
    lazy: { type: Boolean, default: undefined },
  },
  emits,
  setup(props, { emit, expose }) {
    const host = ref<HTMLElement>();
    const embed = shallowRef<EmbedHandle>();
    const options = () => {
      const { publishableKey, ...rest } = props;
      return { ...rest, key: publishableKey } as unknown as EmbedOptions;
    };

    onMounted(() => {
      const handle = mountEmbed(host.value as HTMLElement, options());
      for (const name of EMBED_EVENTS) handle.on(name, (payload) => (emit as (event: string, payload: unknown) => void)(name, payload));
      embed.value = handle;
    });
    // Props the parent leaves out are undefined here, so update() clears them.
    watch(() => ({ ...props }), () => embed.value?.update(options()));
    onBeforeUnmount(() => embed.value?.destroy());

    expose({ embed });
    return () => h('div', { ref: host });
  },
});
