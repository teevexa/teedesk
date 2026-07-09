import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Plus, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { knowledgeService } from '@/services/knowledge.service';
import { KnowledgeCardSkeleton } from '@/components/shared/SkeletonLoaders';
import { EmptyState } from '@/components/shared/EmptyState';
import { useUIStore } from '@/store';
import { useDebounce } from '@/hooks/use-debounce';

export const KnowledgeBase: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { isBackendConnected } = useUIStore();
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['knowledge', 'search', debouncedQuery, selectedCategory],
    queryFn: () =>
      knowledgeService.search({
        query: debouncedQuery || undefined,
        category: selectedCategory || undefined,
        per_page: 50,
      }),
    enabled: isBackendConnected,
    staleTime: 30_000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['knowledge', 'categories'],
    queryFn: knowledgeService.getCategories,
    enabled: isBackendConnected,
    staleTime: 300_000,
  });

  if (!isBackendConnected) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Knowledge Base Unavailable"
        description="Connect the SupportIQ backend to manage and search your knowledge base articles."
      />
    );
  }

  const articles = data?.data ?? [];
  const categories = categoriesData ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-primary">
          <BookOpen className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold gradient-text">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} articles` : 'Loading articles…'}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="glass-card p-4">
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button className="bg-gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All ({total})
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="text-xs"
                >
                  {cat}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <KnowledgeCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load articles"
          description={(error as any)?.message || 'Could not load knowledge base articles.'}
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      )}

      {!isLoading && !isError && articles.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No articles found"
          description={
            searchQuery
              ? `No articles match "${searchQuery}". Try a different search term.`
              : 'Your knowledge base is empty. Add your first article to get started.'
          }
          action={{ label: 'Create Article', onClick: () => {} }}
        />
      )}

      {!isLoading && articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {articles.map((article) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="glass-card p-4 h-full flex flex-col hover:shadow-glow transition-all duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="secondary" className="text-xs">
                      {article.category}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>

                  <h3 className="font-semibold mb-2 line-clamp-2 text-sm">{article.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4 flex-1 line-clamp-3">
                    {article.content}
                  </p>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                      {article.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{article.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{article.views.toLocaleString()} views</span>
                      <span>{article.helpful_count} helpful</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
