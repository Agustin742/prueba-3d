import { useId, useRef, useState, type ReactNode } from 'react';
import type { AvatarConfiguration as BaseAvatarConfiguration } from './avatar-appearance';
import './avatar-customizer.css';

export type AvatarBody = BaseAvatarConfiguration['body'];
export interface AvatarOption { id: string; label: string }
export interface AvatarCatalogue {
  hair: readonly AvatarOption[];
  tops: readonly AvatarOption[];
  accessories: readonly AvatarOption[];
}
export interface AvatarConfiguration extends BaseAvatarConfiguration { nickname: string }
export interface AvatarCustomizerProps extends AvatarConfiguration {
  preview: ReactNode;
  catalogues: Readonly<Record<AvatarBody, AvatarCatalogue>>;
  status: 'ready' | 'loading' | 'unavailable';
  pending?: boolean;
  /** Safe, user-facing error; entry remains blocked until cleared by the owner. */
  error?: string;
  persistenceWarning?: string;
  persistenceNotice?: string;
  onChange: (configuration: AvatarConfiguration) => void;
  onEnter: (configuration: AvatarConfiguration) => void;
}

const hairColors: readonly AvatarOption[] = [
  { id: '#6c4d48', label: 'Castaño' }, { id: '#af6d63', label: 'Cobrizo' },
  { id: '#e5ad58', label: 'Dorado' }, { id: '#353849', label: 'Oscuro' },
  { id: '#c77daa', label: 'Malva' },
];
const clothingColors: readonly AvatarOption[] = [
  { id: '#5b4f96', label: 'Violeta' }, { id: '#75b7da', label: 'Celeste' },
  { id: '#f2c85c', label: 'Amarillo' }, { id: '#efa5ae', label: 'Rosa' },
  { id: '#7eba8b', label: 'Verde' }, { id: '#f4e6d2', label: 'Crema' },
];

function Choice({ label, value, options, onChange, optional = false }: {
  label: string; value: string; options: readonly AvatarOption[];
  onChange: (value: string) => void; optional?: boolean;
}) {
  const valid = options.some(option => option.id === value);
  return <label className="avatar-customizer__field">
    <span>{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} disabled={!optional && options.length === 0}>
      {optional ? <option value="">Sin accesorio</option> : !valid && <option value="" disabled>Elegí una opción</option>}
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </label>;
}

/** Controlled dressing room: the owner supplies approved choices, preview readiness and persistence.
 * Draft changes have no storage or scene side effects; null means no accessory.
 */
