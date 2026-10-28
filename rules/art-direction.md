# Art Direction — Cozy Virtual Office

> This rule governs the product's visual language for environments, avatars, props, color, lighting, and camera. Numeric values are starting points to validate at actual gameplay scale, not immutable measurements.

## Purpose

Establish a coherent, readable, welcoming visual identity for the virtual office while preserving original designs and separating settled project decisions from proposals that still require validation.

## Scope

This document covers visual design: shapes, avatars, environments, props, palette, materials, lighting, camera, visual density, and acceptance. It does not define application logic, interaction behavior, networking, or implementation architecture.

## Principles

- **Decision priority:** settled project decisions in this document take precedence over reference images, other rules here, approved assets, and individual interpretation, in that order.
- **Proposal versus decision:** values and room accents labeled as proposals or starting points MUST be tested before they are treated as final. Open questions remain open until validated and decided.
- **Reference honesty:** an agent MUST disclose when it cannot see reference images and MUST NOT claim visual fidelity based only on this text. No image access is implied by this rule.
- **Style, not content:** the project MAY use broad visual principles associated with cozy games, but MUST NOT substitute a generic cozy-game style for the stated visual language or reproduce another work's content (see Intellectual property).
- **Finished simplicity:** simplified geometry MUST look intentional and complete, not provisional.

## Rules and conventions

### Settled project decisions

| Topic | Decision | Boundary |
|---|---|---|
| Avatars | Human people, not creatures or animals. | Do not reinterpret the product's avatars as Pokémon-like creatures. |
| Head | Wide, dominant, rounded cube; total avatar height is about 2.5–3 heads, with the head about 30–40% of total height. | Reject spherical generic heads and chibi proportions where the head is 50–60% of the body, which read as pets. |
| Body | Long torso, short legs, long flexible, spaghetti-like arms. | — |
| Face | `:)` language: dot eyes, a thin curved mouth, and no nose. | Do not copy a specific game's avatar face. |
| Camera | Isometric or elevated three-quarter view; elevation 30–45°, azimuth about 45°. | Do not claim this is equivalent to a game's third-person camera. |
| World shapes | Beveled rectangular modules combined with rounded organic forms. | Neither perfect cubes, obvious voxels, nor an everything-inflated look. |
| Outlines and shading | No black outlines; soft shading and matte materials. | No hard cel shading. |
| Palette | Use the single authoritative HEX palette in Palette and color. | First-version extras are optional only. |
| Interiors | Each room is a diorama box with its own accent. | Accent choices below are proposals, not settled choices. |
| Intellectual property | Style may inspire; assets must be original. | See Intellectual property. |

### Shape language

| Shape family | Use | Treatment |
|---|---|---|
| Modular geometric | Walls, floors, stairs, platforms, furniture, buildings | Rectangular prisms with visible bevels equal to 5–15% of the shorter side; broad, nearly flat faces; repeatable modules. |
| Grouped organic | Trees, shrubs, flowers, vines, grass | Compact masses, large leaves, controlled variation. |
| Simplified organic | Avatars | Continuous volumes, strong silhouettes, few small details. |

- Assets MUST be designed from their primary silhouette and volume first.
- Fine detail SHOULD be limited to foreground or focal elements.
- Masonry and terraces SHOULD have more defined corners; characters and furniture SHOULD be softer.
- Soften forms without distorting an object's function.
- Small asymmetries MAY be used (offset pots, flowers of different heights, slightly irregular boards).
- Reject Minecraft or obvious voxel aesthetics, everything-inflated clay forms, visible low-poly triangles, photorealism, dirty/worn PBR, thick black-outlined anime, and unfinished basic-shape scenes.

### Avatars

#### Proportions and construction

| Part | Rule |
|---|---|
| Head | Wide, dominant rounded cube, 30–40% of total height; broad forehead and cheeks, no muzzle. |
| Face | Clean surface, tiny features, ample empty space; uniform skin color without pores. |
| Neck | Short or hidden by clothing. |
| Torso | Elongated, simple, slightly trapezoidal volume, about 35–45% of height. |
| Arms | Long, thin, flexible; when extended, hands reach the hip or upper thigh. |
| Hands | Simple mittens or palms, without complex joints. |
| Legs | Short and compact, about 15–25% of height, with a short stride. |
| Feet | Small or medium, rounded; footwear has a readable volume. |
| Hair | Thick, continuous masses. Define the hairstyle silhouette first, with few internal divisions; no strands, fine transparency, or noisy specular detail. |

#### Face and expression

