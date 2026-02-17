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

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasksData: Task[] = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    title: data.title,
                    duration: data.duration,
                    deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : new Date(data.deadline),
                    priority: data.priority as Priority,
                    status: data.status as TaskStatus,
                    isFixed: data.isFixed ?? false,
                    parentId: data.parentId,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
                };
            });
            setTasks(tasksData);
        });

        return () => unsubscribe();
    }, [user, setTasks]);

    // Add a new task
    const addTask = async (task: Omit<Task, 'id' | 'createdAt'>) => {
        if (!user) return;
        const db = getFirebaseDb();
        if (!db) return;
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
        await updateDoc(taskRef, firestoreUpdates);
        updateTaskStore(id, updates);
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
        await updateTask(id, { status: 'Completed' });
    };

    return { tasks, addTask, updateTask, deleteTask, completeTask };
}
