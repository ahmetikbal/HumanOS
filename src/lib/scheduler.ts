// ============================================================
// HUMAN OS — The Kernel (Greedy Bin-Packing EDF Scheduler)
// ============================================================
// Treats user time as CPU cycles, tasks as processes
// Maximizes daily utilization — fills days from today forward
// EDF ordering ensures earliest deadlines are handled first
// ============================================================

import {
    startOfDay,
    endOfDay,
    setHours,
    setMinutes,
    addMinutes,
    addDays,
    isAfter,
    isBefore,
    isSameDay,
    format,
    differenceInMinutes,
    startOfWeek,
} from 'date-fns';
import { Task, ScheduleSlot, DaySchedule, UserSettings } from '@/types';

// Greedy threshold: tasks under this duration are scheduled immediately
const GREEDY_THRESHOLD_MIN = 15;

// ─── Helper: Parse "HH:mm" to Date on a given day ───
function parseTime(timeStr: string, day: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return setMinutes(setHours(startOfDay(day), hours), minutes);
}

// ─── Helper: Get duration of a slot in minutes ───
function slotDuration(slot: ScheduleSlot): number {
    return differenceInMinutes(slot.timeEnd, slot.timeStart);
}

// ─── Helper: Format duration as "Xh Ym" ───
export function formatDuration(minutes: number): string {
    if (minutes < 0) return '0m';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

// ─── Step A: Lay down Fixed blocks (Sleep + user events) ───
function generateFixedBlocks(
    day: Date,
    settings: UserSettings
): ScheduleSlot[] {
    const slots: ScheduleSlot[] = [];
    const wakeTime = parseTime(settings.wakeTime, day);
    const bedTime = parseTime(settings.bedTime, day);

    // Fixed events for this day of week
    const dayOfWeek = day.getDay(); // 0=Sunday
    const todaysFixedEvents = settings.fixedEvents.filter((e) =>
        e.days.includes(dayOfWeek)
    );

    for (const event of todaysFixedEvents) {
        let eventStart = parseTime(event.timeStart, day);
        let eventEnd = parseTime(event.timeEnd, day);

        // Handle overnight events (e.g. 23:00 → 07:00)
        // If end is before start, it wraps past midnight
        if (isBefore(eventEnd, eventStart) || eventEnd.getTime() === eventStart.getTime()) {
            // For the current day: show only the part from eventStart → end of day
            eventEnd = endOfDay(day);
        }

        // Clamp to awake hours for scheduling purposes,
        // but still store original times for display
        const isSleepEvent = event.title.toLowerCase().includes('sleep') ||
            event.title.toLowerCase().includes('uyku');

        slots.push({
            timeStart: eventStart,
            timeEnd: eventEnd,
            type: isSleepEvent ? 'Sleep' : 'Fixed',
            taskTitle: isSleepEvent ? `💤 ${event.title}` : event.title,
            taskId: event.id,
        });
    }

    // Sort by start time
    return slots.sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());
}

// ─── Step B: Calculate Free blocks from gaps between fixed events ───
function calculateFreeBlocks(
    fixedSlots: ScheduleSlot[],
    day: Date,
    settings: UserSettings
): ScheduleSlot[] {
    const freeBlocks: ScheduleSlot[] = [];
    const wakeTime = parseTime(settings.wakeTime, day);
    const bedTime = parseTime(settings.bedTime, day);

    // Get only fixed events that fall within awake hours
    const awakeFixed = fixedSlots
        .filter((s) => {
            // Exclude events entirely outside awake hours
            return !(isAfter(s.timeStart, bedTime) || isBefore(s.timeEnd, wakeTime) || s.timeEnd.getTime() === wakeTime.getTime());
        })
        .map((s) => ({
            ...s,
            // Clamp to awake window
            timeStart: isBefore(s.timeStart, wakeTime) ? wakeTime : s.timeStart,
            timeEnd: isAfter(s.timeEnd, bedTime) ? bedTime : s.timeEnd,
        }))
        .sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());

    // Merge truly overlapping slots (NOT adjacent — strict < )
    const merged = mergeOverlapping(awakeFixed);

    // Find gaps
    let cursor = wakeTime;

    for (const slot of merged) {
        if (isAfter(slot.timeStart, cursor)) {
            freeBlocks.push({
                timeStart: cursor,
                timeEnd: slot.timeStart,
                type: 'Free',
                taskTitle: '🟢 Free',
            });
        }
        cursor = isAfter(slot.timeEnd, cursor) ? slot.timeEnd : cursor;
    }

    // Remaining time until bed
    if (isBefore(cursor, bedTime)) {
        freeBlocks.push({
            timeStart: cursor,
            timeEnd: bedTime,
            type: 'Free',
            taskTitle: '🟢 Free',
        });
    }

    return freeBlocks;
}

