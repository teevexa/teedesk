import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export const MessageSkeleton: React.FC = () => (
  <div className="flex gap-3">
    <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
    <div className="space-y-2 flex-1">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

export const ConversationCardSkeleton: React.FC = () => (
  <Card className="glass-card p-4">
    <div className="flex justify-between mb-2">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    <Skeleton className="h-3 w-3/4 mb-2" />
    <div className="flex justify-between">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  </Card>
);

export const AnalyticsCardSkeleton: React.FC = () => (
  <Card className="glass-card p-4">
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded-md" />
      <div className="space-y-1">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  </Card>
);

export const KnowledgeCardSkeleton: React.FC = () => (
  <Card className="glass-card p-4">
    <div className="flex justify-between mb-3">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-5" />
    </div>
    <Skeleton className="h-4 w-3/4 mb-2" />
    <Skeleton className="h-3 w-full mb-1" />
    <Skeleton className="h-3 w-5/6 mb-4" />
    <div className="flex gap-1">
      <Skeleton className="h-5 w-12 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  </Card>
);

export const AnalyticsPageSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <AnalyticsCardSkeleton key={i} />
      ))}
    </div>
    <Card className="glass-card p-6">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  </div>
);
