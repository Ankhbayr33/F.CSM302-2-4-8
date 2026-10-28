/*
 * stats.h - scheduling metrics and result output
 *
 * Further Challenge 2 (textbook P-31): average turnaround time, waiting
 * time and response time for each scheduling algorithm.
 *   turnaround = completion - arrival
 *   waiting    = turnaround - burst
 *   response   = first start - arrival
 */
#ifndef STATS_H
#define STATS_H

#include <stdio.h>

typedef struct {
    int    tasks;
    int    total_time;        /* time when the last task completed       */
    int    busy_time;         /* sum of bursts                            */
    int    context_switches;
    double avg_turnaround;
    double avg_waiting;
    double avg_response;
    double utilization;       /* busy / total, in percent                 */
    double throughput;        /* tasks per 100 time units                 */
} Summary;

void stats_compute(Summary *s);

void stats_print_gantt(FILE *out);
void stats_print_table(FILE *out, const Summary *s);

/* whole result as one JSON object (for the UI) */
void stats_print_json(FILE *out, const Summary *s, const char *algorithm,
                      int quantum, int uses_quantum,
                      char warnings[][160], int warning_count);

#endif /* STATS_H */
