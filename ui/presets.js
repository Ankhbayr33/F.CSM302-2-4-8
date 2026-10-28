/* presets.js - sample task sets (schedule-file text) for the UI */
"use strict";

window.PRESETS = [
  {
    id: "book",
    name: "Номын жишээ (5 task, P-29)",
    text: "T1, 4, 20\nT2, 2, 25\nT3, 3, 25\nT4, 3, 15\nT5, 10, 10\n",
  },
  {
    id: "eight",
    name: "8 task, бүгд t=0-д ирнэ",
    text: "T1, 4, 20\nT2, 3, 25\nT3, 3, 25\nT4, 5, 15\nT5, 5, 20\nT6, 1, 10\nT7, 3, 30\nT8, 10, 25\n",
  },
  {
    id: "arrival",
    name: "Ирэх хугацаатай + CPU idle",
    text: "# name, priority, burst, arrival\nP1, 3, 8, 0\nP2, 5, 4, 1\nP3, 1, 9, 2\nP4, 5, 5, 3\nP5, 9, 2, 40\n",
  },
  {
    id: "convoy",
    name: "Convoy effect (FCFS vs SJF)",
    text: "# one long task listed first, all arrive at 0\nLong, 5, 50\nS1, 5, 3\nS2, 5, 3\nS3, 5, 3\nS4, 5, 3\n",
  },
  {
    id: "samepri",
    name: "Ижил priority-тэй task-ууд (Priority-RR)",
    text: "A, 5, 25\nB, 5, 15\nC, 5, 20\nD, 8, 10\nE, 1, 5\n",
  },
  {
    id: "single",
    name: "Захын тохиолдол: ганц task",
    text: "Only, 1, 7\n",
  },
  {
    id: "invalid",
    name: "Алдаатай оролт (priority 11)",
    text: "T1, 4, 20\nT2, 11, 25\n",
  },
];
