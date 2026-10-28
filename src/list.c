/*
 * list.c - singly linked list of tasks
 */
#include <stdio.h>
#include <stdlib.h>
#include "list.h"

static struct node *new_node(Task *task)
{
    struct node *n = malloc(sizeof *n);
    if (n == NULL) {
        fprintf(stderr, "error: out of memory\n");
        exit(EXIT_FAILURE);
    }
    n->task = task;
    n->next = NULL;
    return n;
}

void insert(struct node **head, Task *task)
{
    struct node *n = new_node(task);
    n->next = *head;
    *head = n;
}

void append(struct node **head, Task *task)
{
    struct node *n = new_node(task);
    struct node **p = head;
    while (*p != NULL)
        p = &(*p)->next;
    *p = n;
}

void delete(struct node **head, Task *task)
{
    struct node **p = head;
    while (*p != NULL) {
        if ((*p)->task == task) {
            struct node *victim = *p;
            *p = victim->next;
            free(victim);
            return;
        }
        p = &(*p)->next;
    }
}

Task *pop_front(struct node **head)
{
    if (*head == NULL)
        return NULL;
    struct node *first = *head;
    Task *t = first->task;
    *head = first->next;
    free(first);
    return t;
}

void traverse(struct node *head)
{
    for (struct node *n = head; n != NULL; n = n->next)
        printf("[%s] [%d] [%d]\n", n->task->name, n->task->priority,
               n->task->burst);
}

int list_length(struct node *head)
{
    int len = 0;
    for (; head != NULL; head = head->next)
        len++;
    return len;
}

int comes_before(const Task *a, const Task *b)
{
    if (a->arrival != b->arrival)
        return a->arrival < b->arrival;
    return a->tid < b->tid;
}

Task *list_earliest(struct node *head)
{
    Task *best = NULL;
    for (struct node *n = head; n != NULL; n = n->next)
        if (best == NULL || comes_before(n->task, best))
            best = n->task;
    return best;
}

Task *pop_earliest(struct node **head)
{
    Task *t = list_earliest(*head);
    if (t != NULL)
        delete(head, t);
    return t;
}
