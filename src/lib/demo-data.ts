'use client';

import {
    collection,
    doc,
    setDoc,
    getDocs,
    Timestamp,
    writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { addDays, setHours, setMinutes } from 'date-fns';

// ─── Turkish Dummy Tasks (10-15 days spread) ───

interface DemoTask {
    title: string;
    description: string;
    duration: number; // minutes
    deadlineDaysFromNow: number;
    priority: 'Low' | 'Medium' | 'High';
    status: 'Pending' | 'In-Progress';
}

const DEMO_TASKS: DemoTask[] = [
    {
        title: 'Mezuniyet Projesi Raporu',
        description: 'Projenin teknik detaylarını ve sonuçları belgelemek.',
        duration: 180,
        deadlineDaysFromNow: 12,
        priority: 'High',
        status: 'In-Progress',
    },
    {
        title: 'Mobil Uygulama UI Tasarımı',
        description: 'Figma üzerinde ana ekranların wireframe ve hi-fi tasarımlarını yapmak.',
        duration: 120,
        deadlineDaysFromNow: 5,
        priority: 'High',
        status: 'Pending',
    },
    {
        title: 'Sunum Hazırlığı',
        description: 'Etkinlik için proje sunumunu oluşturmak, demo videosu hazırlamak.',
        duration: 90,
        deadlineDaysFromNow: 2,
        priority: 'High',
        status: 'In-Progress',
    },
    {
        title: 'Veritabanı Optimizasyonu',
        description: 'Firestore sorgu performansını artırmak, gereksiz okuma/yazmaları azaltmak.',
        duration: 60,
        deadlineDaysFromNow: 7,
        priority: 'Medium',
        status: 'Pending',
    },
    {
        title: 'API Entegrasyonu',
        description: 'Üçüncü parti takvim API entegrasyonunu tamamlamak.',
        duration: 150,
        deadlineDaysFromNow: 8,
        priority: 'Medium',
        status: 'Pending',
    },
    {
        title: 'Birim Testleri Yazımı',
        description: 'Scheduler ve panic-mode modülleri için birim testleri yazmak.',
        duration: 100,
        deadlineDaysFromNow: 10,
        priority: 'Medium',
        status: 'Pending',
    },
    {
        title: 'Araştırma Makalesi Okuma',
        description: 'EDF scheduling üzerine 3 akademik makaleyi okuyup not almak.',
        duration: 90,
        deadlineDaysFromNow: 14,
        priority: 'Low',
        status: 'Pending',
    },
    {
        title: 'Portfolyo Web Sitesi',
        description: 'Kişisel portfolyo sitesini güncellemek, son projeleri eklemek.',
        duration: 120,
        deadlineDaysFromNow: 11,
        priority: 'Low',
        status: 'Pending',
    },
    {
        title: 'CV Güncelleme',
        description: 'Yeni becerileri ve projeleri CV\'ye eklemek.',
        duration: 45,
        deadlineDaysFromNow: 3,
        priority: 'Medium',
        status: 'Pending',
    },
    {
        title: 'Kod Review — Backend',
        description: 'Takım arkadaşının backend PR\'ını incelemek ve feedback vermek.',
        duration: 40,
        deadlineDaysFromNow: 1,
        priority: 'High',
        status: 'Pending',
    },
    {
        title: 'Docker Konfigürasyonu',
        description: 'Projeyi dockerize etmek, docker-compose dosyasını oluşturmak.',
        duration: 75,
        deadlineDaysFromNow: 9,
        priority: 'Low',
        status: 'Pending',
    },
    {
        title: 'Haftalık Retrospektif Notu',
        description: 'Bu haftanın kazanımlarını ve gelecek haftanın plan notlarını yazmak.',
        duration: 30,
        deadlineDaysFromNow: 1,
        priority: 'Medium',
        status: 'Pending',
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

    // Check if demo data already exists
    const tasksCol = collection(db, 'users', userId, 'tasks');
    const existingTasks = await getDocs(tasksCol);
    if (!existingTasks.empty) {
        // Demo data already seeded
        return;
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
