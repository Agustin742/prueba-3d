import { Mesh, Vector3, type Intersection } from 'three';
import { describe, expect, it } from 'vitest';
import {
  RECEPTION_INTERACTIONS,
  getReceptionInteraction,
  receptionInteractionTarget,
  type ReceptionInteractionId,
} from './reception-interactions';
import { composedReception } from './test-room';

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
      ['Bell dome', 'counter-bell'],
      ['Bell button', 'counter-bell'],
      ['Coral counter crown', 'counter-bell'],
      ['L counter warm carcass', 'counter-bell'],
      ['Noticeboard frame', 'noticeboard'],
      ['Pinned notice.001', 'noticeboard'],
      ['Notice pin.002', 'noticeboard'],
      ['Peach seat cushion', 'waiting-seat'],
      ['Upholstered back', 'waiting-seat'],
      ['Seat arm.001', 'waiting-seat'],
      ['Door header', 'portal-doorway'],
      ['Portal crest', 'portal-doorway'],
      ['Threshold', 'portal-doorway'],
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
      'Tile 0-0',
      'Back left',
      'Lance leaf 0',
      'Layered display shelf',
      'Rounded window frame',
      'Avatar',
    ]) {
      const mesh = new Mesh();
      mesh.userData.name = nonInteractive;
      const hit: Intersection = { object: mesh, distance: 1, point: new Vector3(0, 0, 0) };
      expect(receptionInteractionTarget(hit)).toBeNull();
    }
  });

  it('matches actual mesh names inside the room composed from the module GLBs for every catalog interaction', async () => {
    const matched = new Set<ReceptionInteractionId>();
    (await composedReception()).traverse(node => {
      const hit: Intersection = { object: node, distance: 1, point: new Vector3() };
      const id = receptionInteractionTarget(hit);
      if (id) matched.add(id);
    });
    expect(matched).toEqual(new Set(['counter-bell', 'noticeboard', 'waiting-seat', 'portal-doorway']));
  });
});
