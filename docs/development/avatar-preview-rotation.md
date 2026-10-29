# Wardrobe preview rotation

## Controls

- Drag horizontally over the 3D preview with the primary mouse button or one finger.
  Dragging one preview width makes a full 360° turn. Vertical touch scrolling remains
  available; browser gesture cancellation stops rotation.
- Use **Izquierda** or **Derecha** for 45° steps. Both buttons and **Restablecer**
  are native buttons: Tab to focus, then Enter or Space to activate.
- **Restablecer** returns to the original elevated three-quarter view.

The controls wrap on narrow screens and retain native keyboard focus indicators.
There is no automatic spin, inertia, zoom, or elevation change, including with
reduced motion enabled. Existing reduced-motion avatar loading is unchanged.

## Boundaries

`AvatarPreviewRotation` owns a temporary viewing angle outside the keyed resource
owner. Selection changes retain this angle while the wardrobe stays mounted;
leaving the wardrobe resets it. It is not an appearance setting and is not saved
or broadcast. Nickname edits still do not reload resources.

`AvatarPreviewCamera` moves only the wardrobe's dedicated camera around the framed
avatar's origin, keeping its initial height, orbit radius and orthographic zoom.
It does not rotate or deform the avatar root, bones, materials, or mixer, and it
cannot change the world camera. Resource disposal, stale-result cancellation,
rendered-frame readiness and error handling remain owned by the existing preview.
Pointer capture ends on release, cancellation or lost capture; secondary pointers
and buttons do not start a gesture. Control key/click events do not bubble into
world shortcuts. No global keyboard listeners are added.

## Verification and limits

Focused tests use a real Three.js orthographic camera with a mocked R3F provider
and assert rear/front positions, look direction, unchanged height/radius/zoom,
mouse/touch gestures, cancellation and resource lifecycle regressions:

```sh
node node_modules/vitest/vitest.mjs run src/features/avatar/CustomizedAvatarPreview.test.tsx src/features/avatar/AvatarPreviewRotation.test.tsx
```

These tests do not prove browser WebGL rendering or visual asset fit. Before visual
acceptance, check front/rear garments, keyboard activation/focus, real touch capture,
vertical scrolling, reduced motion and control overlap at mobile/desktop sizes and
200% zoom. No new model geometry or catalogue fitting is included in this change.

See [accessibility](../../rules/ui-and-accessibility.md) and
[avatar boundaries](../../rules/avatars-and-customization.md).
