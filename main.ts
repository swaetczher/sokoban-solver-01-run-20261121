// Sokoban solver — karya sendiri, ditulis dari nol untuk kompetisi
// make.fun "Build the best Sokoban solver, 21 November 2026".
//
// Ide utama: level-level kompetisi ini terurai menjadi kamar-kamar kecil.
// Satu lorong 1 petak melintasi papan; tiap kamar (slot 6x6, 3-4 box)
// hanya terhubung ke lorong lewat SATU pintu, dan box yang sudah masuk
// kamar tidak pernah keluar lagi. Jadi jumlah push optimal level (P*)
// adalah jumlah push optimal tiap kamar, dan tiap kamar bisa dipecahkan
// sendiri-sendiri dengan A* berbasis push — jauh lebih kecil daripada
// mencari di seluruh level sekaligus (sampai 16 box).
//
// Tiap kamar dipecahkan dengan:
//   - A* atas "push" (bukan langkah kaki): state = posisi box terurut +
//     posisi kanonik pemain (sel terkecil dari daerah yang bisa dijangkau
//     pemain tanpa mendorong). Langkah kaki dihitung ulang saat rekonstruksi.
//   - Heuristik admissible: penugasan box->goal berbiaya minimum memakai
//     jarak BFS terpendek (diabaikan box lain), dihitung dengan DP atas
//     subset; untuk >8 box dipakai jumlah jarak minimum per box.
//   - Pemangkasan deadlock: sudut (corner), blok 2x2 beku, dan box yang
//     menempel dinding pada baris/kolom yang tidak mengandung goal.
//   - Syarat keluar: solusi kamar harus berakhir dengan pemain masih bisa
//     berjalan ke pintu (supaya bisa lanjut ke kamar berikut). Kamar yang
//     gagal syarat ini dipecahkan tanpa syarat keluar dan dikerjakan TERAKHIR.
// Urutan kamar deterministik (pintu terkecil dulu). Semua anggaran dihitung
// dari jumlah ekspansi (bukan jam dinding) sehingga dua run menghasilkan
// byte yang identik. Kalau dekomposisi gagal, fallback ke A* push di
// seluruh level; kalau itu pun gagal, jawaban kosong (format tetap valid).
//
// I/O mengikuti starter kit: baca /input/<id>/level.txt (atau
// $MAKEFUN_INPUT_DIR), tulis /output/<id>/solution.txt (atau
// $MAKEFUN_OUTPUT_DIR) berisi langkah u/d/l/r + newline.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Anggaran kerja deterministik (jumlah ekspansi A*, bukan waktu).
const ROOM_BUDGET = 120000;
const FULL_BUDGET = 200000;
const WORK_CAP = 800000;

interface Dir { ch: string; dr: number; dc: number }
const DIRS: Dir[] = [
  { ch: 'u', dr: -1, dc: 0 },
  { ch: 'd', dr: 1, dc: 0 },
  { ch: 'l', dr: 0, dc: -1 },
  { ch: 'r', dr: 0, dc: 1 },
];
const INF = 1e9;

interface Level {
  w: number;
  h: number;
  floor: Uint8Array; // 1 = bisa dipijak
  goal: Uint8Array; // 1 = goal
  boxes: number[]; // terurut naik
  player: number; // -1 bila tidak ada
}

interface Push { from: number; to: number; dir: number }
interface Work { used: number; cap: number }

function parseLevel(text: string): Level {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const h = rows.length;
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  const floor = new Uint8Array(w * h);
  const goal = new Uint8Array(w * h);
  const boxes: number[] = [];
  let player = -1;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '#') continue;
      const i = r * w + c;
      floor[i] = 1;
      if (ch === '.' || ch === '*' || ch === '+') goal[i] = 1;
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  }
  boxes.sort((a, b) => a - b);
  return { w, h, floor, goal, boxes, player };
}

// ---- utilitas grid -------------------------------------------------------

function cellOf(w: number, r: number, c: number): number { return r * w + c; }

