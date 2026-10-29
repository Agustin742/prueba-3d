import { Box3, Group, SkinnedMesh, Vector3 } from 'three';
import type { AvatarResource } from '../avatar/load-avatar';

/** Height every avatar is normalized to, with its feet on y=0. */
export const avatarHeight = 2;

/**
 * Measures the posed rig, scales it to `avatarHeight`, centers it on XZ and puts its feet on y=0,
 * then parents it under `root`. Returns the cleanup that restores the original scene placement.
 */
export function frameAvatar(avatar: AvatarResource, root: Group): () => void {
  const originalPosition = avatar.scene.position.clone();
  avatar.update(0); // Evaluate the original clip before measuring skinned posed vertices.
  avatar.scene.updateMatrixWorld(true);
  avatar.scene.traverse(node => { if (node instanceof SkinnedMesh) node.skeleton.update(); });
  const bounds = new Box3().setFromObject(avatar.scene, true);
  const center = bounds.isEmpty() ? new Vector3() : bounds.getCenter(new Vector3());
  const height = bounds.getSize(new Vector3()).y;
  const frame = new Group();
  frame.scale.setScalar(height > 0 ? avatarHeight / height : 1);
  avatar.scene.position.add(new Vector3(-center.x, bounds.isEmpty() ? 0 : -bounds.min.y, -center.z));
  frame.add(avatar.scene);
  root.add(frame);
  return () => {
    frame.remove(avatar.scene); root.remove(frame);
    avatar.scene.position.copy(originalPosition);
    avatar.scene.updateMatrixWorld(true);
  };
}
