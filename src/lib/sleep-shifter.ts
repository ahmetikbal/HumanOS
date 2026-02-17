// ============================================================
// HUMAN OS — Sleep Shifter
// ============================================================
// Gradually shifts wake/sleep times toward a target
// by adjusting X minutes backwards per day
// ============================================================

import { parse, format, subMinutes, isAfter, isBefore, isEqual } from 'date-fns';

export interface SleepShiftResult {
    newWakeTime: string; // HH:mm
    newBedTime: string; // HH:mm
    isTargetReached: boolean;
    daysRemaining: number;
}

/**
 * Calculate the adjusted wake/bed time for today based on
 * the current and target wake times + shift rate.
 *
 * @param currentWakeTime - Current wake time in "HH:mm"
 * @param targetWakeTime - Target wake time in "HH:mm"
 * @param currentBedTime - Current bed time in "HH:mm"
 * @param shiftRateMin - Minutes to shift per day
 * @param daysElapsed - Number of days since shift started
 */
export function calculateSleepShift(
    currentWakeTime: string,
    targetWakeTime: string,
    currentBedTime: string,
    shiftRateMin: number,
    daysElapsed: number
): SleepShiftResult {
    const refDate = new Date(2000, 0, 1); // Reference date for parsing
    const current = parse(currentWakeTime, 'HH:mm', refDate);
    const target = parse(targetWakeTime, 'HH:mm', refDate);
    const bed = parse(currentBedTime, 'HH:mm', refDate);

    // Total shift needed in minutes
    const totalShiftNeeded = Math.abs(
        (current.getHours() * 60 + current.getMinutes()) -
        (target.getHours() * 60 + target.getMinutes())
    );

    // Shift applied so far
    const shiftApplied = Math.min(shiftRateMin * daysElapsed, totalShiftNeeded);

    // Determine direction (shifting earlier = subtracting minutes)
    const isShiftingEarlier = isAfter(current, target) || isEqual(current, target);

    let newWake: Date;
    let newBed: Date;

    if (isShiftingEarlier) {
        newWake = subMinutes(current, shiftApplied);
        newBed = subMinutes(bed, shiftApplied);
    } else {
        // Shifting later — add minutes
        newWake = new Date(current.getTime() + shiftApplied * 60000);
        newBed = new Date(bed.getTime() + shiftApplied * 60000);
    }

    const isTargetReached = shiftApplied >= totalShiftNeeded;
    const daysRemaining = isTargetReached
        ? 0
        : Math.ceil((totalShiftNeeded - shiftApplied) / shiftRateMin);

    return {
        newWakeTime: isTargetReached ? targetWakeTime : format(newWake, 'HH:mm'),
        newBedTime: format(newBed, 'HH:mm'),
        isTargetReached,
        daysRemaining,
    };
}