// Jalur jalan kaki terpendek (BFS) dari `from` ke `to`, menghindari dinding
// dan sel yang ditandai di `blocked`. Mengembalikan string langkah atau null.
function walkPath(w: number, h: number, floor: Uint8Array, blocked: Uint8Array, from: number, to: number): string | null {
  if (from === to) return '';
  const prev = new Int32Array(w * h).fill(-2);
  const prevDir = new Int8Array(w * h);
  const queue: number[] = [from];
  prev[from] = -1;
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const r = Math.floor(cur / w);
    const c = cur % w;
    for (let d = 0; d < 4; d++) {
      const nr = r + DIRS[d].dr;
      const nc = c + DIRS[d].dc;
      if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
      const ni = cellOf(w, nr, nc);
      if (!floor[ni] || blocked[ni] || prev[ni] !== -2) continue;
      prev[ni] = cur;
      prevDir[ni] = d;
      if (ni === to) {
        let s = '';
        let x = to;
        while (x !== from) {
          s = DIRS[prevDir[x]].ch + s;
          x = prev[x];
        }
        return s;
      }
      queue.push(ni);
    }
  }
  return null;
}

// Daerah yang bisa dijangkau pemain dari `start` tanpa mendorong box.
function regionOf(w: number, h: number, floor: Uint8Array, boxSet: Uint8Array, start: number): { set: Uint8Array; min: number } {
  const set = new Uint8Array(w * h);
  const queue: number[] = [start];
  set[start] = 1;
  let min = start;
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    if (cur < min) min = cur;
    const r = Math.floor(cur / w);
    const c = cur % w;
    for (let d = 0; d < 4; d++) {
      const nr = r + DIRS[d].dr;
      const nc = c + DIRS[d].dc;
      if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
      const ni = cellOf(w, nr, nc);
      if (!floor[ni] || boxSet[ni] || set[ni]) continue;
      set[ni] = 1;
      queue.push(ni);
    }
  }
  return { set, min };
}

function boxSetOf(w: number, h: number, boxes: number[]): Uint8Array {
  const s = new Uint8Array(w * h);
  for (const b of boxes) s[b] = 1;
  return s;
}

// ---- A* berbasis push ----------------------------------------------------

// Jarak BFS dari tiap goal ke semua sel (mengabaikan box lain).
function goalDistances(w: number, h: number, floor: Uint8Array, goals: number[]): number[][] {
  const out: number[][] = [];
  for (const g of goals) {
    const dist = new Int32Array(w * h).fill(-1);
    const queue: number[] = [g];
    dist[g] = 0;
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      const r = Math.floor(cur / w);
      const c = cur % w;
      for (let d = 0; d < 4; d++) {
        const nr = r + DIRS[d].dr;
        const nc = c + DIRS[d].dc;
        if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
        const ni = cellOf(w, nr, nc);
        if (!floor[ni] || dist[ni] !== -1) continue;
        dist[ni] = dist[cur] + 1;
        queue.push(ni);
      }
    }
    const row: number[] = [];
    for (let i = 0; i < w * h; i++) row.push(dist[i] < 0 ? INF : dist[i]);
    out.push(row);
  }
  return out;
}

// Biaya penugasan minimum box->goal (DP atas subset goal). INF bila ada box
// yang tidak bisa mencapai goal mana pun.
function assignmentCost(cost: number[][], n: number): number {
  const total = 1 << n;
  const dp = new Float64Array(total).fill(INF);
  dp[0] = 0;
  const pop = new Uint8Array(total);
  for (let m = 1; m < total; m++) pop[m] = pop[m >> 1] + (m & 1);
  for (let mask = 0; mask < total; mask++) {
    const k = pop[mask];
    if (k >= n || dp[mask] >= INF) continue;
    for (let j = 0; j < n; j++) {
      if (mask & (1 << j)) continue;
      const c = cost[k][j];
      if (c >= INF) continue;
      const nm = mask | (1 << j);
      const v = dp[mask] + c;
      if (v < dp[nm]) dp[nm] = v;
    }
  }
  return dp[total - 1];
}

