'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    signInAnonymously,
    signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, googleProvider } from './firebase';
import { seedDemoData } from './demo-data';
import { UserSettings } from '@/types';

// Fixed Firestore path for demo data — all demo users share this path
// so data persists across anonymous auth sessions
export const DEMO_FIRESTORE_UID = 'demo-user';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isDemoUser: boolean;
    /** The UID to use for Firestore paths — demo users get a fixed ID */
    effectiveUid: string | null;
    signInWithGoogle: () => Promise<void>;
    signInAsDemo: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isDemoUser: false,
    effectiveUid: null,
    signInWithGoogle: async () => { },
    signInAsDemo: async () => { },
    signOut: async () => { },
});

const DEFAULT_SETTINGS: UserSettings = {
    wakeTime: '07:00',
    bedTime: '23:00',
    targetWakeTime: undefined,
    shiftRateMin: 15,
    panicModeActive: false,
    fixedEvents: [],
    calendarEvents: [],
    breakTimeMin: 10,
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDemoUser, setIsDemoUser] = useState(false);

    const effectiveUid = user
        ? (isDemoUser ? DEMO_FIRESTORE_UID : user.uid)
        : null;

    useEffect(() => {
        const auth = getFirebaseAuth();
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);
            setIsDemoUser(user?.isAnonymous ?? false);
            setLoading(false);

            // Create default user settings document if first login (non-demo)
            if (user && !user.isAnonymous) {
                const db = getFirebaseDb();
                if (db) {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (!userDoc.exists()) {
                        await setDoc(userDocRef, {
                            settings: DEFAULT_SETTINGS,
                            createdAt: new Date(),
                        });
                    }
                }
            }
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const auth = getFirebaseAuth();
        if (!auth) return;
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Google sign-in error:', error);
        }
    };

    const signInAsDemo = async () => {
        const auth = getFirebaseAuth();
        if (!auth) return;
        try {
            await signInAnonymously(auth);
            setIsDemoUser(true);
            // Seed demo data using the fixed demo path
            await seedDemoData(DEMO_FIRESTORE_UID);
        } catch (error) {
            console.error('Demo sign-in error:', error);
        }
    };

    const signOut = async () => {
        const auth = getFirebaseAuth();
        if (!auth) return;
        try {
            setIsDemoUser(false);
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Sign-out error:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, isDemoUser, effectiveUid, signInWithGoogle, signInAsDemo, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
