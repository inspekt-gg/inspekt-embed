# Changelog

## 0.1.0 - 2026-11-09

- `mountEmbed(container, options)` returns a handle with `update`, `on`, `loader` and `destroy`.
- `InspektEmbed` for React and Vue. The `key` prop is `publishableKey`.
- `stillUrl(options)` returns a Render API still URL and throws a `RangeError` for an out-of-range value.
- `mountEmbed` and `stillUrl` throw on a secret key (`cs2sk_`).
- ESM, CJS and type declarations for each subpath.
