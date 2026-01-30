import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export interface NavSection {
  key: string;
  label: string;
}

export interface AppShellProps {
  sections: NavSection[];
  activeKey: string;
  onSelect: (key: string) => void;
  onLogout: () => void;
  userEmail?: string;
  children: ReactNode;
}

export function AppShell({
  sections,
  activeKey,
  onSelect,
  onLogout,
  userEmail,
  children,
}: AppShellProps) {
  return (
    <div className='min-vh-100'>
      <header className='border-bottom bg-white'>
        <div className='container py-3 d-flex align-items-center'>
          <div className='flex-grow-1'>
            <h1 className='h5 mb-1'>Siu Tin Dei Admin</h1>
            <p className='mb-0 text-muted small'>
              Manage organizations, activities, and schedules.
            </p>
          </div>
          <div className='d-flex align-items-center gap-2'>
            {userEmail && <span className='text-muted small'>{userEmail}</span>}
            <Button variant='secondary' onClick={onLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <div className='container py-4'>
        <div className='row g-4'>
          <aside className='col-lg-3'>
            <nav className='nav flex-column nav-pills sidebar'>
              {sections.map((section) => {
                const isActive = section.key === activeKey;
                return (
                  <button
                    key={section.key}
                    type='button'
                    onClick={() => onSelect(section.key)}
                    className={`nav-link text-start ${
                      isActive ? 'active' : 'link-body-emphasis'
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </aside>
          <main className='col-lg-9 d-grid gap-4'>{children}</main>
        </div>
      </div>
    </div>
  );
}
