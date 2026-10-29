# Wardrobe preview rotation

## Controls

- Drag horizontally over the 3D preview with the primary mouse button or one finger.
  Dragging one preview width makes a full 360° turn. Vertical touch scrolling remains
  available; browser gesture cancellation stops rotation.
- Keyboard alternative: Tab to focus the preview, then use Left/Right Arrow for
  45° steps and Home to restore the original elevated three-quarter view.

There are no visible rotation buttons or instruction overlays. The focusable
preview retains the browser's keyboard focus indicator and accessible instructions.
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
and buttons do not start a gesture. Preview key/click events do not bubble into
world shortcuts; rotation keys act only when the preview itself has focus. No global keyboard listeners are added.

## Verification and limits

Focused tests use a real Three.js orthographic camera with a mocked R3F provider
and assert rear/front positions, look direction, unchanged height/radius/zoom,
mouse/touch gestures, cancellation and resource lifecycle regressions:

```sh
node node_modules/vitest/vitest.mjs run src/features/avatar/CustomizedAvatarPreview.test.tsx src/features/avatar/AvatarPreviewRotation.test.tsx
```

These tests do not prove browser WebGL rendering or visual asset fit. Before visual
acceptance, check front/rear garments, keyboard rotation/focus, real touch capture,
vertical scrolling, reduced motion and unobstructed framing at mobile/desktop sizes and
200% zoom. No new model geometry or catalogue fitting is included in this change.

See [accessibility](../../rules/ui-and-accessibility.md) and
[avatar boundaries](../../rules/avatars-and-customization.md).
