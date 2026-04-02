import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: {
    hasPermission: (permission?: string) => boolean;
    user: { name: string; email: string };
  }) => unknown) =>
    selector({
      hasPermission: () => true,
      user: { name: 'Admin User', email: 'admin@example.com' },
    }),
}));

describe('Sidebar responsive behavior', () => {
  it('renders as desktop-only sidebar shell', () => {
    render(<Sidebar />);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar.className).toContain('hidden');
    expect(sidebar.className).toContain('lg:flex');
  });
});
