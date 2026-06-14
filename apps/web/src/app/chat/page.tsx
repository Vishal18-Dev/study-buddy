'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Send, Sparkles, User, Trash2, HelpCircle,
  MessageSquare
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { get, post } from '@/lib/fetcher';
import { cn } from '@/lib/utils';
import type { Plan } from '@/lib/types';

type ChatMessage = { role: 'user' | 'model'; content: string };

const CAPABILITY_CHIPS = [
  { label: 'Explain a concept',       prompt: 'Explain the most important concept in my study plan right now' },
  { label: 'Practice questions',      prompt: 'Give me 5 practice questions on my current topic' },
  { label: 'Adjust my plan',          prompt: 'I need to adjust my study plan — can you help?' },
  { label: 'Quiz me',                 prompt: 'Quiz me on my weakest area' },
  { label: 'Exam tips',               prompt: 'Give me top exam tips for my subject' },
  { label: 'Summarise today',         prompt: 'Summarise what I should focus on today' },
];

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-secondary px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, '<br/>');
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'model',
    content: "Hi! I'm your AI Study Assistant. I can explain concepts, generate practice questions, help you adjust your plan, or answer anything about your subjects. What would you like to work on?"
  }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadPlan = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const p = await get<Plan>('/api/plans/active', session.accessToken);
      setPlan(p);
    } catch { /* silent */ }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') loadPlan();
  }, [status, loadPlan, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || !session?.accessToken || !plan) return;
    setInput('');
    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: msg }];
    setMessages(newHistory);
    setSending(true);
    try {
      const body = {
        message: msg,
        planId: plan.id,
        history: messages,
      };
      const res = await post<{ reply: string }>('/api/chat', body, session.accessToken);
      setMessages([...newHistory, { role: 'model', content: res.reply }]);
    } catch {
      setMessages([...newHistory, { role: 'model', content: "Sorry, I'm having trouble right now. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'model',
      content: "Chat cleared. What would you like to work on?"
    }]);
  };

  return (
    <AppShell>
      <div className="flex flex-col animate-fade-up" style={{ height: 'calc(100vh - 120px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              AI Study Assistant
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {plan ? `Studying: ${plan.subject}` : 'Your all-in-one study companion'}
            </p>
          </div>
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            id="clear-chat-btn"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear chat
          </button>
        </div>

        {/* What I can do */}
        {!plan && (
          <div className="card-elevated p-4 mb-4 shrink-0">
            <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              No active plan found. Create one to unlock personalised answers.
            </p>
            <Button size="sm" variant="outline" onClick={() => router.push('/onboard')}>
              Create study plan
            </Button>
          </div>
        )}

        {/* Main chat area */}
        <div className="card-elevated flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-3 animate-fade-up', msg.role === 'user' && 'justify-end')}>
                {msg.role === 'model' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[78%] text-sm leading-relaxed',
                    msg.role === 'user' ? 'bubble-user' : 'bubble-bot'
                  )}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="bubble-bot flex items-center gap-1.5 px-4 py-3">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Capability chips — shown while chat is fresh */}
          {messages.length <= 1 && plan && (
            <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
              {CAPABILITY_CHIPS.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => sendMessage(chip.prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary/25 text-primary hover:bg-primary/10 transition-colors font-medium"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 p-4 border-t border-border shrink-0">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={plan ? 'Ask about your topics, get practice questions, adjust your plan...' : 'Create a study plan first to unlock personalised answers'}
              disabled={sending || !plan}
              className="flex-1"
              id="chat-input-main"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={sending || !input.trim() || !plan}
              size="icon"
              id="chat-send-main"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
