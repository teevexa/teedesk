import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { tenantService } from '@/services/tenant.service';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_ROLES, ApiError } from '@/types';

/**
 * Dropdown for switching the active tenant on a session. Only rendered for
 * admin/super_admin users who have access to more than one tenant (their
 * home tenant plus any TenantMembership grants) — a single-tenant user
 * never sees it, so the common case stays uncluttered.
 */
export const TenantSwitcher: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, setAuth } = useAuthStore();

  const isAdmin = user ? ADMIN_ROLES.includes(user.role) : false;

  const { data: tenants = [] } = useQuery({
    queryKey: ['my-tenants'],
    queryFn: () => tenantService.listMyTenants(),
    enabled: isAdmin,
  });

  const switchMutation = useMutation({
    mutationFn: (tenantId: string) => tenantService.switchTenant(tenantId),
    onSuccess: (resp, tenantId) => {
      // Updates the store's token, which the app's WebSocket effect
      // (see pages/Index.tsx, keyed on `token`) picks up automatically to
      // tear down and reconnect with the new tenant-scoped token — the
      // same path an ordinary token refresh already takes.
      setAuth(resp.user, resp.access_token);
      // Every tenant-scoped query (conversations, knowledge base, analytics,
      // admin views, my-tenants itself, ...) is now stale for the new tenant.
      queryClient.invalidateQueries();
      const name = tenants.find((t) => t.id === tenantId)?.name ?? 'tenant';
      toast({ title: `Switched to ${name}` });
    },
    onError: (err: ApiError) =>
      toast({
        title: 'Could not switch tenant',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      }),
  });

  if (!isAdmin || tenants.length <= 1) {
    return null;
  }

  const activeTenantId = user?.tenant_id;

  return (
    <Select
      value={activeTenantId}
      onValueChange={(tenantId) => {
        if (tenantId !== activeTenantId) {
          switchMutation.mutate(tenantId);
        }
      }}
      disabled={switchMutation.isPending}
    >
      <SelectTrigger className="h-8 w-auto min-w-[10rem] gap-2 border-none bg-muted/50 text-xs">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Select tenant" />
      </SelectTrigger>
      <SelectContent align="end">
        {tenants.map((tenant) => (
          <SelectItem key={tenant.id} value={tenant.id}>
            {tenant.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
