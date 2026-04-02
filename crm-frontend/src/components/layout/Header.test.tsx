import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => vi.fn(),
}));

vi.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    themeId: 'default',
    setThemeId: vi.fn(),
    themes: [{ id: 'default', label: 'Default' }],
    appearancePreference: 'system',
    setAppearancePreference: vi.fn(),
  }),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { name: string } }) => unknown) =>
    selector({ user: { name: 'Admin User' } }),
}));

describe('Header responsive behavior', () => {
  it('calls menu action when mobile trigger is clicked', async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();

    render(<Header onMenuClick={onMenuClick} />);

    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });
});
