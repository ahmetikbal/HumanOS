'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Navbar } from '@/components/navbar';
import { useTasks } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
    BarChart3,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    Cpu,
    Activity,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

export default function ReviewPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { tasks } = useTasks();
    useSettings();

    useEffect(() => {
        if (!loading && !user) router.push('/');
    }, [user, loading, router]);

    if (loading || !user) return null;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // Filter tasks for this week
    // Use completedAt for completed tasks, createdAt for all others
    const weekTasks = tasks.filter((t) => {
        if (t.status === 'Completed' && t.completedAt) {
            return isWithinInterval(t.completedAt, { start: weekStart, end: weekEnd });
        }
        return isWithinInterval(t.createdAt, { start: weekStart, end: weekEnd });
    });

    const completed = weekTasks.filter((t) => t.status === 'Completed');
    const dropped = weekTasks.filter((t) => t.status === 'Dropped');
    const inProgress = weekTasks.filter(
        (t) => t.status === 'Pending' || t.status === 'In-Progress'
    );

    const totalMinutes = weekTasks.reduce((acc, t) => acc + t.duration, 0);
    const completedMinutes = completed.reduce((acc, t) => acc + t.duration, 0);
    const droppedMinutes = dropped.reduce((acc, t) => acc + t.duration, 0);

    const cpuUtilization =
        totalMinutes > 0
            ? Math.round((completedMinutes / totalMinutes) * 100)
            : 0;

    const completionRate =
        weekTasks.length > 0
            ? Math.round((completed.length / weekTasks.length) * 100)
            : 0;

    // Priority breakdown
    const highTasks = weekTasks.filter((t) => t.priority === 'High');
    const mediumTasks = weekTasks.filter((t) => t.priority === 'Medium');
    const lowTasks = weekTasks.filter((t) => t.priority === 'Low');

    const highCompleted = highTasks.filter((t) => t.status === 'Completed').length;
    const mediumCompleted = mediumTasks.filter((t) => t.status === 'Completed').length;
    const lowCompleted = lowTasks.filter((t) => t.status === 'Completed').length;

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">
                        <span className="text-gradient">Weekly Review</span>
                    </h1>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                        {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')} •
                        Sunday Routine
                    </p>
                </div>

                {/* Main Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <Card className="glass border-border/30">
                        <CardContent className="p-4 text-center">
                            <Cpu className="w-5 h-5 text-primary mx-auto mb-2" />
                            <p className="text-3xl font-bold font-mono text-primary">
                                {cpuUtilization}%
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                CPU Utilization
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="glass border-border/30">
                        <CardContent className="p-4 text-center">
                            <CheckCircle className="w-5 h-5 text-chart-2 mx-auto mb-2" />
                            <p className="text-3xl font-bold font-mono text-chart-2">
                                {completed.length}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">Completed</p>
                        </CardContent>
                    </Card>

                    <Card className="glass border-border/30">
                        <CardContent className="p-4 text-center">
                            <XCircle className="w-5 h-5 text-destructive mx-auto mb-2" />
                            <p className="text-3xl font-bold font-mono text-destructive">
                                {dropped.length}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">Dropped</p>
                        </CardContent>
                    </Card>

                    <Card className="glass border-border/30">
                        <CardContent className="p-4 text-center">
                            <Clock className="w-5 h-5 text-chart-4 mx-auto mb-2" />
                            <p className="text-3xl font-bold font-mono text-chart-4">
                                {Math.round(completedMinutes / 60 * 10) / 10}h
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                Time Invested
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Completion Rate */}
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                Completion Rate
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pb-6">
                            <div className="text-center">
                                <p className="text-5xl font-bold font-mono text-gradient">
                                    {completionRate}%
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 font-mono">
                                    {completed.length} / {weekTasks.length} processes completed
                                </p>
                            </div>
                            <Progress value={completionRate} className="h-3" />

                            <div className="flex justify-between text-xs text-muted-foreground font-mono">
                                <span className="text-chart-2">
                                    ✓ {completedMinutes}m completed
                                </span>
                                <span className="text-destructive">
                                    ✗ {droppedMinutes}m dropped
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Priority Breakdown */}
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Activity className="w-4 h-4 text-muted-foreground" />
                                Priority Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pb-6">
                            <PriorityBar
                                label="High"
                                completed={highCompleted}
                                total={highTasks.length}
                                colorClass="bg-destructive"
                            />
                            <PriorityBar
                                label="Medium"
                                completed={mediumCompleted}
                                total={mediumTasks.length}
                                colorClass="bg-chart-4"
                            />
                            <PriorityBar
                                label="Low"
                                completed={lowCompleted}
                                total={lowTasks.length}
                                colorClass="bg-primary"
                            />
                        </CardContent>
                    </Card>

                    {/* Completed Tasks */}
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-chart-2" />
                                Completed Processes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 pb-4 max-h-60 overflow-y-auto">
                            {completed.length === 0 ? (
                                <p className="text-xs text-muted-foreground font-mono text-center py-4">
                                    No completed processes this week
                                </p>
                            ) : (
                                completed.map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-chart-2/5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-3 h-3 text-chart-2" />
                                            <span className="text-xs">{task.title}</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {task.duration}m
                                        </span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Dropped Tasks */}
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-destructive" />
                                Dropped Processes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 pb-4 max-h-60 overflow-y-auto">
                            {dropped.length === 0 ? (
                                <p className="text-xs text-muted-foreground font-mono text-center py-4">
                                    No dropped processes this week
                                </p>
                            ) : (
                                dropped.map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-destructive/5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <XCircle className="w-3 h-3 text-destructive" />
                                            <span className="text-xs line-through text-muted-foreground">
                                                {task.title}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {task.duration}m
                                        </span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

function PriorityBar({
    label,
    completed,
    total,
    colorClass,
}: {
    label: string;
    completed: number;
    total: number;
    colorClass: string;
}) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">{label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                    {completed}/{total}
                </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorClass} rounded-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
