// ============================================================
// HUMAN OS — Type Definitions
// ============================================================

export type Priority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Pending' | 'In-Progress' | 'Completed' | 'Dropped';
export type SlotType = 'Task' | 'Fixed' | 'Free' | 'Sleep';

export interface Task {
    id: string;
    title: string;
    description?: string; // optional notes for the task
    duration: number; // minutes
    deadline: Date;
    priority: Priority;
    status: TaskStatus;
    isFixed: boolean; // true for events like Gym/Dinner
    parentId?: string; // if split from a larger task
    createdAt: Date;
    completedAt?: Date; // when the task was completed
}

export interface FixedEvent {
    id: string;
    title: string;
    timeStart: string; // HH:mm format
    timeEnd: string; // HH:mm format
    days: number[]; // 0=Sunday, 1=Monday, ...6=Saturday
}

// One-time calendar event (e.g., "Meeting on Feb 26 13:00–15:00")
export interface CalendarEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    timeStart: string; // HH:mm
    timeEnd: string; // HH:mm
    description?: string;
}

export interface ScheduleSlot {
    timeStart: Date;
    timeEnd: Date;
    taskId?: string;
    taskTitle?: string;
    type: SlotType;
    priority?: Priority;
    isOverflow?: boolean; // flagged when deadline can't be met
    isOverdue?: boolean; // deadline has passed but task is not completed
}

export interface DaySchedule {
    date: string; // YYYY-MM-DD
    slots: ScheduleSlot[];
}

export interface UserSettings {
    wakeTime: string; // HH:mm
    bedTime: string; // HH:mm
    targetWakeTime?: string; // HH:mm
    shiftRateMin: number; // minutes per day
    panicModeActive: boolean;
    fixedEvents: FixedEvent[];
    calendarEvents: CalendarEvent[]; // one-time events
    breakTimeMin: number; // break between consecutive tasks (default 10)
}

export interface WeeklyStats {
    completed: number;
    dropped: number;
    totalScheduled: number;
    cpuUtilization: number; // percentage
}