export function AvatarCustomizer(props: AvatarCustomizerProps) {
  const { body, hairId, topId, accessoryId, hairColor, clothingColor, nickname,
    catalogues, preview, status, pending, error, persistenceWarning, onChange, onEnter } = props;
  const id = useId();
  const nicknameInput = useRef<HTMLInputElement>(null);
  const [attempted, setAttempted] = useState(false);
  const configuration: AvatarConfiguration = { body, hairId, topId, accessoryId, hairColor, clothingColor, nickname };
  const catalogue = catalogues[body];
  const has = (options: readonly AvatarOption[], value: string) => options.some(option => option.id === value);
  const valid = (value: AvatarConfiguration) => {
    const choices = catalogues[value.body];
    return has(choices.hair, value.hairId) && has(choices.tops, value.topId)
      && (value.accessoryId === null || has(choices.accessories, value.accessoryId))
      && has(hairColors, value.hairColor) && has(clothingColors, value.clothingColor);
  };
  const slotsValid = valid(configuration);
  const blocked = status !== 'ready' || Boolean(pending) || Boolean(error) || !slotsValid;
  const nicknameInvalid = attempted && !nickname.trim();
  const update = (patch: Partial<AvatarConfiguration>) => {
    const next = { ...configuration, ...patch };
    if (!pending && valid(next)) onChange(next);
  };
  const selectBody = (next: AvatarBody) => {
    if (next === body) return;
    const choices = catalogues[next];
    update({ body: next,
      hairId: has(choices.hair, hairId) ? hairId : choices.hair[0]?.id ?? '',
      topId: has(choices.tops, topId) ? topId : choices.tops[0]?.id ?? '',
      accessoryId: accessoryId !== null && has(choices.accessories, accessoryId) ? accessoryId : null });
  };
  const selectedLabel = (options: readonly AvatarOption[], value: string) => options.find(option => option.id === value)?.label;

  return <section className="avatar-customizer" aria-labelledby={`${id}-intro`}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <header className="avatar-customizer__header">
      <strong>Oficina virtual / Bienvenida</strong><span className="avatar-customizer__tag">Tu vestidor</span>
    </header>
    <div className="avatar-customizer__layout">
      <div className="avatar-customizer__intro">
        <span className="avatar-customizer__eyebrow">Antes de entrar</span>
        <h1 id={`${id}-intro`}>Un lugar para vos.<br />Un look bien tuyo.</h1>
        <p>Elegí cómo querés aparecer en la oficina.</p>
        <figure className="avatar-customizer__preview">
          <div className="avatar-customizer__stage" aria-busy={status === 'loading'}>{preview}</div>
          <figcaption>
            <strong className="avatar-customizer__name">{nickname.trim() || 'Tu avatar'}</strong>
            <p>{[selectedLabel(catalogue.hair, hairId), selectedLabel(catalogue.tops, topId),
              accessoryId === null ? 'Sin accesorio' : selectedLabel(catalogue.accessories, accessoryId)].filter(Boolean).join(' · ')}</p>
            <small>Vista previa · Borrador de tu selección</small>
          </figcaption>
        </figure>
      </div>
      <form className="avatar-customizer__panel" aria-labelledby={`${id}-form`} noValidate aria-busy={pending}
        onSubmit={event => {
          event.preventDefault();
          if (pending) return;
          setAttempted(true);
          if (!nickname.trim()) { nicknameInput.current?.focus(); return; }
          if (!blocked) onEnter({ ...configuration, nickname: nickname.trim() });
        }}>
        <h2 id={`${id}-form`}>Armá tu combinación</h2>
        <fieldset disabled={pending}>
          <legend>Modelo de avatar</legend>
          <div className="avatar-customizer__bodies">
            <label><input type="radio" name={`${id}-body`} checked={body === 'female'} onChange={() => selectBody('female')} /> Femenino</label>
            <label><input type="radio" name={`${id}-body`} checked={body === 'male'} onChange={() => selectBody('male')} /> Masculino</label>
          </div>
        </fieldset>
        <fieldset disabled={pending}>
          <legend>Pelo, ropa y accesorios</legend>
          <div className="avatar-customizer__grid">
            <Choice label="Peinado" value={hairId} options={catalogue.hair} onChange={hairId => update({ hairId })} />
            <Choice label="Prenda" value={topId} options={catalogue.tops} onChange={topId => update({ topId })} />
            <Choice label="Accesorio" value={accessoryId ?? ''} options={catalogue.accessories} optional onChange={accessoryId => update({ accessoryId: accessoryId || null })} />
            <small>Un accesorio a la vez.<br />También podés elegir ninguno.</small>
          </div>
        </fieldset>
        <fieldset className="avatar-customizer__colors" disabled={pending}>
          <legend>Sumale color</legend>
          <div className="avatar-customizer__grid">
            <Choice label="Color del pelo" value={hairColor} options={hairColors} onChange={hairColor => update({ hairColor })} />
            <Choice label="Color de la ropa" value={clothingColor} options={clothingColors} onChange={clothingColor => update({ clothingColor })} />
          </div>
        </fieldset>
        <div className="avatar-customizer__entry">
          <label className="avatar-customizer__field" htmlFor={`${id}-nickname`}>¿Cómo te llamás? · Apodo obligatorio</label>
          <input id={`${id}-nickname`} ref={nicknameInput} value={nickname} required disabled={pending} autoComplete="off" placeholder="Tu apodo"
            aria-invalid={nicknameInvalid} aria-describedby={nicknameInvalid ? `${id}-nickname-error` : undefined}
            onChange={event => update({ nickname: event.target.value })} />
          {nicknameInvalid && <p id={`${id}-nickname-error`} role="alert">Escribí tu apodo para continuar.</p>}
          <p className="avatar-customizer__notice">{props.persistenceNotice ?? 'Esta vista no guarda datos por sí sola. El guardado local, cuando esté disponible, será solo en este navegador, no en una cuenta ni entre dispositivos. Al borrar los datos del navegador, se pierde.'}</p>
          {persistenceWarning && <p className="avatar-customizer__notice" role="status">{persistenceWarning}</p>}
          {pending && <p role="status">Preparando tu entrada… Esperá para continuar.</p>}
          {status === 'loading' && <p role="status">Cargando tu avatar… Esperá para entrar.</p>}
          {status === 'unavailable' && <p role="alert">La vista previa no está disponible. Esperá a que esté lista para entrar.</p>}
          {error && <p role="alert">{error}</p>}
          {!slotsValid && status === 'ready' && <p role="alert">Revisá tu selección: elegí opciones disponibles para este modelo.</p>}
          <button className="avatar-customizer__primary" type="submit" disabled={blocked}>Entrar a la oficina →</button>
        </div>
      </form>
    </div>
    <footer className="avatar-customizer__footer">Sin apuro. Elegí lo que te represente.</footer>
  </section>;
}
