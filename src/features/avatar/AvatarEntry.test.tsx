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
it('restores browser preferences and reports save failure to the host without claiming account persistence', () => {
  localStorage.setItem('avatar_nickname', 'Legacy'); const confirm = vi.fn();
  render(<AvatarEntry onConfirm={confirm} />); expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Legacy');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('denied'); });
  act(() => preview.callbacks.at(-1)!('ready')); fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));
  expect(confirm.mock.calls[0][2]).toMatch(/no se guarda en una cuenta/i);
});
