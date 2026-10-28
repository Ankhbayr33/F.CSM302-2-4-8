/*
 * task.h - representation of a task (OSC 10th ed., Chapter 5 project)
 *
 * The textbook's Task has name, tid, priority and burst. We add an optional
 * arrival time (default 0, as in the book) and the bookkeeping fields used
 * to compute turnaround, waiting and response time.
 */
#ifndef TASK_H
#define TASK_H

#define MAX_NAME_LEN 31
#define MAX_TASKS    1000

typedef struct task {
    char name[MAX_NAME_LEN + 1];
    int  tid;         /* unique id, assigned atomically in input order    */
    int  priority;    /* MIN_PRIORITY..MAX_PRIORITY, higher = more urgent */
    int  burst;       /* total CPU burst                                   */
    int  arrival;     /* arrival time (0 if not given)                     */

    int  remaining;   /* CPU time still needed                             */
    int  start;       /* time of first dispatch, -1 if never run           */
    int  completion;  /* finish time, -1 if not finished                   */
} Task;

/* Create a task, assign a tid and register it in the global task table.
 * Returns NULL if the table is full or out of memory. */
Task *task_create(const char *name, int priority, int burst, int arrival);

/* Access to every task ever created, in creation (tid) order. */
int   task_count(void);
Task *task_get(int index);

/* Free all tasks (end of program). */
void  task_free_all(void);

#endif /* TASK_H */
