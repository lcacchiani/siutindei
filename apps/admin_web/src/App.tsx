import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { AuthProvider } from '@/components/auth-provider';
import { AuthCallbackPage } from '@/routes/auth-callback';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path='/auth/callback' element={<AuthCallbackPage />} />
        <Route path='/' element={<AdminDashboard />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </AuthProvider>
  );
}