function isWallAt(w: number, h: number, floor: Uint8Array, r: number, c: number): boolean {
  if (r < 0 || r >= h || c < 0 || c >= w) return true;
  return !floor[cellOf(w, r, c)];
}

// Deadlock sederhana tapi sound untuk box yang belum di goal:
// sudut, blok 2x2 beku, dan box menempel dinding pada baris/kolom tanpa goal.
function deadlocked(w: number, h: number, floor: Uint8Array, goal: Uint8Array, boxes: number[], boxSet: Uint8Array): boolean {
  for (const b of boxes) {
    if (goal[b]) continue;
    const r = Math.floor(b / w);
    const c = b % w;
    const up = isWallAt(w, h, floor, r - 1, c);
    const down = isWallAt(w, h, floor, r + 1, c);
    const left = isWallAt(w, h, floor, r, c - 1);
    const right = isWallAt(w, h, floor, r, c + 1);
    if ((up && left) || (up && right) || (down && left) || (down && right)) return true;
    // Blok 2x2: keempat sel terisi dinding/box dan ada box non-goal di dalamnya.
    const corners: Array<[number, number]> = [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]];
    for (const [tr, tc] of corners) {
      if (tr < 0 || tc < 0 || tr + 1 >= h || tc + 1 >= w) continue;
      const cells = [cellOf(w, tr, tc), cellOf(w, tr + 1, tc), cellOf(w, tr, tc + 1), cellOf(w, tr + 1, tc + 1)];
      let filled = true;
      let bad = false;
      for (const cell of cells) {
        if (floor[cell] && !boxSet[cell]) { filled = false; break; }
        if (boxSet[cell] && !goal[cell]) bad = true;
      }
      if (filled && bad) return true;
    }
    // Box menempel dinding: box terkungkung pada lajur (run) sel yang
    // semuanya menempel dinding di sisi tegak yang sama — dinding di atas
    // atau di bawah berarti box tidak bisa bergerak vertikal selama di
    // lajur itu, dinding di kiri atau kanan berarti tidak bisa bergerak
    // horizontal. Bila lajur itu tertutup dinding di kedua ujungnya dan
    // tidak mengandung goal, box tidak akan pernah mencapai goal.
    // (Lajur dihitung dari kesinambungan dindingnya, bukan dari panjang
    // baris/kolom lantai: box bisa kabur dari dinding dengan bergerak
    // menyusuri lajur sampai ujung dindingnya.)
    if (up || down) {
      let a = c;
      while (a - 1 >= 0 && floor[cellOf(w, r, a - 1)] && (isWallAt(w, h, floor, r - 1, a - 1) || isWallAt(w, h, floor, r + 1, a - 1))) a--;
      let b = c;
      while (b + 1 < w && floor[cellOf(w, r, b + 1)] && (isWallAt(w, h, floor, r - 1, b + 1) || isWallAt(w, h, floor, r + 1, b + 1))) b++;
      const closedLeft = a - 1 < 0 || !floor[cellOf(w, r, a - 1)];
      const closedRight = b + 1 >= w || !floor[cellOf(w, r, b + 1)];
      if (closedLeft && closedRight) {
        let hasGoal = false;
        for (let cc = a; cc <= b; cc++) if (goal[cellOf(w, r, cc)]) { hasGoal = true; break; }
        if (!hasGoal) return true;
      }
    }
    if (left || right) {
      let a = r;
      while (a - 1 >= 0 && floor[cellOf(w, a - 1, c)] && (isWallAt(w, h, floor, a - 1, c - 1) || isWallAt(w, h, floor, a - 1, c + 1))) a--;
      let b = r;
      while (b + 1 < h && floor[cellOf(w, b + 1, c)] && (isWallAt(w, h, floor, b + 1, c - 1) || isWallAt(w, h, floor, b + 1, c + 1))) b++;
      const closedUp = a - 1 < 0 || !floor[cellOf(w, a - 1, c)];
      const closedDown = b + 1 >= h || !floor[cellOf(w, b + 1, c)];
      if (closedUp && closedDown) {
        let hasGoal = false;
        for (let rr = a; rr <= b; rr++) if (goal[cellOf(w, rr, c)]) { hasGoal = true; break; }
        if (!hasGoal) return true;
      }
    }
  }
  return false;
}

