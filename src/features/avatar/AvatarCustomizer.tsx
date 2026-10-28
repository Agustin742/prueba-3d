import { useId, useRef, useState, type ReactNode } from 'react';
import './avatar-customizer.css';

export type AvatarBody = 'male' | 'female';
export interface AvatarOption { id: string; label: string }
export interface AvatarCatalogue {
  hair: readonly AvatarOption[];
  tops: readonly AvatarOption[];
  accessories: readonly AvatarOption[];
}
export interface AvatarConfiguration {
  body: AvatarBody;
  hairId: string;
  topId: string;
  accessoryId: string | null;
  hairColor: string;
  clothingColor: string;
  nickname: string;
}
export interface AvatarCustomizerProps extends AvatarConfiguration {
  preview: ReactNode;
  catalogues: Readonly<Record<AvatarBody, AvatarCatalogue>>;
  status: 'ready' | 'loading' | 'unavailable';
  /** Safe, user-facing error; entry remains blocked until cleared by the owner. */
  error?: string;
  persistenceWarning?: string;
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

/** Controlled dressing room. The owner supplies catalogue order (first hair/top = body defaults),
 * preview readiness, safe feedback and persistence. No storage or scene side effects occur here.
 * Catalogue IDs must be nonempty and unique within each slot; null means no accessory.
 */
export function AvatarCustomizer(props: AvatarCustomizerProps) {
  const { body, hairId, topId, accessoryId, hairColor, clothingColor, nickname,
    catalogues, preview, status, error, persistenceWarning, onChange, onEnter } = props;
  const id = useId();
  const nicknameInput = useRef<HTMLInputElement>(null);
  const [attempted, setAttempted] = useState(false);
  const configuration: AvatarConfiguration = { body, hairId, topId, accessoryId, hairColor, clothingColor, nickname };
  const catalogue = catalogues[body];
  const has = (options: readonly AvatarOption[], value: string) => options.some(option => option.id === value);
  const slotsValid = has(catalogue.hair, hairId) && has(catalogue.tops, topId)
    && (accessoryId === null || has(catalogue.accessories, accessoryId))
    && has(hairColors, hairColor) && has(clothingColors, clothingColor);
  const blocked = status !== 'ready' || Boolean(error) || !slotsValid;
  const nicknameInvalid = attempted && !nickname.trim();
  const update = (patch: Partial<AvatarConfiguration>) => onChange({ ...configuration, ...patch });
  const selectBody = (next: AvatarBody) => {
    if (next === body) return;
    update({ body: next, hairId: catalogues[next].hair[0]?.id ?? '',
      topId: catalogues[next].tops[0]?.id ?? '', accessoryId: null });
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
      <form className="avatar-customizer__panel" aria-labelledby={`${id}-form`} noValidate
        onSubmit={event => {
          event.preventDefault();
          setAttempted(true);
          if (!nickname.trim()) { nicknameInput.current?.focus(); return; }
          if (!blocked) onEnter({ ...configuration, nickname: nickname.trim() });
        }}>
        <h2 id={`${id}-form`}>Armá tu combinación</h2>
        <fieldset>
          <legend>Modelo de avatar</legend>
          <div className="avatar-customizer__bodies">
            <label><input type="radio" name={`${id}-body`} checked={body === 'female'} onChange={() => selectBody('female')} /> Femenino</label>
            <label><input type="radio" name={`${id}-body`} checked={body === 'male'} onChange={() => selectBody('male')} /> Masculino</label>
          </div>
        </fieldset>
        <div className="avatar-customizer__grid">
          <Choice label="Peinado" value={hairId} options={catalogue.hair} onChange={hairId => update({ hairId })} />
          <Choice label="Prenda" value={topId} options={catalogue.tops} onChange={topId => update({ topId })} />
          <Choice label="Accesorio" value={accessoryId ?? ''} options={catalogue.accessories} optional onChange={accessoryId => update({ accessoryId: accessoryId || null })} />
          <small>Un accesorio a la vez.<br />También podés elegir ninguno.</small>
        </div>
        <fieldset className="avatar-customizer__colors">
          <legend>Sumale color</legend>
          <div className="avatar-customizer__grid">
            <Choice label="Color del pelo" value={hairColor} options={hairColors} onChange={hairColor => update({ hairColor })} />
            <Choice label="Color de la ropa" value={clothingColor} options={clothingColors} onChange={clothingColor => update({ clothingColor })} />
          </div>
        </fieldset>
        <div className="avatar-customizer__entry">
          <label className="avatar-customizer__field" htmlFor={`${id}-nickname`}>¿Cómo te llamás? · Apodo obligatorio</label>
          <input id={`${id}-nickname`} ref={nicknameInput} value={nickname} required autoComplete="off" placeholder="Tu apodo"
            aria-invalid={nicknameInvalid} aria-describedby={nicknameInvalid ? `${id}-nickname-error` : undefined}
            onChange={event => update({ nickname: event.target.value })} />
          {nicknameInvalid && <p id={`${id}-nickname-error`} role="alert">Escribí tu apodo para continuar.</p>}
          <p className="avatar-customizer__notice">Esta vista no guarda datos por sí sola. El guardado local, cuando esté disponible, será solo en este navegador, no en una cuenta ni entre dispositivos. Al borrar los datos del navegador, se pierde.</p>
          {persistenceWarning && <p className="avatar-customizer__notice" role="status">{persistenceWarning}</p>}
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
