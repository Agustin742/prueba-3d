import { expect, it, vi } from 'vitest';
import manifest from '../../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue } from './avatar-catalogue';
import { appearancePreferenceKey, defaultAvatarConfiguration, loadAvatarPreferences, saveAvatarPreferences, validateAvatarConfiguration } from './avatar-preferences';

const catalogue = parseAppearanceCatalogue(manifest);
const config = { ...defaultAvatarConfiguration(catalogue), nickname: 'Visitor' };
function storage(raw: string | null = null) {
  const data = new Map<string, string>();
  if (raw !== null) data.set(appearancePreferenceKey, raw);
  return { getItem: vi.fn((key: string) => data.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { data.set(key, value); }) };
}
it('loads defaults and legacy nickname read-only, then roundtrips explicit confirmation only', () => {
  const store = storage(); store.setItem('avatar_nickname', 'Visitor'); store.setItem.mockClear();
  expect(loadAvatarPreferences(catalogue, store).configuration).toEqual(config);
  expect(store.setItem).not.toHaveBeenCalled();
  expect(saveAvatarPreferences({ ...config, extra: 'ignored' }, catalogue, store)).toEqual({ saved: true });
  expect(loadAvatarPreferences(catalogue, store).configuration).toEqual(config);
  expect(store.setItem).toHaveBeenCalledExactlyOnceWith(appearancePreferenceKey, JSON.stringify({ version: 1, configuration: config }));
});
it.each([{ body: 'unknown' }, { hairId: 'bob' }, { topId: 'tshirt' }, { accessoryId: 'earrings' }, { accessoryId: '' }, { hairColor: 'red' }, { clothingColor: '#ffffff' }, { nickname: 1 }])('rejects excluded or invalid preferences %j without overwriting', patch => {
  const value = { ...config, ...patch };
  const store = storage(JSON.stringify({ version: 1, configuration: value }));
  expect(validateAvatarConfiguration(value, catalogue)).toBeNull();
  expect(loadAvatarPreferences(catalogue, store)).toMatchObject({ configuration: defaultAvatarConfiguration(catalogue), warning: expect.any(String) });
  expect(saveAvatarPreferences(value, catalogue, store).saved).toBe(false);
  expect(store.setItem).not.toHaveBeenCalled();
});
it.each(['{', 'null', '{"version":2}', '{"version":1,"configuration":{}}'])('falls back read-only for corrupt data %s', raw => {
  const store = storage(raw);
  expect(loadAvatarPreferences(catalogue, store).warning).toBeTruthy(); expect(store.setItem).not.toHaveBeenCalled();
});
it('roundtrips every approved female slot read-only until explicit save', () => {
  const female = { ...defaultAvatarConfiguration(catalogue, 'female'), nickname: 'Luna' };
  expect(female).toMatchObject({ body: 'female', hairId: 'original', topId: 'tshirt' });
  for (const hairId of ['original', 'afro']) for (const topId of ['tshirt', 'hoodie', 'tank'])
    for (const accessoryId of [null, 'glasses', 'cap', 'headphones', 'earrings']) {
      const value = { ...female, hairId, topId, accessoryId, hairColor: '#c77daa', clothingColor: '#7eba8b' };
      const store = storage(JSON.stringify({ version: 1, configuration: value }));
      expect(loadAvatarPreferences(catalogue, store)).toEqual({ configuration: value });
      expect(store.setItem).not.toHaveBeenCalled();
      expect(saveAvatarPreferences(value, catalogue, store)).toEqual({ saved: true });
      expect(loadAvatarPreferences(catalogue, store)).toEqual({ configuration: value });
    }
});
it.each([{ hairId: 'dreads' }, { topId: 'unknown' }, { accessoryId: 'backpack' }, { hairColor: 'red' }, { clothingColor: '#ffffff' }])('rejects invalid female combinations read-only %j', patch => {
  const value = { ...config, body: 'female', hairId: 'original', topId: 'tshirt', ...patch };
  const store = storage(JSON.stringify({ version: 1, configuration: value }));
  expect(validateAvatarConfiguration(value, catalogue)).toBeNull();
  expect(loadAvatarPreferences(catalogue, store).warning).toBeTruthy();
  expect(saveAvatarPreferences(value, catalogue, store).saved).toBe(false);
  expect(store.setItem).not.toHaveBeenCalled();
});
it('handles blocked getter, unavailable storage and quota failure without losing the draft', () => {
  const blocked = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('quota'); } };
  for (const store of [null, blocked]) {
    expect(loadAvatarPreferences(catalogue, store).warning).toBeTruthy();
    expect(saveAvatarPreferences(config, catalogue, store).saved).toBe(false);
  }
  const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw Error('blocked'); });
  try { expect(loadAvatarPreferences(catalogue).warning).toBeTruthy(); } finally { getter.mockRestore(); }
  expect(saveAvatarPreferences({ ...config, nickname: ' ' }, catalogue, storage()).saved).toBe(false);
});
it('accepts the complete approved palettes and checks current catalogue membership', () => {
  for (const hairColor of ['#6c4d48', '#af6d63', '#e5ad58', '#353849', '#c77daa'])
    for (const clothingColor of ['#5b4f96', '#75b7da', '#f2c85c', '#efa5ae', '#7eba8b', '#f4e6d2'])
      expect(validateAvatarConfiguration({ ...config, hairColor, clothingColor }, catalogue)).toBeTruthy();
  const smaller = { ...catalogue, bodies: catalogue.bodies.map(body => ({ ...body, hair: body.hair.slice(1) })) };
  expect(validateAvatarConfiguration(config, smaller)).toBeNull();
});
