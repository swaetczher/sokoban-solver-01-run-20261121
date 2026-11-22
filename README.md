# sokoban-solver-01-run-20261121 — Sokoban Solver

[![sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/swaetczher/sokoban-solver-01-run-20261121/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/swaetczher/sokoban-solver-01-run-20261121/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)

Entry for the [make.fun bounty **sokoban-solver-01-run-20261121**](https://make.fun/bounty/sokoban-solver-01-run-20261121)
— *"Build the best Sokoban solver, 21 November 2026"* ($100 prize pool, top 10 paid $10 each in USDC on Solana).

## What it does

`main.ts` (TypeScript, Node 22, stdlib only) solves Sokoban levels: it reads
each instance's `level.txt` (XSB: `#` wall, space floor, `.` goal, `$` box,
`*` box on goal, `@` player) from `/input/<id>/` and writes the player's
moves (u/d/l/r, one letter per step) to `/output/<id>/solution.txt`, pushing
every box onto a goal in as few pushes as possible. One run answers all
5 instances of a set within 60 seconds, deterministically — two runs write
byte-identical output.

## How it works

Push-based A* search over box configurations (player reachability via
flood fill), with deadlock detection (corner / frozen-box pruning) and a
push-count heuristic (sum of per-box distances to goals). The search budget
is by work, never by wall clock, so results are reproducible.

## Scoring

Each instance scores 0–1,000 points (1,000 at the push-optimal count P*,
`500 × P* / pushes` above it, 0 if unsolved); total score is
1,000 × the mean over the set's 5 instances. A reward needs a score strictly
above make.fun's own house baseline, plain-astar 1.0.0.

## Local run

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