- Eyes SHOULD be dots, very small ovals, or simple curves.
- The mouth SHOULD be a thin curved stroke; an open smile MAY be used as an animation variant.
- The nose MUST be omitted or nearly imperceptible. Eyebrows MAY be minimal when they add emotion.
- Soft rosy cheeks MAY be used.
- Facial lines SHOULD use `#382F3F` or `#49364B`, never pure black.
- Emotion SHOULD be conveyed through pose, eyes, mouth, and timing, not dozens of facial controls.

#### Clothing and customization

- Clothing SHOULD use large color blocks. Folds SHOULD appear only when they explain pose or construction.
- Identity SHOULD come from silhouette, accessory, and color (for example a hat, backpack, headphones, ID badge, or apron), with few simultaneous accessories.
- Accessories MUST remain visible from the elevated camera, MUST NOT cover the eyes, and SHOULD NOT disrupt the silhouette.
- Skin tones, hairstyles (rounded masses), and clothing SHOULD be diverse while retaining the shared facial design language.
- A soft circular shadow SHOULD anchor the feet to the floor.

#### Animation and acceptance

- Arms SHOULD lag slightly, follow soft arcs, and overshoot gently. During direction changes, hands arrive a fraction after the torso.
- Walking SHOULD use short steps and a soft bounce; running MAY use a stronger torso lean.
- Arms, hair, garments, and accessories SHOULD have secondary motion. Idle poses SHOULD include breathing and small posture adjustments.
- Avoid jelly-like motion and hands passing through walls or furniture.
- Additional bones with interpolation curves, hand IK, or procedural deformation MAY be evaluated against their cost.
- At normal gameplay distance, orientation, the main hairstyle or accessory, and pose or action MUST be distinguishable. An avatar readable only in close-up MUST NOT be accepted.

### Exteriors, terrain, and vegetation

#### Terrain and modular scale

- Terrain SHOULD use a modular grid with discrete heights and horizontal upper platforms.
- Soil or rock walls MUST read vertically; stairs and paths SHOULD explain connections between elevations.
- Grass cover SHOULD be distinct with a slightly scalloped edge. Soil SHOULD have broad soft variation; rock SHOULD use stylized planes and patches.
- Modules MUST NOT have visible gaps.
- Paths MAY use large tiles, warm sand, or brick in a scale pattern.
- Avoid realistic mountains, intense procedural noise, separated cubes, and photographic textures.
- Define **M**, the side length of a floor module, before producing assets. Express paths, doors, building footprints, platforms, and stairs in M.
- Starting values to validate: avatar about 1.5 M tall, doors at least 1.5 M wide, and corridors at least 2 M wide.

#### Vegetation

- Trees SHOULD have compact ovoid crowns made of overlapping leaf groups and a thick trunk; a sphere on a cylinder is insufficient.
- Conifers SHOULD have a conical silhouette, layered branches, and distinct brightness between layers.
- Grass SHOULD use broad blades in patches and varied heights.
- Flowers SHOULD have large petals, a contrasting center, and be grouped by color.
- Vines SHOULD have large oval leaves and descending curves to break rigid lines.
- Use light greens on exposed areas and deep greens within crowns.
- Balance dense areas with visual-rest surfaces, clear paths, and focal points. Abundance MUST NOT hide walkable routes.

### Interiors and office props

#### Rooms as dioramas

- Each room SHOULD read as a box with a floor, two visible walls, and props arranged in layers.
- Walls SHOULD use horizontal two-tone bands (cream above, warm lower trim) and may include a decorative dotted-and-dashed line.
- Floors SHOULD use large, smooth, low-contrast tiles with visible joints.
- Windows and screens SHOULD have thick rounded frames and turquoise or sky-blue glass with soft waves.
- Doors MUST be identifiable, with a large frame, contrasting color, and clear space in front.
- Lighting SHOULD be distributed and warm, with localized hanging bulbs and soft yellow glow.
- A cozy density MAY include small counter and shelf props, hanging plants, and rugs with circular motifs.

#### Room accents

The existing reception revision uses the user-approved cream/wood base with turquoise accents after team feedback that the previous colors were too pink. This approval changes material assignments, not the authoritative HEX identities below or the existing avatar and room geometry. Final appearance still requires visual review under actual lighting. Additional rooms remain deferred.

The proposed rule for future rooms is a shared warm base plus vegetation green and one accent per room. Assignments other than reception remain proposals and MUST be validated before adoption.

