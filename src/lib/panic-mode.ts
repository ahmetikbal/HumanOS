// ============================================================
// HUMAN OS — Panic Mode (The "OOM Killer")
// ============================================================
// Emergency mode that:
// 1. Drops all Low priority tasks
// 2. Compresses Medium priority tasks (20% duration reduction)
// 3. Keeps High priority tasks untouched
// 4. Re-schedules everything
// ============================================================

import { Task, UserSettings } from '@/types';
import { generateSchedule } from './scheduler';

export interface PanicModeResult {
    tasks: Task[];
    droppedCount: number;
    compressedCount: number;
    savedMinutes: number;
}

export function executePanicMode(
    tasks: Task[],
    settings: UserSettings,
    date: Date = new Date()
): PanicModeResult {
    let droppedCount = 0;
    let compressedCount = 0;
    let savedMinutes = 0;

    const updatedTasks = tasks.map((task) => {
        // Skip already completed/dropped tasks and fixed events
        if (task.status === 'Completed' || task.status === 'Dropped') return task;
        if (task.isFixed) return task;

        // 1. Drop Low priority
        if (task.priority === 'Low') {
            droppedCount++;
            savedMinutes += task.duration;
            return { ...task, status: 'Dropped' as const };
        }

        // 2. Compress Medium priority (reduce by 20%)
        if (task.priority === 'Medium') {
            const originalDuration = task.duration;
            const compressedDuration = Math.max(1, Math.floor(task.duration * 0.8));
            compressedCount++;
            savedMinutes += originalDuration - compressedDuration;
            return { ...task, duration: compressedDuration };
        }

        // 3. High priority: untouched
        return task;
    });

    return {
        tasks: updatedTasks,
        droppedCount,
        compressedCount,
        savedMinutes,
    };
}