// ─── Helper: Merge TRULY overlapping time slots (strict overlap, not adjacent) ───
function mergeOverlapping(slots: ScheduleSlot[]): ScheduleSlot[] {
    if (slots.length === 0) return [];
    const sorted = [...slots].sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());
    const merged: ScheduleSlot[] = [{ ...sorted[0] }];

    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        const current = sorted[i];
        // STRICT overlap: only merge if current starts BEFORE last ends
        // Adjacent events (end === start) do NOT merge
        if (current.timeStart.getTime() < last.timeEnd.getTime()) {
            last.timeEnd = isAfter(current.timeEnd, last.timeEnd) ? current.timeEnd : last.timeEnd;
        } else {
            merged.push({ ...current });
        }
    }

    return merged;
}

// ─── Categorize tasks: interrupts (<=15min) vs schedulable ───
function categorizeTasks(tasks: Task[]): {
    interrupts: Task[];
    schedulable: Task[];
} {
    const activeTasks = tasks.filter(
        (t) => (t.status === 'Pending' || t.status === 'In-Progress') && !t.isFixed
    );

    const interrupts = activeTasks
        .filter((t) => t.duration <= GREEDY_THRESHOLD_MIN)
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

    const schedulable = activeTasks
        .filter((t) => t.duration > GREEDY_THRESHOLD_MIN)
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime()); // EDF sort

    return { interrupts, schedulable };
}

// ============================================================
// Greedy Bin-Packing Distribution
// ============================================================
// Like a CPU scheduler that maximizes utilization:
// - Sort all tasks by deadline (EDF)
// - Starting from today, fill each day's free time to capacity
// - Move to next day only when current day is full
// - Tasks are placed BEFORE their deadline, not ON it
// ============================================================

interface DayCapacity {
    date: Date;
    freeMinutes: number;
    freeBlocks: ScheduleSlot[];
    fixedBlocks: ScheduleSlot[];
}

function computeDayCapacity(
    day: Date,
    settings: UserSettings
): DayCapacity {
    const fixedBlocks = generateFixedBlocks(day, settings);
    const freeBlocks = calculateFreeBlocks(fixedBlocks, day, settings);
    const freeMinutes = freeBlocks.reduce((sum, b) => sum + slotDuration(b), 0);
    return { date: day, freeMinutes, freeBlocks, fixedBlocks };
}

function distributeTasksGreedy(
    interrupts: Task[],
    schedulable: Task[],
    targetDate: Date,
    settings: UserSettings
): { dayInterrupts: Task[]; dayTasks: Task[] } {
    const today = startOfDay(new Date());
    const targetDay = startOfDay(targetDate);

    // Build a list of days from today for up to 28 days (4 weeks)
    const planningDays: Date[] = [];
    for (let i = 0; i < 28; i++) {
        planningDays.push(addDays(today, i));
    }

    // Compute capacity for each day
    const dayCapacities: Map<string, number> = new Map();
    for (const d of planningDays) {
        const cap = computeDayCapacity(d, settings);
        dayCapacities.set(format(d, 'yyyy-MM-dd'), cap.freeMinutes);
    }

    // Track remaining capacity as we assign tasks
    const remainingCapacity: Map<string, number> = new Map(dayCapacities);

    // Assign each task to the EARLIEST day that has capacity
    // Tasks are already EDF sorted
    const taskDayAssignment: Map<string, string> = new Map(); // taskId -> day string

    for (const task of [...interrupts, ...schedulable]) {
        let assigned = false;
        for (const d of planningDays) {
            const dayKey = format(d, 'yyyy-MM-dd');
            const capacity = remainingCapacity.get(dayKey) || 0;

            if (capacity >= task.duration) {
                taskDayAssignment.set(task.id, dayKey);
                remainingCapacity.set(dayKey, capacity - task.duration);
                assigned = true;
                break;
            } else if (capacity > 0 && task.duration > capacity) {
                // Task can be split: allocate what fits, rest goes to next day
                // For simplicity in distribution, assign to first day with any capacity
                taskDayAssignment.set(task.id, dayKey);
                remainingCapacity.set(dayKey, 0);
                // The remaining part will be handled by fillDaySchedule splitting
                assigned = true;
                break;
            }
        }

        // If no day has capacity, assign to today (overflow)
        if (!assigned) {
            taskDayAssignment.set(task.id, format(today, 'yyyy-MM-dd'));
        }
    }

    // Filter tasks assigned to the target day
    const targetKey = format(targetDay, 'yyyy-MM-dd');

    const dayInterrupts = interrupts.filter(
        (t) => taskDayAssignment.get(t.id) === targetKey
    );

    const dayTasks = schedulable.filter(
        (t) => taskDayAssignment.get(t.id) === targetKey
    );

    return { dayInterrupts, dayTasks };
}

