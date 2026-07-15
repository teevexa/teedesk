import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/types';

type State = 'verifying' | 'success' | 'error' | 'missing_token';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<State>(token ? 'verifying' : 'missing_token');
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    authService
      .verifyEmail(token)
      .then(() => setState('success'))
      .catch((err: ApiError) => {
        setError(err.message || 'Verification failed. The link may have expired.');
        setState('error');
      });
  }, [token]);

  const handleResend = async () => {
    setIsResending(true);
    try {
      await authService.resendVerification();
      setResent(true);
    } catch {
      // user may not be logged in — silent fail is acceptable here
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl gradient-text">TeeDesk</span>
        </div>

        <Card className="glass-card border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Email verification</CardTitle>
            <CardDescription>
              {state === 'verifying' && 'Verifying your email address…'}
              {state === 'success' && 'Your email has been verified.'}
              {state === 'error' && 'Verification failed.'}
              {state === 'missing_token' && 'No verification token found.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state === 'verifying' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Please wait…</p>
              </div>
            )}

            {state === 'success' && (
              <div className="flex flex-col items-center gap-4 py-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-sm text-muted-foreground text-center">
                  Your account is now active. You can sign in and start using TeeDesk.
                </p>
                <Link to="/login">
                  <Button className="mt-2">Go to sign in</Button>
                </Link>
              </div>
            )}

            {(state === 'error' || state === 'missing_token') && (
              <div className="flex flex-col items-center gap-4 py-4">
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm text-muted-foreground text-center">
                  {error ?? 'The verification link is invalid or missing. Request a new one below.'}
                </p>
                {resent ? (
                  <p className="text-sm text-green-600 font-medium">
                    A new verification email has been sent.
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleResend}
                    disabled={isResending}
                    className="mt-2"
                  >
                    {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Resend verification email
                  </Button>
                )}
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Back to sign in
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
