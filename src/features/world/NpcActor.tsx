import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import type { AvatarResource } from '../avatar/load-avatar';
import { createAvatarBillboard } from '../network/AvatarBillboard';
import { frameAvatar } from './frame-avatar';
import { startNpcChatter } from './npc-chatter';
import { npcLines } from './npc-lines';

export interface NpcActorProps {
  npc: AvatarResource;
  /** Floor position as [x, z]. */
  position: readonly [number, number];
  /** Heading in radians; 0 faces +z. */
  yaw: number;
  /** Name shown under the NPC. */
  nickname?: string;
  /** Randomness source for the chatter; injectable for tests. */
  random?: () => number;
}

/** A stationary NPC: framed like the player (height 2, feet on y=0) and animated in place. */
export function NpcActor({ npc, position, yaw, nickname = 'Tchami', random = Math.random }: NpcActorProps) {
  const root = useMemo(() => new Group(), [npc]);
  const [line, setLine] = useState<string | null>(null);

  useLayoutEffect(() => {
    root.name = 'reception-npc-root';
    root.position.set(position[0], 0, position[1]);
    root.rotation.y = yaw;
    return frameAvatar(npc, root);
  }, [npc, root, position[0], position[1], yaw]);

  // Local-only chatter: never sent over the socket nor added to the chat panel.
  useEffect(() => startNpcChatter({
    lines: npcLines,
    random,
    onLine: setLine,
    playGesture: npc.playGesture?.bind(npc),
  }), [npc, random]);

  // Name label plus the current bubble, redrawn whenever the line changes.
  useEffect(() => {
    const billboard = createAvatarBillboard(nickname, line);
    root.add(billboard);
    return () => {
      root.remove(billboard);
      billboard.material.map?.dispose();
      billboard.material.dispose();
    };
  }, [nickname, line, root]);

  useFrame((_, delta) => npc.update(delta));

  return <primitive object={root} dispose={null} />;
}
