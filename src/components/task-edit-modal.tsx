'use client';

import { useState, useEffect } from 'react';
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
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Pencil, Clock, Flag, Calendar, Trash2 } from 'lucide-react';
import { Priority, Task } from '@/types';
import { format } from 'date-fns';
import { formatDuration } from '@/lib/scheduler';

interface TaskEditModalProps {
    task: Task | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onComplete: (id: string) => Promise<void>;
}

export function TaskEditModal({ task, open, onOpenChange, onUpdate, onDelete, onComplete }: TaskEditModalProps) {
    const [title, setTitle] = useState('');
    const [durationHours, setDurationHours] = useState('0');
    const [durationMinutes, setDurationMinutes] = useState('30');
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');
    const [priority, setPriority] = useState<Priority>('Medium');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Sync form state with task prop
    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDurationHours(Math.floor(task.duration / 60).toString());
            setDurationMinutes((task.duration % 60).toString());
            setDeadlineDate(format(task.deadline, 'yyyy-MM-dd'));
            setDeadlineTime(format(task.deadline, 'HH:mm'));
            setPriority(task.priority);
            setError('');
        }
    }, [task]);

    if (!task) return null;

    const totalMinutes = (parseInt(durationHours) || 0) * 60 + (parseInt(durationMinutes) || 0);

    const handleSave = async () => {
        if (!title.trim()) return;
        if (totalMinutes <= 0) {
            setError('Duration must be at least 1 minute.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const deadline = new Date(`${deadlineDate}T${deadlineTime}`);
            await onUpdate(task.id, {
                title: title.trim(),
                duration: totalMinutes,
                deadline,
                priority,
            });
            onOpenChange(false);
        } catch (err) {
            console.error('Failed to update task:', err);
            setError('Failed to update. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await onDelete(task.id);
            onOpenChange(false);
        } catch (err) {
            console.error('Failed to delete task:', err);
            setError('Failed to delete.');
        } finally {
            setSaving(false);
        }
    };

    const handleComplete = async () => {
        setSaving(true);
        try {
            await onComplete(task.id);
            onOpenChange(false);
        } catch (err) {
            console.error('Failed to complete task:', err);
        } finally {
            setSaving(false);
        }
    };

    const isCompleted = task.status === 'Completed';
    const isDropped = task.status === 'Dropped';
    const isActive = !isCompleted && !isDropped;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass border-border/30 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Pencil className="w-5 h-5 text-primary" />
                        Edit Process
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs font-mono">
                        PID: {task.id.slice(0, 12)} • Status: {task.status}
                        {task.completedAt && ` • Completed: ${format(task.completedAt, 'MMM d, HH:mm')}`}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {error && (
                        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 font-mono">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="grid gap-2">
                        <Label htmlFor="edit-title" className="text-xs font-medium">
                            Process Name
                        </Label>
                        <Input
                            id="edit-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-background/50"
                            disabled={!isActive}
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
                                <Label htmlFor="edit-dur-hours" className="text-[10px] text-muted-foreground mb-1 block">Hours</Label>
                                <Input
                                    id="edit-dur-hours"
                                    type="number"
                                    min="0"
                                    max="24"
                                    value={durationHours}
                                    onChange={(e) => setDurationHours(e.target.value)}
                                    className="bg-background/50"
                                    disabled={!isActive}
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-dur-min" className="text-[10px] text-muted-foreground mb-1 block">Minutes</Label>
                                <Input
                                    id="edit-dur-min"
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(e.target.value)}
                                    className="bg-background/50"
                                    disabled={!isActive}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Deadline */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                Deadline Date
                            </Label>
                            <Input
                                type="date"
                                value={deadlineDate}
                                onChange={(e) => setDeadlineDate(e.target.value)}
                                className="bg-background/50"
                                disabled={!isActive}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium">Time</Label>
                            <Input
                                type="time"
                                value={deadlineTime}
                                onChange={(e) => setDeadlineTime(e.target.value)}
                                className="bg-background/50"
                                disabled={!isActive}
                            />
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="grid gap-2">
                        <Label className="text-xs font-medium flex items-center gap-2">
                            <Flag className="w-3 h-3" />
                            Priority Level
                        </Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)} disabled={!isActive}>
                            <SelectTrigger className="bg-background/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="High">🔴 High</SelectItem>
                                <SelectItem value="Medium">🟡 Medium</SelectItem>
                                <SelectItem value="Low">🔵 Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Created Info */}
                    <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between px-1">
                        <span>Created: {format(task.createdAt, 'MMM d, yyyy HH:mm')}</span>
                        <span className={`px-1.5 py-0.5 rounded priority-${task.priority.toLowerCase()}`}>
                            {task.status}
                        </span>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {isActive && (
                        <div className="flex gap-2 mr-auto">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDelete}
                                disabled={saving}
                                className="cursor-pointer"
                            >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleComplete}
                                disabled={saving}
                                className="text-chart-2 border-chart-2/30 hover:bg-chart-2/10 cursor-pointer"
                            >
                                Complete
                            </Button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="cursor-pointer">
                            Cancel
                        </Button>
                        {isActive && (
                            <Button onClick={handleSave} disabled={saving || !title.trim()} className="glow-primary cursor-pointer">
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
