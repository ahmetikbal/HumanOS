// ============================================================
// HUMAN OS — The Kernel (Greedy Bin-Packing EDF Scheduler)
// ============================================================
// Treats user time as CPU cycles, tasks as processes
// Maximizes daily utilization — fills days from today forward
// Splits tasks across days when they don't fit in one day
// Inserts break time between consecutive long tasks
// Calendar events (one-time interrupts) block time like fixed events
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

// ─── Step A: Lay down Fixed + Calendar event blocks ───
function generateFixedBlocks(
    day: Date,
    settings: UserSettings
): ScheduleSlot[] {
    const slots: ScheduleSlot[] = [];

    // Recurring fixed events for this day of week
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

    // One-time calendar events for this specific date
    const dayKey = format(day, 'yyyy-MM-dd');
    const calendarEvents = (settings.calendarEvents || []).filter(
        (e) => e.date === dayKey
    );

    for (const event of calendarEvents) {
        const eventStart = parseTime(event.timeStart, day);
        const eventEnd = parseTime(event.timeEnd, day);

        slots.push({
            timeStart: eventStart,
            timeEnd: eventEnd,
            type: 'Fixed',
            taskTitle: `📅 ${event.title}`,
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

interface TaskAllocation {
    task: Task;
    allocatedMinutes: number;
    globalPartStart: number; // Starting part number for this allocation
}

function distributeTasksGreedy(
    interrupts: Task[],
    schedulable: Task[],
    targetDate: Date,
    settings: UserSettings
): { dayInterrupts: Task[]; dayAllocations: (TaskAllocation & { totalParts: number })[] } {
    const today = startOfDay(new Date());
    const targetDay = startOfDay(targetDate);

    // Build planning days (56 days = 8 weeks)
    const planningDays: Date[] = [];
    for (let i = 0; i < 56; i++) {
        planningDays.push(addDays(today, i));
    }

    // Compute free minutes for each day
    const dayFreeMinutes: Map<string, number> = new Map();
    for (const d of planningDays) {
        const fixedBlocks = generateFixedBlocks(d, settings);
        const freeBlocks = calculateFreeBlocks(fixedBlocks, d, settings);
        const totalFree = freeBlocks.reduce((sum, b) => sum + slotDuration(b), 0);
        dayFreeMinutes.set(format(d, 'yyyy-MM-dd'), totalFree);
    }

    // Track remaining capacity per day
    const remainingCapacity: Map<string, number> = new Map(dayFreeMinutes);

    // Track allocations per day
    const dayAllocations: Map<string, TaskAllocation[]> = new Map();
    for (const d of planningDays) {
        dayAllocations.set(format(d, 'yyyy-MM-dd'), []);
    }

    // Assign interrupts (small tasks, no splitting)
    const interruptAssignment: Map<string, string> = new Map();
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
    // Parts are numbered sequentially; label only shown if task is actually split
    const breakTime = settings.breakTimeMin || 10;

    // We need to count actual context switches (slots), not just day allocations.
    // A task allocation on a given day may be split into multiple slots by fixed events.
    // So we do a two-pass approach:
    //   Pass 1: Allocate minutes to days (without part numbering)
    //   Pass 2: When filling slots, count actual context switches

    for (const task of schedulable) {
        let remainingDuration = task.duration;

        for (const d of planningDays) {
            if (remainingDuration <= 0) break;

            const dayKey = format(d, 'yyyy-MM-dd');
            let capacity = remainingCapacity.get(dayKey) || 0;

            // Reserve break time if day already has allocations
            const existingAllocations = dayAllocations.get(dayKey) || [];
            if (existingAllocations.length > 0 && capacity > breakTime) {
                capacity -= breakTime;
            }

            if (capacity <= 0) continue;

            const allocate = Math.min(remainingDuration, capacity);

            const allocs = dayAllocations.get(dayKey) || [];
            allocs.push({ task, allocatedMinutes: allocate, globalPartStart: 0 });
            dayAllocations.set(dayKey, allocs);

            // Deduct capacity
            const totalDeducted = allocate + (existingAllocations.length > 0 ? breakTime : 0);
            remainingCapacity.set(dayKey, (remainingCapacity.get(dayKey) || 0) - totalDeducted);

            remainingDuration -= allocate;
        }
    }

    // Now simulate slot filling for ALL days to count actual context switches per task.
    // This is needed to know totalParts accurately.
    const taskSlotCounts: Map<string, number> = new Map(); // taskId -> total slot count
    const taskDaySlotCounts: Map<string, number> = new Map(); // 'taskId:dayKey' -> # slots on that day

    for (const d of planningDays) {
        const dayKey = format(d, 'yyyy-MM-dd');
        const allocs = dayAllocations.get(dayKey) || [];
        if (allocs.length === 0) continue;

        // Simulate free blocks for this day
        const fixedBlocks = generateFixedBlocks(d, settings);
        const freeBlocks = calculateFreeBlocks(fixedBlocks, d, settings);
        const simFree = freeBlocks.map((b) => ({ ...b }));

        // Insert interrupts first (consume free block space)
        const dayInts = interrupts.filter((t) => interruptAssignment.get(t.id) === dayKey);
        for (const interrupt of dayInts) {
            for (const block of simFree) {
                const bMin = slotDuration(block);
                if (bMin >= interrupt.duration) {
                    block.timeStart = addMinutes(block.timeStart, interrupt.duration);
                    break;
                }
            }
        }

        const cleanSimFree = simFree.filter((b) => slotDuration(b) > 0);
        let lastEnd: Date | null = null;

        for (const alloc of allocs) {
            let remaining = alloc.allocatedMinutes;
            let slotsForThisAlloc = 0;

            for (let i = 0; i < cleanSimFree.length && remaining > 0; i++) {
                const block = cleanSimFree[i];
                let blockMin = slotDuration(block);
                if (blockMin <= 0) continue;

                if (lastEnd && block.timeStart.getTime() === lastEnd.getTime()) {
                    const br = Math.min(breakTime, blockMin);
                    block.timeStart = addMinutes(block.timeStart, br);
                    blockMin -= br;
                    if (blockMin <= 0) continue;
                }

                const take = Math.min(remaining, blockMin);
                const end = addMinutes(block.timeStart, take);
                slotsForThisAlloc++;
                block.timeStart = end;
                lastEnd = end;
                remaining -= take;
            }

            const prev = taskSlotCounts.get(alloc.task.id) || 0;
            taskSlotCounts.set(alloc.task.id, prev + slotsForThisAlloc);
            taskDaySlotCounts.set(`${alloc.task.id}:${dayKey}`, slotsForThisAlloc);
        }
    }

    // Now assign globalPartStart for each allocation based on cumulative slot counts
    const taskPartCounter: Map<string, number> = new Map();
    for (const d of planningDays) {
        const dayKey = format(d, 'yyyy-MM-dd');
        const allocs = dayAllocations.get(dayKey) || [];
        for (const alloc of allocs) {
            const currentPart = (taskPartCounter.get(alloc.task.id) || 0) + 1;
            alloc.globalPartStart = currentPart;
            const slotsOnDay = taskDaySlotCounts.get(`${alloc.task.id}:${dayKey}`) || 1;
            taskPartCounter.set(alloc.task.id, currentPart + slotsOnDay - 1);
        }
    }

    // Return allocations for the target day
    const targetKey = format(targetDay, 'yyyy-MM-dd');
    const dayInterrupts = interrupts.filter(
        (t) => interruptAssignment.get(t.id) === targetKey
    );
    const targetAllocations = dayAllocations.get(targetKey) || [];
    // Attach total slot counts
    const enrichedAllocations = targetAllocations.map((a) => ({
        ...a,
        totalParts: taskSlotCounts.get(a.task.id) || 1,
    }));

    return { dayInterrupts, dayAllocations: enrichedAllocations };
}

// ─── Fill free blocks for a single day with allocated task durations ───
function fillDaySchedule(
    freeBlocks: ScheduleSlot[],
    dayInterrupts: Task[],
    dayAllocations: (TaskAllocation & { totalParts: number })[],
    settings: UserSettings
): ScheduleSlot[] {
    const taskSlots: ScheduleSlot[] = [];
    const remainingFree: ScheduleSlot[] = freeBlocks.map((b) => ({ ...b }));
    const today = startOfDay(new Date());
    const breakTime = settings.breakTimeMin || 10;

    // Insert interrupts (<=15min) into earliest free blocks
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
        let slotIndex = 0; // tracks context switches within this allocation

        for (let i = 0; i < cleanFree.length && remainingDuration > 0; i++) {
            const block = cleanFree[i];
            let blockMinutes = slotDuration(block);
            if (blockMinutes <= 0) continue;

            // Insert break if previous task just ended
            if (lastTaskEndTime && block.timeStart.getTime() === lastTaskEndTime.getTime()) {
                const breakAlloc = Math.min(breakTime, blockMinutes);
                block.timeStart = addMinutes(block.timeStart, breakAlloc);
                blockMinutes -= breakAlloc;
                if (blockMinutes <= 0) continue;
            }

            const allocate = Math.min(remainingDuration, blockMinutes);
            const taskEnd = addMinutes(block.timeStart, allocate);

            const isOverdue = isBefore(startOfDay(allocation.task.deadline), today);
            const partNumber = allocation.globalPartStart + slotIndex;
            // Only show [Part N] if the task was actually split
            const label = allocation.totalParts > 1
                ? `${allocation.task.title} [Part ${partNumber}]`
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
            slotIndex++;
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
    // Step A: Fixed + Calendar event blocks
    const fixedBlocks = generateFixedBlocks(date, settings);

    // Step B: Free blocks
    const freeBlocks = calculateFreeBlocks(fixedBlocks, date, settings);

    // Step C: Categorize tasks
    const { interrupts, schedulable } = categorizeTasks(tasks);

    // Step D: Greedy bin-packing with cross-day splitting
    const { dayInterrupts, dayAllocations } = distributeTasksGreedy(
        interrupts, schedulable, date, settings
    );

    // Step E: Fill schedule
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