// ─── Fill free blocks for a single day with assigned tasks ───
function fillDaySchedule(
    freeBlocks: ScheduleSlot[],
    dayInterrupts: Task[],
    dayTasks: Task[],
): ScheduleSlot[] {
    const taskSlots: ScheduleSlot[] = [];
    const remainingFree: ScheduleSlot[] = freeBlocks.map((b) => ({ ...b }));

    // Insert interrupts (<=15min) into earliest free blocks (Greedy)
    for (const interrupt of dayInterrupts) {
        for (let i = 0; i < remainingFree.length; i++) {
            const block = remainingFree[i];
            const blockMinutes = slotDuration(block);
            if (blockMinutes >= interrupt.duration) {
                const taskEnd = addMinutes(block.timeStart, interrupt.duration);
                taskSlots.push({
                    timeStart: block.timeStart,
                    timeEnd: taskEnd,
                    taskId: interrupt.id,
                    taskTitle: `⚡ ${interrupt.title}`,
                    type: 'Task',
                    priority: interrupt.priority,
                });
                block.timeStart = taskEnd;
                break;
            }
        }
    }

    // Clean up empty free blocks
    const cleanFree = remainingFree.filter((b) => slotDuration(b) > 0);

    // Fill with EDF-sorted tasks (splitting if needed)
    for (const task of dayTasks) {
        let remainingDuration = task.duration;
        let partIndex = 0;

        for (let i = 0; i < cleanFree.length && remainingDuration > 0; i++) {
            const block = cleanFree[i];
            const blockMinutes = slotDuration(block);
            if (blockMinutes <= 0) continue;

            const allocate = Math.min(remainingDuration, blockMinutes);
            const taskEnd = addMinutes(block.timeStart, allocate);

            const label = partIndex > 0
                ? `${task.title} [Part ${partIndex + 1}]`
                : task.title;

            taskSlots.push({
                timeStart: block.timeStart,
                timeEnd: taskEnd,
                taskId: task.id,
                taskTitle: label,
                type: 'Task',
                priority: task.priority,
            });

            block.timeStart = taskEnd;
            remainingDuration -= allocate;
            partIndex++;
        }
    }

    return taskSlots;
}

// ============================================================
// Main Scheduler Function — Generates schedule for any day
// ============================================================
export function generateSchedule(
    tasks: Task[],
    settings: UserSettings,
    date: Date = new Date()
): DaySchedule {
    // Step A: Fixed blocks for this day
    const fixedBlocks = generateFixedBlocks(date, settings);

    // Step B: Free blocks for this day
    const freeBlocks = calculateFreeBlocks(fixedBlocks, date, settings);

    // Step C: Categorize all tasks
    const { interrupts, schedulable } = categorizeTasks(tasks);

    // Step D: Greedy bin-packing distribution across days
    const { dayInterrupts, dayTasks } = distributeTasksGreedy(
        interrupts, schedulable, date, settings
    );

    // Step E: Fill this day's schedule
    const taskSlots = fillDaySchedule(freeBlocks, dayInterrupts, dayTasks);

    // Combine fixed + tasks, recalculate remaining free blocks
    const usedSlots = [...fixedBlocks, ...taskSlots];
    const allFinalSlots = recalculateFreeBlocks(usedSlots, date, settings);

    return {
        date: format(date, 'yyyy-MM-dd'),
        slots: allFinalSlots,
    };
}

// ─── Recalculate free blocks after filling ───
function recalculateFreeBlocks(
    usedSlots: ScheduleSlot[],
    day: Date,
    settings: UserSettings
): ScheduleSlot[] {
    const wakeTime = parseTime(settings.wakeTime, day);
    const bedTime = parseTime(settings.bedTime, day);

    // Only include slots within awake hours (no sleep blocks in output)
    const activeSlots = usedSlots
        .filter((s) => s.type !== 'Sleep')
        .filter((s) => {
            // Must overlap with awake window
            return isBefore(s.timeStart, bedTime) && isAfter(s.timeEnd, wakeTime);
        })
        .map((s) => ({
            ...s,
            // Clamp to awake window
            timeStart: isBefore(s.timeStart, wakeTime) ? wakeTime : s.timeStart,
            timeEnd: isAfter(s.timeEnd, bedTime) ? bedTime : s.timeEnd,
        }))
        .sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());

    const result: ScheduleSlot[] = [];
    let cursor = wakeTime;

    for (const slot of activeSlots) {
        if (isAfter(slot.timeStart, cursor)) {
            result.push({
                timeStart: cursor,
                timeEnd: slot.timeStart,
                type: 'Free',
                taskTitle: '🟢 Free',
            });
        }
        result.push(slot);
        cursor = isAfter(slot.timeEnd, cursor) ? slot.timeEnd : cursor;
    }

    if (isBefore(cursor, bedTime)) {
        result.push({
            timeStart: cursor,
            timeEnd: bedTime,
            type: 'Free',
            taskTitle: '🟢 Free',
        });
    }

    return result.sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());
}

// ─── Get the current active task based on time ───
export function getCurrentTask(schedule: DaySchedule): ScheduleSlot | null {
    const now = new Date();
    return (
        schedule.slots.find(
            (slot) =>
                slot.type === 'Task' &&
                isBefore(slot.timeStart, now) &&
                isAfter(slot.timeEnd, now)
        ) ?? null
    );
}

// ─── Get next N upcoming tasks ───
export function getUpcomingTasks(
    schedule: DaySchedule,
    count: number = 2
): ScheduleSlot[] {
    const now = new Date();
    return schedule.slots
        .filter((slot) => slot.type === 'Task' && isAfter(slot.timeStart, now))
        .slice(0, count);
}
