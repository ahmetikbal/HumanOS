'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { FixedEventEditModal } from '@/components/fixed-event-edit-modal';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
    Trash2,
    Pencil,
    Pin,
    Clock,
    Zap,
    Calendar,
    Plus,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { FixedEvent, CalendarEvent } from '@/types';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function InterruptsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const {
        settings,
        addFixedEvent,
        removeFixedEvent,
        updateFixedEvent,
        addCalendarEvent,
        removeCalendarEvent,
        updateCalendarEvent,
    } = useSettings();

    // Tab state
    const [activeTab, setActiveTab] = useState<'calendar' | 'fixed'>('calendar');

    // Fixed event modal state
    const [editFixedEvent, setEditFixedEvent] = useState<FixedEvent | null>(null);
    const [editFixedOpen, setEditFixedOpen] = useState(false);

    // Calendar event form state
    const [calModalOpen, setCalModalOpen] = useState(false);
    const [editingCalEvent, setEditingCalEvent] = useState<CalendarEvent | null>(null);
    const [calTitle, setCalTitle] = useState('');
    const [calDate, setCalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [calStart, setCalStart] = useState('12:00');
    const [calEnd, setCalEnd] = useState('13:00');
    const [calDesc, setCalDesc] = useState('');
    const [calSaving, setCalSaving] = useState(false);
    const [isFixedEvent, setIsFixedEvent] = useState(false); // toggle for recurring
    const [fixedDays, setFixedDays] = useState<number[]>([]);

    useEffect(() => {
        if (!loading && !user) router.push('/');
    }, [user, loading, router]);

    if (loading || !user) return null;

    const calendarEvents = settings.calendarEvents || [];

    // ─── Calendar Event Handlers ───
    const openCalModal = (event?: CalendarEvent) => {
        if (event) {
            setEditingCalEvent(event);
            setCalTitle(event.title);
            setCalDate(event.date);
            setCalStart(event.timeStart);
            setCalEnd(event.timeEnd);
            setCalDesc(event.description || '');
            setIsFixedEvent(false);
        } else {
            setEditingCalEvent(null);
            setCalTitle('');
            setCalDate(format(new Date(), 'yyyy-MM-dd'));
            setCalStart('12:00');
            setCalEnd('13:00');
            setCalDesc('');
            setIsFixedEvent(false);
            setFixedDays([]);
        }
        setCalModalOpen(true);
    };

    const handleCalSubmit = async () => {
        if (!calTitle.trim()) return;
        setCalSaving(true);
        try {
            if (isFixedEvent) {
                // Create a recurring fixed event
                if (fixedDays.length === 0) {
                    setCalSaving(false);
                    return;
                }
                await addFixedEvent({
                    id: crypto.randomUUID(),
                    title: calTitle.trim(),
                    timeStart: calStart,
                    timeEnd: calEnd,
                    days: fixedDays,
                });
            } else if (editingCalEvent) {
                await updateCalendarEvent(editingCalEvent.id, {
                    title: calTitle.trim(),
                    date: calDate,
                    timeStart: calStart,
                    timeEnd: calEnd,
                    ...(calDesc.trim() ? { description: calDesc.trim() } : {}),
                });
            } else {
                // Build calendar event object without undefined fields
                const newEvent: CalendarEvent = {
                    id: crypto.randomUUID(),
                    title: calTitle.trim(),
                    date: calDate,
                    timeStart: calStart,
                    timeEnd: calEnd,
                };
                if (calDesc.trim()) {
                    newEvent.description = calDesc.trim();
                }
                await addCalendarEvent(newEvent);
            }
            setCalModalOpen(false);
        } catch (err) {
            console.error('Failed to save event:', err);
        } finally {
            setCalSaving(false);
        }
    };

    const handleDeleteCalEvent = async (eventId: string) => {
        try {
            await removeCalendarEvent(eventId);
        } catch (err) {
            console.error('Failed to delete calendar event:', err);
        }
    };

    // ─── Fixed Event Handlers ───
    const toggleDay = (day: number) => {
        setFixedDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const selectAllDays = () => {
        if (fixedDays.length === 7) {
            setFixedDays([]);
        } else {
            setFixedDays([0, 1, 2, 3, 4, 5, 6]);
        }
    };

    const tabs = [
        { key: 'calendar' as const, label: 'Calendar Events', count: calendarEvents.length },
        { key: 'fixed' as const, label: 'Fixed Events', count: settings.fixedEvents.length },
    ];

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="text-gradient">Interrupts</span>
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                            Hardware Interrupts — {calendarEvents.length} events • {settings.fixedEvents.length} fixed
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className="gap-2 glow-primary hover:scale-105 transition-transform duration-200 cursor-pointer"
                        onClick={() => openCalModal()}
                    >
                        <Plus className="w-4 h-4" />
                        New Event
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.key
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                }`}
                        >
                            {tab.label}
                            <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
                        </button>
                    ))}
                </div>

                {activeTab === 'calendar' ? (
                    /* ─── Calendar Events ─── */
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-chart-2" />
                                Calendar Events — One-Time Interrupts
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                            {calendarEvents.length === 0 ? (
                                <p className="text-xs text-muted-foreground font-mono text-center py-8">
                                    No calendar events. Click &quot;New Event&quot; to add a meeting, appointment, etc.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {[...calendarEvents]
                                        .sort((a, b) => `${a.date}${a.timeStart}`.localeCompare(`${b.date}${b.timeStart}`))
                                        .map((event) => (
                                            <div
                                                key={event.id}
                                                className="flex items-center justify-between p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-chart-2/10 flex items-center justify-center flex-shrink-0">
                                                        <Calendar className="w-4 h-4 text-chart-2" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium truncate">{event.title}</p>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                                            <Clock className="w-2.5 h-2.5" />
                                                            <span>{event.date}</span>
                                                            <span>•</span>
                                                            <span>{event.timeStart} – {event.timeEnd}</span>
                                                        </div>
                                                        {event.description && (
                                                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[300px]">
                                                                {event.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openCalModal(event)}
                                                        className="h-7 w-7 p-0 cursor-pointer"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteCalEvent(event.id)}
                                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    /* ─── Fixed Events ─── */
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Pin className="w-4 h-4 text-chart-4" />
                                Fixed Events — Recurring Locked Slots
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                            {settings.fixedEvents.length === 0 ? (
                                <p className="text-xs text-muted-foreground font-mono text-center py-8">
                                    No fixed events. Click &quot;New Fixed Event&quot; to create a recurring slot.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {settings.fixedEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex items-center justify-between p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                                                    <Pin className="w-4 h-4 text-chart-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{event.title}</p>
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        <span>{event.timeStart} – {event.timeEnd}</span>
                                                        <span>•</span>
                                                        <span>{event.days.map((d) => dayNames[d]).join(', ')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditFixedEvent(event);
                                                        setEditFixedOpen(true);
                                                    }}
                                                    className="h-7 w-7 p-0 cursor-pointer"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeFixedEvent(event.id)}
                                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive cursor-pointer"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </main>

            {/* Calendar / Fixed Event Modal */}
            <Dialog open={calModalOpen} onOpenChange={setCalModalOpen}>
                <DialogContent className="glass border-border/30 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            {isFixedEvent ? <Pin className="w-5 h-5 text-chart-4" /> : <Calendar className="w-5 h-5 text-chart-2" />}
                            {editingCalEvent ? 'Edit Event' : isFixedEvent ? 'New Fixed Event' : 'New Calendar Event'}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs font-mono">
                            {isFixedEvent
                                ? '📌 Recurring locked slot — blocks the same time every week'
                                : '📅 One-time interrupt — blocks time on a specific date'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        {/* Fixed Event Toggle — only for new events */}
                        {!editingCalEvent && (
                            <div className="flex items-center justify-between rounded-lg bg-chart-4/5 border border-chart-4/20 p-3">
                                <div>
                                    <Label htmlFor="fixed-toggle" className="text-xs font-medium cursor-pointer flex items-center gap-2">
                                        <Pin className="w-3 h-3 text-chart-4" />
                                        Fixed Event
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Recurring locked slot (e.g. Gym, Dinner, Class)
                                    </p>
                                </div>
                                <Switch id="fixed-toggle" checked={isFixedEvent} onCheckedChange={setIsFixedEvent} />
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="cal-title" className="text-xs font-medium">
                                Event Name
                            </Label>
                            <Input
                                id="cal-title"
                                value={calTitle}
                                onChange={(e) => setCalTitle(e.target.value)}
                                placeholder={isFixedEvent ? 'e.g. Gym, Lunch, Class...' : 'e.g. Team meeting, Doctor appointment...'}
                                className="bg-background/50"
                            />
                        </div>

                        {/* Date — only for calendar events */}
                        {!isFixedEvent && (
                            <div className="grid gap-2">
                                <Label htmlFor="cal-date" className="text-xs font-medium flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> Date
                                </Label>
                                <Input
                                    id="cal-date"
                                    type="date"
                                    value={calDate}
                                    onChange={(e) => setCalDate(e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label className="text-xs font-medium flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> Start Time
                                </Label>
                                <Input
                                    type="time"
                                    value={calStart}
                                    onChange={(e) => setCalStart(e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs font-medium flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> End Time
                                </Label>
                                <Input
                                    type="time"
                                    value={calEnd}
                                    onChange={(e) => setCalEnd(e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                        </div>

                        {/* Day Selector — only for fixed events */}
                        {isFixedEvent && (
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium flex items-center gap-2">
                                        <Calendar className="w-3 h-3" /> Repeat Days
                                    </Label>
                                    <button
                                        onClick={selectAllDays}
                                        className="text-[10px] text-primary hover:underline cursor-pointer"
                                    >
                                        {fixedDays.length === 7 ? 'Deselect All' : 'Every Day'}
                                    </button>
                                </div>
                                <div className="flex gap-1.5">
                                    {dayNames.map((name, i) => (
                                        <button
                                            key={i}
                                            onClick={() => toggleDay(i)}
                                            className={`text-[10px] flex-1 h-8 rounded-md font-medium transition-all duration-150 cursor-pointer ${fixedDays.includes(i)
                                                ? 'bg-chart-4 text-white scale-105 shadow-md'
                                                : 'bg-background/30 text-muted-foreground hover:bg-background/50'
                                                }`}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description — only for calendar events */}
                        {!isFixedEvent && (
                            <div className="grid gap-2">
                                <Label htmlFor="cal-desc" className="text-xs font-medium">
                                    Description <span className="text-muted-foreground font-normal">(optional)</span>
                                </Label>
                                <textarea
                                    id="cal-desc"
                                    value={calDesc}
                                    onChange={(e) => setCalDesc(e.target.value)}
                                    placeholder="Meeting agenda, location, links..."
                                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                                    rows={2}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCalModalOpen(false)} className="cursor-pointer">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCalSubmit}
                            disabled={!calTitle.trim() || calSaving || (isFixedEvent && fixedDays.length === 0)}
                            className={isFixedEvent ? 'bg-chart-4 hover:bg-chart-4/90 cursor-pointer' : 'glow-primary cursor-pointer'}
                        >
                            {calSaving ? 'Saving...' : editingCalEvent ? 'Save Changes' : isFixedEvent ? '📌 Create Fixed Event' : '📅 Create Event'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Fixed Event Edit Modal */}
            <FixedEventEditModal
                event={editFixedEvent}
                open={editFixedOpen}
                onOpenChange={setEditFixedOpen}
                onUpdate={updateFixedEvent}
                onDelete={removeFixedEvent}
            />
        </div >
    );
}

