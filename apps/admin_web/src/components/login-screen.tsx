import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBanner } from '@/components/status-banner';
import { useAuth } from '@/components/auth-provider';

export function LoginScreen() {
  const { login, configErrors } = useAuth();
  const hasConfigErrors = configErrors.length > 0;

  return (
    <main className='container py-5'>
      <div className='row justify-content-center'>
        <div className='col-lg-6'>
          <Card
            title='Admin sign in'
            description='Sign in with your admin account to manage entries.'
          >
            {hasConfigErrors && (
              <div className='mb-3 d-grid gap-2'>
                {configErrors.map((error) => (
                  <StatusBanner key={error} variant='error' title='Config'>
                    {error}
                  </StatusBanner>
                ))}
              </div>
            )}
            <Button
              type='button'
              onClick={login}
              disabled={hasConfigErrors}
              className='w-100'
            >
              Continue to login
            </Button>
            <p className='mt-3 text-muted small'>
              You must be in the admin group to access management tools.
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
