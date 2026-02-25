'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
    Cpu,
    LayoutDashboard,
    CalendarDays,
    ListTodo,
    BarChart3,
    Settings,
    LogOut,
    Zap,
} from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/processes', label: 'Processes', icon: ListTodo },
    { href: '/interrupts', label: 'Interrupts', icon: Zap },
    { href: '/timeline', label: 'Timeline', icon: CalendarDays },
    { href: '/review', label: 'Review', icon: BarChart3 },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navbar() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();

    if (!user) return null;

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14">
                    {/* Logo */}
                    <Link href="/dashboard" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:glow-primary transition-shadow duration-300">
                            <Cpu className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-bold text-sm tracking-tight">
                            <span className="text-gradient">Human</span>
                            <span className="text-foreground">OS</span>
                        </span>
                    </Link>

                    {/* Nav Links */}
                    <div className="flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <Button
                                        variant={isActive ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className={`gap-2 text-xs font-medium cursor-pointer ${isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <item.icon className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">{item.label}</span>
                                    </Button>
                                </Link>
                            );
                        })}
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-3">
                        {user.photoURL && (
                            <img
                                src={user.photoURL}
                                alt="Avatar"
                                className="w-7 h-7 rounded-full ring-2 ring-primary/20"
                            />
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={signOut}
                            className="text-muted-foreground hover:text-destructive text-xs cursor-pointer"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
