'use client';

import { useEffect } from 'react';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/store/useStore';
import { Task, Priority, TaskStatus } from '@/types';

export function useTasks() {
    const { user } = useAuth();
    const { tasks, setTasks, updateTask: updateTaskStore, deleteTask: deleteTaskStore } = useStore();

    // Subscribe to tasks collection
    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();
        if (!db) return;

        const tasksRef = collection(db, 'users', user.uid, 'tasks');
        const q = query(tasksRef);

        let unsubscribed = false;
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasksData: Task[] = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    title: data.title,
                    description: data.description || '',
                    duration: data.duration,
                    deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : new Date(data.deadline),
                    priority: data.priority as Priority,
                    status: data.status as TaskStatus,
                    isFixed: data.isFixed ?? false,
                    parentId: data.parentId,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
                    completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate() : (data.completedAt ? new Date(data.completedAt) : undefined),
                };
            });
            setTasks(tasksData);
        }, (error) => {
            // Gracefully handle permission errors — unsubscribe to prevent cascade
            if (error.code === 'permission-denied') {
                console.warn('Firestore permission denied for tasks. Unsubscribing listener.');
                if (!unsubscribed) { unsubscribed = true; unsubscribe(); }
            } else {
                console.error('Firestore tasks subscription error:', error);
            }
        });

        return () => { unsubscribed = true; unsubscribe(); };
    }, [user, setTasks]);

    // Add a new task
    const addTask = async (task: Omit<Task, 'id' | 'createdAt'>) => {
        if (!user) throw new Error('Not authenticated');
        const db = getFirebaseDb();
        if (!db) throw new Error('Database not initialized');
        const tasksRef = collection(db, 'users', user.uid, 'tasks');
        await addDoc(tasksRef, {
            ...task,
            deadline: Timestamp.fromDate(task.deadline),
            createdAt: Timestamp.now(),
        });
    };

    // Update a task
    const updateTask = async (id: string, updates: Partial<Task>) => {
        if (!user) return;
        const db = getFirebaseDb();
        if (!db) return;
        const taskRef = doc(db, 'users', user.uid, 'tasks', id);
        const firestoreUpdates: Record<string, unknown> = { ...updates };
        if (updates.deadline) {
            firestoreUpdates.deadline = Timestamp.fromDate(updates.deadline);
        }
        if (updates.completedAt) {
            firestoreUpdates.completedAt = Timestamp.fromDate(updates.completedAt);
        }
        // Remove undefined values
        Object.keys(firestoreUpdates).forEach(key => {
            if (firestoreUpdates[key] === undefined) delete firestoreUpdates[key];
        });
        await updateDoc(taskRef, firestoreUpdates);
        updateTaskStore(id, updates);
    };

    // Batch update tasks (for Panic Mode)
    const batchUpdateTasks = async (updatedTasks: Task[]) => {
        if (!user) return;
        const db = getFirebaseDb();
        if (!db) return;

        const currentTasks = useStore.getState().tasks;
        const promises: Promise<void>[] = [];

        for (const updatedTask of updatedTasks) {
            const original = currentTasks.find(t => t.id === updatedTask.id);
            if (!original) continue;

            // Check if anything changed
            const changes: Partial<Task> = {};
            if (updatedTask.status !== original.status) changes.status = updatedTask.status;
            if (updatedTask.duration !== original.duration) changes.duration = updatedTask.duration;

            if (Object.keys(changes).length > 0) {
                promises.push(updateTask(updatedTask.id, changes));
            }
        }

        await Promise.all(promises);
    };

    // Delete a task
    const deleteTask = async (id: string) => {
        if (!user) return;
        const db = getFirebaseDb();
        if (!db) return;
        const taskRef = doc(db, 'users', user.uid, 'tasks', id);
        await deleteDoc(taskRef);
        deleteTaskStore(id);
    };

    // Complete a task
    const completeTask = async (id: string) => {
        await updateTask(id, { status: 'Completed', completedAt: new Date() });
    };

    return { tasks, addTask, updateTask, batchUpdateTasks, deleteTask, completeTask };
}
