# CPU Scheduling Algorithms — Gantt Chart Simulator

**F.CSM302 Үйлдлийн систем · Бие даалт 1**
Сурах бичиг: Silberschatz, Galvin, Gagne, *Operating System Concepts*, 10th ed., Бүлэг 5, Programming Project “Scheduling Algorithms” (P-29 – P-31)

Хуваарилалтын код: `____` · Гишүүд: `____`

## Зорилго

Номын төслийн 5 алгоритмыг C хэлээр хэрэгжүүлж, үр дүнг interactive **Gantt chart**-аар дүрсэлнэ:

| Алгоритм | Executable | Тайлбар |
|---|---|---|
| FCFS | `./fcfs` | Ирсэн дарааллаар, бүтэн burst ажиллуулна |
| SJF | `./sjf` | Ирсэн task-уудаас хамгийн богино burst-тайг сонгоно (non-preemptive) |
| Priority | `./priority` | Хамгийн өндөр priority (1–10, их тоо = өндөр) |
| RR | `./rr` | Round-robin, time quantum (анхдагч 10) |
| Priority-RR | `./priority_rr` | Priority бүрт тусдаа queue; ижил priority-тэй task-ууд RR-ээр ажиллана |

Номын **Further Challenges**-ийг хоёуланг нь хийсэн: (1) task id-г `__sync_fetch_and_add`-аар atomic байдлаар олгоно, (2) алгоритм бүрийн дундаж turnaround, waiting, response time-ийг тооцно.

## Quick Start

```sh
git clone <repo-url> cpu-scheduling && cd cpu-scheduling
make                      # 5 executable build хийнэ
./rr schedule.txt         # номын жишээ, quantum 10
make test                 # бүх тест (73 шалгалт)
make ui                   # Gantt chart UI → http://localhost:8000
```

Шаардлага: GCC эсвэл Clang (C11), `make`, Python 3.8+ (зөвхөн UI ба тестэд, нэмэлт сан хэрэггүй). Linux, macOS, Windows дээр WSL эсвэл MSYS2 ашиглана.

## Ашиглах

```sh
./fcfs schedule.txt               # номынх шиг
./rr -q 4 tests/data/arrival.txt  # өөр quantum
./sjf -j schedule.txt             # JSON гаралт (UI ашигладаг)
./priority -h                     # тусламж
```

**Оролтын файл** (`schedule.txt`), мөр бүрт нэг task:

```
# name, priority, burst[, arrival]
T1, 4, 20
T2, 2, 25, 5      # 4 дэх талбар (arrival) заавал биш, анхдагч 0
```

Priority 1–10, burst ≥ 1, arrival ≥ 0. Буруу оролтод програм мөрийн дугаартай алдааны мэдээлэл хэвлээд 1 кодоор гарна.

**Гаралт:** номын `Running task = [T1] [4] [20] for 10 units.` мөрүүд, текст Gantt chart, task бүрийн хүснэгт ба дундаж үзүүлэлтүүд.

```
Gantt chart:
|  T1  |  T2  |  T3  |  T4  |  T5  |  T1  |  T2  |  T3  |  T4  |  T2  |  T3  |
0      10     20     30     40     50     60     70     80     85     90     95
```

## Gantt chart UI

`make ui` командыг ажиллуулахад `ui/server.py` нээгдэнэ. UI-д оруулсан task-уудыг сервер түр файлд бичээд **жинхэнэ C executable-ийг** (`./rr -j …`) ажиллуулж, гарсан JSON-ийг зурна. Алгоритмыг JS дээр давхар хэрэгжүүлээгүй.

- CPU мөрөнд номынх шиг Gantt chart зурагдана, доор нь task бүр өөрийн мөртэй (тасархай хүрээ нь хүлээж буй, дүүргэлттэй хэсэг нь ажиллаж буй хугацаа)
- Тоглуулах, зогсоох, алхамаар шилжих (←/→), хугацааны slider, хурд тохируулах
- `t` агшин бүрт ажиллаж буй, ready, ирээгүй, дууссан task-уудыг харуулна
- 5 алгоритмыг нэг дор харьцуулна: ижил хуваарьтай мини Gantt-ууд, WT/TAT/RT bar chart, хүснэгт
- Бэлэн жишээнүүд, санамсаргүй task үүсгэгч, `.txt` ачаалах/татах
- Backend асаагүй үед CLI-ийн `-j` гаралтыг (`./rr -j schedule.txt > result.json`) "JSON үр дүн ачаалах" товчоор нээж болно