// A* push-optimal. `floor` membatasi arena (kamar + pintu masuk, atau
// seluruh level untuk fallback). `exitCell >= 0` berarti state goal juga
// harus memungkinkan pemain berjalan ke sel itu. Mengembalikan daftar push
// (from -> to) atau null bila tidak ketemu dalam anggaran.
function pushSolve(
  w: number, h: number, floor: Uint8Array, goal: Uint8Array,
  boxes0: number[], player0: number, exitCell: number,
  budget: number, work: Work,
): Push[] | null {
  const n = boxes0.length;
  const goals: number[] = [];
  for (let i = 0; i < w * h; i++) if (goal[i] && floor[i]) goals.push(i);
  if (goals.length !== n) return null;
  const distToGoal = goalDistances(w, h, floor, goals);

  const heuristic = (boxes: number[]): number => {
    if (n <= 8) {
      const cost: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let j = 0; j < n; j++) row.push(distToGoal[j][boxes[i]]);
        cost.push(row);
      }
      return assignmentCost(cost, n);
    }
    let sum = 0;
    for (let i = 0; i < n; i++) {
      let best = INF;
      for (let j = 0; j < n; j++) best = Math.min(best, distToGoal[j][boxes[i]]);
      if (best >= INF) return INF;
      sum += best;
    }
    return sum;
  };

  const startBoxes = [...boxes0].sort((a, b) => a - b);
  const startSet = boxSetOf(w, h, startBoxes);
  if (deadlocked(w, h, floor, goal, startBoxes, startSet)) return null;
  const startRegion = regionOf(w, h, floor, startSet, player0);
  const startPlayer = startRegion.min;
  const h0 = heuristic(startBoxes);
  if (h0 >= INF) return null;

  // Node disimpan di array; heap diurutkan (f, h, seq) — total order yang
  // deterministik.
  const nodeBoxes: number[][] = [startBoxes];
  const nodePlayer: number[] = [startPlayer];
  const nodeG: number[] = [0];
  const nodeF: number[] = [h0];
  const nodeH: number[] = [h0];
  const nodeParent: number[] = [-1];
  const nodePush: Array<Push | null> = [null];
  const nodeSeq: number[] = [0];
  let seq = 1;
  const heap: number[] = [0];
  const less = (a: number, b: number): boolean => {
    if (nodeF[a] !== nodeF[b]) return nodeF[a] < nodeF[b];
    if (nodeH[a] !== nodeH[b]) return nodeH[a] < nodeH[b];
    return nodeSeq[a] < nodeSeq[b];
  };
  const heapPush = (id: number): void => {
    heap.push(id);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      const t = heap[i]; heap[i] = heap[p]; heap[p] = t;
      i = p;
    }
  };
  const heapPop = (): number => {
    const top = heap[0];
    const last = heap.pop() as number;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === i) break;
        const t = heap[i]; heap[i] = heap[m]; heap[m] = t;
        i = m;
      }
    }
    return top;
  };

  const keyOf = (boxes: number[], player: number): string => boxes.join(',') + '|' + player;
  const closed = new Map<string, number>();
  closed.set(keyOf(startBoxes, startPlayer), 0);

  const solvedHere = (boxes: number[]): boolean => {
    for (let i = 0; i < n; i++) if (!goal[boxes[i]]) return false;
    return true;
  };

  let expansions = 0;
  while (heap.length > 0) {
    const id = heapPop();
    const boxes = nodeBoxes[id];
    const player = nodePlayer[id];
    const g = nodeG[id];
    const best = closed.get(keyOf(boxes, player));
    if (best !== undefined && best < g) continue; // versi lama dari state ini
    if (solvedHere(boxes)) {
      if (exitCell < 0) {
        return reconstruct(id);
      }
      const reg = regionOf(w, h, floor, boxSetOf(w, h, boxes), player);
      if (reg.set[exitCell]) return reconstruct(id);
      // Sudah solved tapi pemain terkunci di dalam: bukan goal yang dicari,
      // lanjutkan pencarian (state ini tidak dikembangkan lagi di bawah
      // karena tidak ada push yang berguna dari posisi solved — tetap
      // kembangkan: box di goal boleh didorong keluar lalu kembali).
    }
    if (expansions >= budget || work.used >= work.cap) return null;
    expansions++;
    work.used++;
    const boxSet = boxSetOf(w, h, boxes);
    const region = regionOf(w, h, floor, boxSet, player);
    for (let bi = 0; bi < n; bi++) {
      const b = boxes[bi];
      const br = Math.floor(b / w);
      const bc = b % w;
      for (let d = 0; d < 4; d++) {
        const dr = DIRS[d].dr;
        const dc = DIRS[d].dc;
        const pr = br - dr;
        const pc = bc - dc;
        const tr = br + dr;
        const tc = bc + dc;
        if (pr < 0 || pr >= h || pc < 0 || pc >= w) continue;
        if (tr < 0 || tr >= h || tc < 0 || tc >= w) continue;
        const behind = cellOf(w, pr, pc);
        const target = cellOf(w, tr, tc);
        if (!floor[behind] || !floor[target] || boxSet[target] || !region.set[behind]) continue;
        const nb = [...boxes];
        nb[bi] = target;
        nb.sort((a, b2) => a - b2);
        const nSet = boxSetOf(w, h, nb);
        if (deadlocked(w, h, floor, goal, nb, nSet)) continue;
        const hh = heuristic(nb);
        if (hh >= INF) continue;
        const nRegion = regionOf(w, h, floor, nSet, b);
        const nPlayer = nRegion.min;
        const ng = g + 1;
        const key = keyOf(nb, nPlayer);
        const prev = closed.get(key);
        if (prev !== undefined && prev <= ng) continue;
        closed.set(key, ng);
        const nid = nodeBoxes.length;
        nodeBoxes.push(nb);
        nodePlayer.push(nPlayer);
        nodeG.push(ng);
        nodeH.push(hh);
        nodeF.push(ng + hh);
        nodeParent.push(id);
        nodePush.push({ from: b, to: target, dir: d });
        nodeSeq.push(seq++);
        heapPush(nid);
      }
    }
  }
  return null;

  function reconstruct(endId: number): Push[] {
    const out: Push[] = [];
    let cur = endId;
    while (cur > 0) {
      const p = nodePush[cur];
      if (p) out.push(p);
      cur = nodeParent[cur];
    }
    out.reverse();
    return out;
  }
}

