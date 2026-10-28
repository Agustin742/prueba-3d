import { describe, expect, it } from 'vitest';
import manifest from '../../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue, toAppearanceChoices } from './avatar-catalogue';

const fixture = () => structuredClone(manifest);
describe('appearance catalogue boundary', () => {
  it('projects the real approved catalogue without assembly metadata', () => {
    const parsed = parseAppearanceCatalogue(manifest);
    expect(parsed.bodies.map(body => body.id)).toEqual(['male', 'female']);
    const ids = [
      [['classic-short', 'fade', 'afro', 'dreads', 'long-tied'], ['tshirt', 'hoodie', 'shirt', 'tank', 'jacket'], ['round-glasses', 'square-glasses', 'cap', 'headphones', 'backpack']],
      [['original', 'bob', 'high-ponytail', 'bun', 'afro'], ['tshirt', 'hoodie', 'blouse', 'tank', 'jacket'], ['glasses', 'cap', 'headphones', 'earrings', 'handbag']],
    ];
    parsed.bodies.forEach((body, index) => {
      expect([body.hair, body.tops, body.accessories].map(list => list.map(item => item.id))).toEqual(ids[index]);
      expect(body.hair[0]).not.toHaveProperty('assembly');
      expect(toAppearanceChoices(parsed)[body.id].hair[0]).toEqual({ id: body.hair[0].id, label: body.hair[0].label });
    });
    expect(parsed.bodies[1].tops[1].path).toBe('/models/avatars-hem-correction/female/top-hoodie.glb');
  });
  it.each([null, {}, { version: 2, bodies: [] }])('rejects malformed roots %j', value => {
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it('requires both bodies exactly once', () => {
    const value = fixture();
    value.bodies[1] = value.bodies[0];
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it('requires five unique entries and correct slots and material arrays', () => {
    for (const mutate of [
      (v: ReturnType<typeof fixture>) => v.bodies[0].hair.pop(),
      (v: ReturnType<typeof fixture>) => { v.bodies[0].hair[1].id = v.bodies[0].hair[0].id; },
      (v: ReturnType<typeof fixture>) => { v.bodies[0].hair[0].slot = 'top'; },
      (v: ReturnType<typeof fixture>) => { v.bodies[0].hair[0].tintMaterials = [null as unknown as string]; },
    ]) {
      const value = fixture(); mutate(value);
      expect(() => parseAppearanceCatalogue(value)).toThrow();
    }
  });
  it('validates body paths, rig identity and required strings', () => {
    for (const patch of [{ path: '/models/avatars/female/body.glb' }, { rigFamily: '' }, { id: 'other' }]) {
      const value = fixture(); Object.assign(value.bodies[0], patch);
      expect(() => parseAppearanceCatalogue(value)).toThrow();
    }
    const value = fixture(); value.bodies[0].hair[0].label = '';
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it.each(['https://evil.test/a.glb', '//evil.test/a.glb', '/models/avatars/male/../body.glb', '/models/avatars/male/%2e%2e/body.glb', '/models/avatars/male/unknown.glb', '/models/avatars/female/hair-original.glb', '/models/avatars/male/hair-classic-short.glb?x=1'])('rejects unsafe or mismatched paths %s', path => {
    const value = fixture(); value.bodies[0].hair[0].path = path;
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
});
