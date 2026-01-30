import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { StatusBanner } from '@/components/status-banner';
import { completeLogin } from '@/lib/auth';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const finishLogin = async () => {
      try {
        await completeLogin();
        navigate('/', { replace: true });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to complete login.';
        setErrorMessage(message);
      }
    };

    finishLogin();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (errorMessage) {
    return (
      <main className='container py-5'>
        <StatusBanner variant='error' title='Login failed'>
          {errorMessage}
        </StatusBanner>
      </main>
    );
  }

  return (
      <main className='container py-5'>
        <StatusBanner variant='info' title='Signing you in...'>
        Completing your admin session.
      </StatusBanner>
    </main>
  );
}
