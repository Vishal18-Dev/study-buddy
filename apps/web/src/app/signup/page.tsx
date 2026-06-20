'use client';
import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { post } from '@/lib/fetcher';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const planId = params.get('planId') || (typeof window !== 'undefined' ? localStorage.getItem('pendingPlanId') : null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preference, setPreference] = useState<'PLAN_ONLY' | 'PLAN_CONTENT' | 'PLAN_CONTENT_EXAMS'>('PLAN_ONLY');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);

    try {
      await post('/api/auth/register', {
        email,
        password,
        name: name || undefined,
        planId: planId || undefined,
        preference,
      });

      // Sign in immediately after registration
      const result = await signIn('credentials', { email, password, redirect: false });

      if (result?.error) {
        setError('Account created but sign-in failed. Please go to login.');
      } else {
        if (typeof window !== 'undefined') localStorage.removeItem('pendingPlanId');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>

        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity">
            <Image 
              src="/unslump-icon-gradient.svg"
              alt="Unslump Logo"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
            <span className="text-2xl font-bold gradient-text">Unslump AI</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              {planId ? 'Save your study plan and track progress' : 'Start your study journey today'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {planId && (
              <div className="mb-4 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-primary">
                Your study plan is ready to be saved to your account.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="name">Name (optional)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="signup-email">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="signup-password">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              {/* Preference Picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Study Mode Preference</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'PLAN_ONLY', label: 'Plan Only', desc: 'Schedule focus' },
                      { value: 'PLAN_CONTENT', label: 'Plan + Content', desc: 'Notes & links' },
                      { value: 'PLAN_CONTENT_EXAMS', label: 'Full Package', desc: 'Adds quizzes' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPreference(opt.value)}
                      className={`flex flex-col items-center justify-between text-center p-3 rounded-xl border text-xs transition-all duration-200 ${
                        preference === opt.value
                          ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                          : 'border-border bg-secondary/20 hover:bg-secondary/40 text-muted-foreground'
                      }`}
                    >
                      <span className="font-semibold block mb-1">{opt.label}</span>
                      <span className="text-[10px] opacity-80 block leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" loading={loading} id="signup-submit">
                Create account
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href={planId ? `/login?planId=${planId}` : '/login'} className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <SignupForm />
    </Suspense>
  );
}