![Gantt chart](docs/screenshots/gantt_rr.png)

## Бүтэц

```
src/
  driver.c               файл унших, оролт шалгах, -q/-j/-h сонголт, main()
  task.h / task.c        Task бүтэц, atomic tid, task-уудын хүснэгт
  list.h / list.c        linked list (insert/delete/traverse + append/pop)
  cpu.h / cpu.c          run(): simulated clock, Gantt сегмент бүртгэх
  schedulers.h           add() / schedule() interface
  schedule_fcfs.c        FCFS
  schedule_sjf.c         SJF
  schedule_priority.c    Priority
  schedule_rr.c          Round-robin
  schedule_priority_rr.c Priority + round-robin (priority бүрт queue)
  stats.h / stats.c      метрик, текст Gantt, JSON гаралт
ui/
  server.py              UI ↔ C executable гүүр (stdlib)
  index.html, style.css
  api.js  presets.js  gantt.js  compare.js  app.js
tests/
  data/      үндсэн тестийн өгөгдөл      errors/   алдаатай оролт
  expected/  хүлээгдсэн гаралт           run_tests.sh, reference_check.py
docs/        MANUAL.md, screenshots/
schedule.txt номын жишээ
```

Makefile нь `driver.c`, `list.c`, `cpu.c`, `task.c`, `stats.c`-г нэг `schedule_*.c`-тэй холбож алгоритм бүрт тусдаа executable гаргана. Энэ нь номын эх кодын бүтэцтэй адил (`make fcfs`, `./fcfs schedule.txt`).

## Шийдвэрүүд (номонд тодорхой заагаагүй)

- **Тэнцүү үед:** SJF-д burst, Priority-д priority тэнцүү бол FCFS дарааллаар (arrival, дараа нь файлд орсон дараалал) сонгоно.
- **RR:** slice бүр `min(q, үлдсэн burst)`. Slice-ийн үеэр ирсэн task, preempt хийгдсэн task-аас өмнө queue-д орно.
- **Priority-RR:** хамгийн өндөр priority-тэй хоосон биш queue-гаас авна. Номонд preemption шаардаагүй тул ажиллаж буй slice-ийг тасалдуулахгүй.
- **Arrival time:** номонд бүх task 0-д ирнэ гэсэн. Нэмэлт 4 дэх талбараар өөр нөхцөлд турших боломжтой; CPU хоосон бол `idle` сегмент үүснэ.
- **Context switch:** өөр task руу шилжсэн тоо (idle-ийг тоолохгүй).

## Тест

`make test` нь дараах 4 хэсгийг шалгана:

1. **Golden** — 5 алгоритмыг `tests/data/`-ийн 7 файл дээр (RR-д q=10 ба q=4) ажиллуулж `tests/expected/`-тэй харьцуулна (49 тест)
2. **Алдаа** — 13 буруу оролт (priority 11, burst 0, давхардсан нэр, хоосон файл …) зөв мессеж өгч, 1 кодоор гарах ёстой
3. **Сонголт** — `-q 0`, `-q abc`, файлгүй, мэдэгдэхгүй сонголт, JSON зөв эсэх
4. **Reference** — `tests/reference_check.py` нь бие даасан Python хэрэгжүүлэлт. 300 санамсаргүй task set × 5 алгоритм дээр timeline болон бүх метрикийг C-ийн үр дүнтэй тулгана

Номын 5 task-тай жишээний дундаж үр дүн:

| | FCFS | SJF | Priority | RR (q=10) | Priority-RR (q=10) |
|---|---|---|---|---|---|
| Дундаж turnaround | 63.0 | 49.0 | 52.0 | 76.0 | 54.0 |
| Дундаж waiting | 44.0 | 30.0 | 33.0 | 57.0 | 35.0 |
| Дундаж response | 44.0 | 30.0 | 33.0 | 20.0 | 30.0 |

## Ашигласан материал, AI

- Silberschatz, Galvin, Gagne, *Operating System Concepts*, 10th ed., Wiley 2018 — Бүлэг 5.3, Programming Projects P-29–P-31
- Кодын бүтэц нь номын эх кодын (driver/list/cpu/schedulers) зохион байгуулалтыг дагасан; кодыг шинээр бичсэн
.

