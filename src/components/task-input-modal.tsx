'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatDuration } from '@/lib/scheduler';

interface TaskInputModalProps {
    onSubmit: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
}

export function TaskInputModal({ onSubmit }: TaskInputModalProps) {
    const [open, setOpen] = useState(false);

    const [title, setTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [description, setDescription] = useState('');

    // Task-specific — separate hours and minutes
    const [durationHours, setDurationHours] = useState('0');
    const [durationMinutes, setDurationMinutes] = useState('30');
    const [deadlineDate, setDeadlineDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [deadlineTime, setDeadlineTime] = useState('23:59');
    const [priority, setPriority] = useState<Priority>('Medium');

    const resetForm = () => {
        setTitle('');
        setDurationHours('0');
        setDurationMinutes('30');
        setDeadlineDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
        setDeadlineTime('23:59');
        setPriority('Medium');
        setError('');
        setDescription('');
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setSubmitting(true);
        setError('');

        try {
            const deadline = new Date(`${deadlineDate}T${deadlineTime}`);
            const durationNum = (parseInt(durationHours) || 0) * 60 + (parseInt(durationMinutes) || 0);
            if (durationNum <= 0) {
                setError('Duration must be at least 1 minute.');
                setSubmitting(false);
                return;
            }

            await onSubmit({
                title: title.trim(),
                description: description.trim() || undefined,
                duration: durationNum,
                deadline,
                priority,
                status: 'Pending',
                isFixed: false,
            });

            resetForm();
            setOpen(false);
        } catch (err) {
            console.error('Failed to create:', err);
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

    const totalMinutes = (parseInt(durationHours) || 0) * 60 + (parseInt(durationMinutes) || 0);
    const isInterrupt = totalMinutes > 0 && totalMinutes <= 15;

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
                            placeholder="e.g. Write report, Study..."
                            className="bg-background/50"
                            onKeyDown={(e) => e.key === 'Enter' && title.trim() && handleSubmit()}
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-xs font-medium">
                            Description <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Notes, links, context..."
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            rows={2}
                        />
                    </div>

                    {/* Duration — Hours + Minutes */}
                    <div className="grid gap-2">
                        <Label className="text-xs font-medium flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            Duration
                            {totalMinutes > 0 && (
                                <span className="text-muted-foreground font-mono text-[10px] ml-auto">
                                    = {formatDuration(totalMinutes)}
                                </span>
                            )}
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="dur-hours" className="text-[10px] text-muted-foreground mb-1 block">Hours</Label>
                                <Input
                                    id="dur-hours"
                                    type="number"
                                    min="0"
                                    max="24"
                                    value={durationHours}
                                    onChange={(e) => setDurationHours(e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                            <div>
                                <Label htmlFor="dur-min" className="text-[10px] text-muted-foreground mb-1 block">Minutes</Label>
                                <Input
                                    id="dur-min"
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                        </div>
                        {isInterrupt && (
                            <p className="text-xs text-chart-4 font-mono mt-1">
                                ⚡ ≤15min → Interrupt mode (Greedy scheduling)
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
                        className="cursor-pointer glow-primary"
                    >
                        {submitting ? 'Spawning...' : 'Spawn Process'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
