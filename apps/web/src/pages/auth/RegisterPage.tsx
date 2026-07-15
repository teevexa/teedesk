import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/types';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    tenant_name: '',
    tenant_slug: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'tenant_name') {
        next.tenant_slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl gradient-text">TeeDesk</span>
        </div>

        <Card className="glass-card border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Create workspace</CardTitle>
            <CardDescription>Set up your team's TeeDesk account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Workspace info */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="tenant_name">Workspace name</Label>
                  <Input
                    id="tenant_name"
                    placeholder="Acme Corp"
                    value={form.tenant_name}
                    onChange={set('tenant_name')}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenant_slug">
                    Workspace URL{' '}
                    <span className="text-muted-foreground text-xs font-normal">
                      (letters, numbers, hyphens)
                    </span>
                  </Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">teedesk.app/</span>
                    <Input
                      id="tenant_slug"
                      placeholder="acme-corp"
                      value={form.tenant_slug}
                      onChange={set('tenant_slug')}
                      pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]"
                      required
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Account info */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={set('name')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@acmecorp.com"
                    value={form.email}
                    onChange={set('email')}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password{' '}
                    <span className="text-muted-foreground text-xs font-normal">
                      (8+ chars, upper, lower, number)
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={set('password')}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create workspace
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
