'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Navbar } from '@/components/navbar';
import { useTasks } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
import { useSchedule } from '@/hooks/useSchedule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    CalendarDays,
    Clock,
    Moon,
    Pin,
    Zap,
    AlertTriangle,
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { ScheduleSlot, SlotType } from '@/types';

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
    useTasks();
    useSettings();
    const { schedule } = useSchedule();

    useEffect(() => {
        if (!loading && !user) router.push('/');
    }, [user, loading, router]);

    if (loading || !user) return null;

    const slots = schedule?.slots?.filter(
        (s) => s.timeStart.getTime() > 0 // filter out overflow markers with epoch 0
    ) ?? [];

    // Generate hour markers
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="text-gradient">Timeline</span>
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                            {format(new Date(), 'EEEE, MMMM d')} — Memory Map
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <CalendarDays className="w-5 h-5 text-primary" />
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-6">
                    {(Object.keys(slotConfig) as SlotType[]).map((type) => {
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
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-3 h-3 rounded-sm slot-overflow" />
                        <span>Overflow</span>
                    </div>
                </div>

                {/* Overflow warnings */}
                {schedule?.slots
                    ?.filter((s) => s.isOverflow && s.timeStart.getTime() === 0)
                    .map((overflow, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm"
                        >
                            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                            <span className="text-destructive font-mono text-xs">
                                {overflow.taskTitle}
                            </span>
                        </div>
                    ))}

                {/* Timeline */}
                <Card className="glass border-border/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            Daily Memory Map — {slots.length} blocks allocated
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-6">
                        <div className="relative">
                            {/* Hour grid */}
                            <div className="absolute left-0 top-0 bottom-0 w-12">
                                {hours.map((hour) => (
                                    <div
                                        key={hour}
                                        className="absolute left-0 text-[10px] text-muted-foreground/40 font-mono"
                                        style={{ top: `${(hour / 24) * 100}%` }}
                                    >
                                        {String(hour).padStart(2, '0')}:00
                                    </div>
                                ))}
                            </div>

                            {/* Slots */}
                            <div className="ml-14 space-y-1">
                                {slots.map((slot, i) => (
                                    <TimelineSlot key={i} slot={slot} />
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

function TimelineSlot({ slot }: { slot: ScheduleSlot }) {
    const duration = differenceInMinutes(slot.timeEnd, slot.timeStart);
    const cfg = slotConfig[slot.type];
    const Icon = cfg.icon;
    const colorClass = slot.isOverflow ? 'slot-overflow' : cfg.colorClass;

    // Height based on duration (min 32px, max 120px)
    const height = Math.max(32, Math.min(120, duration * 1.5));

    return (
        <div
            className={`${colorClass} rounded-lg px-3 py-2 flex items-center gap-2 transition-all hover:scale-[1.01] hover:brightness-110`}
            style={{ minHeight: `${height}px` }}
        >
            <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">
                        {slot.taskTitle || cfg.label}
                    </span>
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
                    ({duration}m)
                </span>
            </div>
        </div>
    );
}
