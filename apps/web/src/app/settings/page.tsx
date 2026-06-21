'use client';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, Mail, MessageCircle, CreditCard, Trash2, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { get, patch } from '@/lib/fetcher';
import { useToast } from '@/components/ui/toast-provider';

interface UserData {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  telegramId: string | null;
  role?: string;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { addToast } = useToast();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [loading, setLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (!session?.accessToken) return;
    get<UserData>('/api/auth/me', session.accessToken)
      .then((u) => {
        setUserData(u);
        setName(u.name || '');
        setTelegramId(u.telegramId || '');
        setRole(u.role || 'STUDENT');
      })
      .catch(() => {});
  }, [session?.accessToken]);

  const handleSave = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      addToast('Settings saved', 'success');
    }, 800);
  };

  const handleUpdateRole = async (newRole: 'STUDENT' | 'TEACHER') => {
    if (!session?.accessToken) return;
    setLoadingRole(true);
    try {
      await patch('/api/auth/role', { role: newRole }, session.accessToken);
      setRole(newRole);
      addToast(`Account switched to ${newRole === 'TEACHER' ? 'Teacher' : 'Student'}!`, 'success');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch {
      addToast('Failed to switch roles', 'error');
    } finally {
      setLoadingRole(false);
    }
  };

  const tierLabels: Record<string, string> = {
    FREE: 'Free',
    MONTHLY: 'Pro Monthly',
    ANNUAL: 'Pro Annual',
  };

  return (
    <AppShell>
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="settings-name">Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={userData?.email || ''}
                  className="pl-9 opacity-60"
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="telegram-id">
                Telegram ID
                <span className="ml-2 text-xs text-muted-foreground">(for future notifications)</span>
              </label>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="telegram-id"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  placeholder="@yourusername"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2 pb-2">
              <label className="text-sm font-medium block">Account Role</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={role === 'STUDENT' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleUpdateRole('STUDENT')}
                  disabled={loadingRole}
                >
                  Student
                </Button>
                <Button
                  type="button"
                  variant={role === 'TEACHER' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleUpdateRole('TEACHER')}
                  disabled={loadingRole}
                >
                  Teacher / Tutor
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Note: Changing role updates navigation menus and dashboard access immediately.
              </p>
            </div>

            <Button onClick={handleSave} loading={loading} id="save-settings">
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Subscription</CardTitle>
              <Badge variant={userData?.tier === 'FREE' ? 'secondary' : 'default'}>
                {tierLabels[userData?.tier || 'FREE'] || 'Free'}
              </Badge>
            </div>
            <CardDescription>
              {userData?.tier === 'FREE'
                ? 'Upgrade to Pro for unlimited plans and priority replanning.'
                : 'Thank you for being a Pro member.'}
            </CardDescription>
          </CardHeader>
          {userData?.tier === 'FREE' && (
            <CardContent>
              {/* Razorpay stub — UI only for MVP */}
              <Button variant="accent" className="w-full" id="upgrade-btn" onClick={() => addToast('Payment integration coming soon.', 'info')}>
                <CreditCard className="h-4 w-4" />
                Upgrade to Pro — ₹299/month
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Razorpay payment — coming soon
              </p>
            </CardContent>
          )}
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            {!confirmDelete ? (
              <Button
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
                id="delete-account-btn"
              >
                <Trash2 className="h-4 w-4" />
                Delete account
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This will permanently delete your account and all study data. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    loading={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      // MVP stub: just sign out
                      setTimeout(() => signOut({ callbackUrl: '/' }), 1000);
                    }}
                    id="confirm-delete-btn"
                  >
                    Yes, delete my account
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
