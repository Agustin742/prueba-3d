# Reception asset study

An original, warm reception diorama authored in Blender for the [room foundation](../decisions/rendering-and-authoring.md). This is an asset study, not a playable room or a completed web integration. Visual direction comes from [Art direction](../../rules/art-direction.md).

## Files and inspection

| File | Purpose |
|---|---|
| [reception.blend](../../assets/blender/reception.blend) | Authored source (the monolith GLB was retired after the split; re-export it with the recipes below if needed). Separate source scene `ITReception_Scene`, materials, studio camera/lights and the original avatar as a scale reference. |
| [modules/](../../public/models/rooms/modules/) | The runtime room: 15 reusable module GLBs (geometry/materials only; no avatar, animations, cameras or lights) with ids, paths and collision footprints in [room-modules.ts](../../src/features/world/room-modules.ts). |
| [reception-room.ts](../../src/features/world/reception-room.ts) | `receptionRoom`: the 4x4 reception (32x28 tiles, door in the right of the back wall) as declarative placements (module, position, quarter-turn yaw, optional scale) plus the walkable floor envelope; `receptionUnitRoom` keeps the original single room as the parity oracle. [compose-room.ts](../../src/features/world/compose-room.ts) clones the modules (and instances the repeated floor tiles) into one scene; [derive-layout.ts](../../src/features/world/derive-layout.ts) derives the collision obstacles from the footprints. |
| [split_reception_modules.py](../../scripts/blender/split_reception_modules.py) | One-off split of the monolithic export into the modules. |
| [author_reception.py](../../scripts/blender/author_reception.py) | Authoring recipe, output guards, export validation, camera framing and shared material-assignment resolver. |
| [recolor_reception.py](../../scripts/blender/recolor_reception.py) | Explicit two-phase material-only revision with read-only baseline, staged export/source checks and guarded promotion. |
| [test_reception_palette.py](../../scripts/blender/test_reception_palette.py) | Blender-independent assignment and export-invariance regression tests. |

Open the source in a separate Blender window if another unsaved scene is open. The connected authoring run restored the original active scene and left its file path unchanged; the original `character.glb` was not edited.

Local review images are in `odd/artifacts/reception/desktop.png`, `mobile.png` and `grayscale.png`. They are deliberately untracked. The mobile image is a whole-room overview, not proof that the eventual gameplay camera is usable on a phone.

## Composition and proposed scale

The reception is the original room repeated 4x4 in tile pattern and grown toward the front and right (back-left corner fixed); the description below is of that unit. The room combines a beveled tiled plinth, two cutaway walls, a framed open portal, an L-shaped counter with bell and stationery, cushioned waiting seat, noticeboard, window/display shelves, broad-leaf planter and pendant accents. The user approved a cream/wood base with turquoise accents after team feedback that the previous reception was too pink. This is reception-specific approval, not a new product-wide palette or permission to author other rooms. The material resolver maps coral assignments to turquoise, peach to cream and terracotta to wood; sand floor tiles become pale cream while existing cream tiles remain. All palette HEX identities, historical object names (including color names), geometry and the original avatar remain unchanged.

| Measurement | Proposed value |
|---|---|
| Module M | 4/3 Blender units; one unit is one meter in the source scene. |
| Avatar reference | 2 units tall, existing imported Idle pose; feet on the floor. |
| Portal | 2 units clear width, approximately 2.92 units clear height. |
| Central lane | 2.8 units wide; prop AABBs checked against the proposed lane. |
| Floor footprint | Approximately 10.8 × 9.45 units. |

These are asset layout measurements, not a navigation or physics contract. The export has no collision bodies or interaction implementation. Exact gameplay scale, camera follow, performance and interaction distance remain to be validated.

## Rebuilding safely

The recipes below still export the monolithic `public/models/rooms/reception.glb`, which is no longer shipped or loaded; the app consumes only the modules. The last committed monolith is in git history at commit `49070f7`. Re-split with `split_reception_modules.py` after changing the source.

The recipe runs in the connected Blender UI in Object mode. Use a fresh authoring session with no `ITReception_` data and with all five output paths absent. It refuses existing outputs or an occupied namespace rather than deleting user data. Do not remove or overwrite an existing study merely to rerun the command; preserve it and decide on a separate revision first.

From Blender's Python console, substitute your actual checkout path:

```python
from pathlib import Path
import runpy
project_root = Path(r"C:\path\to\integratec-final-front")
recipe = runpy.run_path(str(project_root / "scripts/blender/author_reception.py"))
evidence = recipe["build"](project_root)
print(evidence)
```

The recipe imports the existing avatar only for reference renders. Its approved Git blob hash is `fa08fdeacfef59a2c53a2c32cd7f58dfed56cbe3`. Blender's generated bone-display `Icosphere` is hidden and excluded from reference scale calculations; it is not part of the avatar design. The source contains no autorun script handlers added by this recipe. Rendering and export use only the isolated authoring scene; no factory reset, user-preference change or original-scene deletion is performed.

## Material-only revision workflow

Run `python -B scripts/blender/test_reception_palette.py` from the checkout for the deterministic contract. It uses only Python's standard library and writes no bytecode. Actual RED was observed for the missing assignment resolver (five errors), then GREEN for five tests; adding the export-invariance contract produced two missing-comparator errors before seven tests passed. Aesthetic appearance has no meaningful automated RED.

Use the connected Blender session with the clean, existing canonical source open. Loading the helper has no scene side effects:

