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
import { Plus, Clock, Flag, Calendar, Zap, Pin } from 'lucide-react';
import { Priority, Task, FixedEvent } from '@/types';
import { format, addDays } from 'date-fns';
import { formatDuration } from '@/lib/scheduler';

interface TaskInputModalProps {
    onSubmit: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
    onAddFixedEvent: (event: FixedEvent) => Promise<void>;
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TaskInputModal({ onSubmit, onAddFixedEvent }: TaskInputModalProps) {
    const [open, setOpen] = useState(false);

    // Shared
    const [title, setTitle] = useState('');
    const [isFixed, setIsFixed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [description, setDescription] = useState('');

    // Task-specific — separate hours and minutes
    const [durationHours, setDurationHours] = useState('0');
    const [durationMinutes, setDurationMinutes] = useState('30');
    const [deadlineDate, setDeadlineDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [deadlineTime, setDeadlineTime] = useState('23:59');
    const [priority, setPriority] = useState<Priority>('Medium');

    // Fixed event-specific
    const [eventStart, setEventStart] = useState('12:00');
    const [eventEnd, setEventEnd] = useState('13:00');
    const [eventDays, setEventDays] = useState<number[]>([]);

    const resetForm = () => {
        setTitle('');
        setIsFixed(false);
        setDurationHours('0');
        setDurationMinutes('30');
        setDeadlineDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
        setDeadlineTime('23:59');
        setPriority('Medium');
        setEventStart('12:00');
        setEventEnd('13:00');
        setEventDays([]);
        setError('');
        setDescription('');
    };

    const toggleDay = (day: number) => {
        setEventDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const selectAllDays = () => {
        if (eventDays.length === 7) {
            setEventDays([]);
        } else {
            setEventDays([0, 1, 2, 3, 4, 5, 6]);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setSubmitting(true);
        setError('');

        try {
            if (isFixed) {
                // Create a fixed event via settings
                if (!eventStart || !eventEnd || eventDays.length === 0) {
                    setError('Please set start time, end time, and at least one day.');
                    setSubmitting(false);
                    return;
                }
                const fixedEvent: FixedEvent = {
                    id: crypto.randomUUID(),
                    title: title.trim(),
                    timeStart: eventStart,
                    timeEnd: eventEnd,
                    days: eventDays,
                };
                await onAddFixedEvent(fixedEvent);
            } else {
                // Create a regular task
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
            }

            resetForm();
            setOpen(false);
        } catch (err) {
            console.error('Failed to create:', err);
            setError(isFixed ? 'Failed to create fixed event.' : 'Failed to add task. Please try again.');
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
    const isInterrupt = !isFixed && totalMinutes > 0 && totalMinutes <= 15;

    const canSubmit = isFixed
        ? title.trim() && eventStart && eventEnd && eventDays.length > 0
        : title.trim();

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
                        {isFixed ? (
                            <Pin className="w-5 h-5 text-chart-4" />
                        ) : (
                            <Zap className="w-5 h-5 text-primary" />
                        )}
                        {isFixed ? 'Create Fixed Event' : 'Spawn New Process'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs font-mono">
                        {isFixed
                            ? '📌 Locked timeslot — recurs on selected days'
                            : isInterrupt
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

                    {/* Fixed event toggle — AT THE TOP */}
                    <div className="flex items-center justify-between rounded-lg bg-chart-4/5 border border-chart-4/20 p-3">
                        <div>
                            <Label htmlFor="fixed" className="text-xs font-medium cursor-pointer flex items-center gap-2">
                                <Pin className="w-3 h-3 text-chart-4" />
                                Fixed Event
                            </Label>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                Recurring locked slot (e.g. Gym, Dinner, Class)
                            </p>
                        </div>
                        <Switch id="fixed" checked={isFixed} onCheckedChange={setIsFixed} />
                    </div>

                    {/* Title */}
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="text-xs font-medium">
                            {isFixed ? 'Event Name' : 'Process Name'}
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={isFixed ? 'e.g. Gym, Lunch, Class...' : 'e.g. Write report, Study...'}
                            className="bg-background/50"
                            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
                        />
                    </div>

                    {!isFixed && (
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
                    )}

                    {isFixed ? (
                        /* ─── Fixed Event Fields ─── */
                        <>
                            {/* Time Range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label className="text-xs font-medium flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        Start Time
                                    </Label>
                                    <Input
                                        type="time"
                                        value={eventStart}
                                        onChange={(e) => setEventStart(e.target.value)}
                                        className="bg-background/50"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-xs font-medium flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        End Time
                                    </Label>
                                    <Input
                                        type="time"
                                        value={eventEnd}
                                        onChange={(e) => setEventEnd(e.target.value)}
                                        className="bg-background/50"
                                    />
                                </div>
                            </div>

                            {/* Day Selector */}
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium flex items-center gap-2">
                                        <Calendar className="w-3 h-3" />
                                        Repeat Days
                                    </Label>
                                    <button
                                        onClick={selectAllDays}
                                        className="text-[10px] text-primary hover:underline cursor-pointer"
                                    >
                                        {eventDays.length === 7 ? 'Deselect All' : 'Every Day'}
                                    </button>
                                </div>
                                <div className="flex gap-1.5">
                                    {dayNames.map((name, i) => (
                                        <button
                                            key={i}
                                            onClick={() => toggleDay(i)}
                                            className={`text-[10px] flex-1 h-8 rounded-md font-medium transition-all duration-150 cursor-pointer ${eventDays.includes(i)
                                                ? 'bg-chart-4 text-white scale-105 shadow-md'
                                                : 'bg-background/30 text-muted-foreground hover:bg-background/50'
                                                }`}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* ─── Regular Task Fields ─── */
                        <>
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
                        </>
                    )}
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
                        disabled={!canSubmit || submitting}
                        className={`cursor-pointer ${isFixed ? 'bg-chart-4 hover:bg-chart-4/90' : 'glow-primary'}`}
                    >
                        {submitting
                            ? (isFixed ? 'Creating...' : 'Spawning...')
                            : (isFixed ? '📌 Create Event' : 'Spawn Process')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
