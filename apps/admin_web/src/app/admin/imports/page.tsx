'use client';

import { AdminDashboard } from '../../../components/admin/admin-dashboard';
import { AuthProvider } from '../../../components/auth-provider';

export default function AdminImportsPage() {
  return (
    <AuthProvider>
      <AdminDashboard initialSection='imports' />
    </AuthProvider>
  );
}
