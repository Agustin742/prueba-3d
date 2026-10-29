import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AvatarEntry } from './AvatarEntry';
import { appearancePreferenceKey } from './avatar-preferences';
const preview = vi.hoisted(() => ({ callbacks: [] as ((status: 'ready' | 'loading' | 'unavailable') => void)[] }));
vi.mock('./CustomizedAvatarPreview', async importOriginal => ({ ...await importOriginal<object>(), CustomizedAvatarPreview: ({ onStatusChange }: { onStatusChange(status: 'ready' | 'loading' | 'unavailable'): void }) => { preview.callbacks.push(onStatusChange); return <p>Preview</p>; } }));
beforeEach(() => { localStorage.clear(); preview.callbacks = []; });
it('gates entry on current preview, ignores stale callbacks after A/B/A, and saves only explicit confirmation', () => {
  const confirm = vi.fn(); render(<AvatarEntry onConfirm={confirm} />);
  const enter = screen.getByRole('button', { name: /Entrar/ }) as HTMLButtonElement;
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Ada ' } });
  expect(enter.disabled).toBe(true); const old = preview.callbacks.at(-1)!;
  act(() => old('ready')); expect(enter.disabled).toBe(false);
  fireEvent.change(screen.getByLabelText('Peinado'), { target: { value: 'dreads' } });
  fireEvent.change(screen.getByLabelText('Peinado'), { target: { value: 'afro' } });
  act(() => old('ready')); expect(enter.disabled).toBe(true);
  expect(localStorage.getItem(appearancePreferenceKey)).toBeNull();
  act(() => preview.callbacks.at(-1)!('ready')); fireEvent.click(enter);
  expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'Ada', body: 'male' }), expect.objectContaining({ version: 1 }), undefined);
  expect(JSON.parse(localStorage.getItem(appearancePreferenceKey)!).configuration.nickname).toBe('Ada');
  expect(screen.getByText(/cosméticos.*solo.*local/i)).toBeDefined();
});
it('switches body with readiness gating and restores the full confirmed female draft on remount', () => {
  const confirm = vi.fn(); const { unmount } = render(<AvatarEntry onConfirm={confirm} />);
  const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  change('¿Cómo te llamás? · Apodo obligatorio', ' Luna ');
  const maleReady = preview.callbacks.at(-1)!; act(() => maleReady('ready'));
  fireEvent.click(screen.getByRole('radio', { name: 'Femenino' }));
  act(() => maleReady('ready'));
  expect((screen.getByRole('button', { name: /Entrar/ }) as HTMLButtonElement).disabled).toBe(true);
  change('Peinado', 'original'); change('Prenda', 'tshirt'); change('Accesorio', 'earrings');
  change('Color del pelo', '#c77daa'); change('Color de la ropa', '#7eba8b');
  expect(localStorage.getItem(appearancePreferenceKey)).toBeNull();
  act(() => preview.callbacks.at(-1)!('ready')); fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));
  const expected = { body: 'female', hairId: 'original', topId: 'tshirt', accessoryId: 'earrings',
    hairColor: '#c77daa', clothingColor: '#7eba8b', nickname: 'Luna' };
  expect(confirm).toHaveBeenCalledWith(expected, expect.objectContaining({ version: 1 }), undefined);
  unmount(); const write = vi.spyOn(Storage.prototype, 'setItem');
  render(<AvatarEntry onConfirm={confirm} />);
  expect((screen.getByRole('radio', { name: 'Femenino' }) as HTMLInputElement).checked).toBe(true);
  for (const [label, value] of [['Peinado', 'original'], ['Prenda', 'tshirt'], ['Accesorio', 'earrings'],
    ['Color del pelo', '#c77daa'], ['Color de la ropa', '#7eba8b']])
    expect((screen.getByLabelText(label) as HTMLSelectElement).value).toBe(value);
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Luna');
  expect(write).not.toHaveBeenCalled(); write.mockRestore();
});
it('restores browser preferences and reports save failure to the host without claiming account persistence', () => {
  localStorage.setItem('avatar_nickname', 'Legacy'); const confirm = vi.fn();
  render(<AvatarEntry onConfirm={confirm} />); expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Legacy');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('denied'); });
  act(() => preview.callbacks.at(-1)!('ready')); fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));
  expect(confirm.mock.calls[0][2]).toMatch(/no se guarda en una cuenta/i);
});
