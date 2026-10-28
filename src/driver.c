/*
 * driver.c - reads the schedule of tasks and invokes the scheduler
 *
 * Schedule file format (textbook):  [name], [priority], [CPU burst]
 * Extension: an optional 4th field gives the arrival time (default 0).
 *     T1, 4, 20
 *     T2, 2, 25, 5
 * Blank lines and lines starting with '#' are ignored.
 *
 * Usage:  ./fcfs [-q quantum] [-j] schedule.txt
 *     -q N   time quantum for RR / Priority-RR (default 10)
 *     -j     print the result as JSON (used by the web UI)
 */
#include <ctype.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cpu.h"
#include "schedulers.h"
#include "stats.h"
#include "task.h"

#define LINE_SIZE    512
#define MAX_FIELDS   6
#define VALUE_LIMIT  1000000
#define MAX_SLICES   200000
#define MAX_WARNINGS 8

int time_quantum = QUANTUM;

typedef struct {
    char name[MAX_NAME_LEN + 1];
    int priority, burst, arrival;
} TaskSpec;

static TaskSpec specs[MAX_TASKS];
static int spec_count = 0;
static int json_mode = 0;
static char warnings[MAX_WARNINGS][160];
static int warning_count = 0;

static void fatal(const char *fmt, const char *a, int line, const char *b)
{
    char msg[256];
    char body[200];
    snprintf(body, sizeof body, fmt, a ? a : "", b ? b : "");
    if (line > 0)
        snprintf(msg, sizeof msg, "line %d: %s", line, body);
    else
        snprintf(msg, sizeof msg, "%s", body);

    if (json_mode) {
        /* keep stdout valid JSON so the UI can show the message */
        printf("{\"error\":\"");
        for (const char *p = msg; *p; p++) {
            if (*p == '"' || *p == '\\')
                putchar('\\');
            putchar(*p);
        }
        printf("\"}\n");
    }
    fprintf(stderr, "error: %s\n", msg);
    exit(EXIT_FAILURE);
}

static void warn(const char *msg)
{
    if (warning_count < MAX_WARNINGS)
        snprintf(warnings[warning_count++], sizeof warnings[0], "%s", msg);
    if (!json_mode)
        fprintf(stderr, "warning: %s\n", msg);
}

static void usage(const char *prog)
{
    fprintf(stderr,
            "Usage: %s [-q quantum] [-j] schedule_file\n"
            "  schedule_file  lines of: name, priority(%d-%d), burst[, arrival]\n"
            "  -q N           time quantum for RR algorithms (default %d)\n"
            "  -j             JSON output (for the web UI)\n"
            "  -h             show this help\n",
            prog, MIN_PRIORITY, MAX_PRIORITY, QUANTUM);
}

/* whole string must be an integer in [lo, hi]; returns 0 or -1 */
static int parse_int_range(const char *s, int lo, int hi, int *out)
{
    char *end;
    errno = 0;
    long v = strtol(s, &end, 10);
    if (*s == '\0' || *end != '\0' || errno == ERANGE || v < lo || v > hi)
        return -1;
    *out = (int)v;
    return 0;
}

static int is_space(char c)
{
    return c == ' ' || c == '\t' || c == '\r' || c == '\n';
}

static char *trim(char *s)
{
    while (is_space(*s))
        s++;
    char *end = s + strlen(s);
    while (end > s && is_space(end[-1]))
        *--end = '\0';
    return s;
}

/*
 * Split a line into fields. If the line contains commas (textbook format)
 * it is split on commas only, so "T 1, 4, 5" gives the invalid name "T 1"
 * instead of being silently misread. Otherwise it is split on white space.
 * Returns the number of fields (max + 1 if there are too many).
 */
static int split_fields(char *line, char *field[], int max)
{
    int count = 0;

    if (strchr(line, ',') != NULL) {
        char *p = line;
        for (;;) {
            char *comma = strchr(p, ',');
            if (comma)
                *comma = '\0';
            if (count == max)
                return max + 1;
            field[count++] = trim(p);
            if (!comma)
                break;
            p = comma + 1;
        }
        return count;
    }

    char *p = line;
    while (*p) {
        while (*p && is_space(*p))
            p++;
        if (!*p)
            break;
        if (count == max)
            return max + 1;
        field[count++] = p;
        while (*p && !is_space(*p))
            p++;
        if (*p)
            *p++ = '\0';
    }
    return count;
}

static int valid_name(const char *s)
{
    if (*s == '\0' || strlen(s) > MAX_NAME_LEN)
        return 0;
    for (; *s; s++)
        if (!isalnum((unsigned char)*s) && *s != '_' && *s != '-'
            && *s != '.')
            return 0;
    return 1;
}

