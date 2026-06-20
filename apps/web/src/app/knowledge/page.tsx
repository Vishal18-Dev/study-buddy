'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Library, Upload, FileText, Youtube, Link as LinkIcon, Globe,
  Plus, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { get, post } from '@/lib/fetcher';
import { cn } from '@/lib/utils';

interface KnowledgeSource {
  id: string;
  title: string;
  type: 'pdf' | 'text' | 'youtube' | 'link';
  url?: string;
  content?: string;
  createdAt: string;
}

interface ActivePlan { id: string; subject: string }

const TYPE_ICONS: Record<string, React.ElementType> = {
  youtube: Youtube,
  link:    LinkIcon,
  pdf:     FileText,
  text:    FileText,
};

const TYPE_COLORS: Record<string, string> = {
  youtube: 'bg-red-50 text-red-600 border-red-100',
  link:    'bg-blue-50 text-blue-600 border-blue-100',
  pdf:     'bg-amber-50 text-amber-600 border-amber-100',
  text:    'bg-slate-50 text-slate-600 border-slate-100',
};

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [type, setType] = useState<'youtube' | 'link' | 'text'>('youtube');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  const fetchSources = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const p = await get<ActivePlan | null>('/api/plans/active', session.accessToken);
      if (p) {
        setPlan(p);
        // Backend: GET /api/knowledge/:planId
        const list = await get<KnowledgeSource[]>(`/api/knowledge/${p.id}`, session.accessToken);
        setSources(list || []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') fetchSources();
  }, [status, fetchSources, router]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !plan) return;
    setUploading(true);
    setSuccess('');
    setError('');
    try {
      const body: Record<string, string> = {
        type,
        title: title || (type === 'youtube' ? 'YouTube Video' : type === 'link' ? 'Web Link' : 'Text Note'),
      };
      if (type === 'youtube' || type === 'link') body.url = url;
      if (type === 'text') body.content = textContent;

      // Backend: POST /api/knowledge/:planId
      await post(`/api/knowledge/${plan.id}`, body, session.accessToken);
      setSuccess('Source added. Your plan will adapt to it automatically.');
      setUrl(''); setTitle(''); setTextContent('');
      fetchSources();
    } catch {
      setError('Failed to add source. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-up">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload resources, notes, and links. Your AI plan will adapt to them automatically.
          </p>
        </div>

        {/* Upload card */}
        {!plan && !loading ? (
          <Card glow={true} className="p-6 text-center border border-border/40 shadow-xl">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold">No active study plan</p>
            <p className="text-sm text-muted-foreground mt-1">Create a plan first to add knowledge sources.</p>
            <Button className="mt-4" onClick={() => router.push('/onboard')}>Create plan</Button>
          </Card>
        ) : plan && (
          <Card glow={true} className="p-6 border border-border/40 shadow-xl">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Add a source
            </h2>

            {/* Type selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(['youtube', 'link', 'text'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                    type === t
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  )}
                  id={`source-type-${t}`}
                >
                  {t === 'youtube' && <Youtube className="h-3.5 w-3.5" />}
                  {t === 'link'    && <Globe className="h-3.5 w-3.5" />}
                  {t === 'text'    && <FileText className="h-3.5 w-3.5" />}
                  {t === 'youtube' ? 'YouTube' : t === 'link' ? 'Web link' : 'Text / Notes'}
                </button>
              ))}
            </div>

            <form onSubmit={handleUpload} className="space-y-3">
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title (optional)"
                id="ks-title"
              />

              {(type === 'youtube' || type === 'link') && (
                <Input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder={type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'}
                  required
                  id="ks-url"
                />
              )}

              {type === 'text' && (
                <textarea
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="Paste your notes, exam paper questions, or any text content..."
                  rows={5}
                  required
                  id="ks-content"
                  className="w-full resize-none text-sm p-3 rounded-lg border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              )}

              {success && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" disabled={uploading} id="add-source-btn">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Adding...' : 'Add source'}
              </Button>
            </form>
          </Card>
        )}

        {/* Sources list */}
        <Card glow={true} className="border border-border/40 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              Your sources
            </h2>
            <Badge variant="secondary">{sources.length} {sources.length === 1 ? 'source' : 'sources'}</Badge>
          </div>

          {loading ? (
            <div className="p-5 space-y-4 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-border/10 last:border-0">
                  <div className="h-9 w-9 bg-secondary/40 dark:bg-card/40 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 bg-secondary/40 dark:bg-card/40 rounded w-1/3" />
                    <div className="h-3 bg-secondary/30 dark:bg-card/30 rounded w-1/2" />
                  </div>
                  <div className="h-5 w-14 bg-secondary/40 dark:bg-card/40 rounded shrink-0" />
                </div>
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-12">
              <Library className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-foreground">No sources yet</p>
              <p className="text-muted-foreground text-sm mt-1">Add a YouTube video, link, or text notes above.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sources.map(source => {
                const Icon = TYPE_ICONS[source.type] || FileText;
                const colorClass = TYPE_COLORS[source.type] || TYPE_COLORS.text;
                return (
                  <div key={source.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl border shrink-0', colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{source.title}</p>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate block"
                        >
                          {source.url}
                        </a>
                      )}
                      {source.content && (
                        <p className="text-xs text-muted-foreground truncate">{source.content.slice(0, 80)}...</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(source.createdAt)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize text-xs">
                      {source.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      </div>
    </AppShell>
  );
}
