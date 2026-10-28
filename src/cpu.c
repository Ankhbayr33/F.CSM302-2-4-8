/*
 * cpu.c - virtual CPU: simulated clock and Gantt-chart timeline
 */
#include <stdio.h>
#include <stdlib.h>
#include "cpu.h"

static int clock_now = 0;
static int quiet = 0;
static int switches = 0;
static Task *last_task = NULL;

static Segment *segments = NULL;
static int seg_count = 0, seg_cap = 0;

static void add_segment(Task *task, int start, int end)
{
    if (seg_count == seg_cap) {
        seg_cap = seg_cap ? seg_cap * 2 : 64;
        Segment *p = realloc(segments, (size_t)seg_cap * sizeof *p);
        if (p == NULL) {
            fprintf(stderr, "error: out of memory\n");
            exit(EXIT_FAILURE);
        }
        segments = p;
    }
    segments[seg_count].task = task;
    segments[seg_count].start = start;
    segments[seg_count].end = end;
    seg_count++;
}

void run(Task *task, int slice)
{
    if (slice <= 0 || slice > task->remaining) {
        fprintf(stderr, "internal error: bad slice %d for task %s\n",
                slice, task->name);
        exit(EXIT_FAILURE);
    }
    if (!quiet)
        printf("Running task = [%s] [%d] [%d] for %d units.\n",
               task->name, task->priority, task->burst, slice);

    if (task->start < 0)
        task->start = clock_now;          /* first response */
    if (last_task != NULL && last_task != task)
        switches++;
    last_task = task;

    add_segment(task, clock_now, clock_now + slice);
    clock_now += slice;
    task->remaining -= slice;
    if (task->remaining == 0)
        task->completion = clock_now;
}

void cpu_idle_until(int t)
{
    if (t <= clock_now)
        return;
    if (!quiet)
        printf("CPU idle from %d to %d.\n", clock_now, t);
    add_segment(NULL, clock_now, t);
    clock_now = t;
}

int cpu_time(void) { return clock_now; }
int cpu_segment_count(void) { return seg_count; }
const Segment *cpu_segment(int i) { return &segments[i]; }
int cpu_context_switches(void) { return switches; }
void cpu_set_quiet(int q) { quiet = q; }

void cpu_free(void)
{
    free(segments);
    segments = NULL;
    seg_count = seg_cap = 0;
}
