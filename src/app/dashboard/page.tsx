'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Navbar } from '@/components/navbar';
import { CurrentTask } from '@/components/current-task';
import { PanicButton } from '@/components/panic-button';
import { TaskInputModal } from '@/components/task-input-modal';
import { useTasks } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
import { useSchedule } from '@/hooks/useSchedule';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Cpu,
    Clock,
    ListTodo,
    ChevronRight,
    Activity,
    Zap,
    BarChart3,
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { ScheduleSlot } from '@/types';
import { PanicModeResult } from '@/lib/panic-mode';

export default function DashboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { tasks, addTask, completeTask } = useTasks();
    const { settings } = useSettings();
    const { currentTask, upcomingTasks, schedule } = useSchedule();

    useEffect(() => {
        if (!loading && !user) router.push('/');
    }, [user, loading, router]);

    if (loading || !user) return null;

    // Stats
    const activeTasks = tasks.filter(
        (t) => t.status === 'Pending' || t.status === 'In-Progress'
    );
    const completedToday = tasks.filter(
        (t) =>
            t.status === 'Completed' &&
            format(t.createdAt, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    ).length;

    const totalScheduledMinutes = schedule?.slots
        .filter((s) => s.type === 'Task')
        .reduce((acc, s) => acc + differenceInMinutes(s.timeEnd, s.timeStart), 0) ?? 0;

    const totalFreeMinutes = schedule?.slots
        .filter((s) => s.type === 'Free')
        .reduce((acc, s) => acc + differenceInMinutes(s.timeEnd, s.timeStart), 0) ?? 0;

    const cpuUtilization =
        totalScheduledMinutes + totalFreeMinutes > 0
            ? Math.round(
                (totalScheduledMinutes / (totalScheduledMinutes + totalFreeMinutes)) * 100
            )
            : 0;

    const handlePanicExecuted = async (result: PanicModeResult) => {
        // Update tasks in store (Firestore sync will happen via useTasks)
        useStore.getState().setTasks(result.tasks);
    };

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="text-gradient">Dashboard</span>
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                            {format(new Date(), 'EEEE, MMMM d — HH:mm')} • Kernel Active
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <TaskInputModal onSubmit={addTask} />
                        <PanicButton
                            tasks={tasks}
                            settings={settings}
                            onPanicExecuted={handlePanicExecuted}
                        />
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <StatCard
                        icon={<Activity className="w-4 h-4 text-primary" />}
                        label="CPU Utilization"
                        value={`${cpuUtilization}%`}
                    />
                    <StatCard
                        icon={<ListTodo className="w-4 h-4 text-chart-4" />}
                        label="Active Processes"
                        value={activeTasks.length.toString()}
                    />
                    <StatCard
                        icon={<Zap className="w-4 h-4 text-chart-2" />}
                        label="Completed Today"
                        value={completedToday.toString()}
                    />
                    <StatCard
                        icon={<Clock className="w-4 h-4 text-chart-5" />}
                        label="Scheduled Time"
                        value={`${Math.round(totalScheduledMinutes / 60 * 10) / 10}h`}
                    />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* CPU Register — Current Task (spans 2 cols) */}
                    <div className="lg:col-span-2">
                        <CurrentTask
                            currentTask={currentTask}
                            onComplete={completeTask}
                        />
                    </div>

                    {/* Next Up */}
                    <div className="space-y-4">
                        <Card className="glass border-border/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                                    Next Up — Process Queue
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pb-4">
                                {upcomingTasks.length === 0 ? (
                                    <p className="text-xs text-muted-foreground font-mono text-center py-4">
                                        Process queue empty
                                    </p>
                                ) : (
                                    upcomingTasks.map((task, i) => (
                                        <UpcomingTaskCard key={i} task={task} index={i} />
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Task List Summary */}
                        <Card className="glass border-border/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <ListTodo className="w-4 h-4 text-muted-foreground" />
                                    Process Table
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 pb-4 max-h-60 overflow-y-auto">
                                {activeTasks.length === 0 ? (
                                    <p className="text-xs text-muted-foreground font-mono text-center py-4">
                                        No active processes
                                    </p>
                                ) : (
                                    activeTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className="flex items-center justify-between p-2 rounded-lg bg-background/30 hover:bg-background/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[9px] px-1 py-0 flex-shrink-0 priority-${task.priority.toLowerCase()}`}
                                                >
                                                    {task.priority[0]}
                                                </Badge>
                                                <span className="text-xs truncate">{task.title}</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0 ml-2">
                                                {task.duration}m
                                            </span>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ─── Sub-components ───

function StatCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <Card className="glass border-border/30">
            <CardContent className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0">
                    {icon}
                </div>
                <div>
                    <p className="text-lg font-bold font-mono">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function UpcomingTaskCard({
    task,
    index,
}: {
    task: ScheduleSlot;
    index: number;
}) {
    const duration = differenceInMinutes(task.timeEnd, task.timeStart);
    return (
        <div className="p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium truncate pr-2">
                    {task.taskTitle?.replace(/^⚡ /, '')}
                </span>
                <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 priority-${task.priority?.toLowerCase()}`}
                >
                    {task.priority}
                </Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                <Clock className="w-2.5 h-2.5" />
                <span>
                    {format(task.timeStart, 'HH:mm')} → {format(task.timeEnd, 'HH:mm')}
                </span>
                <span className="ml-auto">{duration}m</span>
            </div>
        </div>
    );
}
