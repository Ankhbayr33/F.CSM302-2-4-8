# CPU Scheduling Algorithms - OSC 10th ed., Chapter 5 Programming Project
#
#   make              build all five schedulers
#   make fcfs         build only ./fcfs   (also: sjf, priority, rr, priority_rr)
#   ./fcfs schedule.txt
#   make test         run the tests in tests/
#   make ui           start the Gantt-chart web UI on http://localhost:8000
#   make clean        remove build output

CC      ?= gcc
CFLAGS  ?= -std=c11 -Wall -Wextra -pedantic -O2
SRC     := src
OBJ     := build

COMMON  := driver list cpu task stats
COMMON_OBJS := $(addprefix $(OBJ)/,$(addsuffix .o,$(COMMON)))
HEADERS := $(wildcard $(SRC)/*.h)

SCHEDULERS := fcfs sjf priority rr priority_rr

.PHONY: all test ui clean

all: $(SCHEDULERS)

# one executable per algorithm: common files + schedule_<name>.c
$(SCHEDULERS): %: $(COMMON_OBJS) $(OBJ)/schedule_%.o
	$(CC) $(CFLAGS) -o $@ $^

$(OBJ)/%.o: $(SRC)/%.c $(HEADERS) | $(OBJ)
	$(CC) $(CFLAGS) -c -o $@ $<

$(OBJ):
	mkdir -p $(OBJ)

test: all
	sh tests/run_tests.sh

ui: all
	python3 ui/server.py

clean:
	rm -rf $(OBJ) $(SCHEDULERS) $(addsuffix .exe,$(SCHEDULERS))
