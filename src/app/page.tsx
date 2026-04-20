'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Cpu,
  Zap,
  Shield,
  ArrowRight,
  Terminal,
  Play,
} from 'lucide-react';

export default function HomePage() {
  const { user, loading, signInWithGoogle, signInAsDemo } = useAuth();
  const router = useRouter();
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await signInAsDemo();
    } finally {
      setDemoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Cpu className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-sm">
            Booting Human OS...
          </p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-chart-2/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-chart-5/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 max-w-2xl text-center">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center glow-primary">
              <Terminal className="w-8 h-8 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-chart-2 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-3">
            <span className="text-gradient">Human</span>
            <span className="text-foreground"> OS</span>
          </h1>
          <p className="text-lg text-muted-foreground font-mono">
            The Biological Operating System
          </p>
        </div>

        {/* Description */}
        <p className="text-muted-foreground text-base leading-relaxed max-w-lg">
          Stop deciding. Start executing. Human OS treats your time as CPU cycles and your tasks as
          processes — automatically scheduled using{' '}
          <span className="text-primary font-medium">Earliest Deadline First</span> algorithm.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-lg">
          <div className="glass rounded-xl p-4 flex flex-col items-center gap-2 text-center">
            <Cpu className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">O(1) Decisions</span>
          </div>
          <div className="glass rounded-xl p-4 flex flex-col items-center gap-2 text-center">
            <Zap className="w-5 h-5 text-chart-4" />
            <span className="text-xs text-muted-foreground">Auto Scheduling</span>
          </div>
          <div className="glass rounded-xl p-4 flex flex-col items-center gap-2 text-center">
            <Shield className="w-5 h-5 text-destructive" />
            <span className="text-xs text-muted-foreground">Panic Mode</span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <Button
            size="lg"
            onClick={signInWithGoogle}
            className="px-8 py-6 text-base font-semibold rounded-xl glow-primary hover:scale-105 transition-transform duration-200 cursor-pointer"
          >
            Boot System
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={handleDemo}
            disabled={demoLoading}
            className="px-8 py-5 text-sm font-medium rounded-xl border-primary/30 text-primary hover:bg-primary/10 hover:scale-105 transition-all duration-200 cursor-pointer gap-2"
          >
            {demoLoading ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                Loading demo...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Try Demo
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/60 font-mono">
          Sign in with Google or try the demo with pre-loaded data
        </p>
      </div>

      {/* Bottom terminal line */}
      <div className="absolute bottom-6 left-6 font-mono text-xs text-muted-foreground/40">
        <span className="text-primary/60">$</span> human-os --version 1.0.0
      </div>
    </div>
  );
}
