// ============================================================
// HUMAN OS — The Kernel (Greedy Bin-Packing EDF Scheduler)
// ============================================================
// Treats user time as CPU cycles, tasks as processes
// Maximizes daily utilization — fills days from today forward
// Splits tasks across days when they don't fit in one day
// Inserts break time between consecutive long tasks
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
} from 'date-fns';
import { Task, ScheduleSlot, DaySchedule, UserSettings } from '@/types';

// Greedy threshold: tasks under this duration are scheduled as interrupts
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

// ─── Step A: Lay down Fixed blocks (user-created fixed events) ───
function generateFixedBlocks(
    day: Date,
    settings: UserSettings
): ScheduleSlot[] {
    const slots: ScheduleSlot[] = [];

    // Fixed events for this day of week
    const dayOfWeek = day.getDay(); // 0=Sunday
    const todaysFixedEvents = settings.fixedEvents.filter((e) =>
        e.days.includes(dayOfWeek)
    );

    for (const event of todaysFixedEvents) {
        let eventStart = parseTime(event.timeStart, day);
        let eventEnd = parseTime(event.timeEnd, day);

        // Handle overnight events (e.g. 23:00 → 07:00)
        if (isBefore(eventEnd, eventStart) || eventEnd.getTime() === eventStart.getTime()) {
            eventEnd = endOfDay(day);
        }

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
            return !(isAfter(s.timeStart, bedTime) || isBefore(s.timeEnd, wakeTime) || s.timeEnd.getTime() === wakeTime.getTime());
        })
        .map((s) => ({
            ...s,
            timeStart: isBefore(s.timeStart, wakeTime) ? wakeTime : s.timeStart,
            timeEnd: isAfter(s.timeEnd, bedTime) ? bedTime : s.timeEnd,
        }))
        .sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());

    // Merge truly overlapping slots (strict <, not <=)
    const merged = mergeOverlapping(awakeFixed);

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

// ─── Helper: Merge TRULY overlapping time slots (strict < ) ───
function mergeOverlapping(slots: ScheduleSlot[]): ScheduleSlot[] {
    if (slots.length === 0) return [];
    const sorted = [...slots].sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());
    const merged: ScheduleSlot[] = [{ ...sorted[0] }];

    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        const current = sorted[i];
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
// Cross-Day Greedy Bin-Packing Distribution
// ============================================================
// - Sort all tasks by deadline (EDF)
// - Starting from today, fill each day to capacity
// - When a task doesn't fully fit, split it: allocate what fits,
//   carry the remainder to the next day
// - Track { taskId, allocatedMinutes } per day
// ============================================================

interface TaskAllocation {
    task: Task;
    allocatedMinutes: number;
    partIndex: number; // 0 = first part, 1 = second, etc.
}

function distributeTasksGreedy(
    interrupts: Task[],
    schedulable: Task[],
    targetDate: Date,
    settings: UserSettings
): { dayInterrupts: Task[]; dayAllocations: TaskAllocation[] } {
    const today = startOfDay(new Date());
    const targetDay = startOfDay(targetDate);

    // Build a list of days for up to 56 days (8 weeks) planning horizon
    const planningDays: Date[] = [];
    for (let i = 0; i < 56; i++) {
        planningDays.push(addDays(today, i));
    }

    // Compute free minutes for each day (accounting for break time between tasks)
    const dayFreeMinutes: Map<string, number> = new Map();
    for (const d of planningDays) {
        const fixedBlocks = generateFixedBlocks(d, settings);
        const freeBlocks = calculateFreeBlocks(fixedBlocks, d, settings);
        const totalFree = freeBlocks.reduce((sum, b) => sum + slotDuration(b), 0);
        dayFreeMinutes.set(format(d, 'yyyy-MM-dd'), totalFree);
    }

    // Track remaining capacity per day
    const remainingCapacity: Map<string, number> = new Map(dayFreeMinutes);

    // Track allocations per day: dayKey -> TaskAllocation[]
    const dayAllocations: Map<string, TaskAllocation[]> = new Map();
    for (const d of planningDays) {
        dayAllocations.set(format(d, 'yyyy-MM-dd'), []);
    }

    // Track interrupt assignments
    const interruptAssignment: Map<string, string> = new Map(); // taskId -> dayKey

    // Assign interrupts first (small tasks, no splitting)
    for (const interrupt of interrupts) {
        for (const d of planningDays) {
            const dayKey = format(d, 'yyyy-MM-dd');
            const capacity = remainingCapacity.get(dayKey) || 0;
            if (capacity >= interrupt.duration) {
                interruptAssignment.set(interrupt.id, dayKey);
                remainingCapacity.set(dayKey, capacity - interrupt.duration);
                break;
            }
        }
    }

    // Assign schedulable tasks with CROSS-DAY SPLITTING
    const breakTime = settings.breakTimeMin || 10;

    for (const task of schedulable) {
        let remainingDuration = task.duration;
        let partIndex = 0;

        for (const d of planningDays) {
            if (remainingDuration <= 0) break;

            const dayKey = format(d, 'yyyy-MM-dd');
            let capacity = remainingCapacity.get(dayKey) || 0;

            // Account for break time if this day already has task allocations
            const existingAllocations = dayAllocations.get(dayKey) || [];
            if (existingAllocations.length > 0 && capacity > breakTime) {
                capacity -= breakTime; // Reserve break time
            }

            if (capacity <= 0) continue;

            const allocate = Math.min(remainingDuration, capacity);

            const allocs = dayAllocations.get(dayKey) || [];
            allocs.push({ task, allocatedMinutes: allocate, partIndex });
            dayAllocations.set(dayKey, allocs);

            // Deduct from capacity (allocate + break)
            const totalDeducted = allocate + (existingAllocations.length > 0 ? breakTime : 0);
            remainingCapacity.set(dayKey, (remainingCapacity.get(dayKey) || 0) - totalDeducted);

            remainingDuration -= allocate;
            partIndex++;
        }
    }

    // Return allocations for the target day
    const targetKey = format(targetDay, 'yyyy-MM-dd');

    const dayInterrupts = interrupts.filter(
        (t) => interruptAssignment.get(t.id) === targetKey
    );

    const targetAllocations = dayAllocations.get(targetKey) || [];

    return { dayInterrupts, dayAllocations: targetAllocations };
}

