'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { useSettings } from '@/hooks/useSettings';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
    Settings as SettingsIcon,
    Moon,
    Sun,
    Target,
    Clock,
    Plus,
    Trash2,
    Calendar,
} from 'lucide-react';
import { calculateSleepShift } from '@/lib/sleep-shifter';
import { FixedEvent } from '@/types';

export default function SettingsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { settings, updateSettings, addFixedEvent, removeFixedEvent } = useSettings();


    // Local form state
    const [wakeTime, setWakeTime] = useState(settings.wakeTime);
    const [bedTime, setBedTime] = useState(settings.bedTime);
    const [targetWakeTime, setTargetWakeTime] = useState(settings.targetWakeTime ?? '');
    const [saving, setSaving] = useState(false);
    const [shiftRate, setShiftRate] = useState(settings.shiftRateMin.toString());

    // Fixed event form
    const [eventTitle, setEventTitle] = useState('');
    const [eventStart, setEventStart] = useState('');
    const [eventEnd, setEventEnd] = useState('');
    const [eventDays, setEventDays] = useState<number[]>([]);

    // Update local state when settings change
    useEffect(() => {
        setWakeTime(settings.wakeTime);
        setBedTime(settings.bedTime);
        setTargetWakeTime(settings.targetWakeTime ?? '');
        setShiftRate(settings.shiftRateMin.toString());
    }, [settings]);

    useEffect(() => {
        if (!loading && !user) router.push('/');
    }, [user, loading, router]);

    if (loading || !user) return null;

    const handleSaveTime = async () => {
        setSaving(true);
        try {
            await updateSettings({
                wakeTime,
                bedTime,
                targetWakeTime: targetWakeTime || undefined,
                shiftRateMin: parseInt(shiftRate) || 15,
            });
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddEvent = async () => {
        if (!eventTitle || !eventStart || !eventEnd || eventDays.length === 0) return;

        const newEvent: FixedEvent = {
            id: crypto.randomUUID(),
            title: eventTitle,
            timeStart: eventStart,
            timeEnd: eventEnd,
            days: eventDays,
        };

        await addFixedEvent(newEvent);
        setEventTitle('');
        setEventStart('');
        setEventEnd('');
        setEventDays([]);
    };

    const toggleDay = (day: number) => {
        setEventDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    // Calculate sleep shift preview
    const sleepShift = targetWakeTime
        ? calculateSleepShift(wakeTime, targetWakeTime, bedTime, parseInt(shiftRate) || 15, 1)
        : null;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">
                        <span className="text-gradient">Settings</span>
                    </h1>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                        System Configuration — BIOS Settings
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Sleep Schedule */}
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Moon className="w-4 h-4 text-chart-4" />
                                Sleep Schedule
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="wake" className="text-xs flex items-center gap-2">
                                        <Sun className="w-3 h-3" /> Wake Time
                                    </Label>
                                    <Input
                                        id="wake"
                                        type="time"
                                        value={wakeTime}
                                        onChange={(e) => setWakeTime(e.target.value)}
                                        className="bg-background/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bed" className="text-xs flex items-center gap-2">
                                        <Moon className="w-3 h-3" /> Bed Time
                                    </Label>
                                    <Input
                                        id="bed"
                                        type="time"
                                        value={bedTime}
                                        onChange={(e) => setBedTime(e.target.value)}
                                        className="bg-background/50"
                                    />
                                </div>
                            </div>

                            <Separator className="my-3" />

                            {/* Sleep Shifter */}
                            <div className="space-y-3">
                                <Label className="text-xs font-medium flex items-center gap-2">
                                    <Target className="w-3 h-3 text-chart-2" /> Sleep Shifter
                                </Label>
                                <p className="text-[10px] text-muted-foreground">
                                    Gradually shift your wake time toward a target by adjusting each
                                    day.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="target-wake" className="text-[10px]">
                                            Target Wake Time
                                        </Label>
                                        <Input
                                            id="target-wake"
                                            type="time"
                                            value={targetWakeTime}
                                            onChange={(e) => setTargetWakeTime(e.target.value)}
                                            className="bg-background/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="shift-rate" className="text-[10px]">
                                            Shift Rate (min/day)
                                        </Label>
                                        <Input
                                            id="shift-rate"
                                            type="number"
                                            min="1"
                                            max="60"
                                            value={shiftRate}
                                            onChange={(e) => setShiftRate(e.target.value)}
                                            className="bg-background/50"
                                        />
                                    </div>
                                </div>

                                {sleepShift && (
                                    <div className="rounded-lg bg-chart-2/5 border border-chart-2/10 p-3 text-xs font-mono">
                                        <p className="text-chart-2 mb-1">Sleep Shifter Preview (Day 1):</p>
                                        <p className="text-muted-foreground">
                                            Wake: {wakeTime} → {sleepShift.newWakeTime} | Bed:{' '}
                                            {bedTime} → {sleepShift.newBedTime}
                                        </p>
                                        <p className="text-muted-foreground">
                                            {sleepShift.isTargetReached
                                                ? '✓ Target reached!'
                                                : `~${sleepShift.daysRemaining} days to target`}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Button onClick={handleSaveTime} disabled={saving} className="w-full cursor-pointer">
                                {saving ? 'Saving...' : 'Save Sleep Settings'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Fixed Events */}
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-chart-4" />
                                Fixed Events (Locked Timeslots)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pb-6">
                            {/* Existing events */}
                            {settings.fixedEvents.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {settings.fixedEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex items-center justify-between p-3 rounded-lg bg-background/30"
                                        >
                                            <div>
                                                <p className="text-xs font-medium">{event.title}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono">
                                                    {event.timeStart} – {event.timeEnd} •{' '}
                                                    {event.days.map((d) => dayNames[d]).join(', ')}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeFixedEvent(event.id)}
                                                className="text-destructive hover:text-destructive cursor-pointer"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Separator />

                            {/* Add new event */}
                            <div className="space-y-3">
                                <Label className="text-xs font-medium">Add Fixed Event</Label>
                                <Input
                                    placeholder="Event name (e.g. Gym, Dinner)"
                                    value={eventTitle}
                                    onChange={(e) => setEventTitle(e.target.value)}
                                    className="bg-background/50"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="time"
                                        value={eventStart}
                                        onChange={(e) => setEventStart(e.target.value)}
                                        className="bg-background/50"
                                        placeholder="Start"
                                    />
                                    <Input
                                        type="time"
                                        value={eventEnd}
                                        onChange={(e) => setEventEnd(e.target.value)}
                                        className="bg-background/50"
                                        placeholder="End"
                                    />
                                </div>

                                {/* Day selector */}
                                <div className="flex gap-1.5">
                                    {dayNames.map((name, i) => (
                                        <button
                                            key={i}
                                            onClick={() => toggleDay(i)}
                                            className={`text-[10px] w-9 h-7 rounded-md font-medium transition-colors cursor-pointer ${eventDays.includes(i)
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-background/30 text-muted-foreground hover:bg-background/50'
                                                }`}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>

                                <Button
                                    onClick={handleAddEvent}
                                    variant="outline"
                                    className="w-full cursor-pointer"
                                    disabled={!eventTitle || !eventStart || !eventEnd || eventDays.length === 0}
                                >
                                    <Plus className="w-3 h-3 mr-2" />
                                    Add Fixed Event
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
