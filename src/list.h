/*
 * list.h - singly linked list of tasks
 *
 * insert / delete / traverse follow the textbook's supporting files.
 * append, pop_front and the "earliest" helpers were added so the
 * round-robin schedulers can use a list as a FIFO ready queue.
 */
#ifndef LIST_H
#define LIST_H

#include "task.h"

struct node {
    Task *task;
    struct node *next;
};

void  insert(struct node **head, Task *task);   /* at the front          */
void  append(struct node **head, Task *task);   /* at the back (FIFO)    */
void  delete(struct node **head, Task *task);   /* remove (no free)      */
Task *pop_front(struct node **head);            /* remove first, or NULL */
void  traverse(struct node *head);              /* print the list        */
int   list_length(struct node *head);

/* Task with the smallest (arrival, tid), i.e. FCFS order; NULL if empty. */
Task *list_earliest(struct node *head);

/* Remove and return list_earliest(), or NULL if empty. */
Task *pop_earliest(struct node **head);

/* 1 if a arrives before b (ties broken by tid = input order). */
int   comes_before(const Task *a, const Task *b);

#endif /* LIST_H */
