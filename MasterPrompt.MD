# Project Name: Human OS - The Biological Operating System
# Role: Senior Full Stack Architect & Algorithm Engineer

## Project Overview
Build a responsive web application called "Human OS". The goal is to manage the user's life with the precision of a computer operating system. It treats the user's time as CPU cycles and tasks as processes. The core philosophy is to minimize decision fatigue (Curse of Dimensionality) by automating the scheduling of daily tasks using specific algorithms (EDF - Earliest Deadline First).

## Tech Stack & Infrastructure
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI (for components), Lucide React (icons).
- **State Management:** Zustand (for global store and client-side scheduler state).
- **Backend/DB:** Firebase v9 (Authentication, Firestore for database).
- **Deployment:** Vercel (Production environment).
- **Date Handling:** date-fns (for complex date math).

## Core Features & Requirements

### 1. The Kernel (Scheduling Engine)
This is the heart of the app. It must run on the client side (or edge function) to act as an O(1) scheduler.
- **Algorithm:** Modified EDF (Earliest Deadline First).
- **Task Splitting:** If a task duration > available contiguous time slot, it must be split into sub-tasks automatically across multiple days/slots.
- **Context Switching Rules:**
  - Tasks < 2 minutes: "Interrupts". Schedule immediately in the first available gap (Greedy approach).
  - Tasks > 2 minutes: Strictly ordered by Deadline.
- **Panic Mode (The "OOM Killer"):** A button that, when triggered:
  1. Drops all tasks with `priority: 'Low'`.
  2. Compresses `priority: 'Medium'` tasks (reduces duration by 20% if possible).
  3. Keeps `priority: 'High'` untouched.
  4. Re-schedules everything instantly.
- **Sleep Shifter:** A setting to define `CurrentWakeTime` and `TargetWakeTime`. The system automatically adjusts the daily wake-up/sleep blocks by shifting X minutes backwards every day until the target is reached.

### 2. Data Model (Firestore Schema)

#### `users/{userId}`
- `settings`: { wakeTime, bedTime, targetWakeTime, shiftRateMin, panicModeActive }

#### `users/{userId}/tasks`
- `id`: string
- `title`: string
- `duration`: number (minutes)
- `deadline`: timestamp (Hard constraint)
- `priority`: 'Low' | 'Medium' | 'High'
- `status`: 'Pending' | 'In-Progress' | 'Completed' | 'Dropped'
- `isFixed`: boolean (false for tasks, true for events like Gym/Dinner)
- `parentId`: string (if split from a larger task)

#### `users/{userId}/schedule` (Generated)
- `date`: string (YYYY-MM-DD)
- `slots`: Array of { timeStart, timeEnd, taskId, type: 'Task' | 'Fixed' | 'Free' | 'Sleep' }

### 3. User Interface (UI/UX)
- **Design Language:** Clean, minimal, dashboard-style. Not a CLI, but highly efficient GUI. Dark mode default.
- **Dashboard:**
  - **Current Task (The CPU Register):** Big, bold display of *what to do right now*. No list, just the current instruction.
  - **Next Up:** Small preview of the next 2 tasks.
  - **Panic Button:** Visible emergency trigger.
- **Calendar/Timeline View:**
  - A vertical daily timeline showing blocks (Used vs. Free memory).
  - Drag-and-drop to manually override the auto-scheduler (Dynamic Interrupts).
- **Input Modal:**
  - Fields: Title, Estimated Duration, Deadline (Mandatory for >2min), Priority.
- **Review Page (Sunday Routine):**
  - Weekly visualization of completed vs. dropped tasks.
  - Productivity score (CPU Utilization %).

## Development Phases (Step-by-Step Implementation)

### Phase 1: Setup & Infrastructure
1. Initialize Next.js 14 project with TypeScript & Tailwind.
2. Setup Firebase Config & Auth Context (Google Login).
3. Create the Firestore hooks for CRUD operations on Tasks.

### Phase 2: The Scheduler Algorithm (The Hardest Part)
1. Implement `generateSchedule(tasks, fixedEvents, settings)` function.
   - Step A: Lay down "Fixed" blocks (Sleep, Eat, Sport).
   - Step B: Calculate "Free" blocks.
   - Step C: Insert <2min tasks into the earliest free blocks.
   - Step D: Sort remaining tasks by Deadline (EDF).
   - Step E: Iterate and fill blocks. Implement logic to split large tasks if `task.duration > block.duration`.
   - Step F: Handle "Overflow" (impossible deadlines) by flagging them in UI.

### Phase 3: Frontend Implementation
1. Build the "Task Input" component.
2. Build the "Timeline/Calendar" component using `div` blocks calculated from the schedule.
3. Build the "Current Task" execution view.

### Phase 4: Advanced Features
1. Implement "Panic Mode" logic in the scheduler.
2. Implement "Sleep Shifter" logic.
3. Add "Weekly Review" analytics chart.


# PRODUCT PHILOSOPHY
Human OS is not a to-do app.

It is a deterministic execution engine inspired by:

- Operating System scheduling
- EDF (Earliest Deadline First)
- Least Slack Time
- Interrupt handling
- AI Agent rule systems

Goal:
Minimize cognitive branching factor.
Reduce decision fatigue (Curse of Dimensionality).
Convert life execution into O(1) daily decision cost.
User does NOT decide what to do.
User executes what the system assigns.


## Instructions for the AI
Please start by outlining the project structure and writing the core `scheduler.ts` utility file, as that is the most complex logic. Then proceed to the Next.js page structure.