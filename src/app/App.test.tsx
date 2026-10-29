import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import manifest from '../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue } from '../features/avatar/avatar-catalogue';
import { defaultAvatarConfiguration } from '../features/avatar/avatar-preferences';
import { App } from './App';
const host = vi.hoisted(() => ({ reception: vi.fn() }));
vi.mock('../features/avatar/AvatarEntry', () => ({ AvatarEntry: ({ onConfirm }: { onConfirm: (...args: unknown[]) => void }) => <button onClick={() => onConfirm({ ...defaultAvatarConfiguration(parseAppearanceCatalogue(manifest)), nickname: 'Ada' }, parseAppearanceCatalogue(manifest), 'Browser unavailable')}>Confirm wardrobe</button> }));
vi.mock('../features/world/ReceptionPreview', () => ({ ReceptionPreview: (props: unknown) => { host.reception(props); return <p>Reception canvas</p>; } }));
it('waits for confirmation then wires only the local configuration and catalogue into the existing multiplayer reception', () => {
  render(<App />); expect(screen.queryByText('Reception canvas')).toBeNull();
  fireEvent.click(screen.getByText('Confirm wardrobe'));
  expect(screen.getByText('Reception canvas')).toBeDefined();
  expect(host.reception).toHaveBeenLastCalledWith(expect.objectContaining({ multiplayer: true, configuration: expect.objectContaining({ nickname: 'Ada' }), catalogue: expect.objectContaining({ version: 1 }) }));
  expect(screen.getByText('Browser unavailable')).toBeDefined();
  expect(screen.queryByRole('button', { name: /Avatar calibration/i })).toBeNull();
});
