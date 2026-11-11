# @inspekt-gg/embed

The [inspekt.gg](https://inspekt.gg) CS2 skin viewer for JavaScript, React and Vue, plus Render API still URLs. TypeScript types included.

```sh
npm install @inspekt-gg/embed
```

`/react` needs React 18+. `/vue` needs Vue 3.3+.

## Key

1. Sign in at [inspekt.gg/dashboard](https://inspekt.gg/dashboard), start the free 10-day trial and copy the publishable key (`cs2pk_...`).
2. Add each origin your page runs on to the key's allowed origins, `http://localhost:5173` included.

A short-lived token (`cs2tk_...`) from your server also works as the key: [Secret keys and tokens](https://inspekt.gg/docs/render-api#secret-keys-and-tokens). The secret key (`cs2sk_...`) stays on your server. Passing it here throws.

## Embed

Height is required. Pass `inspect` (an inspect link), or `s` (a catalog id) with `wear` and `seed`. Catalog ids: [skins.json](https://inspekt.gg/assets/skins.json), the same ids `stillUrl` takes as `id`.

JavaScript:

```html
<div id="viewer" style="height:400px"></div>
```

```js
import { mountEmbed } from '@inspekt-gg/embed';

const embed = mountEmbed(document.getElementById('viewer'), {
  inspect: 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview 001807209A0228043004388F85D7F30340950512E67D72',
  key: 'cs2pk_your_key_here',
  autorotate: true,
});
embed.on('error', (e) => console.error(e.code, e.message));
```

React:

```jsx
import { InspektEmbed } from '@inspekt-gg/embed/react';

export const Viewer = ({ inspectLink }) => (
  <InspektEmbed
    inspect={inspectLink}
    publishableKey="cs2pk_your_key_here"
    autorotate
    style={{ height: 400 }}
    onError={(e) => console.error(e.code, e.message)}
  />
);
```

Vue:

```vue
<script setup>
import { InspektEmbed } from '@inspekt-gg/embed/vue';
defineProps({ inspectLink: String });
</script>

<template>
  <InspektEmbed :inspect="inspectLink" publishable-key="cs2pk_your_key_here" autorotate
    style="height: 400px" @error="(e) => console.error(e.code, e.message)" />
</template>
```

Options: [embed parameters](https://inspekt.gg/docs/embed), plus `title` (the iframe's accessible title) and `lazy` (`false` loads eagerly). React and Vue: the prop is `publishableKey`. Next.js: client components only.

No WebGPU: a still or a card is shown, and `fallback` fires with `no-webgpu`.

`mountEmbed` returns a handle:

```js
embed.on('loaded', (e) => console.log(e.id, e.ms)); // returns an unsubscribe function
embed.update({ view: 'back', wear: 0.3 });  // item fields, scene, view, autorotate: applied live
embed.update({ theme: 'light' });           // any other option: reloads the frame
const frame = await embed.loader();         // loader handle: screenshot(), setMode()
embed.destroy();
```

`undefined` clears an option. React: a `ref` receives the handle. Vue: the handle is exposed as `embed`.

### Events

`embed.on(name, fn)`, `on<Name>` in React, `@name` in Vue. Codes: [inspekt.gg/docs/errors](https://inspekt.gg/docs/errors).

| Event | Payload | Fires when |
| --- | --- | --- |
| `ready` | `{ backend }` | Ready for commands. |
| `loaded` | `{ id, name, ms, notes }` | The item is on screen. |
| `interactive` | `{ id, ms, notes }` | The 3D view drew its first frame. |
| `error` | `{ code, message }` | Access refused, such as `origin_not_allowed` or `quota_exceeded`. |
| `fallback` | `{ code, message, id }` | The item could not be drawn, such as `no-webgpu`. |
| `progress` | `{ value, label }` | Load progress, 0 to 1. |
| `state` | `{ id, wear, seed, nametag }` | The item changed. |
| `view` | `{ view }` | A visitor changed the pose. |
| `mode` | `{ mode, ok }` | Switched between `item` and `first` person. |

## Still image

`stillUrl(options)` returns a still image URL. Works in Node 18+ and server components.

```js
import { stillUrl } from '@inspekt-gg/embed/still';

stillUrl({ id: 'ak47_cu_ak47_cobra_gen', wear: 0.1662, seed: 55, view: 'front', w: 640, h: 400, key: 'cs2pk_your_key_here' });
// https://inspekt.gg/api/still?id=ak47_cu_ak47_cobra_gen&wear=0.1662&seed=55&view=front&w=640&h=400&key=cs2pk_your_key_here
```

Use it in an `<img>` with `referrerpolicy="strict-origin"`. Test it from an `<img>` on an allowed origin; opened in the address bar it gets `403 origin_required`. Options: [Render API parameters](https://inspekt.gg/docs/render-api). `key` is required, plus one of `inspect`, `id`, `sticker` or `charm`. Out-of-range values throw a `RangeError`.

MIT. Copyright 2026 Inspekt.
