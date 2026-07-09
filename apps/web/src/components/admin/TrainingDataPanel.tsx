import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Brain, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { adminService, TrainingEntry } from '@/services/admin.service';
import { useToast } from '@/hooks/use-toast';

type VerifiedFilter = 'all' | 'pending' | 'verified';

export const TrainingDataPanel: React.FC = () => {
  const [filter, setFilter] = useState<VerifiedFilter>('all');
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryParams = {
    page,
    size: 15,
    ...(filter === 'pending' ? { is_verified: false } : {}),
    ...(filter === 'verified' ? { is_verified: true } : {}),
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['training-data', filter, page],
    queryFn: () => adminService.getTrainingData(queryParams),
    staleTime: 30_000,
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => adminService.verifyTrainingEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-data'] });
      toast({ title: 'Entry approved', description: 'Marked as verified for next retrain.' });
    },
    onError: () => {
      toast({ title: 'Failed to verify entry', variant: 'destructive' });
    },
  });

  const retrainMutation = useMutation({
    mutationFn: () => adminService.triggerRetrain(),
    onSuccess: (result) => {
      toast({
        title: 'Retrain queued',
        description: `Task ${result.task_id.slice(0, 8)}… dispatched to Celery worker.`,
      });
    },
    onError: () => {
      toast({ title: 'Failed to trigger retrain', variant: 'destructive' });
    },
  });

  const items = data?.items ?? [];
  const hasMore = items.length === 15;

  const sourceLabel = (source: string) => {
    if (source === 'feedback') return <Badge variant="secondary">Feedback</Badge>;
    if (source === 'manual') return <Badge variant="outline">Manual</Badge>;
    return <Badge variant="outline">{source}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Training Data</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review feedback-sourced examples, approve them, then trigger a retrain to update the
            intent classifier.
          </p>
        </div>
        <Button
          onClick={() => retrainMutation.mutate()}
          disabled={retrainMutation.isPending}
          className="gap-2"
        >
          {retrainMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          Retrain Now
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Training Examples</CardTitle>
          <div className="flex items-center gap-2">
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Select
              value={filter}
              onValueChange={(v) => {
                setFilter(v as VerifiedFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Brain className="h-8 w-8 opacity-30" />
              <p className="text-sm">
                {filter === 'pending'
                  ? 'No pending entries. Positive feedback will appear here.'
                  : 'No training data yet.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">User message</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry: TrainingEntry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs max-w-[260px] truncate">
                      {entry.input_text}
                    </TableCell>
                    <TableCell>
                      {entry.labeled_intent ? (
                        <Badge variant="outline" className="text-xs">
                          {entry.labeled_intent}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.labeled_sentiment ?? '—'}
                    </TableCell>
                    <TableCell>{sourceLabel(entry.source)}</TableCell>
                    <TableCell>
                      {entry.is_verified ? (
                        <Badge className="bg-success/20 text-success border-success/30 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!entry.is_verified && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={verifyMutation.isPending}
                          onClick={() => verifyMutation.mutate(entry.id)}
                        >
                          Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {!isLoading && items.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">Page {page}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
