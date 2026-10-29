import { describe, expect, it, vi } from 'vitest';
import manifest from '../../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue } from './avatar-catalogue';
import { appearancePreferenceKey, defaultAvatarConfiguration, loadAvatarPreferences, saveAvatarPreferences, validateAvatarConfiguration } from './avatar-preferences';

const catalogue = () => parseAppearanceCatalogue(manifest);
function storage() {
  const data = new Map<string, string>();
  return { getItem: vi.fn((key: string) => data.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { data.set(key, value); }) };
}
describe('browser-only appearance preferences', () => {
  it('loads safe editable defaults and optional legacy nickname without writing', () => {
    const store = storage(); store.setItem('avatar_nickname', 'Visitor'); store.setItem.mockClear();
    const result = loadAvatarPreferences(catalogue(), store);
    expect(result.configuration).toMatchObject({ body: 'male', hairId: 'afro', topId: 'hoodie', accessoryId: null, hairColor: '#6c4d48', clothingColor: '#5b4f96', nickname: 'Visitor' });
    expect(result.warning).toBeUndefined(); expect(store.setItem).not.toHaveBeenCalled();
  });
  it('roundtrips only explicitly saved confirmed configurations', () => {
    const store = storage();
    const config = { ...defaultAvatarConfiguration(catalogue(), 'female'), nickname: 'Visitor', accessoryId: 'earrings' };
    expect(saveAvatarPreferences(config, catalogue(), store)).toEqual({ saved: true });
    expect(loadAvatarPreferences(catalogue(), store).configuration).toEqual(config);
    expect(store.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.getItem(appearancePreferenceKey)!)).toEqual({ version: 1, configuration: config });
  });
  it.each([{ body: 'other' }, { hairId: 'bob' }, { topId: 'missing' }, { accessoryId: '' }, { accessoryId: 'earrings' }, { hairColor: '#ffffff' }, { clothingColor: '#ffffff' }, { nickname: 1 }])('rejects invalid configuration %j', patch => {
    const value = { ...defaultAvatarConfiguration(catalogue()), nickname: 'Visitor', ...patch };
    expect(validateAvatarConfiguration(value, catalogue())).toBeNull();
    const store = storage();
    expect(saveAvatarPreferences(value, catalogue(), store).saved).toBe(false);
    expect(store.setItem).not.toHaveBeenCalled();
  });
  it.each(['{', 'null', '{"version":2}', '{"version":1,"configuration":{}}'])('returns defaults and warning for corrupt preferences %s', raw => {
    const store = storage(); store.setItem(appearancePreferenceKey, raw); store.setItem('avatar_nickname', 'Legacy');
    const loaded = loadAvatarPreferences(catalogue(), store);
    expect(loaded.configuration).toEqual(defaultAvatarConfiguration(catalogue())); expect(loaded.warning).toBeTruthy();
  });
  it('handles unavailable, blocked and quota-limited storage without throwing', () => {
    const blocked = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('quota'); } };
    for (const store of [null, blocked]) {
      expect(loadAvatarPreferences(catalogue(), store).warning).toBeTruthy();
      expect(saveAvatarPreferences({ ...defaultAvatarConfiguration(catalogue()), nickname: 'Visitor' }, catalogue(), store)).toMatchObject({ saved: false, warning: expect.any(String) });
    }
  });
  it('catches the browser localStorage getter itself being blocked', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw Error('blocked getter'); });
    try {
      expect(loadAvatarPreferences(catalogue()).warning).toBeTruthy();
      expect(saveAvatarPreferences({ ...defaultAvatarConfiguration(catalogue()), nickname: 'Visitor' }, catalogue()).saved).toBe(false);
    } finally { getter.mockRestore(); }
  });
  it('projects unknown fields away and accepts every offered palette color', () => {
    const store = storage();
    for (const hairColor of ['#6c4d48', '#af6d63', '#e5ad58', '#353849', '#c77daa']) {
      for (const clothingColor of ['#5b4f96', '#75b7da', '#f2c85c', '#efa5ae', '#7eba8b', '#f4e6d2']) {
        const value = { ...defaultAvatarConfiguration(catalogue()), nickname: 'Visitor', hairColor, clothingColor, extra: 'ignored' };
        expect(saveAvatarPreferences(value, catalogue(), store).saved).toBe(true);
        expect(loadAvatarPreferences(catalogue(), store).configuration).not.toHaveProperty('extra');
      }
    }
  });
  it('uses actual catalogue membership and never stores blank entry nicknames', () => {
    const value = { ...defaultAvatarConfiguration(catalogue()), nickname: ' ' };
    expect(saveAvatarPreferences(value, catalogue(), storage()).saved).toBe(false);
    const smaller = { ...catalogue(), bodies: catalogue().bodies.map(body => ({ ...body, hair: body.hair.slice(1) })) };
    expect(validateAvatarConfiguration(value, smaller)).toBeNull();
  });
});
