# Coil

Coil is a browser game about guiding a neon serpent across a bordered grid. Eat pellets to grow, avoid the wall and your own body, and keep chaining pellets before the combo window drains.

## Install

```sh
npm ci
```

## Development

```sh
npm run dev
```

The dev server prints a local URL. Open it in a browser to play.

## Production Build

```sh
npm run build
```

The complete static site is emitted to `dist/`. The generated art and audio are committed under `assets/`; the build only bundles them and does not run the asset-generation tools.

## Controls

- Move: Arrow keys or WASD
- Confirm: Enter or Space
- Back / Pause: Escape
- Pause: P
- Mute: M

On touch screens, use the on-screen d-pad and menu buttons.
