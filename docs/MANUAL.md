# Manual — CPU Scheduling Algorithms (Gantt Chart)

## 8.1 Хэрэглэгчийн заавар

**Програмын зорилго.** Task-уудын жагсаалтыг FCFS, SJF, Priority, RR, Priority-RR алгоритмаар хуваарилж, Gantt chart болон waiting, turnaround, response time-аар харьцуулна.

**Дэмжих орчин.** Linux, macOS, Windows (WSL эсвэл MSYS2). UI нь орчин үеийн аль ч browser-т (Chrome, Firefox, Edge, Safari) ажиллана.

**Нээх.** Төслийн хавтаст `make ui` ажиллуулна. Browser автоматаар `http://localhost:8000` хаягийг нээнэ. Нээгдэхгүй бол хаягийг гараар оруулна. Баруун дээд буланд **“C backend холбогдсон”** гэж харагдах ёстой.

**Оролт ба тохиргоо.**

| Талбар | Утга |
|---|---|
| Алгоритм | FCFS / SJF / Priority / RR / Priority-RR |
| Time quantum | 1–1000000. Зөвхөн RR, Priority-RR-д идэвхтэй |
| Task-ууд | `нэр, priority, burst[, arrival]` мөр бүрт нэг. Priority 1–10 (их тоо = өндөр), burst ≥ 1, arrival ≥ 0 |
| Бэлэн жишээ | Номын жишээ, 8 task, arrival + idle, convoy effect, ижил priority, ганц task, алдаатай оролт |
| Санамсаргүй | Task-ын тоо, хамгийн их burst, хамгийн их arrival (0 бол бүгд 0-д ирнэ) |

**Ажиллуулах, зогсоох, reset.**
- **▶ Ажиллуулах** — сонгосон алгоритмыг C програмаар ажиллуулж, Gantt chart-ыг t = 0-ээс тоглуулна
- **Бүх алгоритмыг харьцуулах** — ижил task-уудаар 5 алгоритмыг ажиллуулж, харьцуулалтын хэсгийг гаргана
- Тоглуулагч: ⏮ эхлэл · ◀ өмнөх үйл явдал · ▶/⏸ тоглуулах/зогсоох · ▶| дараагийн үйл явдал · ⏭ төгсгөл · slider · хурд
- Гарын товч: `Space` тоглуулах/зогсоох, `←` `→` үйл явдлаар шилжих, `Home` `End`
- **Reset** — үр дүнг арилгаж, FCFS, q = 10, сонгосон жишээ рүү буцаана

**Дүрслэлийн тэмдэг, өнгө, төлөв.**

| Тэмдэг | Утга |
|---|---|
| Өнгөт блок (нэртэй) | Task CPU дээр ажилласан хугацаа. Өнгө нь task-ын оролтын дарааллаар тогтмол |
| Ташуу зураастай өнгөт блок | 9 дэх болон түүнээс хойшхи task (өнгө давтагдах тул зураасаар ялгана) |
| Саарал ташуу зураас `idle` | CPU хоосон байсан (ирсэн task байхгүй) |
| Тасархай хүрээ | Task ирчихсэн боловч хүлээж байгаа (ready) |
| ▼ | Task ирсэн агшин (arrival) |
| ✓ 45 | Task 45-д дууссан |
| Улаан босоо шугам `t=…` | Одоогийн хугацаа |
| ★ / ногоон багана | Харьцуулалтад хамгийн бага (сайн) утга |

**Жишээ 1 — номын жишээ, RR.** “Номын жишээ” сонгоод, Алгоритм = RR, q = 10 → Ажиллуулах. Gantt: T1 T2 T3 T4 T5 T1 T2 T3 T4 T2 T3 (0…95). Дундаж waiting 57, response 20.

**Жишээ 2 — convoy effect.** “Convoy effect” жишээг сонгоод “Бүх алгоритмыг харьцуулах” дарна. FCFS-д урт task эхэлж ажиллахад богино task-ууд хүлээдэг (дундаж waiting 43.6). SJF-д богино task-ууд түрүүлж ажиллах тул энэ нь 6 болж буурна. Үүнийг bar chart дээр харж болно.

