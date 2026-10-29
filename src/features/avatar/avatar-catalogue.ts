import type { AppearanceAsset, AppearanceBody, AppearanceCatalogue } from './avatar-appearance';
const approved = {
  male: { hair: ['afro', 'dreads'], top: ['hoodie', 'tank'], accessory: ['round-glasses', 'square-glasses', 'cap', 'headphones', 'backpack'] },
  female: { hair: ['original', 'afro'], top: ['tshirt', 'hoodie', 'tank'], accessory: ['glasses', 'cap', 'headphones', 'earrings'] },
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid appearance object');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unsupported appearance field');
}
function assets(value: unknown, slot: AppearanceAsset['slot'], body: AppearanceBody['id']): AppearanceAsset[] {
  if (!Array.isArray(value) || value.length !== approved[body][slot].length) throw Error('Invalid appearance options');
  return value.map((item, index) => {
    const asset = record(item); keys(asset, ['id', 'label', 'path', 'slot', 'tintMaterials', 'detailMaterials']);
    const id = approved[body][slot][index];
    const tintMaterials = slot === 'accessory' ? [] : [slot === 'hair' ? 'AvatarHairTint' : 'AvatarTopTint'];
    const detailMaterials = slot === 'accessory' && ['cap', 'headphones', 'backpack'].includes(id) ? ['AvatarDetail'] : [];
    const path = body === 'female' && slot === 'top' && id === 'hoodie'
      ? '/models/avatars-hem-correction/female/top-hoodie.glb' : `/models/avatars/${body}/${slot}-${id}.glb`;
    if (asset.id !== id || asset.slot !== slot || asset.path !== path || typeof asset.label !== 'string' || !asset.label.trim()
      || JSON.stringify(asset.tintMaterials) !== JSON.stringify(tintMaterials) || JSON.stringify(asset.detailMaterials) !== JSON.stringify(detailMaterials)) throw Error('Unapproved appearance asset');
    return { id, label: asset.label, path, slot, tintMaterials, detailMaterials };
  });
}
/** Only the two approved bodies and their selected local overlays enter this contract. */
export function parseAppearanceCatalogue(value: unknown): AppearanceCatalogue {
  const root = record(value); keys(root, ['version', 'bodies']);
  if (root.version !== 1 || !Array.isArray(root.bodies) || root.bodies.length !== 2) throw Error('Invalid appearance catalogue');
  const bodies = root.bodies.map((value, index): AppearanceBody => {
    const body = record(value); keys(body, ['id', 'hair', 'tops', 'accessories']);
    const id = index === 0 ? 'male' : 'female';
    if (body.id !== id) throw Error('Unsupported appearance body');
    return { id, hair: assets(body.hair, 'hair', id), tops: assets(body.tops, 'top', id), accessories: assets(body.accessories, 'accessory', id) };
  });
  return { version: 1, bodies };
}
export function toAppearanceChoices(catalogue: AppearanceCatalogue) {
  const options = (items: readonly AppearanceAsset[]) => items.map(({ id, label }) => ({ id, label }));
  const choices = (body: AppearanceBody) => ({ hair: options(body.hair), tops: options(body.tops), accessories: options(body.accessories) });
  return { male: choices(catalogue.bodies[0]), female: choices(catalogue.bodies[1]) };
}
