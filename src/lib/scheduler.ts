// ============================================================
// HUMAN OS — The Kernel (EDF Scheduling Engine)
// ============================================================
// Modified Earliest Deadline First scheduler
// Treats user time as CPU cycles, tasks as processes
// ============================================================

import {
    startOfDay,
    endOfDay,
    setHours,
    setMinutes,
    addMinutes,
    isAfter,
    isBefore,
    format,
    differenceInMinutes,
} from 'date-fns';
import { Task, ScheduleSlot, DaySchedule, UserSettings, FixedEvent } from '@/types';

// ─── Helper: Parse "HH:mm" to Date on a given day ───
function parseTime(timeStr: string, day: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return setMinutes(setHours(startOfDay(day), hours), minutes);
}

// ─── Helper: Get duration of a slot in minutes ───
function slotDuration(slot: ScheduleSlot): number {
    return differenceInMinutes(slot.timeEnd, slot.timeStart);
}

// ─── Step A: Lay down Fixed blocks (Sleep, Fixed Events) ───
function generateFixedBlocks(
    day: Date,
    settings: UserSettings
): ScheduleSlot[] {
    const slots: ScheduleSlot[] = [];
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const wakeTime = parseTime(settings.wakeTime, day);
    const bedTime = parseTime(settings.bedTime, day);

    // Sleep block: midnight → wakeTime
    if (isAfter(wakeTime, dayStart)) {
        slots.push({
            timeStart: dayStart,
            timeEnd: wakeTime,
            type: 'Sleep',
            taskTitle: '💤 Sleep',
        });
    }

    // Sleep block: bedTime → end of day
    if (isBefore(bedTime, dayEnd)) {
        slots.push({
            timeStart: bedTime,
            timeEnd: dayEnd,
            type: 'Sleep',
            taskTitle: '💤 Sleep',
        });
    }

    // Fixed events for this day
    const dayOfWeek = day.getDay(); // 0=Sunday
    const todaysFixedEvents = settings.fixedEvents.filter((e) =>
        e.days.includes(dayOfWeek)
    );

    for (const event of todaysFixedEvents) {
        const eventStart = parseTime(event.timeStart, day);
        const eventEnd = parseTime(event.timeEnd, day);
        slots.push({
            timeStart: eventStart,
            timeEnd: eventEnd,
            type: 'Fixed',
            taskTitle: event.title,
            taskId: event.id,
        });
    }

    // Sort by start time
    return slots.sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());
}

// ─── Step B: Calculate Free blocks from gaps ───
function calculateFreeBlocks(
    fixedSlots: ScheduleSlot[],
    day: Date,
    settings: UserSettings
): ScheduleSlot[] {
    const freeBlocks: ScheduleSlot[] = [];
    const wakeTime = parseTime(settings.wakeTime, day);
    const bedTime = parseTime(settings.bedTime, day);

    // Merge overlapping fixed slots
    const merged = mergeOverlapping(fixedSlots);

    // Find gaps between fixed slots within awake hours
    let cursor = wakeTime;

    for (const slot of merged) {
        // Only consider slots within awake hours
        const slotStart = isAfter(slot.timeStart, wakeTime) ? slot.timeStart : wakeTime;
        const slotEnd = isBefore(slot.timeEnd, bedTime) ? slot.timeEnd : bedTime;

        if (isAfter(slotStart, bedTime) || isBefore(slotEnd, wakeTime)) continue;

        if (isAfter(slotStart, cursor)) {
            freeBlocks.push({
                timeStart: cursor,
                timeEnd: slotStart,
                type: 'Free',
                taskTitle: '🟢 Free',
            });
        }
        cursor = isAfter(slotEnd, cursor) ? slotEnd : cursor;
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

// ─── Helper: Merge overlapping time slots ───
function mergeOverlapping(slots: ScheduleSlot[]): ScheduleSlot[] {
    if (slots.length === 0) return [];
    const sorted = [...slots].sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());
    const merged: ScheduleSlot[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        const current = sorted[i];
        if (current.timeStart.getTime() <= last.timeEnd.getTime()) {
            last.timeEnd = isAfter(current.timeEnd, last.timeEnd) ? current.timeEnd : last.timeEnd;
        } else {
            merged.push(current);
        }
    }

    return merged;
}

// ─── Step C & D: Separate interrupts (<2min) and EDF sort ───
function categorizeTasks(tasks: Task[]): {
    interrupts: Task[];
    schedulable: Task[];
} {
    const activeTasks = tasks.filter(
        (t) => t.status === 'Pending' || t.status === 'In-Progress'
    );

    const interrupts = activeTasks
        .filter((t) => t.duration <= 2 && !t.isFixed)
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

    const schedulable = activeTasks
        .filter((t) => t.duration > 2 && !t.isFixed)
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime()); // EDF sort

    return { interrupts, schedulable };
}