static void read_schedule(const char *path)
{
    char line[LINE_SIZE], numbuf[16];
    char *field[MAX_FIELDS];
    int lineno = 0;
    FILE *in = fopen(path, "r");

    if (in == NULL)
        fatal("cannot open schedule file '%s': %s", path, 0,
              strerror(errno));

    while (fgets(line, sizeof line, in) != NULL) {
        lineno++;
        if (strchr(line, '\n') == NULL && !feof(in))
            fatal("line too long%s%s", NULL, lineno, NULL);

        char *p = line;
        while (*p == ' ' || *p == '\t')
            p++;
        if (*p == '#' || *p == '\n' || *p == '\r' || *p == '\0')
            continue;

        int n = split_fields(p, field, MAX_FIELDS);
        if (n != 3 && n != 4)
            fatal("expected 'name, priority, burst[, arrival]'%s%s",
                  NULL, lineno, NULL);
        if (spec_count >= MAX_TASKS) {
            snprintf(numbuf, sizeof numbuf, "%d", MAX_TASKS);
            fatal("too many tasks (max %s)%s", numbuf, lineno, NULL);
        }

        TaskSpec *t = &specs[spec_count];
        if (!valid_name(field[0]))
            fatal("invalid task name '%s' (use letters, digits, _ - ., "
                  "at most 31 characters)%s", field[0], lineno, NULL);
        snprintf(t->name, sizeof t->name, "%s", field[0]);

        if (parse_int_range(field[1], MIN_PRIORITY, MAX_PRIORITY,
                            &t->priority) != 0)
            fatal("priority '%s' must be an integer from 1 to 10%s",
                  field[1], lineno, NULL);
        if (parse_int_range(field[2], 1, VALUE_LIMIT, &t->burst) != 0)
            fatal("CPU burst '%s' must be a positive integer "
                  "(at most 1000000)%s", field[2], lineno, NULL);
        t->arrival = 0;
        if (n == 4 && parse_int_range(field[3], 0, VALUE_LIMIT,
                                      &t->arrival) != 0)
            fatal("arrival time '%s' must be a non-negative integer "
                  "(at most 1000000)%s", field[3], lineno, NULL);

        for (int k = 0; k < spec_count; k++)
            if (strcmp(specs[k].name, t->name) == 0)
                fatal("duplicate task name '%s'%s", t->name, lineno, NULL);
        spec_count++;
    }
    fclose(in);

    if (spec_count == 0)
        fatal("schedule file '%s' contains no tasks%s", path, 0, NULL);
}

static void parse_args(int argc, char *argv[], const char **path,
                       int *quantum_given)
{
    *path = NULL;
    *quantum_given = 0;

    /* look for -j first so that every later error is reported as JSON */
    for (int k = 1; k < argc; k++)
        if (strcmp(argv[k], "-j") == 0)
            json_mode = 1;

    for (int k = 1; k < argc; k++) {
        const char *a = argv[k];
        if (strcmp(a, "-h") == 0 || strcmp(a, "--help") == 0) {
            usage(argv[0]);
            exit(EXIT_SUCCESS);
        } else if (strcmp(a, "-j") == 0) {
            continue;
        } else if (strcmp(a, "-q") == 0) {
            if (k + 1 >= argc)
                fatal("option -q needs a value%s%s", NULL, 0, NULL);
            if (parse_int_range(argv[++k], 1, VALUE_LIMIT,
                                &time_quantum) != 0)
                fatal("time quantum '%s' must be a positive integer%s",
                      argv[k], 0, NULL);
            *quantum_given = 1;
        } else if (a[0] == '-') {
            fatal("unknown option '%s' (see -h)%s", a, 0, NULL);
        } else if (*path == NULL) {
            *path = a;
        } else {
            fatal("only one schedule file may be given ('%s')%s", a, 0,
                  NULL);
        }
    }
    if (*path == NULL) {
        usage(argv[0]);
        fatal("no schedule file given%s%s", NULL, 0, NULL);
    }
}

int main(int argc, char *argv[])
{
    const char *path;
    int quantum_given;
    char msg[160];
    long total_burst = 0;

    parse_args(argc, argv, &path, &quantum_given);
    read_schedule(path);

    for (int i = 0; i < spec_count; i++)
        total_burst += specs[i].burst;
    if (scheduler_uses_quantum && total_burst / time_quantum > MAX_SLICES) {
        snprintf(msg, sizeof msg, "%ld", total_burst / time_quantum);
        fatal("quantum too small: about %s time slices; "
              "use a larger -q%s", msg, 0, NULL);
    }
    if (quantum_given && !scheduler_uses_quantum) {
        snprintf(msg, sizeof msg,
                 "%s does not use a time quantum; -q %d is ignored",
                 scheduler_name, time_quantum);
        warn(msg);
    }

    for (int i = 0; i < spec_count; i++)
        add(specs[i].name, specs[i].priority, specs[i].burst,
            specs[i].arrival);

    cpu_set_quiet(json_mode);
    if (!json_mode) {
        printf("Algorithm: %s", scheduler_name);
        if (scheduler_uses_quantum)
            printf(", time quantum: %d", time_quantum);
        printf(", tasks: %d\n\n", spec_count);
    }

    schedule();

    Summary s;
    stats_compute(&s);
    if (json_mode) {
        stats_print_json(stdout, &s, scheduler_name, time_quantum,
                         scheduler_uses_quantum, warnings, warning_count);
    } else {
        stats_print_gantt(stdout);
        stats_print_table(stdout, &s);
    }

    cpu_free();
    task_free_all();
    return EXIT_SUCCESS;
}
