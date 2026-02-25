import { create } from 'zustand';
import { Task, UserSettings, ScheduleSlot, DaySchedule } from '@/types';

interface HumanOSState {
    // ─── Data ───
    tasks: Task[];
    settings: UserSettings;
    todaySchedule: DaySchedule | null;
    currentTaskId: string | null;

    // ─── Task Actions ───
    setTasks: (tasks: Task[]) => void;
    addTask: (task: Task) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;

    // ─── Settings Actions ───
    setSettings: (settings: UserSettings) => void;
    updateSettings: (updates: Partial<UserSettings>) => void;

    // ─── Schedule Actions ───
    setTodaySchedule: (schedule: DaySchedule | null) => void;
    setCurrentTaskId: (id: string | null) => void;

    // ─── Panic Mode ───
    triggerPanicMode: () => void;
}

export const useStore = create<HumanOSState>((set, get) => ({
    // ─── Initial State ───
    tasks: [],
    settings: {
        wakeTime: '07:00',
        bedTime: '23:00',
        targetWakeTime: '',
        shiftRateMin: 15,
        panicModeActive: false,
        fixedEvents: [],
        breakTimeMin: 10,
    },
    todaySchedule: null,
    currentTaskId: null,

    // ─── Task Actions ───
    setTasks: (tasks) => set({ tasks }),

    addTask: (task) =>
        set((state) => ({ tasks: [...state.tasks, task] })),

    updateTask: (id, updates) =>
        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.id === id ? { ...t, ...updates } : t
            ),
        })),

    deleteTask: (id) =>
        set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
        })),

    // ─── Settings Actions ───
    setSettings: (settings) => set({ settings }),

    updateSettings: (updates) =>
        set((state) => ({
            settings: { ...state.settings, ...updates },
        })),

    // ─── Schedule Actions ───
    setTodaySchedule: (schedule) => set({ todaySchedule: schedule }),
    setCurrentTaskId: (id) => set({ currentTaskId: id }),

    // ─── Panic Mode (OOM Killer) ───
    triggerPanicMode: () =>
        set((state) => {
            const updatedTasks = state.tasks.map((task) => {
                if (task.status === 'Completed' || task.status === 'Dropped') return task;
                if (task.isFixed) return task;

                if (task.priority === 'Low') {
                    return { ...task, status: 'Dropped' as const };
                }
                if (task.priority === 'Medium') {
                    const compressedDuration = Math.max(1, Math.floor(task.duration * 0.8));
                    return { ...task, duration: compressedDuration };
                }
                // High priority: untouched
                return task;
            });

            return {
                tasks: updatedTasks,
                settings: { ...state.settings, panicModeActive: true },
            };
        }),
}));
