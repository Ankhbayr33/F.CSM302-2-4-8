/*
 * stats.c - scheduling metrics and result output
 */
#include <string.h>
#include "cpu.h"
#include "stats.h"
#include "task.h"

#define GANTT_PER_ROW 12

static int turnaround(const Task *t) { return t->completion - t->arrival; }
static int waiting(const Task *t)    { return turnaround(t) - t->burst; }
static int response(const Task *t)   { return t->start - t->arrival; }

void stats_compute(Summary *s)
{
    int n = task_count();
    long tat = 0, wt = 0, rt = 0;

    memset(s, 0, sizeof *s);
    s->tasks = n;
    for (int i = 0; i < n; i++) {
        const Task *t = task_get(i);
        tat += turnaround(t);
        wt += waiting(t);
        rt += response(t);
        s->busy_time += t->burst;
        if (t->completion > s->total_time)
            s->total_time = t->completion;
    }
    if (n > 0) {
        s->avg_turnaround = (double)tat / n;
        s->avg_waiting = (double)wt / n;
        s->avg_response = (double)rt / n;
    }
    if (s->total_time > 0) {
        s->utilization = 100.0 * s->busy_time / s->total_time;
        s->throughput = 100.0 * n / s->total_time;
    }
    s->context_switches = cpu_context_switches();
}

/* ---------------------------------------------------------------- */
/* text output                                                       */
/* ---------------------------------------------------------------- */

static int cell_width(const Segment *g)
{
    int w = g->task ? (int)strlen(g->task->name) + 2 : 6;  /* " idle " */
    return w < 6 ? 6 : w;
}

static void print_centered(FILE *out, const char *s, int width)
{
    int len = (int)strlen(s);
    int left = (width - len) / 2;
    fprintf(out, "%*s%s%*s", left, "", s, width - len - left, "");
}

void stats_print_gantt(FILE *out)
{
    int count = cpu_segment_count();

    fputs("\nGantt chart:\n", out);
    for (int row = 0; row < count; row += GANTT_PER_ROW) {
        int last = row + GANTT_PER_ROW < count ? row + GANTT_PER_ROW : count;

        fputc('|', out);
        for (int k = row; k < last; k++) {
            const Segment *g = cpu_segment(k);
            print_centered(out, g->task ? g->task->name : "idle",
                           cell_width(g));
            fputc('|', out);
        }
        fputc('\n', out);

        for (int k = row; k < last; k++) {
            const Segment *g = cpu_segment(k);
            fprintf(out, "%-*d", cell_width(g) + 1, g->start);
        }
        fprintf(out, "%d\n", cpu_segment(last - 1)->end);
    }
}

void stats_print_table(FILE *out, const Summary *s)
{
    fputs("\n Task      Pri  Burst  Arrival  Start  Finish  "
          "Turnaround  Waiting  Response\n", out);
    for (int i = 0; i < task_count(); i++) {
        const Task *t = task_get(i);
        fprintf(out, " %-8s %4d %6d %8d %6d %7d %11d %8d %9d\n",
                t->name, t->priority, t->burst, t->arrival, t->start,
                t->completion, turnaround(t), waiting(t), response(t));
    }
    fprintf(out,
            "\n Average turnaround time: %.2f\n"
            " Average waiting time:    %.2f\n"
            " Average response time:   %.2f\n"
            " Total time: %d, CPU busy: %d, utilization: %.1f%%\n"
            " Throughput: %.2f tasks per 100 time units, "
            "context switches: %d\n",
            s->avg_turnaround, s->avg_waiting, s->avg_response,
            s->total_time, s->busy_time, s->utilization,
            s->throughput, s->context_switches);
}

/* ---------------------------------------------------------------- */
/* JSON output                                                       */
/* ---------------------------------------------------------------- */

static void json_string(FILE *out, const char *str)
{
    fputc('"', out);
    for (; *str; str++) {
        unsigned char c = (unsigned char)*str;
        if (c == '"' || c == '\\')
            fprintf(out, "\\%c", c);
        else if (c < 0x20)
            fprintf(out, "\\u%04x", c);
        else
            fputc(c, out);
    }
    fputc('"', out);
}

void stats_print_json(FILE *out, const Summary *s, const char *algorithm,
                      int quantum, int uses_quantum,
                      char warnings[][160], int warning_count)
{
    fputs("{\"algorithm\":", out);
    json_string(out, algorithm);
    fprintf(out, ",\"uses_quantum\":%s,\"quantum\":%d,\"tasks\":[",
            uses_quantum ? "true" : "false", quantum);
    for (int i = 0; i < task_count(); i++) {
        const Task *t = task_get(i);
        fprintf(out, "%s{\"name\":", i ? "," : "");
        json_string(out, t->name);
        fprintf(out, ",\"tid\":%d,\"priority\":%d,\"burst\":%d,"
                "\"arrival\":%d,\"start\":%d,\"completion\":%d,"
                "\"turnaround\":%d,\"waiting\":%d,\"response\":%d}",
                t->tid, t->priority, t->burst, t->arrival, t->start,
                t->completion, turnaround(t), waiting(t), response(t));
    }
    fputs("],\"timeline\":[", out);
    for (int k = 0; k < cpu_segment_count(); k++) {
        const Segment *g = cpu_segment(k);
        fprintf(out, "%s{\"tid\":%d,\"start\":%d,\"end\":%d}", k ? "," : "",
                g->task ? g->task->tid : -1, g->start, g->end);
    }
    fprintf(out, "],\"summary\":{\"tasks\":%d,\"total_time\":%d,"
            "\"busy_time\":%d,\"context_switches\":%d,"
            "\"avg_turnaround\":%.4f,\"avg_waiting\":%.4f,"
            "\"avg_response\":%.4f,\"utilization\":%.4f,"
            "\"throughput\":%.4f},\"warnings\":[",
            s->tasks, s->total_time, s->busy_time, s->context_switches,
            s->avg_turnaround, s->avg_waiting, s->avg_response,
            s->utilization, s->throughput);
    for (int k = 0; k < warning_count; k++) {
        if (k)
            fputc(',', out);
        json_string(out, warnings[k]);
    }
    fputs("]}\n", out);
}
