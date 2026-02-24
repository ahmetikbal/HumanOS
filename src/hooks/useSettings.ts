'use client';

import { useEffect } from 'react';
import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/store/useStore';
import { UserSettings, FixedEvent } from '@/types';

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

        const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
            const data = snapshot.data();
            if (data?.settings) {
                setSettings(data.settings as UserSettings);
            }
        });

        return () => unsubscribe();
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

    // Add a fixed event
    const addFixedEvent = async (event: FixedEvent) => {
        const updatedEvents = [...settings.fixedEvents, event];
        await updateSettings({ fixedEvents: updatedEvents });
    };

    // Remove a fixed event
    const removeFixedEvent = async (eventId: string) => {
        const updatedEvents = settings.fixedEvents.filter((e) => e.id !== eventId);
        await updateSettings({ fixedEvents: updatedEvents });
    };

    // Update a fixed event
    const updateFixedEvent = async (eventId: string, updates: Partial<FixedEvent>) => {
        const updatedEvents = settings.fixedEvents.map((e) =>
            e.id === eventId ? { ...e, ...updates } : e
        );
        await updateSettings({ fixedEvents: updatedEvents });
    };

    return { settings, updateSettings, addFixedEvent, removeFixedEvent, updateFixedEvent };
}
