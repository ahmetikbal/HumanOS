'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Clock, Flag, Calendar, Zap } from 'lucide-react';
import { Priority, Task } from '@/types';
import { format, addDays } from 'date-fns';

interface TaskInputModalProps {
    onSubmit: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
}

export function TaskInputModal({ onSubmit }: TaskInputModalProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState('30');
    const [deadlineDate, setDeadlineDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [deadlineTime, setDeadlineTime] = useState('23:59');
    const [priority, setPriority] = useState<Priority>('Medium');
    const [isFixed, setIsFixed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const resetForm = () => {
        setTitle('');
        setDuration('30');
        setDeadlineDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
        setDeadlineTime('23:59');
        setPriority('Medium');
        setIsFixed(false);
        setError('');
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setSubmitting(true);
        setError('');

        try {
            const deadline = new Date(`${deadlineDate}T${deadlineTime}`);
            const durationNum = parseInt(duration) || 30;

            await onSubmit({
                title: title.trim(),
                duration: durationNum,
                deadline,
                priority,
                status: 'Pending',
                isFixed,
            });

            resetForm();
            setOpen(false);
        } catch (err) {
            console.error('Failed to add task:', err);
            setError('Failed to add task. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            resetForm();
            setSubmitting(false);
        }
    };

    const durationNum = parseInt(duration) || 0;
    const isInterrupt = durationNum > 0 && durationNum <= 2;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    className="gap-2 glow-primary hover:scale-105 transition-transform duration-200 cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    New Process
                </Button>
            </DialogTrigger>
            <DialogContent className="glass border-border/30 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Zap className="w-5 h-5 text-primary" />
                        Spawn New Process
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs font-mono">
                        {isInterrupt
                            ? '⚡ Interrupt — will be scheduled immediately'
                            : 'Task will be scheduled via EDF algorithm'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Error Message */}
                    {error && (
                        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 font-mono">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="text-xs font-medium">
                            Process Name
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Write report, Gym session..."
                            className="bg-background/50"
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                    </div>

                    {/* Duration */}
                    <div className="grid gap-2">
                        <Label htmlFor="duration" className="text-xs font-medium flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            Duration (minutes)
                        </Label>
                        <Input
                            id="duration"
                            type="number"
                            min="1"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="bg-background/50"
                        />
                        {isInterrupt && (
                            <p className="text-xs text-chart-4 font-mono mt-1">
                                ⚡ &lt;2min → Interrupt mode (Greedy scheduling)
                            </p>
                        )}
                    </div>

                    {/* Deadline */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="deadline-date" className="text-xs font-medium flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                Deadline Date
                            </Label>
                            <Input
                                id="deadline-date"
                                type="date"
                                value={deadlineDate}
                                onChange={(e) => setDeadlineDate(e.target.value)}
                                className="bg-background/50"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="deadline-time" className="text-xs font-medium">
                                Time
                            </Label>
                            <Input
                                id="deadline-time"
                                type="time"
                                value={deadlineTime}
                                onChange={(e) => setDeadlineTime(e.target.value)}
                                className="bg-background/50"
                            />
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="grid gap-2">
                        <Label className="text-xs font-medium flex items-center gap-2">
                            <Flag className="w-3 h-3" />
                            Priority Level
                        </Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                            <SelectTrigger className="bg-background/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="High">🔴 High — Protected from OOM Killer</SelectItem>
                                <SelectItem value="Medium">🟡 Medium — Compressible</SelectItem>
                                <SelectItem value="Low">🔵 Low — Droppable</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Fixed event toggle */}
                    <div className="flex items-center justify-between rounded-lg bg-background/30 p-3">
                        <div>
                            <Label htmlFor="fixed" className="text-xs font-medium cursor-pointer">
                                Fixed Event
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Locked timeslot (e.g. Gym, Dinner)
                            </p>
                        </div>
                        <Switch id="fixed" checked={isFixed} onCheckedChange={setIsFixed} />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => handleOpenChange(false)}
                        className="cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!title.trim() || submitting}
                        className="glow-primary cursor-pointer"
                    >
                        {submitting ? 'Spawning...' : 'Spawn Process'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
