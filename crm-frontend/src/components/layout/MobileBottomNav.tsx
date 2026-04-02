'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Grid2x2, Settings } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { NAV_ITEMS } from './Sidebar';
import { PERMISSIONS } from '@/lib/permissions';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/Modal';

const MOBILE_NAV_PRIMARY_ITEMS = 4;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const visibleItems = NAV_ITEMS
    .filter((item) => !item.permission || hasPermission(item.permission))
    .map((item) => ({ ...item }));
  const moreItems = visibleItems.slice(MOBILE_NAV_PRIMARY_ITEMS);

  if (hasPermission(PERMISSIONS.settings.view)) {
    moreItems.push({
      href: '/settings',
      label: 'Settings',
      icon: Settings,
      permission: PERMISSIONS.settings.view,
    });
  }

  const primaryItems = visibleItems.slice(0, MOBILE_NAV_PRIMARY_ITEMS);
  const moreIsActive = moreItems.some((item) =>
    pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
  );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur lg:hidden"
        style={{ borderColor: 'var(--border-light)' }}
        aria-label="Mobile bottom navigation"
      >
        <ul className="grid grid-cols-5 gap-1">
          {primaryItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    'flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium',
                    active ? 'text-primary-700' : 'text-slate-500'
                  )}
                  style={active ? { background: 'var(--primary-50)' } : undefined}
                >
                  <Icon size={16} />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              className={clsx(
                'flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium',
                moreIsActive ? 'text-primary-700' : 'text-slate-500'
              )}
              style={moreIsActive ? { background: 'var(--primary-50)' } : undefined}
            >
              <Grid2x2 size={16} />
              <span className="truncate">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Modal isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} size="md">
        <ModalHeader>
          <ModalTitle>All sections</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="grid grid-cols-1 gap-2">
            {moreItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-colors',
                    active ? 'text-primary-700' : 'text-slate-700'
                  )}
                  style={{
                    borderColor: 'var(--border-light)',
                    background: active ? 'var(--primary-50)' : 'var(--surface-container-lowest)',
                  }}
                  onClick={() => setIsMoreOpen(false)}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
