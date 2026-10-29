import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import manifest from '../../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue, toAppearanceChoices } from './avatar-catalogue';
import { AvatarCustomizer, type AvatarCustomizerProps } from './AvatarCustomizer';
import { defaultAvatarConfiguration } from './avatar-preferences';

const catalogue = parseAppearanceCatalogue(manifest);
const catalogues = toAppearanceChoices(catalogue);
const initial = { ...defaultAvatarConfiguration(catalogue), nickname: '  Sol  ' };
function setup(overrides: Partial<AvatarCustomizerProps> = {}) {
  const onChange = vi.fn(), onEnter = vi.fn();
  function Harness() {
    const [value, setValue] = useState(initial);
    return <AvatarCustomizer {...value} catalogues={catalogues} preview={<div>Vista 3D del padre</div>}
      status="ready" onEnter={onEnter} onChange={next => { onChange(next); setValue(next); }} {...overrides} />;
  }
  return { ...render(<Harness />), onChange, onEnter };
}
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.submit(screen.getByRole('form', { name: 'Armá tu combinación' }));
it('retains the preview and native choices for only the nine approved original-avatar modules', () => {
  const { onChange } = setup();
  expect(screen.getByText('Vista 3D del padre')).toBeTruthy();
  expect(screen.queryByRole('radio')).toBeNull();
  for (const [label, count] of [['Peinado', 2], ['Prenda', 2], ['Accesorio', 6]] as const)
    expect(within(screen.getByLabelText(label)).getAllByRole('option')).toHaveLength(count);
  for (const name of ['Femenino', 'Bob', 'Remera', 'Aros', 'Campera']) expect(screen.queryByRole('option', { name })).toBeNull();
  change('Peinado', 'dreads'); change('Prenda', 'tank'); change('Accesorio', 'backpack');
  change('Color del pelo', '#c77daa'); change('Color de la ropa', '#7eba8b');
  expect(onChange).toHaveBeenLastCalledWith({ ...initial, hairId: 'dreads', topId: 'tank', accessoryId: 'backpack', hairColor: '#c77daa', clothingColor: '#7eba8b' });
  change('Accesorio', ''); expect(onChange.mock.lastCall?.[0].accessoryId).toBeNull();
});
it('focuses blank nickname errors and confirms the trimmed draft without writing storage', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const { onEnter } = setup(); change('¿Cómo te llamás? · Apodo obligatorio', ' '); submit();
  expect(document.activeElement).toBe(screen.getByRole('textbox'));
  expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  expect(onEnter).not.toHaveBeenCalled();
  change('¿Cómo te llamás? · Apodo obligatorio', '  Luna  '); submit();
  expect(onEnter).toHaveBeenCalledExactlyOnceWith({ ...initial, nickname: 'Luna' });
  expect(write).not.toHaveBeenCalled(); write.mockRestore();
});
it.each([{ status: 'loading' as const }, { status: 'unavailable' as const }, { error: 'Revisá tu selección.' }, { pending: true }, { hairId: 'bob' }])('gates entry and retains the draft for %j', patch => {
  const { onEnter } = setup(patch); submit();
  expect((screen.getByRole('button', { name: /Entrar/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(onEnter).not.toHaveBeenCalled();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(initial.nickname);
  expect(screen.getAllByRole(patch.status === 'loading' || patch.pending ? 'status' : 'alert').length).toBeGreaterThan(0);
});
it('keeps owner-controlled values and resumes confirmation after readiness recovers', () => {
  const onChange = vi.fn(), onEnter = vi.fn();
  const props: AvatarCustomizerProps = { ...initial, catalogues, preview: null, status: 'ready', onChange, onEnter };
  const { rerender } = render(<AvatarCustomizer {...props} />);
  change('Peinado', 'dreads'); expect((screen.getByLabelText('Peinado') as HTMLSelectElement).value).toBe('afro');
  rerender(<AvatarCustomizer {...props} hairId="dreads" status="loading" />);
  rerender(<AvatarCustomizer {...props} hairId="dreads" />); submit();
  expect(onEnter).toHaveBeenCalledWith({ ...initial, hairId: 'dreads', nickname: 'Sol' });
});
it.each([{ hair: [] }, { hair: [{ id: 'removed', label: 'Otro catálogo' }] }])('blocks empty or stale catalogue selections', ({ hair }) => {
  const { onEnter } = setup({ catalogues: { male: { ...catalogues.male, hair } } }); submit();
  expect(screen.getByRole('alert').textContent).toMatch(/opciones disponibles/);
  expect(onEnter).not.toHaveBeenCalled();
});
it('preserves editing on failure and displays honest storage feedback', () => {
  const { onChange } = setup({ error: 'Revisá tu selección.', persistenceWarning: 'No pudimos guardar en este navegador.' });
  change('Prenda', 'tank'); expect(onChange.mock.lastCall?.[0].topId).toBe('tank');
  expect(screen.getByRole('status').textContent).toMatch(/este navegador/);
});
it('disables native controls while confirmation is pending', () => {
  setup({ pending: true });
  expect(screen.getByRole('textbox').matches(':disabled')).toBe(true);
  for (const choice of screen.getAllByRole('combobox')) expect(choice.matches(':disabled')).toBe(true);
});
it('isolates world keyboard shortcuts without cancelling native input', () => {
  const worldKey = vi.fn();
  render(<div onKeyDown={worldKey} onKeyUp={worldKey}><AvatarCustomizer {...initial} catalogues={catalogues} preview={null} status="ready" onChange={vi.fn()} onEnter={vi.fn()} /></div>);
  expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'w' })).toBe(true);
  fireEvent.keyUp(screen.getByRole('textbox'), { key: 'w' }); expect(worldKey).not.toHaveBeenCalled();
});
