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

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isDemoUser: boolean;
    signInWithGoogle: () => Promise<void>;
    signInAsDemo: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isDemoUser: false,
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

            // Create default user settings document if first login
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
            const result = await signInAnonymously(auth);
            setIsDemoUser(true);
            // Seed demo data for this anonymous user
            await seedDemoData(result.user.uid);
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
        <AuthContext.Provider value={{ user, loading, isDemoUser, signInWithGoogle, signInAsDemo, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
