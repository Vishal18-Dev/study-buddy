'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  School, Users, BookOpen, Plus, Copy, PlusCircle, 
  GraduationCap, ClipboardList, Check, CheckCircle2, 
  AlertCircle, Calendar, Award, Sparkles, Flame, Clock
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { get, post } from '@/lib/fetcher';
import { useToast } from '@/components/ui/toast-provider';
import { usePlan } from '@/components/providers/PlanContext';
import { cn } from '@/lib/utils';

interface StudentRosterItem {
  id: string;
  name: string;
  email: string;
  streak: number;
  activePlan: {
    id: string;
    subject: string;
    goalScore: number;
    dailyHours: number;
    coveragePercent: number;
  } | null;
  lastCheckIn: {
    date: string;
    completionFlag: string;
  } | null;
}

interface ClassroomTemplate {
  id: string;
  subject: string;
  syllabusContext: string;
  createdAt: string;
}

function ClassroomsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { refreshPlans } = usePlan();

  const isTeacher = session?.role === 'TEACHER';
  
  // Roster selected classroom
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Classroom details states
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [templates, setTemplates] = useState<ClassroomTemplate[]>([]);
  const [loadingClassDetails, setLoadingClassDetails] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Tabs: 'roster' | 'templates'
  const [activeTab, setActiveTab] = useState<'roster' | 'templates'>('roster');

  // Modal / Form states
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateSyllabus, setTemplateSyllabus] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const [studentCode, setStudentCode] = useState('');
  const [joiningClass, setJoiningClass] = useState(false);

  // Generate Plan for Student Modal
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterItem | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [goalScore, setGoalScore] = useState(70);
  const [knowledgeLevel, setKnowledgeLevel] = useState<'BEGINNER' | 'SOME_KNOWLEDGE' | 'REVISION'>('BEGINNER');
  const [currentScore, setCurrentScore] = useState(50);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // Load classrooms list
  const loadClassrooms = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoadingList(true);
    try {
      const endpoint = isTeacher ? '/api/classrooms/taught' : '/api/classrooms/joined';
      const data = await get<any[]>(endpoint, session.accessToken);
      setClassrooms(data);
      
      // Auto-select classroom from URL or first in list
      const urlClassroomId = searchParams?.get('classroomId');
      if (urlClassroomId) {
        setSelectedClassroomId(urlClassroomId);
      } else if (data.length > 0) {
        setSelectedClassroomId(data[0].id);
      }
    } catch {
      addToast('Failed to load classrooms', 'error');
    } finally {
      setLoadingList(false);
    }
  }, [session?.accessToken, isTeacher, searchParams]);

  // Load classroom details (roster & templates)
  const loadClassroomDetails = useCallback(async (classroomId: string) => {
    if (!session?.accessToken) return;
    setLoadingClassDetails(true);
    try {
      // Teachers load rosters, students only load templates
      if (isTeacher) {
        const rosterData = await get<StudentRosterItem[]>(`/api/classrooms/${classroomId}/roster`, session.accessToken);
        setRoster(rosterData);
      }
      
      const templatesData = await get<ClassroomTemplate[]>(`/api/classrooms/${classroomId}/templates`, session.accessToken);
      setTemplates(templatesData);
    } catch {
      addToast('Failed to load class details', 'error');
    } finally {
      setLoadingClassDetails(false);
    }
  }, [session?.accessToken, isTeacher]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') loadClassrooms();
  }, [status, loadClassrooms, router]);

  useEffect(() => {
    if (selectedClassroomId) {
      loadClassroomDetails(selectedClassroomId);
    } else {
      setRoster([]);
      setTemplates([]);
    }
  }, [selectedClassroomId, loadClassroomDetails]);

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !session?.accessToken) return;
    setCreatingClass(true);
    try {
      const res = await post<any>('/api/classrooms', { name: newClassName.trim() }, session.accessToken);
      addToast(`Classroom "${res.name}" created!`, 'success');
      setNewClassName('');
      setShowCreateClass(false);
      await loadClassrooms();
      setSelectedClassroomId(res.id);
    } catch {
      addToast('Failed to create classroom', 'error');
    } finally {
      setCreatingClass(false);
    }
  };

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !session?.accessToken) return;
    setJoiningClass(true);
    try {
      const res = await post<{ classroom: any }>('/api/classrooms/join', { code: studentCode.trim() }, session.accessToken);
      addToast(`Joined classroom "${res.classroom.name}"!`, 'success');
      setStudentCode('');
      await loadClassrooms();
      setSelectedClassroomId(res.classroom.id);
    } catch (err: any) {
      addToast('Invalid code or already joined', 'error');
    } finally {
      setJoiningClass(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateSubject.trim() || !templateSyllabus.trim() || !selectedClassroomId || !session?.accessToken) return;
    setCreatingTemplate(true);
    try {
      await post(`/api/classrooms/${selectedClassroomId}/templates`, {
        subject: templateSubject.trim(),
        syllabusContext: templateSyllabus.trim(),
      }, session.accessToken);
      addToast('Plan template added!', 'success');
      setTemplateSubject('');
      setTemplateSyllabus('');
      setShowCreateTemplate(false);
      loadClassroomDetails(selectedClassroomId);
    } catch {
      addToast('Failed to create template', 'error');
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleGenerateStudentPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedTemplateId || !examDate || !selectedClassroomId || !session?.accessToken) return;
    
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    setGeneratingPlan(true);
    try {
      await post(`/api/classrooms/${selectedClassroomId}/students/${selectedStudent.id}/plans`, {
        subject: template.subject,
        examDate,
        dailyHours,
        goalScore,
        knowledgeLevel,
        syllabusContext: template.syllabusContext,
        currentScore,
        teacherNotes: teacherNotes.trim() || undefined,
        templateId: template.id,
      }, session.accessToken);

      addToast(`Plan assigned to ${selectedStudent.name}!`, 'success');
      setSelectedStudent(null);
      setTeacherNotes('');
      loadClassroomDetails(selectedClassroomId);
    } catch {
      addToast('Failed to assign study plan', 'error');
    } finally {
      setGeneratingPlan(false);
    }
  };

  const copyCodeToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    addToast('Classroom invite code copied!', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // UI Helpers
  const selectedClass = classrooms.find(c => c.id === selectedClassroomId);

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <School className="h-6 w-6 text-primary" />
              Classrooms & Rosters
            </h1>
            <p className="text-sm text-muted-foreground">
              {isTeacher 
                ? 'Manage school sections, share join codes, and create custom plan templates.' 
                : 'Join classes and access study materials assigned by your instructors.'}
            </p>
          </div>
          
          {/* Action trigger */}
          {isTeacher ? (
            <Button onClick={() => setShowCreateClass(true)} id="btn-show-create-classroom">
              <Plus className="h-4 w-4" />
              Create Classroom
            </Button>
          ) : (
            <form onSubmit={handleJoinClassroom} className="flex gap-2 w-full sm:w-auto">
              <Input
                placeholder="6-char join code"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-36 font-semibold uppercase tracking-wider text-center"
                required
                id="join-code-input"
              />
              <Button type="submit" loading={joiningClass} id="join-class-btn">
                Join Class
              </Button>
            </form>
          )}
        </div>

        {/* Create Classroom Modal */}
        {showCreateClass && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-6 space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-lg">Create New Classroom</CardTitle>
                <CardDescription>Enter the name of your classroom or tuition group.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateClassroom} className="space-y-4">
                <Input
                  placeholder="e.g. AP Calculus AB, Science - Grade 10"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowCreateClass(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={creatingClass} id="create-class-submit">
                    Create
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Split grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Left panel: classrooms list */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Classrooms</h3>
            
            {loadingList ? (
              <div className="space-y-2">
                <div className="h-10 bg-secondary/30 rounded-lg animate-pulse" />
                <div className="h-10 bg-secondary/30 rounded-lg animate-pulse" />
              </div>
            ) : classrooms.length === 0 ? (
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">No classrooms yet.</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-1.5">
                {classrooms.map((cls) => {
                  const active = cls.id === selectedClassroomId;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassroomId(cls.id)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium border transition-all duration-150',
                        active 
                          ? 'bg-primary border-primary text-white shadow-md' 
                          : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <p className="font-semibold truncate">{cls.name}</p>
                      <p className={cn('text-[9px] mt-0.5 opacity-80', active ? 'text-white' : 'text-muted-foreground')}>
                        {isTeacher 
                          ? `${cls._count?.members || 0} students` 
                          : `Taught by ${cls.teacher?.name || 'Tutor'}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Details */}
          <div className="lg:col-span-3">
            {selectedClass ? (
              <Card className="p-6 border border-border/40 shadow-xl space-y-6">
                
                {/* Class header stats */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selectedClass.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isTeacher 
                        ? `Invite Code: ` 
                        : `Instructor: ${selectedClass.teacher?.name} (${selectedClass.teacher?.email})`}
                      {isTeacher && (
                        <button
                          onClick={() => copyCodeToClipboard(selectedClass.code)}
                          className="font-bold text-primary inline-flex items-center gap-1 ml-1 hover:underline text-xs bg-primary/10 px-2 py-0.5 rounded"
                        >
                          {selectedClass.code}
                          {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </p>
                  </div>
                  
                  {/* Tabs switch */}
                  {isTeacher && (
                    <div className="flex gap-1 bg-secondary rounded-lg p-0.5 shrink-0">
                      <button
                        onClick={() => setActiveTab('roster')}
                        className={cn(
                          'text-xs font-semibold px-3 py-1.5 rounded-md transition-colors',
                          activeTab === 'roster' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Student Roster
                      </button>
                      <button
                        onClick={() => setActiveTab('templates')}
                        className={cn(
                          'text-xs font-semibold px-3 py-1.5 rounded-md transition-colors',
                          activeTab === 'templates' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Plan Templates
                      </button>
                    </div>
                  )}
                </div>

                {/* ── TEACHER: TAB ROSTER ─────────────────────── */}
                {isTeacher && activeTab === 'roster' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-primary" />
                        Class Roster
                      </h3>
                      <span className="text-xs text-muted-foreground font-semibold">{roster.length} students</span>
                    </div>

                    {loadingClassDetails ? (
                      <div className="h-24 bg-secondary/20 rounded-lg animate-pulse" />
                    ) : roster.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-border rounded-xl">
                        <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium text-muted-foreground">No students have joined this classroom yet.</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Share the code <strong className="text-primary">{selectedClass.code}</strong> with your students to invite them.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-border text-muted-foreground font-semibold">
                              <th className="py-2.5">Student Details</th>
                              <th className="py-2.5">Streak</th>
                              <th className="py-2.5">Personal Plan</th>
                              <th className="py-2.5 text-center">Last Check-In</th>
                              <th className="py-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {roster.map((student) => (
                              <tr key={student.id} className="hover:bg-secondary/10 transition-colors">
                                <td className="py-3">
                                  <p className="font-semibold text-foreground">{student.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{student.email}</p>
                                </td>
                                <td className="py-3">
                                  <div className="flex items-center gap-1">
                                    <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
                                    <span className="font-semibold">{student.streak}</span>
                                  </div>
                                </td>
                                <td className="py-3 max-w-[150px]">
                                  {student.activePlan ? (
                                    <div className="space-y-1">
                                      <p className="font-semibold truncate">{student.activePlan.subject}</p>
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                                          <div className="h-full bg-primary" style={{ width: `${student.activePlan.coveragePercent}%` }} />
                                        </div>
                                        <span className="text-[9px] font-bold">{student.activePlan.coveragePercent}%</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic text-[11px]">No active plan</span>
                                  )}
                                </td>
                                <td className="py-3 text-center">
                                  {student.lastCheckIn ? (
                                    <Badge 
                                      variant={
                                        student.lastCheckIn.completionFlag === 'YES' || student.lastCheckIn.completionFlag === 'LOGGED_OFFLINE'
                                          ? 'success' 
                                          : student.lastCheckIn.completionFlag === 'PARTIALLY' 
                                          ? 'warning' 
                                          : 'destructive'
                                      }
                                      className="text-[9px] uppercase tracking-wide px-1.5 py-0.5"
                                    >
                                      {student.lastCheckIn.completionFlag.replace('_', ' ')}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground italic text-[11px]">-</span>
                                  )}
                                </td>
                                <td className="py-3 text-right">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 text-[11px] font-semibold border-primary/30 text-primary hover:bg-primary/5"
                                    onClick={() => {
                                      if (templates.length === 0) {
                                        addToast('Create a plan template in the Templates tab first!', 'info');
                                        return;
                                      }
                                      setSelectedStudent(student);
                                      setSelectedTemplateId(templates[0].id);
                                    }}
                                    id={`assign-plan-to-${student.id}`}
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    Generate Plan
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TEACHER / STUDENT: TAB TEMPLATES / STUDY MATERIALS ───────── */}
                {(!isTeacher || activeTab === 'templates') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        Plan Templates
                      </h3>
                      {isTeacher && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setShowCreateTemplate(true)}
                          id="btn-show-create-template"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Template
                        </Button>
                      )}
                    </div>

                    {/* Create Template Form */}
                    {showCreateTemplate && isTeacher && (
                      <Card className="p-4 border border-dashed border-primary/20 space-y-4">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">New Study Plan Template</h4>
                        <form onSubmit={handleCreateTemplate} className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground">Subject Name</label>
                            <Input
                              placeholder="e.g. AP Calculus AB, Physics Section A"
                              value={templateSubject}
                              onChange={(e) => setTemplateSubject(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground">
                              Syllabus Topics (One per line)
                            </label>
                            <textarea
                              rows={5}
                              className="w-full text-xs p-3 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary"
                              placeholder="e.g.&#10;Limits & Continuity&#10;Derivatives Definition&#10;Power Rule & Chain Rule&#10;Applications of Derivatives"
                              value={templateSyllabus}
                              onChange={(e) => setTemplateSyllabus(e.target.value)}
                              required
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateTemplate(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" size="sm" loading={creatingTemplate} id="create-template-submit">
                              Save Template
                            </Button>
                          </div>
                        </form>
                      </Card>
                    )}

                    {loadingClassDetails ? (
                      <div className="h-20 bg-secondary/20 rounded-lg animate-pulse" />
                    ) : templates.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-border rounded-xl">
                        <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium text-muted-foreground">No plan templates have been assigned yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map((tpl) => (
                          <Card key={tpl.id} className="p-4 border border-border/80 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold text-xs text-foreground truncate">{tpl.subject}</h4>
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-4 max-h-[80px] overflow-y-auto whitespace-pre-wrap leading-relaxed border-l-2 border-primary/20 pl-2.5">
                                {tpl.syllabusContext}
                              </p>
                            </div>
                            
                            {!isTeacher && (
                              <Button
                                className="w-full mt-2"
                                size="sm"
                                onClick={() => {
                                  // Direct to chat onboard pre-filling template params
                                  const query = new URLSearchParams({
                                    classroomId: selectedClassroomId || '',
                                    templateId: tpl.id,
                                    subject: tpl.subject,
                                    syllabusContext: tpl.syllabusContext,
                                  }).toString();
                                  router.push(`/onboard?${query}`);
                                }}
                                id={`personalize-template-${tpl.id}`}
                              >
                                Customize Study Plan
                              </Button>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ) : (
              <div className="text-center py-16 card-elevated">
                <School className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30 animate-pulse" />
                <p className="text-sm font-semibold text-muted-foreground">Select a classroom from the list to view details.</p>
              </div>
            )}
          </div>
        </div>

        {/* Generate Student Plan Modal (Teacher Only) */}
        {selectedStudent && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <CardHeader className="p-0 border-b border-border pb-3">
                <CardTitle className="text-lg">Generate Personalized Study Plan</CardTitle>
                <CardDescription>
                  Tailor a study schedule for <strong>{selectedStudent.name}</strong>. The LLM will adjust the topic pacing based on their score.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleGenerateStudentPlan} className="space-y-4">
                
                {/* Template Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground block">Select Plan Syllabus Template</label>
                  <select
                    className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    required
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.subject}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Exam Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground block">Exam Date</label>
                    <Input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* Daily Availability */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground block">Daily Study Hours</label>
                    <Input
                      type="number"
                      min={0.5}
                      max={16}
                      step={0.5}
                      value={dailyHours}
                      onChange={(e) => setDailyHours(parseFloat(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Goal Score */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground block">Target Exam Score (%)</label>
                    <Input
                      type="number"
                      min={10}
                      max={100}
                      value={goalScore}
                      onChange={(e) => setGoalScore(parseInt(e.target.value))}
                      required
                    />
                  </div>

                  {/* Current Baseline Score */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground block">Current Baseline Score (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={currentScore}
                      onChange={(e) => setCurrentScore(parseInt(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Knowledge Level */}
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block">Knowledge Level</label>
                    <select
                      className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary"
                      value={knowledgeLevel}
                      onChange={(e) => setKnowledgeLevel(e.target.value as any)}
                      required
                    >
                      <option value="BEGINNER">Beginner (Slow pace, heavy details)</option>
                      <option value="SOME_KNOWLEDGE">Some Knowledge (Balanced pace)</option>
                      <option value="REVISION">Revision (Fast pace, intense practice)</option>
                    </select>
                  </div>
                </div>

                {/* Teacher comments */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground block">Teacher Notes & Feedback (Optional)</label>
                  <textarea
                    rows={3}
                    className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="e.g. struggles with limits, needs to complete extra basic exercises, focus on calculus."
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="ghost" onClick={() => setSelectedStudent(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={generatingPlan} id="generate-assigned-plan-submit">
                    Generate & Assign
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ClassroomsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <ClassroomsContent />
    </Suspense>
  );
}
