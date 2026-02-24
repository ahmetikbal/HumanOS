'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Navbar } from '@/components/navbar';
import { TaskEditModal } from '@/components/task-edit-modal';
import { useTasks } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
import { useStore } from '@/store/useStore';
import { generateSchedule, formatDuration } from '@/lib/scheduler';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    CalendarDays,
    Clock,
    Moon,
    Pin,
    Zap,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    format,
    differenceInMinutes,
    addDays,
    startOfWeek,
    isSameDay,
    isToday,
    getHours,
    getMinutes,
} from 'date-fns';
import { ScheduleSlot, SlotType, Task } from '@/types';

const slotConfig: Record<
    SlotType,
    { icon: typeof Clock; colorClass: string; label: string }
> = {
    Sleep: { icon: Moon, colorClass: 'slot-sleep', label: 'Sleep' },
    Fixed: { icon: Pin, colorClass: 'slot-fixed', label: 'Fixed' },
    Task: { icon: Zap, colorClass: 'slot-task', label: 'Task' },
    Free: { icon: Clock, colorClass: 'slot-free', label: 'Free' },
};

export default function TimelinePage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { tasks, updateTask, deleteTask, completeTask } = useTasks();
    useSettings();
    const settings = useStore((s) => s.settings);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [editTask, setEditTask] = useState<Task | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [nowTick, setNowTick] = useState(0);

    useEffect(() => {
        if (!loading && !user) router.push('/');
    }, [user, loading, router]);

    // Tick every 30 seconds for now-indicator
    useEffect(() => {
        const interval = setInterval(() => setNowTick((t) => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    // Calculate week days
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    // Generate schedule for selected day
    const schedule = useMemo(() => {
        return generateSchedule(tasks, settings, selectedDate);
    }, [tasks, settings, selectedDate]);

    if (loading || !user) return null;

    // Filter out zero-time slots
    const slots = schedule?.slots?.filter(
        (s) => differenceInMinutes(s.timeEnd, s.timeStart) > 0
    ) ?? [];

    // Parse wake/bed for positioning
    const wakeHour = parseInt(settings.wakeTime.split(':')[0]);
    const wakeMin = parseInt(settings.wakeTime.split(':')[1]);
    const bedHour = parseInt(settings.bedTime.split(':')[0]);
    const bedMin = parseInt(settings.bedTime.split(':')[1]);
    const dayStartMin = wakeHour * 60 + wakeMin;
    const dayEndMin = bedHour * 60 + bedMin;
    const dayLengthMin = dayEndMin - dayStartMin;

    // Current time position
    const now = new Date();
    const nowMin = getHours(now) * 60 + getMinutes(now);
    const nowPercent = dayLengthMin > 0
        ? Math.max(0, Math.min(100, ((nowMin - dayStartMin) / dayLengthMin) * 100))
        : 0;
    const showNowLine = isToday(selectedDate) && nowMin >= dayStartMin && nowMin <= dayEndMin;

    // Hour markers (only awake hours)
    const hours: number[] = [];
    for (let h = wakeHour; h <= bedHour; h++) {
        hours.push(h);
    }

    // Convert slot time to percentage position within the day
    const timeToPercent = (date: Date): number => {
        const mins = getHours(date) * 60 + getMinutes(date);
        return Math.max(0, Math.min(100, ((mins - dayStartMin) / dayLengthMin) * 100));
    };

    const handleSlotClick = (slot: ScheduleSlot) => {
        if (slot.type === 'Task' && slot.taskId) {
            const task = tasks.find((t) => t.id === slot.taskId);
            if (task) {
                setEditTask(task);
                setEditOpen(true);
            }
        }
    };

    // Check if a slot is the "current" one
    const isCurrentSlot = (slot: ScheduleSlot) => {
        if (!isToday(selectedDate)) return false;
        return now >= slot.timeStart && now < slot.timeEnd;
    };

    const navigateWeek = (direction: number) => {
        setSelectedDate(addDays(selectedDate, direction * 7));
    };

    // Total height for timeline in pixels (60px per hour)
    const PX_PER_HOUR = 60;
    const totalHeightPx = ((dayEndMin - dayStartMin) / 60) * PX_PER_HOUR;

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="text-gradient">Timeline</span>
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                            {format(selectedDate, 'EEEE, MMMM d')} — Memory Map
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigateWeek(-1)}
                            className="cursor-pointer h-8 w-8 p-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDate(new Date())}
                            className="cursor-pointer text-xs h-8"
                        >
                            Today
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigateWeek(1)}
                            className="cursor-pointer h-8 w-8 p-0"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Week Day Tabs */}
                <div className="flex gap-1 mb-6">
                    {weekDays.map((day) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isDayToday = isToday(day);
                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(day)}
                                className={`flex-1 py-2 rounded-lg text-center transition-all duration-200 cursor-pointer ${isSelected
                                    ? 'bg-primary text-primary-foreground shadow-md scale-105'
                                    : isDayToday
                                        ? 'bg-primary/10 text-primary border border-primary/20'
                                        : 'bg-background/30 text-muted-foreground hover:bg-background/50'
                                    }`}
                            >
                                <span className="block text-[10px] font-medium uppercase">
                                    {format(day, 'EEE')}
                                </span>
                                <span className={`block text-sm font-bold ${isSelected ? '' : 'font-mono'}`}>
                                    {format(day, 'd')}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-4">
                    {(['Fixed', 'Task', 'Free'] as SlotType[]).map((type) => {
                        const cfg = slotConfig[type];
                        return (
                            <div
                                key={type}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                                <div className={`w-3 h-3 rounded-sm ${cfg.colorClass}`} />
                                <span>{cfg.label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Timeline */}
                <Card className="glass border-border/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {format(selectedDate, 'EEEE')} — {slots.filter(s => s.type === 'Task').length} tasks scheduled
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-6">
                        <div className="relative" style={{ height: `${totalHeightPx}px` }}>
                            {/* Hour grid lines */}
                            {hours.map((hour) => {
                                const topPx = ((hour * 60 + 0 - dayStartMin) / (dayEndMin - dayStartMin)) * totalHeightPx;
                                return (
                                    <div key={hour} className="absolute left-0 right-0" style={{ top: `${topPx}px` }}>
                                        <div className="flex items-start">
                                            <span className="text-[10px] text-muted-foreground/40 font-mono w-12 flex-shrink-0 -translate-y-1/2">
                                                {String(hour).padStart(2, '0')}:00
                                            </span>
                                            <div className="flex-1 border-t border-border/10" />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Now indicator */}
                            {showNowLine && (
                                <div
                                    className="absolute left-10 right-0 z-20 flex items-center pointer-events-none"
                                    style={{ top: `${(nowPercent / 100) * totalHeightPx}px` }}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50 flex-shrink-0" />
                                    <div className="flex-1 h-[2px] bg-red-500/70" />
                                    <span className="text-[9px] text-red-400 font-mono ml-1 flex-shrink-0">
                                        {format(now, 'HH:mm')}
                                    </span>
                                </div>
                            )}

                            {/* Slots — absolutely positioned */}
                            {slots.map((slot, i) => {
                                const topPct = timeToPercent(slot.timeStart);
                                const bottomPct = timeToPercent(slot.timeEnd);
                                const heightPct = bottomPct - topPct;
                                if (heightPct <= 0) return null;

                                const topPx = (topPct / 100) * totalHeightPx;
                                const heightPx = Math.max(28, (heightPct / 100) * totalHeightPx);
                                const duration = differenceInMinutes(slot.timeEnd, slot.timeStart);
                                const cfg = slotConfig[slot.type];
                                const Icon = cfg.icon;
                                const isCurrent = isCurrentSlot(slot);
                                const isClickable = slot.type === 'Task' && !!slot.taskId;

                                return (
                                    <div
                                        key={i}
                                        className={`absolute left-14 right-0 ${cfg.colorClass} rounded-lg px-3 py-1.5 flex items-center gap-2 overflow-hidden transition-all
                                            ${isCurrent ? 'ring-2 ring-primary ring-offset-1 ring-offset-background shadow-lg shadow-primary/20 z-10' : ''}
                                            ${isClickable ? 'cursor-pointer hover:brightness-110 z-[5]' : ''}`}
                                        style={{
                                            top: `${topPx}px`,
                                            height: `${heightPx - 2}px`,
                                        }}
                                        onClick={isClickable ? () => handleSlotClick(slot) : undefined}
                                    >
                                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isCurrent ? 'opacity-100' : 'opacity-70'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-medium truncate ${isCurrent ? 'text-primary' : ''}`}>
                                                    {slot.taskTitle || cfg.label}
                                                </span>
                                                {isCurrent && (
                                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold animate-pulse">
                                                        NOW
                                                    </span>
                                                )}
                                                {slot.priority && (
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[8px] px-1 py-0 priority-${slot.priority.toLowerCase()}`}
                                                    >
                                                        {slot.priority}
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-[10px] opacity-60 font-mono">
                                                {format(slot.timeStart, 'HH:mm')} – {format(slot.timeEnd, 'HH:mm')}{' '}
                                                ({formatDuration(duration)})
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Edit Modal */}
            <TaskEditModal
                task={editTask}
                open={editOpen}
                onOpenChange={setEditOpen}
                onUpdate={updateTask}
                onDelete={deleteTask}
                onComplete={completeTask}
            />
        </div>
    );
}
