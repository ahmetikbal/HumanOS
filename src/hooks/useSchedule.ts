'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { generateSchedule, getCurrentTask, getUpcomingTasks } from '@/lib/scheduler';

export function useSchedule() {
    const { tasks, settings, setTodaySchedule, setCurrentTaskId, todaySchedule } = useStore();
    const [tick, setTick] = useState(0);

    // Regenerate schedule when tasks or settings change
    const schedule = useMemo(() => {
        return generateSchedule(tasks, settings, new Date());
    }, [tasks, settings]);

    // Update store
    useEffect(() => {
        setTodaySchedule(schedule);
    }, [schedule, setTodaySchedule]);

    // Tick every minute to update current task
    useEffect(() => {
        const interval = setInterval(() => {
            setTick((t) => t + 1);
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const currentTask = useMemo(() => {
        if (!todaySchedule) return null;
        return getCurrentTask(todaySchedule);
    }, [todaySchedule, tick]);

    const upcomingTasks = useMemo(() => {
        if (!todaySchedule) return [];
        return getUpcomingTasks(todaySchedule, 2);
    }, [todaySchedule, tick]);

    useEffect(() => {
        setCurrentTaskId(currentTask?.taskId ?? null);
    }, [currentTask, setCurrentTaskId]);

    return { schedule, currentTask, upcomingTasks };
}
