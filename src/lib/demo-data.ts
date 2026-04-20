'use client';

import {
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    Timestamp,
    writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { addDays, setHours, setMinutes } from 'date-fns';

// ─── Demo Tasks (matching the desired process list) ───

interface DemoTask {
    title: string;
    description: string;
    duration: number; // minutes
    deadlineDaysFromNow: number;
    priority: 'Low' | 'Medium' | 'High';
    status: 'Pending' | 'In-Progress' | 'Completed';
}

const DEMO_TASKS: DemoTask[] = [
    {
        title: 'Build alınıp Play Store\'a gönderilecek',
        description: 'Release build oluşturup Play Store\'a yüklemek.',
        duration: 30,
        deadlineDaysFromNow: 0,
        priority: 'Medium',
        status: 'Completed',
    },
    {
        title: 'Kod Review — Backend',
        description: 'Takım arkadaşının backend PR\'ını incelemek ve feedback vermek.',
        duration: 40,
        deadlineDaysFromNow: 0,
        priority: 'High',
        status: 'Pending',
    },
    {
        title: 'Sunum Hazırlığı',
        description: 'Etkinlik için proje sunumunu hazırlamak, demo videosu çekmek.',
        duration: 150,
        deadlineDaysFromNow: 1,
        priority: 'High',
        status: 'In-Progress',
    },
    {
        title: 'CV Güncelleme',
        description: 'Yeni becerileri ve projeleri CV\'ye eklemek.',
        duration: 120,
        deadlineDaysFromNow: 2,
        priority: 'Medium',
        status: 'Pending',
    },
    {
        title: 'Mobil Uygulama UI Tasarımı',
        description: 'Figma üzerinde ana ekranların wireframe ve hi-fi tasarımlarını yapmak.',
        duration: 360,
        deadlineDaysFromNow: 4,
        priority: 'High',
        status: 'Pending',
    },
    {
        title: 'Veritabanı Optimizasyonu',
        description: 'Firestore sorgu performansını artırmak, gereksiz okuma/yazmaları azaltmak.',
        duration: 300,
        deadlineDaysFromNow: 6,
        priority: 'Medium',
        status: 'Pending',
    },
    {
        title: 'API Entegrasyonu',
        description: 'Üçüncü parti takvim API entegrasyonunu tamamlamak.',
        duration: 180,
        deadlineDaysFromNow: 7,
        priority: 'Medium',
        status: 'Pending',
    },
    {
        title: 'Docker Konfigürasyonu',
        description: 'Projeyi dockerize etmek, docker-compose dosyasını oluşturmak.',
        duration: 75,
        deadlineDaysFromNow: 8,
        priority: 'Low',
        status: 'Pending',
    },
    {
        title: 'Unit Test Yazımı',
        description: 'Scheduler ve panic-mode modülleri için birim testleri yazmak.',
        duration: 220,
        deadlineDaysFromNow: 9,
        priority: 'Medium',
        status: 'Pending',
    },
    {
        title: 'Portfolyo Web Sitesi Yapımı',
        description: 'Kişisel portfolyo sitesini güncellemek, son projeleri eklemek.',
        duration: 600,
        deadlineDaysFromNow: 10,
        priority: 'Low',
        status: 'Pending',
    },
    {
        title: 'Makale Okuma',
        description: 'EDF scheduling üzerine 3 akademik makaleyi okuyup not almak.',
        duration: 150,
        deadlineDaysFromNow: 13,
        priority: 'Low',
        status: 'Pending',
    },
    {
        title: 'Bitirme Projesi Raporu',
        description: 'Projenin teknik detaylarını ve sonuçları belgelemek.',
        duration: 300,
        deadlineDaysFromNow: 14,
        priority: 'High',
        status: 'In-Progress',
    },
];

// ─── Fixed Events ───

const DEMO_FIXED_EVENTS = [
    {
        id: 'fe-breakfast',
        title: 'Kahvaltı',
        timeStart: '07:30',
        timeEnd: '08:00',
        days: [0, 1, 2, 3, 4, 5, 6], // every day
    },
    {
        id: 'fe-lunch',
        title: 'Öğle Yemeği',
        timeStart: '12:30',
        timeEnd: '13:00',
        days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
        id: 'fe-dinner',
        title: 'Akşam Yemeği',
        timeStart: '19:00',
        timeEnd: '19:30',
        days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
        id: 'fe-gym',
        title: 'Spor',
        timeStart: '17:00',
        timeEnd: '18:00',
        days: [1, 3, 5], // Mon, Wed, Fri
    },
];

// ─── Calendar Events (Interrupts) ───

function getDemoCalendarEvents() {
    const today = new Date();
    return [
        {
            id: 'ce-meeting1',
            title: 'Proje Toplantısı',
            date: formatDateStr(addDays(today, 1)),
            timeStart: '10:00',
            timeEnd: '11:30',
            description: 'Sprint planlama toplantısı — tüm takım katılacak.',
        },
        {
            id: 'ce-career',
            title: 'Kariyer Etkinliği',
            date: formatDateStr(addDays(today, 3)),
            timeStart: '14:00',
            timeEnd: '16:00',
            description: 'Üniversitede kariyer günleri paneli.',
        },
        {
            id: 'ce-advisor',
            title: 'Danışman Görüşmesi',
            date: formatDateStr(addDays(today, 2)),
            timeStart: '09:00',
            timeEnd: '09:45',
            description: 'Proje ilerleme durumu hakkında danışman ile görüşme.',
        },
        {
            id: 'ce-workshop',
            title: 'React Workshop',
            date: formatDateStr(addDays(today, 5)),
            timeStart: '13:00',
            timeEnd: '15:00',
            description: 'Next.js ve Server Components workshop\'u.',
        },
    ];
}

function formatDateStr(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ─── Seeder Function ───

export async function seedDemoData(userId: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) throw new Error('Database not initialized');

    const tasksCol = collection(db, 'users', userId, 'tasks');
    const existingTasks = await getDocs(tasksCol);

    // In production: always force-reseed so every demo visitor gets fresh data
    // In development: only seed if no tasks exist (so dev edits persist)
    const isProduction = process.env.NODE_ENV === 'production';

    if (!existingTasks.empty) {
        if (!isProduction) {
            // Dev mode: keep existing data (user edits persist)
            return;
        }
        // Production: delete existing tasks and reseed
        const deletePromises = existingTasks.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
    }

    const now = new Date();
    const batch = writeBatch(db);

    // 1. Seed tasks
    for (const task of DEMO_TASKS) {
        const deadline = addDays(now, task.deadlineDaysFromNow);
        const taskRef = doc(tasksCol);
        batch.set(taskRef, {
            title: task.title,
            description: task.description,
            duration: task.duration,
            deadline: Timestamp.fromDate(setMinutes(setHours(deadline, 23), 59)),
            priority: task.priority,
            status: task.status,
            isFixed: false,
            createdAt: Timestamp.now(),
            ...(task.status === 'Completed' ? { completedAt: Timestamp.now() } : {}),
        });
    }

    // 2. Seed settings (fixedEvents + calendarEvents)
    const userDocRef = doc(db, 'users', userId);
    batch.set(userDocRef, {
        settings: {
            wakeTime: '07:00',
            bedTime: '23:00',
            shiftRateMin: 15,
            panicModeActive: false,
            fixedEvents: DEMO_FIXED_EVENTS,
            calendarEvents: getDemoCalendarEvents(),
            breakTimeMin: 10,
        },
        createdAt: new Date(),
    }, { merge: true });

    await batch.commit();
}
