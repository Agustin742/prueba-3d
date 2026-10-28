import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNavigationControls } from './use-navigation-controls';

function Controls({ active = true }: { active?: boolean }) {
  const controls = useNavigationControls(active);
  return <><div ref={controls.container} tabIndex={0} aria-label="Navigation" {...controls.events}>
    <span data-testid="position" />
    <input aria-label="Typing" /><button>Other control</button><div contentEditable suppressContentEditableWarning>Editable</div>
  </div><button onClick={() => {
    const state = controls.tick(10);
    screen.getByTestId('position').textContent = JSON.stringify(state);
  }}>Frame</button><button onClick={() => controls.target({ x: 3, y: 0, z: 2 })}>Target</button>
  <button onClick={() => controls.target({ x: 0, y: 0, z: 3 })}>Replacement</button>
  <button onClick={() => controls.target({ x: -2, y: 0, z: -1.5 })}>Blocked</button>
  <button onClick={controls.stop}>Stop</button><p role="status">{controls.feedback}</p></>;
}
const root = () => screen.getByLabelText('Navigation');
const frame = () => { fireEvent.click(screen.getByText('Frame')); return JSON.parse(screen.getByTestId('position').textContent!); };
const key = (value: string, repeat = false) => fireEvent.keyDown(root(), { key: value, repeat });

describe('navigation input arbitration through rendered controls', () => {
  it('moves WASD on world axes, caps resumed dt, and stops on release', () => {
    render(<Controls />); root().focus(); key('w');
    expect(frame().position).toEqual({ x: 0, y: 0, z: 1.75 });
    fireEvent.keyUp(window, { key: 'w' });
    expect(frame().position.z).toBe(1.75);
    key('d'); expect(frame().position.x).toBe(0.25);
  });

  it('normalizes diagonal A/S input through the same collision owner', () => {
    render(<Controls />); root().focus(); key('a'); key('s');
    const { position } = frame();
    expect(position.x).toBeCloseTo(-0.25 / Math.sqrt(2));
    expect(position.z).toBeCloseTo(2 + 0.25 / Math.sqrt(2));
  });

  it('replaces targets, interrupts with manual input, cancels and rejects blocked targets honestly', () => {
    render(<Controls />); root().focus();
    fireEvent.click(screen.getByText('Target')); expect(frame().path.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Replacement')); expect(frame().path.at(-1)).toEqual({ x: 0, y: 0, z: 3 });
    key('a'); const manual = frame(); expect(manual.path).toEqual([]); expect(manual.position.x).toBeLessThan(0.25);
    fireEvent.keyUp(window, { key: 'a' });
    fireEvent.click(screen.getByText('Target')); key('Escape'); expect(frame().path).toEqual([]);
    fireEvent.click(screen.getByText('Target')); fireEvent.click(screen.getByText('Stop')); expect(frame().path).toEqual([]);
    fireEvent.click(screen.getByText('Blocked')); expect(frame().path).toEqual([]);
    expect(screen.getByRole('status').textContent).toMatch(/not reachable/i);
  });

  it.each(['Typing', 'Other control', 'Editable'])('isolates %s and discards held keys/path on UI focus', label => {
    render(<Controls />); root().focus(); key('w');
    const control = label === 'Typing' ? screen.getByLabelText(label) : screen.getByText(label);
    control.focus(); fireEvent.keyDown(control, { key: 'd' });
    expect(frame().position).toEqual({ x: 0, y: 0, z: 2 });
    root().focus(); key('w', true); expect(frame().position.z).toBe(2);
    key('w'); expect(frame().position.z).toBe(1.75);
  });

  it('UI pointer activation cancels held movement even when the control does not take focus', () => {
    render(<Controls />); root().focus(); key('w');
    fireEvent.pointerDown(screen.getByText('Other control'));
    expect(frame().position.z).toBe(2);
  });

  it('clears on blur, hidden document, inactive controls and modal insertion; never resumes old intent', () => {
    const { rerender } = render(<Controls />); root().focus(); key('w');
    fireEvent.blur(window); expect(frame().position.z).toBe(2);
    key('w', true); expect(frame().position.z).toBe(2);
    key('w'); fireEvent(document, new Event('visibilitychange')); expect(frame().position.z).toBe(2);
    fireEvent.click(screen.getByText('Target')); expect(frame().path.length).toBeGreaterThan(0);
    const beforeSwitch = frame().position.z;
    rerender(<Controls active={false} />);
    expect(frame().path).toEqual([]);
    rerender(<Controls />); root().focus(); expect(frame().position.z).toBe(beforeSwitch);
    key('w'); const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); document.body.append(dialog);
    expect(frame().position.z).toBe(beforeSwitch); dialog.remove();
    key('w', true); expect(frame().position.z).toBe(beforeSwitch);
  });
});