// Ubah daftar push menjadi string langkah (jalan kaki + push), dari state
// awal yang diberikan. Mengembalikan null bila ada push yang tak terjangkau.
function pushesToMoves(
  level: Level, player0: number, boxes0: Set<number>, pushes: Push[],
): { moves: string; player: number; boxes: Set<number> } | null {
  const { w, h, floor } = level;
  let moves = '';
  let player = player0;
  const boxes = new Set<number>(boxes0);
  for (const p of pushes) {
    const blocked = boxSetOf(w, h, [...boxes]);
    const behind = p.from - (DIRS[p.dir].dr * w + DIRS[p.dir].dc);
    const walk = walkPath(w, h, floor, blocked, player, behind);
    if (walk === null) return null;
    moves += walk + DIRS[p.dir].ch;
    boxes.delete(p.from);
    boxes.add(p.to);
    player = p.from;
  }
  return { moves, player, boxes };
}

// Simulasi penuh: true bila semua langkah legal dan semua box di goal.
function verifySolved(level: Level, moves: string): boolean {
  const { w, h, floor, goal } = level;
  const boxes = new Set<number>(level.boxes);
  let player = level.player;
  for (const ch of moves) {
    const d = DIRS.find((x) => x.ch === ch);
    if (!d) return false;
    const r = Math.floor(player / w);
    const c = player % w;
    const nr = r + d.dr;
    const nc = c + d.dc;
    if (nr < 0 || nr >= h || nc < 0 || nc >= w) return false;
    const next = cellOf(w, nr, nc);
    if (!floor[next]) return false;
    if (boxes.has(next)) {
      const br = nr + d.dr;
      const bc = nc + d.dc;
      if (br < 0 || br >= h || bc < 0 || bc >= w) return false;
      const beyond = cellOf(w, br, bc);
      if (!floor[beyond] || boxes.has(beyond)) return false;
      boxes.delete(next);
      boxes.add(beyond);
    }
    player = next;
  }
  for (const b of boxes) if (!goal[b]) return false;
  return true;
}

