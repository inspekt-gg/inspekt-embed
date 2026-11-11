import { createElement, forwardRef, useEffect, useRef } from 'react';
import type { CSSProperties, ForwardedRef } from 'react';
import { EMBED_EVENTS, mountEmbed } from './index';
import type { EmbedEventName, EmbedEvents, EmbedHandle, EmbedOptions } from './index';

type Callbacks = { [E in EmbedEventName as `on${Capitalize<E>}`]?: (payload: EmbedEvents[E]) => void };

/** Adds an `on<Event>` callback per event. */
export interface InspektEmbedProps extends Omit<EmbedOptions, 'key'>, Callbacks {
  /** The `key` parameter. */
  publishableKey: string;
  className?: string;
  style?: CSSProperties;
}

function setRef(ref: ForwardedRef<EmbedHandle | null>, value: EmbedHandle | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

/** The viewer. Height is required, through `style` or `className`. A `ref` receives the `EmbedHandle`. */
export const InspektEmbed = forwardRef<EmbedHandle | null, InspektEmbedProps>(function InspektEmbed(props, ref) {
  const { className, style, publishableKey, ...rest } = props;
  const options: Record<string, unknown> = { key: publishableKey };
  const callbacks: Record<string, ((payload: unknown) => void) | undefined> = {};
  for (const [name, value] of Object.entries(rest)) {
    if (/^on[A-Z]/.test(name)) callbacks[name] = value as (payload: unknown) => void;
    else options[name] = value;
  }

  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<EmbedHandle | undefined>(undefined);
  const latest = useRef(callbacks);
  const sent = useRef(options);

  useEffect(() => {
    const embed = (handle.current = mountEmbed(host.current as HTMLDivElement, sent.current as unknown as EmbedOptions));
    for (const name of EMBED_EVENTS) {
      embed.on(name, (payload) => latest.current[`on${name[0]?.toUpperCase()}${name.slice(1)}`]?.(payload));
    }
    setRef(ref, embed);
    return () => {
      setRef(ref, null);
      embed.destroy();
      handle.current = undefined;
    };
  }, []);

  // After every render, hand the embed the props. update() ignores values that did not change.
  useEffect(() => {
    latest.current = callbacks;
    const patch = { ...options };
    for (const name of Object.keys(sent.current)) if (!(name in options)) patch[name] = undefined;
    sent.current = options;
    handle.current?.update(patch);
  });

  return createElement('div', { ref: host, className, style });
});
