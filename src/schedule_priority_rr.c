/*
 * schedule_priority_rr.c - Priority scheduling with Round-Robin
 *
 * One FIFO queue per priority level (textbook Figure 5.7). The scheduler
 * always serves the highest non-empty level; tasks of equal priority share
 * the CPU round-robin, one time quantum at a time.
 * As the textbook allows, a running task is not preempted in the middle of
 * its slice by a newly arrived higher-priority task.
 */
#include <stdio.h>
#include <stdlib.h>
#include "cpu.h"
#include "list.h"
#include "schedulers.h"

const char *scheduler_name = "Priority-RR";
const int scheduler_uses_quantum = 1;

static struct node *pending = NULL;                 /* not arrived yet   */
static struct node *queue[MAX_PRIORITY + 1];        /* one per priority  */

void add(char *name, int priority, int burst, int arrival)
{
    Task *t = task_create(name, priority, burst, arrival);
    if (t == NULL) {
        fprintf(stderr, "error: cannot create task %s\n", name);
        exit(EXIT_FAILURE);
    }
    insert(&pending, t);
}

static void admit_arrivals(void)
{
    Task *t;
    while ((t = list_earliest(pending)) != NULL && t->arrival <= cpu_time()) {
        delete(&pending, t);
        append(&queue[t->priority], t);
    }
}

static int any_ready(void)
{
    for (int p = MIN_PRIORITY; p <= MAX_PRIORITY; p++)
        if (queue[p] != NULL)
            return 1;
    return 0;
}

/* head of the highest-priority non-empty queue */
static Task *pickNextTask(void)
{
    for (int p = MAX_PRIORITY; p >= MIN_PRIORITY; p--)
        if (queue[p] != NULL)
            return pop_front(&queue[p]);
    return NULL;
}

void schedule(void)
{
    admit_arrivals();
    while (any_ready() || pending != NULL) {
        Task *t = pickNextTask();
        if (t == NULL) {
            cpu_idle_until(list_earliest(pending)->arrival);
            admit_arrivals();
            continue;
        }
        int slice = t->remaining < time_quantum ? t->remaining : time_quantum;
        run(t, slice);
        admit_arrivals();
        if (t->remaining > 0)
            append(&queue[t->priority], t);
    }
}