| Room | Proposed accent | Key props |
|---|---|---|
| Reception (approved revision) | Turquoise `#62CFC7` | Existing counter, waiting seat and pendant accents; cream/wood base, bell, plants. |
| Meeting room | Turquoise `#62CFC7` | Thick table, rounded chairs, rounded-frame screen, board. |
| Open workspace | Butter `#F7D86B` | Thick wooden desks, monitors, shelves with muted books. |
| Lounge | Green `#65B96A` | Tufted sofas, benches, hanging plants, circular rug. |
| Kitchen / café | Peach pink `#F5B5AB` | Counter, barrel or stools, display dishes and jars. |
| Quiet room | Lavender `#B5A7D6` | Armchair, spherical lamp, curtains. |

#### Props

Each prop SHOULD have a functional silhouette, a dominant material, few secondary components, and a distinctive detail only when needed.

- Furniture SHOULD be sturdy, with rounded corners and robust legs; avoid ultra-thin frames.
- Scale MAY be slightly exaggerated so props read from the elevated camera.
- Tools and action objects SHOULD have thick handles, a clear functional head, and material contrast. They MUST be recognizable by silhouette, not by texture or label alone.
- Interactive objects SHOULD stand out through scale, placement, and moderate contrast, not color alone.

### Palette and color

HEX values below are proposed design values, not official colors from any game. They MUST be reviewed in-engine under final lighting. This section is the sole authoritative palette; optional extras are not replacements.

#### Main colors

| Function | HEX | Use |
|---|---|---|
| Light cream | `#FFF0D8` | Walls, trim, lit areas |
| Pale cream | `#FFF9EB` | Frames, flowers, lit details; replaces pure white |
| Sand | `#E9C99B` | Paths, warm stone, floors |
| Soft terracotta | `#C88D65` | Walls, pots, lower trim |
| Wood brown | `#AF7B52` | Benches, fences, posts, crates, furniture |
| Coral red | `#E66861` | Roofs, awnings, focal accents |
| Peach pink | `#F5B5AB` | Flowers, textiles |
| Butter yellow | `#F7D86B` | Flowers, optimistic details |
| Turquoise | `#62CFC7` | Doors, glass, accents |
| Sky blue | `#A9E7F4` | Sky, illuminated water |
| Grass green | `#A6D96A` | Grass and lit foliage |
| Leaf green | `#65B96A` | Crowns and shrubs |
| Deep green | `#3E8654` | Crown interiors, vegetation contrast |
| Lavender | `#B5A7D6` | Ambient shadows |

Optional extras from the first version: brick `#B8473A` for scale-pattern paths and peach `#F2A66B` for the lower wall band.

#### Character colors

| Use | HEX values |
|---|---|
| Skin (expandable) | `#F8C6AF`, `#ECA786`, `#CB8966`, `#8B593E`, `#5C392D` |
| Hair | `#6C4D48`, `#AF6D63`, `#E5AD58`, `#353849`, `#C77DAA` |
| Clothing | `#5B4F96`, `#75B7DA`, `#F2C85C`, `#EFA5AE`, `#7EBA8B`, `#F4E6D2` |

#### Color rules

- Large surfaces SHOULD use light and mid tones; intense colors SHOULD be accents only.
- Use yellowish greens in lit areas and deep greens in shadow.
- Differentiate by hue and value, not saturation alone.
- Shadows MUST be tinted (lavender, blue, or brown), never pure black.
- Avoid a global pastel filter, maximum saturation everywhere, pure white, neon, dominant cold grays, and assigning unrelated colors to every object.
- Avatars MUST stand out from the floor by saturation or value.
- Check the scene in grayscale; avatars and interactive objects MUST NOT rely on hue alone.

### Materials and textures

The overall finish SHOULD resemble a painted toy, soft resin, or clean clay. Materials SHOULD be matte or softly satin, with broad highlights and no granular noise. `metalness` SHOULD be approximately 0 except on metal.

| Material | Appearance | Permitted detail | Approximate roughness |
|---|---|---|---|
| Skin | Matte, subtle gradients | Minimal blush | 0.75–0.95 |
| Hair | Defined volume, discreet satin | Large locks | 0.55–0.8 |
| Fabric | Matte and clean | Broad folds, few seams | 0.75–0.95 |
| Wood | Warm, broad discreet grain, softened edges | No splinters or wear | 0.75–1.0 |
| Stone | Solid mass, large planes, moderate tonal changes | Deliberate joints and cracks | 0.75–1.0 |
| Painted metal | Smooth, controlled highlight | Simple hardware; no scene-reflecting chrome | 0.4–0.7 |
| Vegetation | Semi-matte, color in masses | Variation by clusters | Medium |
| Glass | Slightly reflective turquoise or blue | Simple reflection | Specific treatment |
| Water | Clean color, calm ripples | Stylized highlights | Specific treatment |
| Soil | Soft, sandy | Large patches, isolated stones | High |

