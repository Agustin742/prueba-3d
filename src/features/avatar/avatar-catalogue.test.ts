import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAppearanceCatalogue, toAppearanceChoices } from './avatar-catalogue';

const manifest = () => JSON.parse(readFileSync('public/models/avatars/integration-catalogue.json', 'utf8'));
describe('integration catalogue', () => {
  it('offers nine male overlays without a replacement body path', () => {
    const catalogue = parseAppearanceCatalogue(manifest());
    expect(catalogue.bodies).toHaveLength(2);
    expect(catalogue.bodies[0]).not.toHaveProperty('path');
    const choices = toAppearanceChoices(catalogue).male;
    expect(choices.hair.map(item => item.id)).toEqual(['afro', 'dreads']);
    expect(choices.tops.map(item => item.id)).toEqual(['hoodie', 'tank']);
    expect(choices.accessories).toHaveLength(5);
  });
  it('offers only the selected female modules and exact corrected hoodie path', () => {
    const catalogue = parseAppearanceCatalogue(manifest());
    const female = catalogue.bodies.find(body => body.id === 'female')!;
    expect(female.hair.map(asset => asset.id)).toEqual(['original', 'afro']);
    expect(female.tops.map(asset => asset.id)).toEqual(['tshirt', 'hoodie', 'tank']);
    expect(female.accessories.map(asset => asset.id)).toEqual(['glasses', 'cap', 'headphones', 'earrings']);
    expect(female.tops[1].path).toBe('/models/avatars-hem-correction/female/top-hoodie.glb');
    expect(toAppearanceChoices(catalogue)).toHaveProperty('female');
  });
  it.each(['path', 'id', 'slot', 'tintMaterials'])('rejects forged asset %s', field => {
    const value = manifest();
    value.bodies[0].hair[0][field] = field === 'tintMaterials' ? ['Body'] : '../unsupported';
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it.each(['body-path', 'unused-hoodie', 'male-hair', 'extra-body', 'missing-body'])('rejects unselected female catalogue variant %s', variant => {
    const value = manifest();
    if (variant === 'body-path') value.bodies[1].path = '/models/avatars/female/body.glb';
    if (variant === 'unused-hoodie') value.bodies[1].tops[1].path = '/models/avatars/female/top-hoodie.glb';
    if (variant === 'male-hair') value.bodies[1].hair[0] = value.bodies[0].hair[0];
    if (variant === 'extra-body') value.bodies.push(value.bodies[1]);
    if (variant === 'missing-body') value.bodies.pop();
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it('rejects unknown rigs, replacement bodies and duplicate choices', () => {
    for (const mutate of [
      (value: ReturnType<typeof manifest>) => { value.bodies[0].id = 'unknown'; },
      (value: ReturnType<typeof manifest>) => { value.bodies[0].path = '/models/avatars/male/body.glb'; },
      (value: ReturnType<typeof manifest>) => { value.bodies[0].hair[1] = value.bodies[0].hair[0]; },
    ]) { const value = manifest(); mutate(value); expect(() => parseAppearanceCatalogue(value)).toThrow(); }
  });
});
