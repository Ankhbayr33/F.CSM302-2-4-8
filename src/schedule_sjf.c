/*
 * schedule_sjf.c - Shortest-Job-First scheduling (non-preemptive)
 *
 * Among the tasks that have arrived, run the one with the shortest CPU
 * burst. Ties are broken FCFS (arrival time, then input order).
 */
#include <stdio.h>
#include <stdlib.h>
#include "cpu.h"
#include "list.h"
#include "schedulers.h"

const char *scheduler_name = "SJF";
const int scheduler_uses_quantum = 0;

static struct node *head = NULL;

void add(char *name, int priority, int burst, int arrival)
{
    Task *t = task_create(name, priority, burst, arrival);
    if (t == NULL) {
        fprintf(stderr, "error: cannot create task %s\n", name);
        exit(EXIT_FAILURE);
    }
    insert(&head, t);
}

/* shortest burst among arrived tasks, NULL if none has arrived */
static Task *pickNextTask(void)
{
    Task *best = NULL;
    for (struct node *n = head; n != NULL; n = n->next) {
        Task *t = n->task;
        if (t->arrival > cpu_time())
            continue;
        if (best == NULL || t->burst < best->burst
            || (t->burst == best->burst && comes_before(t, best)))
            best = t;
    }
    return best;
}

void schedule(void)
{
    while (head != NULL) {
        Task *t = pickNextTask();
        if (t == NULL) {
            cpu_idle_until(list_earliest(head)->arrival);
            continue;
        }
        run(t, t->burst);
        delete(&head, t);
    }
}
