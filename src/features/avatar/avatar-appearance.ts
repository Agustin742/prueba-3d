export interface AvatarConfiguration {
  body: 'male' | 'female';
  hairId: string;
  topId: string;
  accessoryId: string | null;
  hairColor: string;
  clothingColor: string;
}
export interface AppearanceAsset {
  id: string;
  label: string;
  path: string;
  slot: 'hair' | 'top' | 'accessory';
  tintMaterials: readonly string[];
  detailMaterials: readonly string[];
}
export interface AppearanceBody {
  id: AvatarConfiguration['body'];
  hair: readonly AppearanceAsset[];
  tops: readonly AppearanceAsset[];
  accessories: readonly AppearanceAsset[];
}
export interface AppearanceCatalogue { version: 1; bodies: readonly AppearanceBody[] }
