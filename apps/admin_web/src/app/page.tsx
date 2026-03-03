'use client';

import { AuthGate } from '../components/auth-gate';
import { AuthProvider } from '../components/auth-provider';
import { LoginScreen } from '../components/login-screen';

export default function HomePage() {
  return (
    <AuthProvider>
      <AuthGate requireAuth={false}>
        <LoginScreen />
      </AuthGate>
    </AuthProvider>
  );
}
