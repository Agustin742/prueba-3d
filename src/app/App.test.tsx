import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { App } from './App';
vi.mock('../features/avatar/AvatarPreview', () => ({ AvatarPreview: () => <p>Original calibration canvas</p> }));
vi.mock('../features/world/ReceptionPreview', () => ({ ReceptionPreview: () => <p>Reception canvas</p> }));
  it('renders the reception scene directly without extra navigation tabs or disclaimers', () => {
    render(<App />);
    expect(screen.getByText('Reception canvas')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Avatar calibration/i })).toBeNull();
  });
