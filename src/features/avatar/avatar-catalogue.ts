import type { AppearanceAsset, AppearanceCatalogue } from './avatar-appearance';
const approved = { hair: ['afro', 'dreads'], top: ['hoodie', 'tank'], accessory: ['round-glasses', 'square-glasses', 'cap', 'headphones', 'backpack'] };
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid appearance object');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unsupported appearance field');
}
function assets(value: unknown, slot: AppearanceAsset['slot']): AppearanceAsset[] {
  if (!Array.isArray(value) || value.length !== approved[slot].length) throw Error('Invalid appearance options');
  return value.map((item, index) => {
    const asset = record(item); keys(asset, ['id', 'label', 'path', 'slot', 'tintMaterials', 'detailMaterials']);
    const id = approved[slot][index];
    const tintMaterials = slot === 'accessory' ? [] : [slot === 'hair' ? 'AvatarHairTint' : 'AvatarTopTint'];
    const detailMaterials = slot === 'accessory' && index >= 2 ? ['AvatarDetail'] : [];
    const path = `/models/avatars/male/${slot}-${id}.glb`;
    if (asset.id !== id || asset.slot !== slot || asset.path !== path || typeof asset.label !== 'string' || !asset.label.trim()
      || JSON.stringify(asset.tintMaterials) !== JSON.stringify(tintMaterials) || JSON.stringify(asset.detailMaterials) !== JSON.stringify(detailMaterials)) throw Error('Unapproved appearance asset');
    return { id, label: asset.label, path, slot, tintMaterials, detailMaterials };
  });
}
/** No replacement body or external paths can enter this local preview contract. */
export function parseAppearanceCatalogue(value: unknown): AppearanceCatalogue {
  const root = record(value); keys(root, ['version', 'bodies']);
  if (root.version !== 1 || !Array.isArray(root.bodies) || root.bodies.length !== 1) throw Error('Invalid appearance catalogue');
  const body = record(root.bodies[0]); keys(body, ['id', 'hair', 'tops', 'accessories']);
  if (body.id !== 'male') throw Error('Unsupported appearance body');
  return { version: 1, bodies: [{ id: 'male', hair: assets(body.hair, 'hair'), tops: assets(body.tops, 'top'), accessories: assets(body.accessories, 'accessory') }] };
}
export function toAppearanceChoices(catalogue: AppearanceCatalogue) {
  const body = catalogue.bodies[0];
  const options = (items: readonly AppearanceAsset[]) => items.map(({ id, label }) => ({ id, label }));
  return { male: { hair: options(body.hair), tops: options(body.tops), accessories: options(body.accessories) } };
}
