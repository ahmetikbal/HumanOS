// ============================================================
// HUMAN OS — Type Definitions
// ============================================================

export type Priority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Pending' | 'In-Progress' | 'Completed' | 'Dropped';
export type SlotType = 'Task' | 'Fixed' | 'Free' | 'Sleep';

export interface Task {
    id: string;
    title: string;
    duration: number; // minutes
    deadline: Date;
    priority: Priority;
    status: TaskStatus;
    isFixed: boolean; // true for events like Gym/Dinner
    parentId?: string; // if split from a larger task
    createdAt: Date;
}

export interface FixedEvent {
    id: string;
    title: string;
    timeStart: string; // HH:mm format
    timeEnd: string; // HH:mm format
    days: number[]; // 0=Sunday, 1=Monday, ...6=Saturday
}

export interface ScheduleSlot {
    timeStart: Date;
    timeEnd: Date;
    taskId?: string;
    taskTitle?: string;
    type: SlotType;
    priority?: Priority;
    isOverflow?: boolean; // flagged when deadline can't be met
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
}

export interface WeeklyStats {
    completed: number;
    dropped: number;
    totalScheduled: number;
    cpuUtilization: number; // percentage
}
