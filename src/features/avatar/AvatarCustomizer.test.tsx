import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AvatarCustomizer, type AvatarConfiguration, type AvatarCustomizerProps } from './AvatarCustomizer';

const options = (labels: string[]) => labels.map((label, index) => ({ id: `${label}-${index}`, label }));
const catalogues: AvatarCustomizerProps['catalogues'] = {
  female: {
    hair: options(['Original femenino', 'Bob', 'Cola alta', 'Rodete', 'Rulos / afro']),
    tops: options(['Remera', 'Buzo con capucha', 'Blusa', 'Musculosa', 'Campera']),
    accessories: options(['Anteojos', 'Gorra', 'Auriculares', 'Aros', 'Cartera']),
  },
  male: {
    hair: options(['Corto clásico', 'Degradado', 'Rulos / afro', 'Rastas', 'Largo atado']),
    tops: options(['Remera', 'Buzo con capucha', 'Camisa', 'Musculosa', 'Campera']),
    accessories: options(['Anteojos redondos', 'Anteojos cuadrados', 'Gorra', 'Auriculares', 'Mochila']),
  },
};
const initial: AvatarConfiguration = {
  body: 'female', hairId: 'Original femenino-0', topId: 'Remera-0', accessoryId: null,
  hairColor: '#6c4d48', clothingColor: '#5b4f96', nickname: '  Sol  ',
};
function setup(overrides: Partial<AvatarCustomizerProps> = {}) {
  const onChange = vi.fn();
  const onEnter = vi.fn();
  function Harness() {
    const [value, setValue] = useState(initial);
    return <AvatarCustomizer {...value} catalogues={catalogues} preview={<div>Vista 3D del padre</div>}
      status="ready" onEnter={onEnter} onChange={next => { onChange(next); setValue(next); }} {...overrides} />;
  }
  return { ...render(<Harness />), onChange, onEnter };
}
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const enter = () => fireEvent.click(screen.getByRole('button', { name: /Entrar a la oficina/ }));