// ---- dekomposisi kamar ----------------------------------------------------

interface Room {
  cells: number[];
  doors: number[];
  boxes: number[];
  goals: number[];
}

interface RoomPlan {
  entry: number;
  door: number;
  pushes: Push[];
}

function solveRoom(level: Level, room: Room, exitRequired: boolean, work: Work): Push[] | null {
  const { w, h, floor, goal } = level;
  const door = Math.min(...room.doors);
  // Pintu masuk: sel lorong yang bersebelahan dengan pintu (terkecil).
  const dr = Math.floor(door / w);
  const dc = door % w;
  let entry = -1;
  for (let d = 0; d < 4; d++) {
    const nr = dr + DIRS[d].dr;
    const nc = dc + DIRS[d].dc;
    if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
    const ni = cellOf(w, nr, nc);
    if (Math.floor(ni / w) === Math.floor(level.player / w) && floor[ni]) {
      if (entry < 0 || ni < entry) entry = ni;
    }
  }
  if (entry < 0) return null;
  const mask = new Uint8Array(w * h);
  for (const cell of room.cells) mask[cell] = 1;
  mask[entry] = 1;
  return pushSolve(w, h, mask, goal, [...room.boxes], entry, exitRequired ? door : -1, ROOM_BUDGET, work);
}

function solveByRooms(level: Level, rooms: Room[], work: Work): string | null {
  const { w, h, floor } = level;
  const ordered = [...rooms].sort((a, b) => Math.min(...a.doors) - Math.min(...b.doors));
  const plans: RoomPlan[] = [];
  const deferred: Room[] = [];
  for (const room of ordered) {
    const pushes = solveRoom(level, room, true, work);
    if (pushes) {
      plans.push({ entry: roomEntry(level, room), door: Math.min(...room.doors), pushes });
    } else {
      deferred.push(room);
    }
  }
  // Kamar yang pemainnya terkunci setelah solved dikerjakan paling akhir.
  for (const room of deferred) {
    const pushes = solveRoom(level, room, false, work);
    if (!pushes) return null;
    plans.push({ entry: roomEntry(level, room), door: Math.min(...room.doors), pushes });
  }
  let moves = '';
  let player = level.player;
  let boxes = new Set<number>(level.boxes);
  for (const plan of plans) {
    const blocked = boxSetOf(w, h, [...boxes]);
    const walk = walkPath(w, h, floor, blocked, player, plan.entry);
    if (walk === null) return null;
    moves += walk;
    const res = pushesToMoves(level, plan.entry, boxes, plan.pushes);
    if (!res) return null;
    moves += res.moves;
    player = res.player;
    boxes = res.boxes;
  }
  if (!verifySolved(level, moves)) return null;
  return moves;
}

function roomEntry(level: Level, room: Room): number {
  const { w, h, floor } = level;
  const door = Math.min(...room.doors);
  const dr = Math.floor(door / w);
  const dc = door % w;
  const hallRow = Math.floor(level.player / w);
  let entry = -1;
  for (let d = 0; d < 4; d++) {
    const nr = dr + DIRS[d].dr;
    const nc = dc + DIRS[d].dc;
    if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
    const ni = cellOf(w, nr, nc);
    if (Math.floor(ni / w) === hallRow && floor[ni]) {
      if (entry < 0 || ni < entry) entry = ni;
    }
  }
  return entry;
}

