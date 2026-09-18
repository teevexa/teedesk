import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Upload, ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import { knowledgeService } from '@/services/knowledge.service';
import { useToast } from '@/hooks/use-toast';
import { ApiError, KnowledgeArticle } from '@/types';

interface ArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when viewing/editing an existing article; absent when creating a new one. */
  article?: KnowledgeArticle | null;
}

export const ArticleDialog: React.FC<ArticleDialogProps> = ({ open, onOpenChange, article }) => {
  const isEditing = !!article;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(article?.title ?? '');
      setContent(article?.content ?? '');
      setCategory(article?.category ?? '');
      setTags(article?.tags?.join(', ') ?? '');
      setIsPublished(article?.is_published ?? true);
      setUploadFile(null);
    }
  }, [open, article]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['knowledge'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (isEditing && article) {
        return knowledgeService.update(article.id, {
          title,
          content,
          category: category || undefined,
          tags: tagList,
          is_published: isPublished,
        });
      }
      return knowledgeService.create({
        title,
        content,
        category: category || undefined,
        tags: tagList,
        is_published: isPublished,
      });
    },
    onSuccess: () => {
      toast({ title: isEditing ? 'Article updated' : 'Article created' });
      invalidate();
      onOpenChange(false);
    },
    onError: (err: ApiError) => {
      toast({
        title: 'Save failed',
        description: err?.message || 'Could not save this article.',
        variant: 'destructive',
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Choose a PDF or DOCX file first');
      return knowledgeService.uploadDocument(uploadFile, {
        title: title || undefined,
        category: category || undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      toast({ title: 'Document imported into knowledge base' });
      invalidate();
      onOpenChange(false);
    },
    onError: (err: ApiError) => {
      toast({
        title: 'Upload failed',
        description: err?.message || 'Could not import this document.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!article) return;
      return knowledgeService.delete(article.id);
    },
    onSuccess: () => {
      toast({ title: 'Article deleted' });
      invalidate();
      onOpenChange(false);
    },
    onError: (err: ApiError) => {
      toast({
        title: 'Delete failed',
        description: err?.message || 'Could not delete this article.',
        variant: 'destructive',
      });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (helpful: boolean) => {
      if (!article) return;
      return knowledgeService.markHelpful(article.id, helpful);
    },
    onSuccess: () => {
      toast({ title: 'Thanks for the feedback!' });
      invalidate();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Article' : 'New Article'}</DialogTitle>
        </DialogHeader>

        {isEditing && article && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground -mt-2">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {article.views.toLocaleString()} views
            </span>
            <span>{article.helpful_count} helpful</span>
            <span>{article.not_helpful_count} not helpful</span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => feedbackMutation.mutate(true)}
            >
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => feedbackMutation.mutate(false)}
            >
              <ThumbsDown className="h-3 w-3" />
            </Button>
          </div>
        )}

        <Tabs defaultValue="write">
          <TabsList className={isEditing ? 'hidden' : undefined}>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="upload">Upload PDF / DOCX</TabsTrigger>
          </TabsList>

          <TabsContent value="write" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="article-title">Title</Label>
              <Input
                id="article-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How do I reset my password?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="article-content">Content</Label>
              <Textarea
                id="article-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="Write the article content…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="article-category">Category</Label>
                <Input
                  id="article-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Billing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="article-tags">Tags (comma-separated)</Label>
                <Input
                  id="article-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="password, security"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="article-published" checked={isPublished} onCheckedChange={setIsPublished} />
              <Label htmlFor="article-published">Published</Label>
            </div>

            <DialogFooter className="gap-2">
              {isEditing && (
                <Button
                  variant="destructive"
                  className="mr-auto"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              )}
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!title.trim() || !content.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Article'}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="article-upload">PDF or DOCX file</Label>
              <Input
                id="article-upload"
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Text is extracted automatically and becomes the article content.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="upload-category">Category (optional)</Label>
                <Input
                  id="upload-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-tags">Tags (optional)</Label>
                <Input id="upload-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!uploadFile || uploadMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadMutation.isPending ? 'Importing…' : 'Import Document'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
