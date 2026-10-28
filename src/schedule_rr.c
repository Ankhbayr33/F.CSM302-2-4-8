/*
 * schedule_rr.c - Round-Robin scheduling
 *
 * Tasks wait in a FIFO ready queue. Each task runs for one time quantum
 * (or the rest of its burst if shorter) and, if unfinished, goes to the
 * back of the queue. Tasks that arrive during a slice are queued before
 * the task that was just preempted.
 */
#include <stdio.h>
#include <stdlib.h>
#include "cpu.h"
#include "list.h"
#include "schedulers.h"

const char *scheduler_name = "RR";
const int scheduler_uses_quantum = 1;

static struct node *pending = NULL;   /* tasks that have not arrived yet */
static struct node *ready = NULL;     /* FIFO ready queue                */

void add(char *name, int priority, int burst, int arrival)
{
    Task *t = task_create(name, priority, burst, arrival);
    if (t == NULL) {
        fprintf(stderr, "error: cannot create task %s\n", name);
        exit(EXIT_FAILURE);
    }
    insert(&pending, t);
}

/* move every task that has arrived by now into the ready queue */
static void admit_arrivals(void)
{
    Task *t;
    while ((t = list_earliest(pending)) != NULL && t->arrival <= cpu_time()) {
        delete(&pending, t);
        append(&ready, t);
    }
}

/* head of the ready queue */
static Task *pickNextTask(void)
{
    return pop_front(&ready);
}

void schedule(void)
{
    admit_arrivals();
    while (ready != NULL || pending != NULL) {
        if (ready == NULL) {
            cpu_idle_until(list_earliest(pending)->arrival);
            admit_arrivals();
            continue;
        }
        Task *t = pickNextTask();
        int slice = t->remaining < time_quantum ? t->remaining : time_quantum;
        run(t, slice);
        admit_arrivals();
        if (t->remaining > 0)
            append(&ready, t);
    }
}
