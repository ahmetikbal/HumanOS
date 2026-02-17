'use client';

import { ScheduleSlot } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Play,
    CheckCircle,
    Clock,
    Cpu,
    ChevronRight,
} from 'lucide-react';
import { differenceInMinutes, format } from 'date-fns';
import { useEffect, useState } from 'react';

interface CurrentTaskProps {
    currentTask: ScheduleSlot | null;
    onComplete: (taskId: string) => void;
}

export function CurrentTask({ currentTask, onComplete }: CurrentTaskProps) {
    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!currentTask) return;

        const updateProgress = () => {
            const now = new Date();
            const totalMinutes = differenceInMinutes(currentTask.timeEnd, currentTask.timeStart);
            const elapsedMinutes = differenceInMinutes(now, currentTask.timeStart);
            const pct = Math.min(100, Math.max(0, (elapsedMinutes / totalMinutes) * 100));
            setProgress(pct);
            setElapsed(elapsedMinutes);
        };

        updateProgress();
        const interval = setInterval(updateProgress, 10000);
        return () => clearInterval(interval);
    }, [currentTask]);

    if (!currentTask) {
        return (
            <Card className="glass border-border/30 overflow-hidden">
                <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-chart-2/10 flex items-center justify-center glow-success">
                        <CheckCircle className="w-8 h-8 text-chart-2" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">All Processes Idle</h3>
                        <p className="text-sm text-muted-foreground mt-1 font-mono">
                            CPU Status: FREE — No active processes
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const totalMinutes = differenceInMinutes(currentTask.timeEnd, currentTask.timeStart);
    const remaining = Math.max(0, totalMinutes - elapsed);

    return (
        <Card className="glass border-border/30 overflow-hidden relative">
            {/* Progress bar at top */}
            <div className="h-1 bg-muted">
                <div
                    className="h-full bg-primary transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse-slow">
                            <Cpu className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                                CPU Register — Active Process
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 priority-${currentTask.priority?.toLowerCase()}`}
                                >
                                    {currentTask.priority}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    PID: {currentTask.taskId?.slice(0, 8)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold font-mono text-primary">{remaining}m</p>
                        <p className="text-[10px] text-muted-foreground">remaining</p>
                    </div>
                </div>

                {/* Task title */}
                <h2 className="text-2xl font-bold text-foreground mb-4 leading-tight">
                    {currentTask.taskTitle?.replace(/^⚡ /, '')}
                </h2>

                {/* Time info */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono mb-4">
                    <span className="flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        {format(currentTask.timeStart, 'HH:mm')}
                    </span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(currentTask.timeEnd, 'HH:mm')}
                    </span>
                    <span className="ml-auto">
                        {totalMinutes}min total
                    </span>
                </div>

                {/* Progress */}
                <Progress value={progress} className="h-2 mb-4" />

                {/* Complete button */}
                <Button
                    onClick={() => currentTask.taskId && onComplete(currentTask.taskId)}
                    className="w-full glow-success bg-chart-2 hover:bg-chart-2/90 text-white font-semibold cursor-pointer"
                >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Complete — Kill Process
                </Button>
            </CardContent>
        </Card>
    );
}
