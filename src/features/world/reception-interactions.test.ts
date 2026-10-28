import { readFileSync } from 'node:fs';
import { Mesh, Vector3, type Intersection } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import {
  RECEPTION_INTERACTIONS,
  getReceptionInteraction,
  receptionInteractionTarget,
  type ReceptionInteractionId,
} from './reception-interactions';

describe('reception local interactions catalog and mesh hit resolution', () => {
  it('defines all four bounded reception interactions with explicit local-only classes and feedback', () => {
    expect(RECEPTION_INTERACTIONS.map(item => item.id)).toEqual([
      'counter-bell',
      'noticeboard',
      'waiting-seat',
      'portal-doorway',
    ]);
    expect(getReceptionInteraction('counter-bell').kind).toBe('decorative');
    expect(getReceptionInteraction('noticeboard').kind).toBe('panel');
    expect(getReceptionInteraction('waiting-seat').kind).toBe('decorative');
    expect(getReceptionInteraction('portal-doorway').kind).toBe('unavailable-transition');
    for (const item of RECEPTION_INTERACTIONS) {
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.feedback).toMatch(/local|deferred|not synchronized|unavailable/i);
    }
  });

  it('resolves interactive reception mesh hits across counter, noticeboard, waiting seat and portal doorway', () => {
    const cases: Array<[string, ReceptionInteractionId]> = [
      ['ITReception_Bell dome', 'counter-bell'],
      ['ITReception_Bell button', 'counter-bell'],
      ['ITReception_Coral counter crown', 'counter-bell'],
      ['ITReception_L counter warm carcass', 'counter-bell'],
      ['ITReception_Noticeboard frame', 'noticeboard'],
      ['ITReception_Pinned notice.001', 'noticeboard'],
      ['ITReception_Notice pin.002', 'noticeboard'],
      ['ITReception_Peach seat cushion', 'waiting-seat'],
      ['ITReception_Upholstered back', 'waiting-seat'],
      ['ITReception_Seat arm.001', 'waiting-seat'],
      ['ITReception_Door header', 'portal-doorway'],
      ['ITReception_Portal crest', 'portal-doorway'],
      ['ITReception_Threshold', 'portal-doorway'],
    ];
    for (const [name, expected] of cases) {
      const mesh = new Mesh();
      mesh.userData.name = name;
      const hit: Intersection = { object: mesh, distance: 1, point: new Vector3(0, 1, 0) };
      expect(receptionInteractionTarget(hit)).toBe(expected);
    }
  });

  it('returns null for floor tiles, walls, plants, shelves and missing hits', () => {
    expect(receptionInteractionTarget(undefined)).toBeNull();
    for (const nonInteractive of [
      'ITReception_Tile 0-0',
      'ITReception_Back left',
      'ITReception_Lance leaf 0',
      'ITReception_Layered display shelf',
      'ITReception_Rounded window frame',
      'Avatar',
    ]) {
      const mesh = new Mesh();
      mesh.userData.name = nonInteractive;
      const hit: Intersection = { object: mesh, distance: 1, point: new Vector3(0, 0, 0) };
      expect(receptionInteractionTarget(hit)).toBeNull();
    }
  });

  it('matches actual mesh names inside public/models/rooms/reception.glb for every catalog interaction', async () => {
    const bytes = readFileSync('public/models/rooms/reception.glb');
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    const matched = new Set<ReceptionInteractionId>();
    gltf.scene.traverse(node => {
      const hit: Intersection = { object: node, distance: 1, point: new Vector3() };
      const id = receptionInteractionTarget(hit);
      if (id) matched.add(id);
    });
    expect(matched).toEqual(new Set(['counter-bell', 'noticeboard', 'waiting-seat', 'portal-doorway']));
  });
});
