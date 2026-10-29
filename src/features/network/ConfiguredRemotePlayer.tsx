import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Group, MathUtils, SkinnedMesh, Vector3 } from 'three';
import catalogueData from '../../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue } from '../avatar/avatar-catalogue';
import { validateAvatarConfiguration } from '../avatar/avatar-preferences';
import { loadCustomizedAvatar } from '../avatar/load-customized-avatar';
import type { AvatarResource } from '../avatar/load-avatar';
import type { RemotePlayerProps } from './RemotePlayer';
import { createAvatarBillboard } from './AvatarBillboard';

const catalogue = parseAppearanceCatalogue(catalogueData);

export function ConfiguredRemotePlayer({ appearance, nickname, position, rotation, animation, bubbleText, fallback }: RemotePlayerProps & { fallback: ReactNode }) {
  const root = useMemo(() => new Group(), []);
  const owned = useRef<AvatarResource | null>(null);
  const initialized = useRef(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  // Socket snapshots may recreate objects. Movement/nickname updates must not reload a rig.
  const configuration = validateAvatarConfiguration(appearance, catalogue);
  const selection = JSON.stringify(configuration);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const change = () => setReducedMotion(media.matches);
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    root.position.set(position[0], 0, position[2]); root.rotation.y = rotation;
    initialized.current = true;
  }, [root, position, rotation]);

  useEffect(() => {
    const billboard = createAvatarBillboard(nickname || 'Compañero', bubbleText, false);
    root.add(billboard);
    return () => {
      root.remove(billboard); billboard.material.map?.dispose(); billboard.material.dispose();
    };
  }, [root, nickname, bubbleText]);

  useEffect(() => {
    let obsolete = false;
    let resource: AvatarResource | null = null;
    let frame: Group | null = null;
    const release = () => {
      if (owned.current === resource) owned.current = null;
      if (resource) {
        frame?.remove(resource.scene);
        if (frame) root.remove(frame);
        resource.dispose(); resource = null;
      }
    };
    setFailed(false);
    const selected = selection === 'null' ? null : validateAvatarConfiguration(JSON.parse(selection), catalogue);
    if (!selected) { setFailed(true); return; }
    loadCustomizedAvatar(selected, catalogue, reducedMotion).then(avatar => {
      if (obsolete) { avatar.dispose(); return; }
      resource = avatar;
      avatar.update(0);
      avatar.scene.updateMatrixWorld(true);
      avatar.scene.traverse(node => { if (node instanceof SkinnedMesh) node.skeleton.update(); });
      const bounds = new Box3().setFromObject(avatar.scene, true);
      const center = bounds.isEmpty() ? new Vector3() : bounds.getCenter(new Vector3());
      const height = bounds.getSize(new Vector3()).y;
      frame = new Group(); frame.scale.setScalar(height > 0 ? 2 / height : 1);
      avatar.scene.position.add(new Vector3(-center.x, bounds.isEmpty() ? 0 : -bounds.min.y, -center.z));
      frame.add(avatar.scene); root.add(frame); owned.current = avatar;
    }).catch(() => {
      release();
      if (!obsolete) setFailed(true);
    });
    return () => { obsolete = true; release(); };
  }, [root, selection, reducedMotion]);

  useFrame((_, delta) => {
    root.position.x = MathUtils.lerp(root.position.x, position[0], 0.25);
    root.position.z = MathUtils.lerp(root.position.z, position[2], 0.25);
    const diff = Math.atan2(Math.sin(rotation - root.rotation.y), Math.cos(rotation - root.rotation.y));
    root.rotation.y += MathUtils.clamp(diff, -delta * 8, delta * 8);
    owned.current?.setMoving?.(animation === 'walk' || animation === 'run');
    owned.current?.update(Math.min(delta, 0.1));
  });

  return failed ? fallback : <primitive object={root} dispose={null} />;
}
