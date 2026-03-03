'use client';

import { AdminDashboard } from '../../../components/admin/admin-dashboard';
import { AuthGate } from '../../../components/auth-gate';
import { AuthProvider } from '../../../components/auth-provider';

export default function AdminDashboardPage() {
  return (
    <AuthProvider>
      <AuthGate>
        <AdminDashboard />
      </AuthGate>
    </AuthProvider>
  );
}