// ─── Fill free blocks for a single day with allocated task durations ───
function fillDaySchedule(
    freeBlocks: ScheduleSlot[],
    dayInterrupts: Task[],
    dayAllocations: TaskAllocation[],
    settings: UserSettings
): ScheduleSlot[] {
    const taskSlots: ScheduleSlot[] = [];
    const remainingFree: ScheduleSlot[] = freeBlocks.map((b) => ({ ...b }));
    const today = startOfDay(new Date());
    const breakTime = settings.breakTimeMin || 10;

    // Insert interrupts (<=15min) into earliest free blocks (Greedy)
    for (const interrupt of dayInterrupts) {
        for (let i = 0; i < remainingFree.length; i++) {
            const block = remainingFree[i];
            const blockMinutes = slotDuration(block);
            if (blockMinutes >= interrupt.duration) {
                const taskEnd = addMinutes(block.timeStart, interrupt.duration);
                const isOverdue = isBefore(startOfDay(interrupt.deadline), today);
                taskSlots.push({
                    timeStart: block.timeStart,
                    timeEnd: taskEnd,
                    taskId: interrupt.id,
                    taskTitle: `⚡ ${interrupt.title}`,
                    type: 'Task',
                    priority: interrupt.priority,
                    isOverdue,
                });
                block.timeStart = taskEnd;
                break;
            }
        }
    }

    // Clean up empty free blocks
    const cleanFree = remainingFree.filter((b) => slotDuration(b) > 0);

    // Fill with allocated task portions
    let lastTaskEndTime: Date | null = null;

    for (const allocation of dayAllocations) {
        let remainingDuration = allocation.allocatedMinutes;

        for (let i = 0; i < cleanFree.length && remainingDuration > 0; i++) {
            const block = cleanFree[i];
            let blockMinutes = slotDuration(block);
            if (blockMinutes <= 0) continue;

            // Insert break if previous task just ended and this is a new task
            if (lastTaskEndTime && block.timeStart.getTime() === lastTaskEndTime.getTime()) {
                const breakAlloc = Math.min(breakTime, blockMinutes);
                block.timeStart = addMinutes(block.timeStart, breakAlloc);
                blockMinutes -= breakAlloc;
                if (blockMinutes <= 0) continue;
            }

            const allocate = Math.min(remainingDuration, blockMinutes);
            const taskEnd = addMinutes(block.timeStart, allocate);

            const isOverdue = isBefore(startOfDay(allocation.task.deadline), today);
            const label = allocation.partIndex > 0
                ? `${allocation.task.title} [Part ${allocation.partIndex + 1}]`
                : allocation.task.title;

            taskSlots.push({
                timeStart: block.timeStart,
                timeEnd: taskEnd,
                taskId: allocation.task.id,
                taskTitle: label,
                type: 'Task',
                priority: allocation.task.priority,
                isOverdue,
            });

            block.timeStart = taskEnd;
            lastTaskEndTime = taskEnd;
            remainingDuration -= allocate;
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

    // Step D: Greedy bin-packing with cross-day splitting
    const { dayInterrupts, dayAllocations } = distributeTasksGreedy(
        interrupts, schedulable, date, settings
    );

    // Step E: Fill this day's schedule
    const taskSlots = fillDaySchedule(freeBlocks, dayInterrupts, dayAllocations, settings);

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
            return isBefore(s.timeStart, bedTime) && isAfter(s.timeEnd, wakeTime);
        })
        .map((s) => ({
            ...s,
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