it('renders the supplied preview and approved catalogues as accessible controlled choices', () => {
  const { onChange } = setup();
  expect(screen.getByText('Vista 3D del padre')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Femenino' }).getAttribute('checked')).not.toBeNull();
  for (const [label, count] of [['Peinado', 5], ['Prenda', 5], ['Accesorio', 6]] as const) {
    expect(within(screen.getByLabelText(label)).getAllByRole('option')).toHaveLength(count);
  }
  change('Peinado', 'Bob-1');
  change('Prenda', 'Blusa-2');
  change('Accesorio', 'Aros-3');
  change('Color del pelo', '#c77daa');
  change('Color de la ropa', '#7eba8b');
  expect(onChange).toHaveBeenLastCalledWith({ ...initial, hairId: 'Bob-1', topId: 'Blusa-2', accessoryId: 'Aros-3', hairColor: '#c77daa', clothingColor: '#7eba8b' });
  change('Accesorio', '');
  expect(onChange.mock.lastCall?.[0].accessoryId).toBeNull();
});

it('resets slots to the selected body catalogue defaults and no accessory in both directions', () => {
  const { onChange } = setup();
  change('Accesorio', 'Aros-3');
  fireEvent.click(screen.getByRole('radio', { name: 'Masculino' }));
  expect(onChange).toHaveBeenLastCalledWith({ ...initial, body: 'male', hairId: 'Corto clásico-0', accessoryId: null });
  expect(screen.queryByRole('option', { name: 'Aros' })).toBeNull();
  expect(screen.getByRole('option', { name: 'Mochila' })).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Femenino' }));
  expect(onChange).toHaveBeenLastCalledWith(initial);
});

it('validates whitespace nicknames, focuses the field and enters with the trimmed current configuration', () => {
  const { onEnter } = setup();
  change('¿Cómo te llamás? · Apodo obligatorio', '   ');
  enter();
  const nickname = screen.getByRole('textbox');
  expect(nickname.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(nickname);
  expect(screen.getByRole('alert').textContent).toMatch(/Escribí tu apodo/);
  expect(onEnter).not.toHaveBeenCalled();
  change('¿Cómo te llamás? · Apodo obligatorio', '  Luna  ');
  change('Peinado', 'Bob-1');
  enter();
  expect(onEnter).toHaveBeenCalledExactlyOnceWith({ ...initial, nickname: 'Luna', hairId: 'Bob-1' });
  expect((nickname as HTMLInputElement).value).toBe('  Luna  ');
});

it.each(['loading', 'unavailable'] as const)('blocks entry and announces %s without losing the draft', status => {
  const { onEnter } = setup({ status });
  expect((screen.getByRole('button', { name: /Entrar/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole(status === 'loading' ? 'status' : 'alert').textContent).toMatch(status === 'loading' ? /Cargando/ : /no está disponible/);
  fireEvent.submit(screen.getByRole('form', { name: 'Armá tu combinación' }));
  expect(onEnter).not.toHaveBeenCalled();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(initial.nickname);
});

it('preserves editing on failure and displays an honest optional storage warning', () => {
  const { onChange, onEnter } = setup({ error: 'No pudimos preparar tu avatar. Revisá tu selección.', persistenceWarning: 'El navegador bloqueó el guardado local. Tu selección puede perderse al recargar.' });
  expect(screen.getByRole('alert').textContent).toMatch(/No pudimos preparar/);
  expect(screen.getByText(/El navegador bloqueó/)).toBeTruthy();
  change('Prenda', 'Campera-4');
  expect(onChange.mock.lastCall?.[0].topId).toBe('Campera-4');
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(initial.nickname);
  enter();
  expect(onEnter).not.toHaveBeenCalled();
});

it.each([{ hair: [] }, { hair: [{ id: 'removed-style', label: 'Otro catálogo' }] }])('blocks empty or stale selections without claiming persistence', ({ hair }) => {
  const { onEnter } = setup({ catalogues: { ...catalogues, female: { ...catalogues.female, hair } } });
  expect(screen.getByRole('alert').textContent).toMatch(/opciones disponibles/);
  enter();
  expect(onEnter).not.toHaveBeenCalled();
  expect(screen.queryByText(/se recordará|guardado correctamente/i)).toBeNull();
});

it('keeps the owner as source of truth and submits the complete draft after readiness recovers', () => {
  const onChange = vi.fn();
  const onEnter = vi.fn();
  const props: AvatarCustomizerProps = { ...initial, catalogues, preview: 'Preview', status: 'ready', onChange, onEnter };
  const { rerender } = render(<AvatarCustomizer {...props} />);
  change('Peinado', 'Bob-1');
  expect(onChange).toHaveBeenLastCalledWith({ ...initial, hairId: 'Bob-1' });
  expect((screen.getByLabelText('Peinado') as HTMLSelectElement).value).toBe(initial.hairId);
  const draft = { ...initial, hairId: 'Rodete-3', topId: 'Campera-4', accessoryId: 'Cartera-4', hairColor: '#e5ad58', clothingColor: '#f2c85c' };
  rerender(<AvatarCustomizer {...props} {...draft} status="loading" />);
  rerender(<AvatarCustomizer {...props} {...draft} error="Revisá tu conexión." />);
  expect((screen.getByLabelText('Accesorio') as HTMLSelectElement).value).toBe('Cartera-4');
  rerender(<AvatarCustomizer {...props} {...draft} />);
  fireEvent.submit(screen.getByRole('form', { name: 'Armá tu combinación' }));
  expect(onEnter).toHaveBeenCalledExactlyOnceWith({ ...draft, nickname: 'Sol' });
});

it('isolates bubbling keyboard events from world shortcuts without cancelling native input', () => {
  const worldKey = vi.fn();
  render(<div onKeyDown={worldKey} onKeyUp={worldKey}><AvatarCustomizer {...initial} catalogues={catalogues}
    preview={null} status="ready" onChange={vi.fn()} onEnter={vi.fn()} /></div>);
  const nickname = screen.getByRole('textbox');
  expect(fireEvent.keyDown(nickname, { key: 'w' })).toBe(true);
  fireEvent.keyUp(nickname, { key: 'w' });
  expect(worldKey).not.toHaveBeenCalled();
});
