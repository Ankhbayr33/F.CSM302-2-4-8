/*
 * cpu.h - virtual CPU
 *
 * run() "executes" a task for a time slice: it prints the textbook message,
 * advances the simulated clock and records a segment of the Gantt chart.
 */
#ifndef CPU_H
#define CPU_H

#include "task.h"

/* default length of a time quantum (textbook: 10 milliseconds) */
#define QUANTUM 10

/* One bar of the Gantt chart. task == NULL means the CPU was idle. */
typedef struct {
    Task *task;
    int start;
    int end;
} Segment;

/* run the specified task for the following time slice */
void run(Task *task, int slice);

/* CPU has nothing to do: advance the clock to time t (idle segment). */
void cpu_idle_until(int t);

int  cpu_time(void);                 /* current simulated time          */
int  cpu_segment_count(void);
const Segment *cpu_segment(int i);
int  cpu_context_switches(void);     /* dispatches of a different task  */
void cpu_set_quiet(int quiet);       /* 1 = do not print run() messages */
void cpu_free(void);

#endif /* CPU_H */
