'use client';

import { useEffect } from 'react';
import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/store/useStore';
import { UserSettings, FixedEvent, CalendarEvent } from '@/types';

// Remove undefined values from an object (Firestore rejects undefined)
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                result[key] = stripUndefined(value as Record<string, unknown>);
            } else {
                result[key] = value;
            }
        }
    }
    return result;
}

export function useSettings() {
    const { user } = useAuth();
    const { settings, setSettings, updateSettings: updateSettingsStore } = useStore();

    // Subscribe to user settings
    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();
        if (!db) return;

        const userDocRef = doc(db, 'users', user.uid);

        let unsubscribed = false;
        const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
            const data = snapshot.data();
            if (data?.settings) {
                setSettings(data.settings as UserSettings);
            }
        }, (error) => {
            if ((error as { code?: string }).code === 'permission-denied') {
                console.warn('Firestore permission denied for settings. Unsubscribing listener.');
                if (!unsubscribed) { unsubscribed = true; unsubscribe(); }
            } else {
                console.error('Firestore settings subscription error:', error);
            }
        });

        return () => { unsubscribed = true; unsubscribe(); };
    }, [user, setSettings]);

    // Update settings in Firestore
    const updateSettings = async (updates: Partial<UserSettings>) => {
        if (!user) return;
        const db = getFirebaseDb();
        if (!db) return;
        const userDocRef = doc(db, 'users', user.uid);
        const newSettings = stripUndefined({ ...settings, ...updates } as unknown as Record<string, unknown>) as unknown as UserSettings;
        await setDoc(userDocRef, { settings: newSettings }, { merge: true });
        updateSettingsStore(updates);
    };

    // ─── Fixed Events ───
    const addFixedEvent = async (event: FixedEvent) => {
        const updatedEvents = [...settings.fixedEvents, event];
        await updateSettings({ fixedEvents: updatedEvents });
    };

    const removeFixedEvent = async (eventId: string) => {
        const updatedEvents = settings.fixedEvents.filter((e) => e.id !== eventId);
        await updateSettings({ fixedEvents: updatedEvents });
    };

    const updateFixedEvent = async (eventId: string, updates: Partial<FixedEvent>) => {
        const updatedEvents = settings.fixedEvents.map((e) =>
            e.id === eventId ? { ...e, ...updates } : e
        );
        await updateSettings({ fixedEvents: updatedEvents });
    };

    // ─── Calendar Events (one-time interrupts) ───
    const addCalendarEvent = async (event: CalendarEvent) => {
        const current = settings.calendarEvents || [];
        await updateSettings({ calendarEvents: [...current, event] });
    };

    const removeCalendarEvent = async (eventId: string) => {
        const current = settings.calendarEvents || [];
        await updateSettings({ calendarEvents: current.filter((e) => e.id !== eventId) });
    };

    const updateCalendarEvent = async (eventId: string, updates: Partial<CalendarEvent>) => {
        const current = settings.calendarEvents || [];
        await updateSettings({
            calendarEvents: current.map((e) =>
                e.id === eventId ? { ...e, ...updates } : e
            ),
        });
    };

    return {
        settings,
        updateSettings,
        addFixedEvent,
        removeFixedEvent,
        updateFixedEvent,
        addCalendarEvent,
        removeCalendarEvent,
        updateCalendarEvent,
    };
}
