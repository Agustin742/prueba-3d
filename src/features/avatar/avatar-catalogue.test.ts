import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAppearanceCatalogue, toAppearanceChoices } from './avatar-catalogue';

const manifest = () => JSON.parse(readFileSync('public/models/avatars/integration-catalogue.json', 'utf8'));
describe('integration catalogue', () => {
  it('offers only nine male overlays without a replacement body path', () => {
    const catalogue = parseAppearanceCatalogue(manifest());
    expect(catalogue.bodies).toHaveLength(1);
    expect(catalogue.bodies[0]).not.toHaveProperty('path');
    const choices = toAppearanceChoices(catalogue).male;
    expect(choices.hair.map(item => item.id)).toEqual(['afro', 'dreads']);
    expect(choices.tops.map(item => item.id)).toEqual(['hoodie', 'tank']);
    expect(choices.accessories).toHaveLength(5);
  });
  it.each(['path', 'id', 'slot', 'tintMaterials'])('rejects forged asset %s', field => {
    const value = manifest();
    value.bodies[0].hair[0][field] = field === 'tintMaterials' ? ['Body'] : '../unsupported';
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it('rejects female rigs, replacement bodies and duplicate choices', () => {
    for (const mutate of [
      (value: ReturnType<typeof manifest>) => { value.bodies[0].id = 'female'; },
      (value: ReturnType<typeof manifest>) => { value.bodies[0].path = '/models/avatars/male/body.glb'; },
      (value: ReturnType<typeof manifest>) => { value.bodies[0].hair[1] = value.bodies[0].hair[0]; },
    ]) { const value = manifest(); mutate(value); expect(() => parseAppearanceCatalogue(value)).toThrow(); }
  });
});
