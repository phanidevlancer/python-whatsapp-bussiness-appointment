import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileBottomNav from './MobileBottomNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { hasPermission: (permission?: string) => boolean }) => unknown) =>
    selector({
      hasPermission: () => true,
    }),
}));

describe('MobileBottomNav', () => {
  it('renders mobile nav links from shared items', () => {
    render(<MobileBottomNav />);

    expect(screen.getByRole('navigation', { name: /mobile bottom navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /appointments/i })).toBeInTheDocument();
  });

  it('opens more menu for additional sections', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);

    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByText(/all sections/i)).toBeInTheDocument();
  });
});
