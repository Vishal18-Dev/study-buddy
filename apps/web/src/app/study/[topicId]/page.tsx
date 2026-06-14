'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  CheckCircle2, Send, Bot, User, ArrowLeft, Clock, Sparkles,
  PlayCircle, BookOpen, ChevronRight
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { get, post, patch } from '@/lib/fetcher';
import { cn } from '@/lib/utils';
import type { Topic, Plan } from '@/lib/types';

type ChatMessage = { role: 'user' | 'model'; content: string };

const SUGGESTED_PROMPTS = [
  'Explain this topic simply',
  'Give me 5 practice questions',
  'What are common exam mistakes here?',
  'Summarise the key points',
];

function ytEmbedId(title: string): string {
  // We use YouTube search redirect URL since we don't have an API key.
  // We construct a "no embed" approach — open search in new tab.
  return encodeURIComponent(title + ' explained tutorial');
}

export default function StudyPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState('');
  
  // Video playlist states
  type PlaylistVideo = { videoId: string; title: string; duration: string };
  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<PlaylistVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState<boolean>(false);

  // Notes autosave states
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [debouncedNotes, setDebouncedNotes] = useState(notes);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchVideos = useCallback(async (title: string) => {
    if (!session?.accessToken) return;
    setVideoLoading(true);
    try {
      const res = await get<PlaylistVideo[]>(`/api/recommendations/video/search?query=${encodeURIComponent(title + ' tutorial lesson')}`, session.accessToken);
      if (Array.isArray(res) && res.length > 0) {
        setVideos(res);
        setSelectedVideo(res[0]);
      }
    } catch {
      // fallback to empty
    } finally {
      setVideoLoading(false);
    }
  }, [session?.accessToken]);

  const loadTopic = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      // Fetch plan to get topic info
      const p = await get<Plan>('/api/plans/active', session.accessToken);
      if (!p) return;
      setPlan(p);
      const allTopics = p.days.flatMap(d => d.topics);
      const t = allTopics.find(t => t.id === topicId);
      if (t) {
        setTopic(t);
        setNotes(t.notes || '');
        setDone(t.status === 'COMPLETE');
        // Seed first bot message
        setMessages([{
          role: 'model',
          content: `Ready to study **${t.title}**. I can explain concepts, give you practice questions, or help you adjust your plan. What would you like to do?`
        }]);
        fetchVideos(t.title);
      }
    } catch { /* silent */ }
  }, [session?.accessToken, topicId, fetchVideos]);

  // Debounce notes value
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNotes(notes);
    }, 1500);
    return () => clearTimeout(timer);
  }, [notes]);

  const saveNotes = useCallback(async (text: string) => {
    if (!session?.accessToken || !topic) return;
    setSaveStatus('saving');
    try {
      await patch(`/api/topics/${topic.id}/notes`, { notes: text }, session.accessToken);
      setSaveStatus('saved');
      setTopic(prev => prev ? { ...prev, notes: text } : null);
    } catch {
      setSaveStatus('error');
    }
  }, [session?.accessToken, topic]);

  // Sync debounced notes with API
  useEffect(() => {
    if (topic && debouncedNotes !== (topic.notes || '')) {
      saveNotes(debouncedNotes);
    }
  }, [debouncedNotes, topic, saveNotes]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') loadTopic();
  }, [status, loadTopic, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || !session?.accessToken || !plan) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setSending(true);
    try {
      const body = { message: msg, planId: plan.id, history: messages };
      const res = await post<{ reply: string }>('/api/chat', body, session.accessToken);
      setMessages(prev => [...prev, { role: 'model', content: res.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'model', content: "I'm having trouble connecting. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  const handleMarkDone = async () => {
    if (!session?.accessToken || !topic || marking) return;
    setMarking(true);
    try {
      await patch(`/api/topics/${topic.id}/status`, { status: done ? 'NOT_STARTED' : 'COMPLETE' }, session.accessToken);
      setDone(!done);
    } catch { /* silent */ } finally { setMarking(false); }
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-secondary px-1 py-0.5 rounded text-xs font-mono">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  if (!topic) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  const ytSearchUrl = `https://www.youtube.com/results?search_query=${ytEmbedId(topic.title)}`;

  return (
    <AppShell>
      <div className="animate-fade-up">
        {/* Back link */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          id="back-to-dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        {/* Topic header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground leading-snug">{topic.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {topic.estimatedMins} min
              </Badge>
              {plan && (
                <Badge variant="outline" className="text-xs">{plan.subject}</Badge>
              )}
            </div>
          </div>
          <Button
            onClick={handleMarkDone}
            disabled={marking}
            variant={done ? 'outline' : 'default'}
            className={cn('shrink-0', done && 'border-emerald-500 text-emerald-600 hover:bg-emerald-50')}
            id="mark-done-btn"
          >
            <CheckCircle2 className="h-4 w-4" />
            {done ? 'Completed' : 'Mark Done'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ─ LEFT: Video + Notes ────────────────── */}
          <div className="lg:col-span-3 space-y-5">

            {/* YouTube resource card */}
            <div className="card-elevated p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-red-500" />
                Curated Videos
              </h2>
              {videoLoading ? (
                <div className="rounded-xl overflow-hidden bg-slate-100 aspect-video flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-muted-foreground text-xs">Finding the best tutorial video...</p>
                </div>
              ) : selectedVideo ? (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden bg-black aspect-video relative shadow-inner border border-border">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}`}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      title={selectedVideo.title}
                    ></iframe>
                  </div>
                  
                  {/* Playlist Selector */}
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Video Playlist ({videos.length} recommended)</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {videos.map((vid) => {
                        const isActive = vid.videoId === selectedVideo.videoId;
                        return (
                          <button
                            key={vid.videoId}
                            onClick={() => setSelectedVideo(vid)}
                            className={cn(
                              "w-full text-left flex items-start gap-2.5 p-2 rounded-lg border text-xs transition-all",
                              isActive
                                ? "bg-primary/5 border-primary/30 text-primary font-medium"
                                : "bg-secondary/10 border-transparent hover:bg-secondary/20 text-foreground"
                            )}
                          >
                            <PlayCircle className={cn("h-4 w-4 shrink-0 mt-0.5", isActive ? "text-primary" : "text-muted-foreground")} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{vid.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Duration: {vid.duration}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden bg-slate-900 aspect-video flex flex-col items-center justify-center gap-3 group cursor-pointer"
                  onClick={() => window.open(ytSearchUrl, '_blank')}
                >
                  <div className="h-14 w-14 flex items-center justify-center rounded-full bg-red-600 group-hover:bg-red-700 transition-colors shadow-lg">
                    <PlayCircle className="h-8 w-8 text-white fill-white" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-white font-semibold text-sm">{topic.title}</p>
                    <p className="text-slate-400 text-xs mt-1">Click to search YouTube videos</p>
                  </div>
                </div>
              )}
              <a
                href={selectedVideo ? `https://www.youtube.com/watch?v=${selectedVideo.videoId}` : ytSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 mt-3 text-xs font-medium text-primary hover:underline"
              >
                {selectedVideo ? "Watch on YouTube instead" : "Open YouTube search for this topic"}
                <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Notes panel */}
            <div className="card-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  My Notes
                </h2>
                {saveStatus && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {saveStatus === 'saving' && (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Saving...
                      </>
                    )}
                    {saveStatus === 'saved' && (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Saved
                      </>
                    )}
                    {saveStatus === 'error' && (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Save error
                      </>
                    )}
                  </span>
                )}
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Jot down your notes here as you study..."
                id="notes-area"
                className="w-full h-36 resize-none text-sm p-3 rounded-lg border border-border bg-secondary/30 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>

          </div>

          {/* ─ RIGHT: AI Chat ───────────────────── */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="card-elevated flex flex-col" style={{ height: '560px' }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">AI Study Assistant</p>
                  <p className="text-[10px] text-muted-foreground">Ask anything about this topic</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'model' && (
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn('max-w-[82%] text-sm', msg.role === 'user' ? 'bubble-user' : 'bubble-bot')}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                    {msg.role === 'user' && (
                      <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bubble-bot flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '120ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '240ms' }} />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Suggested prompts */}
              {messages.length <= 1 && (
                <div className="px-3 pb-2 flex gap-1.5 flex-wrap shrink-0">
                  {SUGGESTED_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-medium"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2 shrink-0">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask about this topic..."
                  className="text-sm"
                  id="chat-input-study"
                  disabled={sending}
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage()}
                  disabled={sending || !input.trim()}
                  id="chat-send-study"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
