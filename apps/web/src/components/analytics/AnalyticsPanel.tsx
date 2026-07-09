import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  MessageSquare,
  Heart,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { analyticsService, AnalyticsPeriod } from '@/services/analytics.service';
import { AnalyticsPageSkeleton } from '@/components/shared/SkeletonLoaders';
import { EmptyState } from '@/components/shared/EmptyState';
import { useUIStore } from '@/store';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export const AnalyticsPanel: React.FC = () => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
  const { isBackendConnected } = useUIStore();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics', 'overview', period],
    queryFn: () => analyticsService.getOverview(period),
    enabled: isBackendConnected,
    staleTime: 60_000,
  });

  if (!isBackendConnected) {
    return (
      <div className="p-6">
        <EmptyState
          icon={BarChart3}
          title="Analytics Unavailable"
          description="Connect the SupportIQ backend to see real-time conversation analytics, sentiment trends, and intent distribution."
        />
      </div>
    );
  }

  if (isLoading) return <AnalyticsPageSkeleton />;

  if (isError) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load analytics"
          description={(error as any)?.message || 'An error occurred loading analytics data.'}
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      </div>
    );
  }

  if (!data) return null;

  const totalSentiment =
    data.sentimentDistribution.positive +
      data.sentimentDistribution.negative +
      data.sentimentDistribution.neutral || 1;

  const totalIntents = Object.values(data.intentDistribution).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-primary">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold gradient-text">Analytics</h2>
            <p className="text-sm text-muted-foreground">Real-time conversation insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: MessageSquare,
            value: data.totalMessages,
            label: 'Total Messages',
            color: 'text-primary',
          },
          {
            icon: Heart,
            value: `${data.satisfactionRate}%`,
            label: 'Satisfaction',
            color: 'text-success',
          },
          {
            icon: AlertTriangle,
            value: data.urgentIssues,
            label: 'Urgent Issues',
            color: 'text-warning',
          },
          {
            icon: TrendingUp,
            value: data.totalConversations,
            label: 'Conversations',
            color: 'text-accent',
          },
        ].map(({ icon: Icon, value, label, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="glass-card p-4">
              <div className="flex items-center gap-3">
                <Icon className={`h-8 w-8 ${color}`} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="glass-card p-6">
        <h3 className="text-base font-semibold mb-4">Sentiment Distribution</h3>
        <div className="space-y-3">
          {(
            [
              { key: 'positive', label: 'Positive', colorClass: 'text-success' },
              { key: 'negative', label: 'Negative', colorClass: 'text-destructive' },
              { key: 'neutral', label: 'Neutral', colorClass: 'text-muted-foreground' },
            ] as const
          ).map(({ key, label, colorClass }) => {
            const count = data.sentimentDistribution[key];
            const pct = Math.round((count / totalSentiment) * 100);
            return (
              <div key={key} className="flex items-center gap-4">
                <Badge variant="outline" className={`w-20 justify-center text-xs ${colorClass}`}>
                  {label}
                </Badge>
                <span className="text-sm w-20 text-muted-foreground">{count} msgs</span>
                <Progress value={pct} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="glass-card p-6">
        <h3 className="text-base font-semibold mb-4">Intent Distribution</h3>
        {Object.keys(data.intentDistribution).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No intent data yet for this period.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(data.intentDistribution)
              .sort(([, a], [, b]) => b - a)
              .map(([intent, count]) => {
                const pct = Math.round((count / totalIntents) * 100);
                return (
                  <div
                    key={intent}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {intent.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">{count} messages</p>
                    </div>
                    <Badge variant="secondary">{pct}%</Badge>
                  </div>
                );
              })}
          </div>
        )}
      </Card>
    </div>
  );
};
