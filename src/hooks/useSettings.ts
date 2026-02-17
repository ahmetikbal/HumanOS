'use client';

import { useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/store/useStore';
import { UserSettings, FixedEvent } from '@/types';

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
        const newSettings = { ...settings, ...updates };
        await updateDoc(userDocRef, { settings: newSettings });
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

    return { settings, updateSettings, addFixedEvent, removeFixedEvent };
}
