/*
 * task.c - creation of tasks and the global task table
 *
 * Further Challenge 1 (textbook P-31): the tid counter could be raced on
 * by schedulers running on several CPUs, so it is incremented atomically
 * with __sync_fetch_and_add (GCC / Clang).
 */
#include <stdlib.h>
#include <string.h>
#include "task.h"

static int next_tid = 0;
static Task *table[MAX_TASKS];
static int count = 0;

static int new_tid(void)
{
#if defined(__GNUC__) || defined(__clang__)
    return __sync_fetch_and_add(&next_tid, 1);
#else
    return next_tid++;          /* non-GNU compiler: single-threaded only */
#endif
}

Task *task_create(const char *name, int priority, int burst, int arrival)
{
    if (count >= MAX_TASKS)
        return NULL;

    Task *t = malloc(sizeof *t);
    if (t == NULL)
        return NULL;

    strncpy(t->name, name, MAX_NAME_LEN);
    t->name[MAX_NAME_LEN] = '\0';
    t->tid = new_tid();
    t->priority = priority;
    t->burst = burst;
    t->arrival = arrival;
    t->remaining = burst;
    t->start = -1;
    t->completion = -1;

    table[count++] = t;
    return t;
}

int task_count(void) { return count; }

Task *task_get(int index)
{
    return (index >= 0 && index < count) ? table[index] : NULL;
}

void task_free_all(void)
{
    for (int i = 0; i < count; i++)
        free(table[i]);
    count = 0;
}
