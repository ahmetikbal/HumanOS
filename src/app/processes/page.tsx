'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { TaskInputModal } from '@/components/task-input-modal';
import { TaskEditModal } from '@/components/task-edit-modal';
import { useTasks } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ListTodo,
    Trash2,
    CheckCircle,
    Pencil,
    Filter,
    Pin,
    Clock,
    Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { Task, TaskStatus } from '@/types';

type FilterTab = 'all' | 'active' | 'completed' | 'dropped' | 'fixed-events';

export default function ProcessesPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { tasks, addTask, updateTask, deleteTask, completeTask } = useTasks();
    const { settings, addFixedEvent, removeFixedEvent } = useSettings();

    const [filter, setFilter] = useState<FilterTab>('all');
    const [editTask, setEditTask] = useState<Task | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push('/');
    }, [user, loading, router]);

    if (loading || !user) return null;

    // Filter tasks
    const filteredTasks = tasks.filter((t) => {
        switch (filter) {
            case 'active':
                return t.status === 'Pending' || t.status === 'In-Progress';
            case 'completed':
                return t.status === 'Completed';
            case 'dropped':
                return t.status === 'Dropped';
            default:
                return true;
        }
    });

    const handleEdit = (task: Task) => {
        setEditTask(task);
        setEditOpen(true);
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            await deleteTask(taskId);
        } catch (err) {
            console.error('Failed to delete task:', err);
        }
    };

    const tabs: { key: FilterTab; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: tasks.length },
        { key: 'active', label: 'Active', count: tasks.filter((t) => t.status === 'Pending' || t.status === 'In-Progress').length },
        { key: 'completed', label: 'Completed', count: tasks.filter((t) => t.status === 'Completed').length },
        { key: 'dropped', label: 'Dropped', count: tasks.filter((t) => t.status === 'Dropped').length },
        { key: 'fixed-events', label: 'Fixed Events', count: settings.fixedEvents.length },
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="text-gradient">Processes</span>
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                            Process Manager — {tasks.length} total • {settings.fixedEvents.length} fixed events
                        </p>
                    </div>
                    <TaskInputModal onSubmit={addTask} onAddFixedEvent={addFixedEvent} />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${filter === tab.key
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                }`}
                        >
                            {tab.label}
                            <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
                        </button>
                    ))}
                </div>

                {filter === 'fixed-events' ? (
                    /* ─── Fixed Events Table ─── */
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Pin className="w-4 h-4 text-chart-4" />
                                Fixed Events — Locked Timeslots
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                            {settings.fixedEvents.length === 0 ? (
                                <p className="text-xs text-muted-foreground font-mono text-center py-8">
                                    No fixed events configured. Create one with &quot;New Process&quot; → Fixed Event.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {settings.fixedEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex items-center justify-between p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                                                    <Pin className="w-4 h-4 text-chart-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{event.title}</p>
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        <span>{event.timeStart} – {event.timeEnd}</span>
                                                        <span>•</span>
                                                        <span>{event.days.map((d) => dayNames[d]).join(', ')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeFixedEvent(event.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive cursor-pointer"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    /* ─── Tasks Table ─── */
                    <Card className="glass border-border/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                {filter === 'all' ? 'All Processes' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Processes`}
                                <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                                    {filteredTasks.length} process{filteredTasks.length !== 1 ? 'es' : ''}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                            {filteredTasks.length === 0 ? (
                                <p className="text-xs text-muted-foreground font-mono text-center py-8">
                                    No{filter !== 'all' ? ` ${filter}` : ''} processes found.
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {/* Header row */}
                                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                                        <span className="col-span-4">Name</span>
                                        <span className="col-span-1 text-center">PRI</span>
                                        <span className="col-span-2 text-center">Duration</span>
                                        <span className="col-span-2 text-center">Deadline</span>
                                        <span className="col-span-1 text-center">Status</span>
                                        <span className="col-span-2 text-right">Actions</span>
                                    </div>

                                    {/* Task rows */}
                                    {filteredTasks.map((task) => (
                                        <TaskRow
                                            key={task.id}
                                            task={task}
                                            onEdit={() => handleEdit(task)}
                                            onDelete={() => handleDeleteTask(task.id)}
                                            onComplete={() => completeTask(task.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </main>

            {/* Edit Modal */}
            <TaskEditModal
                task={editTask}
                open={editOpen}
                onOpenChange={setEditOpen}
                onUpdate={updateTask}
                onDelete={deleteTask}
                onComplete={completeTask}
            />
        </div>
    );
}

function TaskRow({
    task,
    onEdit,
    onDelete,
    onComplete,
}: {
    task: Task;
    onEdit: () => void;
    onDelete: () => void;
    onComplete: () => void;
}) {
    const isActive = task.status === 'Pending' || task.status === 'In-Progress';
    const isOverdue = isActive && task.deadline < new Date();

    return (
        <div
            className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-background/50 transition-colors group cursor-pointer ${isOverdue ? 'bg-destructive/5 border border-destructive/10' : 'bg-background/20'
                }`}
            onClick={onEdit}
        >
            {/* Name */}
            <div className="col-span-4 flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium truncate">{task.title}</span>
            </div>

            {/* Priority */}
            <div className="col-span-1 flex justify-center">
                <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 priority-${task.priority.toLowerCase()}`}
                >
                    {task.priority[0]}
                </Badge>
            </div>

            {/* Duration */}
            <div className="col-span-2 text-center">
                <span className="text-xs text-muted-foreground font-mono">{task.duration}m</span>
            </div>

            {/* Deadline */}
            <div className="col-span-2 text-center">
                <span className={`text-[10px] font-mono ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {format(task.deadline, 'MMM d')}
                </span>
            </div>

            {/* Status */}
            <div className="col-span-1 flex justify-center">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${task.status === 'Completed' ? 'bg-chart-2/10 text-chart-2' :
                        task.status === 'Dropped' ? 'bg-destructive/10 text-destructive' :
                            isOverdue ? 'bg-destructive/10 text-destructive' :
                                'bg-primary/10 text-primary'
                    }`}>
                    {task.status === 'In-Progress' ? 'Active' : task.status}
                </span>
            </div>

            {/* Actions */}
            <div className="col-span-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {isActive && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-chart-2 hover:text-chart-2 cursor-pointer"
                            onClick={onComplete}
                            title="Complete"
                        >
                            <CheckCircle className="w-3 h-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-destructive hover:text-destructive cursor-pointer"
                            onClick={onDelete}
                            title="Delete"
                        >
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={onEdit}
                    title="Edit"
                >
                    <Pencil className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
}
