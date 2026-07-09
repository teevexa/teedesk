import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, BarChart3, Settings, BookOpen, LogOut, User } from 'lucide-react';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth.store';
import { AppTab } from '@/store/ui.store';
import { ApiStatusBanner } from '@/components/shared/ApiStatusBanner';
import { AGENT_ROLES, ADMIN_ROLES, UserRole } from '@/types';

interface AppLayoutProps {
  chatPanel: React.ReactNode;
  analyticsPanel: React.ReactNode;
  knowledgePanel: React.ReactNode;
  adminPanel: React.ReactNode;
}

const ALL_TABS: { value: AppTab; label: string; icon: React.ElementType; minRole?: UserRole[] }[] = [
  { value: 'chat', label: 'Support Chat', icon: MessageCircle },
  { value: 'analytics', label: 'Analytics', icon: BarChart3, minRole: AGENT_ROLES },
  { value: 'knowledge', label: 'Knowledge Base', icon: BookOpen, minRole: AGENT_ROLES },
  // Agents see "Queue" label; admins see "Admin" — same tab, content differs based on role
  { value: 'admin', label: 'Dashboard', icon: Settings, minRole: AGENT_ROLES },
];

const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  agent: 'Agent',
  support_agent: 'Support Agent',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

function initials(name?: string, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return (email?.[0] ?? '?').toUpperCase();
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  chatPanel,
  analyticsPanel,
  knowledgePanel,
  adminPanel,
}) => {
  const { activeTab, setActiveTab } = useUIStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const visibleTabs = ALL_TABS.filter(
    ({ minRole }) => !minRole || (user && minRole.includes(user.role))
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen bg-gradient-secondary flex flex-col">
      <ApiStatusBanner />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AppTab)}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Navigation Header */}
        <div className="glass-card border-0 border-b rounded-none flex-shrink-0">
          <div className="flex items-center px-4">
            {/* Brand */}
            <div className="flex items-center gap-2 mr-6 py-4">
              <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm gradient-text">SupportIQ</span>
            </div>

            <TabsList className="bg-transparent gap-1 h-16 p-0 flex-1">
              {visibleTabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* User menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 ml-4 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors outline-none">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground">
                        {initials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-xs font-medium leading-none">
                        {user.name || user.email}
                      </span>
                      <span className="text-xs text-muted-foreground leading-none mt-0.5">
                        {ROLE_LABELS[user.role]}
                      </span>
                    </div>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-0.5">
                      <span className="text-sm font-medium">{user.name || 'User'}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Content Panels */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="chat" className="h-full m-0 overflow-hidden">
            {chatPanel}
          </TabsContent>
          <TabsContent value="analytics" className="h-full m-0 overflow-auto">
            {analyticsPanel}
          </TabsContent>
          <TabsContent value="knowledge" className="h-full m-0 overflow-auto p-6">
            {knowledgePanel}
          </TabsContent>
          <TabsContent value="admin" className="h-full m-0 overflow-auto p-6">
            {adminPanel}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
