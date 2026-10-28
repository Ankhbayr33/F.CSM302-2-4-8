/*
 * schedule_fcfs.c - First-Come, First-Served scheduling (non-preemptive)
 *
 * Tasks are run in the order in which they request the CPU: by arrival
 * time, ties broken by input order (tid). Each task runs its whole burst.
 */
#include <stdio.h>
#include <stdlib.h>
#include "cpu.h"
#include "list.h"
#include "schedulers.h"

const char *scheduler_name = "FCFS";
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

/* the task that requested the CPU first */
static Task *pickNextTask(void)
{
    return list_earliest(head);
}

void schedule(void)
{
    while (head != NULL) {
        Task *t = pickNextTask();
        if (t->arrival > cpu_time())
            cpu_idle_until(t->arrival);    /* nobody has arrived yet */
        run(t, t->burst);
        delete(&head, t);
    }
}
