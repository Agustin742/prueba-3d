import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { CustomizedAvatarPreviewProps } from './CustomizedAvatarPreview';
import * as preferences from './avatar-preferences';
import { AvatarEntry } from './AvatarEntry';

const preview = vi.hoisted(() => ({ requests: [] as CustomizedAvatarPreviewProps[] }));
vi.mock('./CustomizedAvatarPreview', async importOriginal => {
  const original = await importOriginal<typeof import('./CustomizedAvatarPreview')>();
  return { ...original, CustomizedAvatarPreview: (props: CustomizedAvatarPreviewProps) => {
    preview.requests.push(props);
    return <>
      <button onClick={() => props.onStatusChange('ready')}>Render selected avatar</button>
      <button onClick={() => props.onStatusChange('unavailable')}>Preview failed</button>
    </>;
  } };
});
beforeEach(() => {
  localStorage.clear();
  preview.requests = [];
});
const entryButton = () => screen.getByRole('button', { name: /Entrar a la oficina/ }) as HTMLButtonElement;
const renderFrame = () => fireEvent.click(screen.getByText('Render selected avatar'));
const nickname = () => screen.getByLabelText(/Apodo obligatorio/) as HTMLInputElement;

it('shows the entry every visit with legacy nickname filled but never auto-confirms or saves a draft', () => {
  localStorage.setItem('avatar_nickname', 'Luz');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const load = vi.spyOn(preferences, 'loadAvatarPreferences');
  const confirmed = vi.fn();
  render(<AvatarEntry onConfirm={confirmed} />);
  expect(nickname().value).toBe('Luz');
  expect(entryButton().disabled).toBe(true);
  fireEvent.change(nickname(), { target: { value: 'Sol' } });
  fireEvent.change(screen.getByLabelText('Peinado'), { target: { value: 'fade' } });
  expect(load).toHaveBeenCalledTimes(1);
  expect(write).not.toHaveBeenCalled();
  expect(confirmed).not.toHaveBeenCalled();
});
it('saves field-only preferences through the helper only on confirmed entry after rendering', () => {
  const save = vi.spyOn(preferences, 'saveAvatarPreferences');
  const confirmed = vi.fn();
  render(<AvatarEntry onConfirm={confirmed} />);
  fireEvent.change(nickname(), { target: { value: '  Sol  ' } });
  fireEvent.click(entryButton());
  expect(save).not.toHaveBeenCalled();
  renderFrame();
  fireEvent.click(entryButton());
  expect(save).toHaveBeenCalledOnce();
  const saved = JSON.parse(localStorage.getItem(preferences.appearancePreferenceKey)!);
  expect(Object.keys(saved.configuration).sort()).toEqual(['accessoryId', 'body', 'clothingColor', 'hairColor', 'hairId', 'nickname', 'topId']);
  expect(saved.configuration.nickname).toBe('Sol');
  expect(confirmed).toHaveBeenCalledWith(saved.configuration, expect.objectContaining({ version: 1 }), undefined);
  expect(localStorage.getItem('avatar_nickname')).toBeNull();
});
it('restores remembered appearance and nickname on a fresh mount without bypassing preview', () => {
  const confirmed = vi.fn();
  const first = render(<AvatarEntry onConfirm={confirmed} />);
  fireEvent.click(screen.getByLabelText('Femenino'));
  fireEvent.change(screen.getByLabelText('Peinado'), { target: { value: 'bob' } });
  fireEvent.change(screen.getByLabelText('Accesorio'), { target: { value: 'earrings' } });
  fireEvent.change(nickname(), { target: { value: 'Luz' } });
  renderFrame();
  fireEvent.click(entryButton());
  first.unmount();
  confirmed.mockClear();
  render(<AvatarEntry onConfirm={confirmed} />);
  expect((screen.getByLabelText('Femenino') as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText('Peinado') as HTMLSelectElement).value).toBe('bob');
  expect((screen.getByLabelText('Accesorio') as HTMLSelectElement).value).toBe('earrings');
  expect(nickname().value).toBe('Luz');
  expect(entryButton().disabled).toBe(true);
  expect(confirmed).not.toHaveBeenCalled();
});
it('invalidates readiness immediately on choice changes and ignores obsolete preview callbacks', () => {
  render(<AvatarEntry onConfirm={vi.fn()} />);
  renderFrame();
  const obsolete = preview.requests.at(-1)!;
  fireEvent.change(screen.getByLabelText('Peinado'), { target: { value: 'fade' } });
  expect(entryButton().disabled).toBe(true);
  act(() => obsolete.onStatusChange('ready'));
  expect(entryButton().disabled).toBe(true);
  renderFrame();
  expect(entryButton().disabled).toBe(false);
  fireEvent.change(nickname(), { target: { value: 'Luz' } });
  expect(entryButton().disabled).toBe(false);
});
it('requires a fresh frame when returning to an earlier choice and rejects its previous readiness callback', () => {
  render(<AvatarEntry onConfirm={vi.fn()} />);
  renderFrame();
  const obsolete = preview.requests.at(-1)!;
  fireEvent.change(screen.getByLabelText('Peinado'), { target: { value: 'fade' } });
  fireEvent.change(screen.getByLabelText('Peinado'), { target: { value: 'classic-short' } });
  expect(entryButton().disabled).toBe(true);
  act(() => obsolete.onStatusChange('ready'));
  expect(entryButton().disabled).toBe(true);
  renderFrame();
  expect(entryButton().disabled).toBe(false);
});
it('blocks confirmation on preview failure and keeps the draft available', () => {
  const confirmed = vi.fn();
  render(<AvatarEntry onConfirm={confirmed} />);
  fireEvent.change(nickname(), { target: { value: 'Sol' } });
  renderFrame();
  fireEvent.click(screen.getByText('Preview failed'));
  expect(entryButton().disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toMatch(/vista previa/);
  expect(nickname().value).toBe('Sol');
  fireEvent.click(entryButton());
  expect(confirmed).not.toHaveBeenCalled();
});
it('continues the confirmed in-memory session with an honest warning if storage cannot write', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  const confirmed = vi.fn();
  render(<AvatarEntry onConfirm={confirmed} />);
  fireEvent.change(nickname(), { target: { value: 'Sol' } });
  renderFrame();
  fireEvent.click(entryButton());
  expect(confirmed).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'Sol' }), expect.any(Object), expect.stringMatching(/No pudimos guardar/));
  expect(screen.getByText(/No pudimos guardar/)).toBeDefined();
  expect(screen.queryByText(/guardada con éxito/i)).toBeNull();
});
it('keeps read failure visible and never attempts a repair write while editing', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  render(<AvatarEntry onConfirm={vi.fn()} />);
  expect(screen.getByText(/No pudimos guardar o recuperar/)).toBeDefined();
  fireEvent.change(nickname(), { target: { value: 'Sol' } });
  expect(write).not.toHaveBeenCalled();
});
