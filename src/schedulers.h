/*
 * schedulers.h - interface implemented by every schedule_*.c file
 *
 * The Makefile links driver.c with exactly one schedule_*.c, which gives
 * one executable per algorithm (make fcfs, make sjf, ...), as in the book.
 */
#ifndef SCHEDULERS_H
#define SCHEDULERS_H

#define MIN_PRIORITY 1
#define MAX_PRIORITY 10

/* name of the algorithm compiled into this executable, e.g. "FCFS" */
extern const char *scheduler_name;
/* 1 if the algorithm uses the time quantum (RR, Priority-RR) */
extern const int scheduler_uses_quantum;

/* time quantum used by round-robin schedulers (set by driver.c, -q) */
extern int time_quantum;

/* add a task to the list */
void add(char *name, int priority, int burst, int arrival);

/* invoke the scheduler */
void schedule(void);

#endif /* SCHEDULERS_H */