```python
revision = runpy.run_path(str(project_root / "scripts/blender/recolor_reception.py"))
receipt = revision["dry_run"](project_root)
print(receipt)  # Inspect exact baseline hashes and material changes before approval.
# Only after inspection and approval:
evidence = revision["revise"](project_root, receipt)
print(evidence)
# Only after checking staged evidence and renders:
revision["promote"](project_root)
```

Staging is restricted to the new, untracked `odd/artifacts/reception-turquoise/` folder. It preserves `original.blend` and `original.glb`, writes `revised.blend` and `revised.glb`, and captures fresh `desktop.png`, `mobile.png`, `grayscale.png` and `evidence.json`. Existing review evidence is not overwritten. It refuses occupied staging paths. Library writing targets a new absent source path, then explicit promotion copies verified bytes to the authorized canonical paths; no `.blend1`, save-version preference change, factory reset, scene deletion or global handler is used. The committed original version remains in Git.

The revision checks all scene object names/transforms and raw/evaluated mesh geometry, compares GLB JSON excluding only material tables/primitive material indices, requires identical geometry BIN bytes, and checks each exported primitive against its source assignment. Rendering restores original camera placement/scale, resolution, compositor input, selection and output path before saving. Light colors and renderer architecture are not revised. Staging failures remain visible for inspection rather than triggering destructive recovery or automatic retries.

## Observed revision evidence

The connected Blender staging run produced all three fresh renders in `odd/artifacts/reception-turquoise/`. Its `evidence.json` records unchanged 160-object/144-room-mesh inventory and source raw/evaluated geometry plus transforms SHA-256 `7fb0333793fe1a15b5ad848503ee8541a1437e3c3a234722e8461c7af798f39f`. Non-material GLB JSON is identical; embedded geometry BIN SHA-256 is unchanged at `3446de91d471595d3871ad6544ebfbe3f8fa7adabae27c169c5652d9f584452f`. Each exported primitive matches the revised live source assignment.

| Artifact | SHA-256 (canonical files match staging) |
|---|---|
| Revised source | `89296e0f1ffb2b930a0d2abb587836eb1a47d1442920ee58da5ad34bfe57a6f5` |
| Revised export | `6e6a4f1970088534f179bde90610bf069afa6d5f40cde6866732995c75b20e59` |
| Original avatar, unchanged | `de1012840de5fbda751a369ca2c744c4412873bd8da152041ab6c6d01d85132a` |

The parent inspected all three fresh images: the cream/wood/turquoise balance is achieved, the original avatar is visible, the whole room fits and furniture remains readable in grayscale. The portrait render is a small whole-room overview, not gameplay/mobile-performance acceptance.

Actual saved-source library inspection passed: 160 objects, 144 authored meshes, identical persistent transform basis/parent inverse and identity, and raw geometry/material assignments matching the checked live source. All 144 exported primitives match saved material names and base-color factors. The first parity harness incorrectly treated inactive linked-scene `matrix_world` caches as persisted transforms for 16 reference/studio objects; bounded diagnosis confirmed identical persisted basis/location. Correcting the harness to compare persisted properties passed without an asset correction. See local `source-parity.json`; temporary linked inspection IDs were cleaned while the original scene was protected.

Explicit promotion succeeded (`promotion.json`), and a subsequent read-only hash check confirmed both canonical files match staging and the original avatar bytes are unchanged. The staging receipt's `canonical_promoted: false` describes its creation phase rather than subsequent filesystem state. Light tints, geometry, navigation and the original avatar were not revised. These checks cover the material-only S4/S5/S8 continuation; they do not close historical verifier gaps, prove browser gameplay or authorize additional rooms.

## Observed checks and limitations

- The first real export failed its scope check: Blender selected-object export included the original scene's `Cube`. The corrected export explicitly restricts the active scene and contains only the 144 authored mesh nodes.
- Initial renders exposed an importer helper covering the avatar and cropped portrait framing. After correction, desktop, portrait and grayscale renders were inspected: the actual avatar is visible, the complete room fits, and the main furniture remains distinguishable in grayscale.
- The reference uses the seven source avatar meshes, is 2 units tall and has minimum Z = 0. The original GLB hash remained unchanged.
- Syntax and actual Blender execution are checked separately. Aesthetic composition has no meaningful automated RED/GREEN; runtime export guards did expose the scope defect before correction. Do not represent these renders as automated art approval.
- The corrected scene was finalized from the preserved partial run. A fresh end-to-end invocation of the corrected recipe has not been observed; the overwrite guard intentionally prevents rebuilding over these outputs.
- Saved-source/export material parity passed, but browser-rendered material parity, gameplay-scale mobile readability, collision behavior and performance remain unverified. The web bootstrap still lacks its independent verification; this asset does not close that task.
- The parent attempted one initial application smoke check:

  ```sh
  node node_modules/vitest/vitest.mjs run --configLoader runner && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json && node node_modules/vite/bin/vite.js build --configLoader runner
  ```

  It exited 1 at Vitest startup: `Cannot find module '@vitejs/plugin-react'` imported from `vitest.config.ts`. No application tests executed; both typechecks and the build were skipped by `&&`. After separately authorized local dependency-junction repair (7 junctions updated, 435 total local junctions, 7,368 protected file hashes unchanged), the public import and that exact command chain exited 0: 68/68 tests across 10 files, both TypeScript checks and the Vite build passed, with a 1,100.38 kB chunk warning. The independent verifier for that repair failed without a verdict (`assistant reported an error`) and was not retried; human review/disposition remains required alongside the existing verification gaps.