Detail frequency MUST follow this order: large (silhouette and primary color), then medium (leaves, boards, rock planes), then small (exceptional and never dominant). Prefer clear silhouette geometry over complex normal maps. Do not apply procedural noise to every material or use 4K textures on objects that occupy few pixels.

### Lighting and post-processing

#### Daylight baseline

- Use warm directional sunlight from above and one side; about 4800–6000 K is a chromatic reference.
- Use soft blue ambient fill sufficient to read shaded faces.
- Shadows SHOULD be soft, moderately opaque, and consistent in direction across the map.
- Contact shadows or subtle AO MAY anchor bases and intersections. AO MUST NOT look like a black outline.
- Local lights (lamps, bulbs) SHOULD be diffuse yellow with limited radius.
- Avoid darkened faces caused by bangs or canopy shadows.

#### Variants — criteria, not confirmed features

- **Sunset:** golden and peach tones, somewhat longer shadows.
- **Cozy night:** blue and violet tones, localized warm lights, and a readable main path. Do not create it only by lowering exposure.
- **Interior:** distributed warm light, visible corners, materials consistent with outdoors.

#### Post-processing

Use very discreet bloom, consistent tone mapping, and moderate exposure. Soft fog MAY separate backgrounds. Do not use tilt-shift (diorama describes world scale, not a lens), strong blur, chromatic aberration, grain, or dark vignette.

### Camera and spatial readability

- Use an isometric or elevated three-quarter view; orthographic projection or perspective with a narrow FOV. Starting camera values: elevation 30–45°, azimuth about 45° relative to the grid. Compare before fixing values.
- Show enough floor to anticipate movement; avoid extreme wide-angle views.
- Silhouettes MUST read from above and diagonally; facades and roofs SHOULD both remain legible.
- Resolve occlusion: walls and trees MUST NOT continuously hide avatars. Wall cutaways or transparency MAY be used.
- Objects need enough volume not to become thin lines from above.
- Keep value contrast low between general elements so avatars can stand out through saturation.

Validate at actual gameplay size in each of these views:

1. One avatar on a path.
2. An avatar beside a wall, door, and piece of furniture.
3. Several avatars among props in a room.
4. A garden with small decorations.
5. A reduced or mobile screen.

### Visual density, signage, and UI

- Foreground and focal areas MAY have greater richness (flowers, bevels, accessories, color variation); midground objects SHOULD be recognizable with contained detail; background forms SHOULD be large and simple.
- Reserve clear floor for movement and gatherings.
- Signage SHOULD use large, simple icons, little 3D text, visible supports, and soft edges.
- Focus and selection states MUST NOT depend on color alone.
- UI SHOULD use clear panels with broad corners, immediately readable text, discreet borders and shadows, generous spacing, and name labels differentiated by color. It MUST feel part of the same visual world without copying another game's UI.
- World animation MAY include slow, uneven leaf and flower sway, calm water, and a bounce or edge glow on interactive objects. Avoid permanently fast cycles and camera shake.

### Implementation guidance

#### Confirmed 3D path (Three.js / React Three Fiber)

The [project document](../master-document.md), sections 3.1 and 5, confirms this rendering stack. The [decision record](../docs/decisions/rendering-and-authoring.md) records Blender model authoring. These choices do not finalize the visual starting points or open questions in this guide.

- A shared material library MAY include `stoneWarm`, `grassLight`, `grassDark`, `woodWarm`, `roofCoral`, `glassTeal`, `skinBase`, and `fabricMatte`.
- Use GLB/glTF for complex avatars and objects, procedural meshes for simple modules, and instancing for repeated elements where appropriate.
- Define sRGB, tone mapping, and exposure before tuning the palette.
- Maintain a fixed reference scene to detect lighting or material changes.
- Prioritize stable frame rate over effects; test LOD and culling on mobile.

A 2D isometric sprite pipeline is not the current implementation path; replacing the confirmed 3D stack requires an explicit decision under [Documentation and decisions](./documentation-and-decisions.md).

### Intellectual property

- Replicate broad **style attributes**, but create original avatars, props, buildings, and UI.
- Do not reproduce characters, creatures, buildings, logos, insignia, or assets from Pokémon or any other game.
- Do not copy the face of a Pokémon Pokopia avatar; the source guide notes that it belongs to a particular creature.
- Prompts to generative tools SHOULD describe style through attributes in this guide rather than naming games or characters.

