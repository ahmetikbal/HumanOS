'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FixedEvent } from '@/types';
import { Trash2, Save } from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface FixedEventEditModalProps {
    event: FixedEvent | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: (eventId: string, updates: Partial<FixedEvent>) => Promise<void>;
    onDelete: (eventId: string) => Promise<void>;
}

export function FixedEventEditModal({
    event,
    open,
    onOpenChange,
    onUpdate,
    onDelete,
}: FixedEventEditModalProps) {
    const [title, setTitle] = useState('');
    const [timeStart, setTimeStart] = useState('');
    const [timeEnd, setTimeEnd] = useState('');
    const [days, setDays] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (event) {
            setTitle(event.title);
            setTimeStart(event.timeStart);
            setTimeEnd(event.timeEnd);
            setDays([...event.days]);
        }
    }, [event]);

    if (!event) return null;

    const toggleDay = (day: number) => {
        setDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const selectAllDays = () => setDays([0, 1, 2, 3, 4, 5, 6]);
    const selectWeekdays = () => setDays([1, 2, 3, 4, 5]);

    const handleSave = async () => {
        if (!title.trim() || !timeStart || !timeEnd || days.length === 0) return;
        setSaving(true);
        try {
            await onUpdate(event.id, { title: title.trim(), timeStart, timeEnd, days });
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await onDelete(event.id);
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md glass">
                <DialogHeader>
                    <DialogTitle className="text-sm font-medium">Edit Fixed Event</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Event Name</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Gym, Dinner"
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Times */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Start Time</Label>
                            <Input
                                type="time"
                                value={timeStart}
                                onChange={(e) => setTimeStart(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">End Time</Label>
                            <Input
                                type="time"
                                value={timeEnd}
                                onChange={(e) => setTimeEnd(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* Days */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Repeat Days</Label>
                            <div className="flex gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 cursor-pointer"
                                    onClick={selectWeekdays}
                                >
                                    Weekdays
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 cursor-pointer"
                                    onClick={selectAllDays}
                                >
                                    Every Day
                                </Button>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {DAY_NAMES.map((name, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => toggleDay(i)}
                                    className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all cursor-pointer
                                        ${days.includes(i)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-background/30 text-muted-foreground hover:bg-background/50'
                                        }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex justify-between sm:justify-between gap-2">
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={saving}
                        className="cursor-pointer"
                    >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving || !title.trim() || days.length === 0}
                        className="cursor-pointer"
                    >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