function solveLevel(level: Level, work: Work): string {
  const { w, h, floor, goal, boxes, player } = level;
  if (player < 0 || boxes.length === 0) return '';
  if (boxes.every((b) => goal[b])) return '';

  // Dekomposisi: komponen floor di luar baris lorong, masing-masing harus
  // memuat box dan goal yang sama banyaknya serta minimal satu pintu
  // (sel komponen yang bersebelahan dengan sel lorong).
  const hallRow = Math.floor(player / w);
  const compId = new Int32Array(w * h).fill(-1);
  const comps: Room[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!floor[i] || Math.floor(i / w) === hallRow || compId[i] >= 0) continue;
    const cid = comps.length;
    const cells: number[] = [];
    const queue: number[] = [i];
    compId[i] = cid;
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      cells.push(cur);
      const r = Math.floor(cur / w);
      const c = cur % w;
      for (let d = 0; d < 4; d++) {
        const nr = r + DIRS[d].dr;
        const nc = c + DIRS[d].dc;
        if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
        if (Math.floor(cellOf(w, nr, nc) / w) === hallRow) continue;
        const ni = cellOf(w, nr, nc);
        if (!floor[ni] || compId[ni] >= 0) continue;
        compId[ni] = cid;
        queue.push(ni);
      }
    }
    const doors: number[] = [];
    const cBoxes: number[] = [];
    const cGoals: number[] = [];
    const cellSet = new Set<number>(cells);
    for (const cell of cells) {
      if (goal[cell]) cGoals.push(cell);
      if (boxes.includes(cell)) cBoxes.push(cell);
      const r = Math.floor(cell / w);
      const c = cell % w;
      for (let d = 0; d < 4; d++) {
        const nr = r + DIRS[d].dr;
        const nc = c + DIRS[d].dc;
        if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
        const ni = cellOf(w, nr, nc);
        if (Math.floor(ni / w) === hallRow && floor[ni] && !cellSet.has(ni)) {
          doors.push(cell);
          break;
        }
      }
    }
    comps.push({ cells, doors, boxes: cBoxes, goals: cGoals });
  }

  let decomposed = true;
  let coveredBoxes = 0;
  const rooms: Room[] = [];
  for (const comp of comps) {
    if (comp.boxes.length === 0) {
      if (comp.goals.length > 0) decomposed = false;
      continue;
    }
    if (comp.boxes.length !== comp.goals.length || comp.doors.length === 0) {
      decomposed = false;
      break;
    }
    coveredBoxes += comp.boxes.length;
    rooms.push(comp);
  }
  if (decomposed && coveredBoxes === boxes.length && rooms.length > 0) {
    const byRooms = solveByRooms(level, rooms, work);
    if (byRooms !== null) return byRooms;
  }

  // Fallback: A* push di seluruh level.
  const pushes = pushSolve(w, h, floor, goal, [...boxes], player, -1, FULL_BUDGET, work);
  if (pushes) {
    const res = pushesToMoves(level, player, new Set<number>(boxes), pushes);
    if (res && verifySolved(level, res.moves)) return res.moves;
  }
  return '';
}

// ---- main ------------------------------------------------------------------

const work: Work = { used: 0, cap: WORK_CAP };
for (const id of readdirSync(INPUT_DIR).sort()) {
  let moves = '';
  try {
    const level = parseLevel(readFileSync(join(INPUT_DIR, id, 'level.txt'), 'utf8'));
    moves = solveLevel(level, work);
  } catch {
    moves = '';
  }
  mkdirSync(join(OUTPUT_DIR, id), { recursive: true });
  writeFileSync(join(OUTPUT_DIR, id, 'solution.txt'), `${moves}\n`);
}
