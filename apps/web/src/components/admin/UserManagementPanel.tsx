import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/use-toast';
import { ApiError, UserRole } from '@/types';

const ASSIGNABLE_ROLES: UserRole[] = ['customer', 'agent', 'support_agent', 'admin', 'super_admin'];

interface UserManagementPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: me } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => userService.list(1, 50),
    enabled: open,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof userService.update>[1] }) =>
      userService.update(id, payload),
    onSuccess: invalidate,
    onError: (err: ApiError) =>
      toast({
        title: 'Update failed',
        description: err?.message || 'Could not update this user.',
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userService.remove(id),
    onSuccess: () => {
      toast({ title: 'User deleted' });
      invalidate();
    },
    onError: (err: ApiError) =>
      toast({
        title: 'Delete failed',
        description: err?.message || 'Only a super admin can delete users.',
        variant: 'destructive',
      }),
  });

  const users = data?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>User Management</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading users…</p>}
          {!isLoading && users.length === 0 && (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}

          {users.map((u) => (
            <div key={u.id} className="glass-card rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                {!u.email_verified && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    Unverified
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <Select
                  value={u.role}
                  onValueChange={(role) =>
                    updateMutation.mutate({ id: u.id, payload: { role: role as UserRole } })
                  }
                  disabled={u.id === me?.id}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch
                    checked={u.is_active}
                    disabled={u.id === me?.id}
                    onCheckedChange={(is_active) =>
                      updateMutation.mutate({ id: u.id, payload: { is_active } })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    disabled={u.id === me?.id}
                    onClick={() => deleteMutation.mutate(u.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
