/** Wire-only data: no model paths, renderer imports, persistence or identity authority. */
export interface AvatarAppearance {
  body: 'male' | 'female';
  hairId: string;
  topId: string;
  accessoryId: string | null;
  hairColor: string;
  clothingColor: string;
  nickname: string;
}

const approved = {
  male: {
    hair: ['classic-short', 'fade', 'afro', 'dreads', 'long-tied'],
    tops: ['tshirt', 'hoodie', 'shirt', 'tank', 'jacket'],
    accessories: ['round-glasses', 'square-glasses', 'cap', 'headphones', 'backpack'],
  },
  female: {
    hair: ['original', 'bob', 'high-ponytail', 'bun', 'afro'],
    tops: ['tshirt', 'hoodie', 'blouse', 'tank', 'jacket'],
    accessories: ['glasses', 'cap', 'headphones', 'earrings', 'handbag'],
  },
};
const hairColors = ['#6c4d48', '#af6d63', '#e5ad58', '#353849', '#c77daa'];
const clothingColors = ['#5b4f96', '#75b7da', '#f2c85c', '#efa5ae', '#7eba8b', '#f4e6d2'];

/** Validate and project only approved appearance fields. Nickname never replaces join identity. */
export function validateAvatarAppearance(value: unknown): AvatarAppearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { body, hairId, topId, accessoryId, hairColor, clothingColor, nickname } = value as Record<string, unknown>;
  if ((body !== 'male' && body !== 'female') || typeof hairId !== 'string'
    || typeof topId !== 'string' || (accessoryId !== null && typeof accessoryId !== 'string')
    || typeof hairColor !== 'string' || typeof clothingColor !== 'string'
    || typeof nickname !== 'string') return null;
  const options = approved[body];
  if (!options.hair.includes(hairId) || !options.tops.includes(topId)
    || (accessoryId !== null && !options.accessories.includes(accessoryId))
    || !hairColors.includes(hairColor) || !clothingColors.includes(clothingColor)) return null;
  return { body, hairId, topId, accessoryId, hairColor, clothingColor, nickname };
}