**Жишээ 3 — idle.** “Ирэх хугацаатай + CPU idle” сонгоод RR, q = 4 → 26–40 хооронд `idle` блок гарна.

**Түгээмэл алдаа ба шийдэл.**

| Мэдээлэл | Шийдэл |
|---|---|
| “Backend алга” | `make ui` ажиллуулаад `http://localhost:8000` хаягаар нээ (файлыг шууд давхар дарж нээхгүй) |
| “Build хийгдээгүй: …” | Терминалд `make` ажиллуул |
| `line 2: priority '11' must be an integer from 1 to 10` | Priority-г 1–10 болго |
| `CPU burst '0' must be a positive integer` | Burst ≥ 1 |
| `duplicate task name 'T1'` | Нэрийг давхардуулахгүй |
| `invalid task name 'T 1'` | Нэрэнд хоосон зай, тусгай тэмдэгт оруулахгүй (үсэг, тоо, `_ - .`) |
| `quantum too small` | q-г ихэсгэ (200 000-аас олон slice үүсэхээр байна) |
| `cannot listen on port 8000` | `python3 ui/server.py --port 8001` |

## 8.2 Operational заавар

**Repository clone.**
```sh
git clone <repo-url> cpu-scheduling
cd cpu-scheduling
```

**OS, compiler, runtime.** Туршсан орчин: Linux, GCC (C11) болон Clang, GNU Make, Python 3.13. Шаардлага: C11 compiler, make, Python ≥ 3.8.

**Dependency.** Гадны сан хэрэггүй. Ubuntu/WSL: `sudo apt install build-essential python3`. macOS: `xcode-select --install`. Windows: MSYS2 (`pacman -S gcc make python`) эсвэл WSL.

**Build ба Run.**
```sh
make                         # fcfs sjf priority rr priority_rr
make rr                      # зөвхөн нэгийг
./rr schedule.txt            # q = 10
./rr -q 4 schedule.txt
./priority_rr -j schedule.txt > result.json   # UI-д ачаалж болох JSON
make ui                      # UI сервер (Ctrl+C зогсооно)
make clean
```

**Үндсэн тестийн өгөгдөл** (`tests/data/`): `book.txt` (номын 5 task), `eight.txt` (8 task), `arrival.txt` (arrival + idle), `convoy.txt`, `same_priority.txt`, `single.txt` (ганц task, arrival 3), `whitespace.txt` (таслалгүй формат, тайлбар мөр).

**Нэмэлт boundary/error test** (`tests/errors/`): priority 0 ба 11, burst 0, сөрөг burst, хэт их burst, сөрөг arrival, дутуу/илүү талбар, давхардсан нэр, хоосон файл, нэрэнд зай, тоо биш утга, хэт олон RR slice. Сонголтын тест: `-q 0`, `-q abc`, `-q` утгагүй, мэдэгдэхгүй сонголт, файлгүй, хоёр файл.

**Тест ажиллуулах.**
```sh
make test                          # бүх тест
sh tests/run_tests.sh --update     # expected гаралтыг шинэчлэх (гараар шалгах!)
python3 tests/reference_check.py --cases 1000 --seed 7
```

**Хүлээгдсэн үр дүн.** `Passed: 73   Failed: 0`. Номын жишээний дундаж waiting: FCFS 44, SJF 30, Priority 33, RR 57, Priority-RR 35.

**Known issues.**
- Ажиллаж буй task-ыг slice дундуур нь preempt хийхгүй (номонд шаардаагүй). Preemptive SJF (SRTF) хэрэгжээгүй.
- Simulated хугацаа нь бүхэл тоо; context switch-ийн зардлыг 0 гэж үзнэ.
- `__sync_fetch_and_add` нь GCC/Clang-д л байна. MSVC дээр энгийн increment ашиглана (зөвхөн нэг thread).
- UI сервер зөвхөн `127.0.0.1` дээр сонсоно (локал хэрэглээнд).
- 1000-аас олон task, нэг утга 1 000 000-аас их байж болохгүй.
