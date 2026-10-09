# Three-dimensional room

A small browser room built with React and Three.js, with bounded character movement and a nearby bookshelf interaction.

## Run locally

```sh
npm install
npm run start
```

Vite prints the local development URL. Create a production build with:

```sh
npm run build
```

## Runtime assets

- `public/models/bookcaseOpen.glb` — Kenney Furniture Kit bookcase.
- `public/models/loungeSofa.glb` — Kenney Furniture Kit sofa.
- `public/models/tableCoffee.glb` — Kenney Furniture Kit coffee table.
- `public/models/character-female-a.glb` — Kenney Mini Characters model with bundled `idle` and `walk` animation clips.
- `public/models/Textures/colormap.png` — Kenney Mini Characters texture required by the character GLB.
- `public/textures/wood-floor.jpg` — 1024 × 1024 web-sized derivative of the supplied wood floor diffuse texture.

The source assets remain under the ignored `assets/` directory; these runtime copies are separate. No optional HDRI or EXR is included. Furniture and character models are loaded from `public/models/` and scaled to fit their scene roles. The character's referenced `Textures/colormap.png` is included alongside the GLB. The floor uses the bundled wood texture and the room is lit with Three.js ambient, hemisphere, and directional lights.

## Source previews

- Furniture Kit: https://kenney.nl/assets/furniture-kit
- Mini Characters: https://kenney.nl/assets/mini-characters
- Wood floor: https://polyhaven.com/a/wood_floor

## Usage and limitations

Use **WASD** or the **arrow keys** to move relative to the fixed camera. Movement is continuous while a key is held and stays within the room; approach the bookcase and press **E** when its prompt appears. The character turns toward travel and cross-fades between the GLB's `idle` and `walk` clips. The bookcase message clears when you leave or after a short timeout.

The responsive scene contains a textured floor, two rear walls, a fixed orthographic camera, soft real-time lighting, and the selected GLB furniture. Character movement is keyboard-only, and the camera does not follow the character.
