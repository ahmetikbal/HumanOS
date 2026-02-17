'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle, Skull, Trash2, Minimize2, Shield } from 'lucide-react';
import { executePanicMode, PanicModeResult } from '@/lib/panic-mode';
import { Task, UserSettings } from '@/types';

interface PanicButtonProps {
    tasks: Task[];
    settings: UserSettings;
    onPanicExecuted: (result: PanicModeResult) => void;
}

export function PanicButton({ tasks, settings, onPanicExecuted }: PanicButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [result, setResult] = useState<PanicModeResult | null>(null);

    const handlePanic = () => {
        const panicResult = executePanicMode(tasks, settings);
        setResult(panicResult);
        onPanicExecuted(panicResult);
        setShowConfirm(false);
        setShowResult(true);
    };

    return (
        <>
            {/* Panic Button */}
            <Button
                variant="destructive"
                size="lg"
                onClick={() => setShowConfirm(true)}
                className="relative overflow-hidden group glow-danger hover:scale-105 transition-all duration-200 cursor-pointer font-bold px-6"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    PANIC MODE
                    <AlertTriangle className="w-5 h-5" />
                </span>
            </Button>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="glass border-destructive/30 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <Skull className="w-6 h-6" />
                            OOM Killer — Initiated
                        </DialogTitle>
                        <DialogDescription className="font-mono text-xs mt-2">
                            WARNING: This action is irreversible. The following will happen:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        <div className="flex items-center gap-3 text-sm">
                            <Trash2 className="w-4 h-4 text-destructive flex-shrink-0" />
                            <span>
                                <span className="font-semibold text-destructive">DROP</span> all{' '}
                                <span className="priority-low px-1.5 py-0.5 rounded text-xs">Low</span> priority
                                tasks
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Minimize2 className="w-4 h-4 text-chart-4 flex-shrink-0" />
                            <span>
                                <span className="font-semibold text-chart-4">COMPRESS</span> all{' '}
                                <span className="priority-medium px-1.5 py-0.5 rounded text-xs">Medium</span>{' '}
                                tasks by 20%
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Shield className="w-4 h-4 text-chart-2 flex-shrink-0" />
                            <span>
                                <span className="font-semibold text-chart-2">PROTECT</span> all{' '}
                                <span className="priority-high px-1.5 py-0.5 rounded text-xs">High</span> priority
                                tasks
                            </span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowConfirm(false)} className="cursor-pointer">
                            Abort
                        </Button>
                        <Button variant="destructive" onClick={handlePanic} className="glow-danger cursor-pointer">
                            <Skull className="w-4 h-4 mr-2" />
                            Execute OOM Kill
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Result Dialog */}
            <Dialog open={showResult} onOpenChange={setShowResult}>
                <DialogContent className="glass border-chart-2/30 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-chart-2">
                            <Shield className="w-5 h-5" />
                            OOM Killer — Complete
                        </DialogTitle>
                    </DialogHeader>

                    {result && (
                        <div className="space-y-3 py-4 font-mono text-sm">
                            <div className="flex justify-between items-center p-2 rounded bg-destructive/10">
                                <span className="text-destructive">Tasks Dropped</span>
                                <span className="font-bold text-destructive">{result.droppedCount}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded bg-chart-4/10">
                                <span className="text-chart-4">Tasks Compressed</span>
                                <span className="font-bold text-chart-4">{result.compressedCount}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded bg-chart-2/10">
                                <span className="text-chart-2">Time Saved</span>
                                <span className="font-bold text-chart-2">{result.savedMinutes} min</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setShowResult(false)} className="glow-success cursor-pointer">
                            System Stabilized
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