// ─── Step E: Fill free blocks with tasks (with splitting) ───
function fillSchedule(
    freeBlocks: ScheduleSlot[],
    interrupts: Task[],
    schedulable: Task[],
    day: Date
): ScheduleSlot[] {
    const taskSlots: ScheduleSlot[] = [];
    const remainingFree: ScheduleSlot[] = freeBlocks.map((b) => ({ ...b }));

    // Step C: Insert interrupts (<2min) into earliest free blocks (Greedy)
    for (const interrupt of interrupts) {
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
                // Shrink the free block
                block.timeStart = taskEnd;
                break;
            }
        }
    }

    // Clean up empty free blocks
    const cleanFree = remainingFree.filter((b) => slotDuration(b) > 0);

    // Step D & E: Fill with EDF-sorted tasks (splitting if needed)
    const taskQueue = [...schedulable];

    for (const task of taskQueue) {
        let remainingDuration = task.duration;
        let partIndex = 0;
        const isPastDeadline = isBefore(task.deadline, day);

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
                isOverflow: isPastDeadline,
            });

            block.timeStart = taskEnd;
            remainingDuration -= allocate;
            partIndex++;
        }

        // Step F: Flag overflow
        if (remainingDuration > 0) {
            taskSlots.push({
                timeStart: new Date(0),
                timeEnd: new Date(0),
                taskId: task.id,
                taskTitle: `⚠️ OVERFLOW: ${task.title} (${remainingDuration}min unscheduled)`,
                type: 'Task',
                priority: task.priority,
                isOverflow: true,
            });
        }
    }

    return taskSlots;
}

// ============================================================
// Main Scheduler Function
// ============================================================
export function generateSchedule(
    tasks: Task[],
    settings: UserSettings,
    date: Date = new Date()
): DaySchedule {
    // Step A: Fixed blocks
    const fixedBlocks = generateFixedBlocks(date, settings);

    // Step B: Free blocks
    const freeBlocks = calculateFreeBlocks(fixedBlocks, date, settings);

    // Step C & D: Categorize tasks
    const { interrupts, schedulable } = categorizeTasks(tasks);

    // Step E & F: Fill schedule
    const taskSlots = fillSchedule(freeBlocks, interrupts, schedulable, date);

    // Combine all slots and sort
    const allSlots = [...fixedBlocks, ...taskSlots].sort(
        (a, b) => a.timeStart.getTime() - b.timeStart.getTime()
    );

    // Find remaining free time
    const usedSlots = allSlots.filter((s) => s.type !== 'Free');
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

    const awakeSlots = usedSlots.filter(
        (s) =>
            !(s.type === 'Sleep' && isBefore(s.timeEnd, wakeTime)) &&
            !(s.type === 'Sleep' && isAfter(s.timeStart, bedTime))
    );

    // Filter only slots between wake and bed, plus sleep blocks
    const sleepBlocks = usedSlots.filter((s) => s.type === 'Sleep');
    const activeSlots = usedSlots
        .filter((s) => s.type !== 'Sleep')
        .filter((s) => !isAfter(s.timeStart, bedTime) && !isBefore(s.timeEnd, wakeTime))
        .sort((a, b) => a.timeStart.getTime() - b.timeStart.getTime());

    const result: ScheduleSlot[] = [...sleepBlocks];
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
