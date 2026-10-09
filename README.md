# Three-dimensional room

A small browser room built with React and Three.js. ROOM-2 provides the static room, furniture, lighting, and orthographic view; character movement and bookshelf interaction are planned for ROOM-3.

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
- `public/models/character-female-a.glb` — Kenney Mini Characters model, displayed as a static figure.
- `public/models/Textures/colormap.png` — Kenney Mini Characters texture required by the character GLB.
- `public/textures/wood-floor.jpg` — 1024 × 1024 web-sized derivative of the supplied wood floor diffuse texture.

The source assets remain under the ignored `assets/` directory; these runtime copies are separate. No optional HDRI or EXR is included. Furniture and character models are loaded from `public/models/` and scaled to fit their scene roles. The character's referenced `Textures/colormap.png` is included alongside the GLB. The floor uses the bundled wood texture and the room is lit with Three.js ambient, hemisphere, and directional lights.

## Source previews

- Furniture Kit: https://kenney.nl/assets/furniture-kit
- Mini Characters: https://kenney.nl/assets/mini-characters
- Wood floor: https://polyhaven.com/a/wood_floor

## Current state

The responsive scene contains a textured floor, two rear walls, a fixed orthographic camera, soft real-time lighting, the selected GLB furniture, and a static character near the front-center. Character movement, bookshelf proximity prompts, and interaction are not implemented yet.