## Validation

### Acceptance checks

- [ ] The scene feels cozy, cheerful, and welcoming.
- [ ] Geometry is simple, with bevels and rounding where appropriate; flowers, trees, and lamps are not cubic by obligation.
- [ ] The scene reads at normal camera distance and at reduced size.
- [ ] The palette is coherent: warm base, greens, and one or two accents per room.
- [ ] There are no hyperreal textures or excessive noise.
- [ ] Lighting is soft with enough shadow to anchor objects and no excessive bloom.
- [ ] Walkable areas are clearly separated from decorative clusters.
- [ ] Doors and interactive objects are identifiable.
- [ ] Avatars are human, with rounded-cube heads, long torsos, short legs, long flexible arms, and `:)` faces.
- [ ] Hair and clothing use clean masses.
- [ ] Orientation, main accessory, and pose are distinguishable at gameplay scale.
- [ ] The scene passes the grayscale check.
- [ ] Designs are original and reproduce no external brands, characters, or buildings.

### Validation order

1. Gray avatar without textures: head, proportions, and elastic arm animation.
2. Expressions: neutral, happy, surprised.
3. Materials: wall, tile, stone, pot, tree, garment.
4. Lighting: small daytime scene with sun, fill, and shadows.
5. Color: apply the palette and correct under real lighting.
6. One complete room: floor, two walls, door, 4–6 props, plant, and three avatars.
7. Camera: view that same room at gameplay size and on mobile.
8. Several adjacent rooms: consistent warm base and distinct accents.
9. Performance: evaluate geometry, shadows, and animation cost before scaling up.

### Open questions

The following remain unresolved and MUST be decided through tests: module M and exact dimensions; orthographic versus perspective projection; final avatar proportions; final color range; room accents; day/night cycle; and animation complexity. Numeric values in this guide are initial measurements, not claims that these decisions have been finalized.

## References

- [Master project document](../master-document.md) — product scope and established 3D direction.
- No reference images are embedded or asserted to have been inspected by this document.

## Illustrative prompt and design tokens

The following prompt is a concise style summary, not a replacement for the rules above and not permission to reproduce another work:

> Cozy 3D diorama style, isometric view around 40° (azimuth 45°). Beveled rectangular modules combined with grouped rounded nature. No black outlines; matte or softly satin painted-toy materials; subtle ambient occlusion. Warm base (cream `#FFF0D8`, sand `#E9C99B`, wood `#AF7B52`), greens (`#A6D96A`, `#65B96A`, `#3E8654`), and one room accent (coral `#E66861`, turquoise `#62CFC7`, or butter `#F7D86B`). Lavender-tinted shadows `#B5A7D6`, never black. Human avatars: rounded-cube head (~35% of height), `:)` face with dot eyes, long torso, short legs, long flexible arms, hair and clothes in color masses, soft circular contact shadow. Fine detail only in foreground; silhouettes readable at gameplay scale. Original design: do not reproduce characters, creatures, or assets from any game.

Suggested token summary, subject to the same validation and open decisions:

```json
{
  "color": {
    "creamLight": "#FFF0D8", "creamPale": "#FFF9EB", "sand": "#E9C99B",
    "terracotta": "#C88D65", "wood": "#AF7B52", "coral": "#E66861",
    "peach": "#F5B5AB", "butter": "#F7D86B", "teal": "#62CFC7",
    "sky": "#A9E7F4", "grassLight": "#A6D96A", "leaf": "#65B96A",
    "grassDeep": "#3E8654", "lavender": "#B5A7D6",
    "faceLine": "#382F3F"
  },
  "shape": { "bevelRadiusPct": [5, 15], "terrainEdges": "defined", "furnitureEdges": "soft" },
  "avatar": {
    "headPct": [30, 40], "torsoPct": [35, 45], "legsPct": [15, 25],
    "headShape": "roundedCube", "armStyle": "longFlexible",
    "face": { "eyes": "dot", "mouth": "thinCurve", "nose": "none" },
    "contactShadow": "softCircle"
  },
  "camera": { "elevationDeg": [30, 45], "azimuthDeg": 45, "projection": "orthographicOrLowFov" },
  "material": {
    "roughness": { "skinCloth": [0.75, 0.95], "hair": [0.55, 0.8], "woodStone": [0.75, 1.0], "paintedMetal": [0.4, 0.7] },
    "outline": "none", "shading": "soft", "ao": "subtle"
  },
  "light": { "sun": "warm", "fill": "softBlue", "shadowTint": "lavender", "bloom": "minimal" }
}
```
