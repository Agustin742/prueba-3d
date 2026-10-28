import type { AvatarBody, AvatarCatalogue } from './AvatarCustomizer';

/** Module transforms and skin joint order are read from GLB, not trusted metadata. */
export interface AppearanceAsset {
  id: string;
  label: string;
  path: string;
  slot: 'hair' | 'top' | 'accessory';
  tintMaterials: readonly string[];
  detailMaterials: readonly string[];
}

export interface AppearanceBody {
  id: AvatarBody;
  path: string;
  rigFamily: string;
  hair: readonly AppearanceAsset[];
  tops: readonly AppearanceAsset[];
  accessories: readonly AppearanceAsset[];
}

export interface AppearanceCatalogue {
  version: 1;
  bodies: readonly AppearanceBody[];
}

export type AppearanceChoices = Readonly<Record<AvatarBody, AvatarCatalogue>>;
