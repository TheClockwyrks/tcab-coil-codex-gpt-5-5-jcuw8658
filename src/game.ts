import type {
  Game,
  InitApi,
  PointerSample,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import {
  ACTIONS,
  BEST_LABEL,
  BINDINGS,
  BITE_SECONDS,
  BOARD_X,
  BOARD_Y,
  CELL,
  CLEARED_TEXT,
  COIL_DEBUG_VERSION,
  COMBO_MAX,
  COMBO_WINDOW,
  CUES,
  CUE_PATHS,
  DIRECTIONS,
  GAMEOVER_TEXT,
  GRID_COLS,
  GRID_ROWS,
  HEAD_FRAMES,
  INTERIOR_MAX_COL,
  INTERIOR_MAX_ROW,
  INTERIOR_MIN_COL,
  INTERIOR_MIN_ROW,
  MODE,
  MODE_LABEL,
  OBSTACLE_CELLS,
  OVER_ITEMS,
  PAUSE_ITEMS,
  PELLET_POINTS,
  SCORE_LABEL,
  type Cell,
  type Direction,
  type Screen,
  SCREENS,
  SPRITE_PATHS,
  STAGE_CX,
  STAGE_H,
  STAGE_W,
  START_CELLS,
  START_DIR,
  TAGLINE_TEXT,
  TICK_SECONDS,
  TITLE_ITEMS,
  TITLE_TEXT,
  TURN_QUEUE_MAX,
} from "./constants";

export const BACKGROUND = "#06111f";

type MenuRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

type Assets = {
  readonly head: readonly ImageBitmap[];
  readonly body: ImageBitmap;
  readonly corner: ImageBitmap;
  readonly tail: ImageBitmap;
};

export interface CoilState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly score: number;
  readonly best: number;
  readonly combo: number;
  readonly comboWindow: number;
  readonly muted: boolean;
  readonly ticks: number;
  readonly simTime: number;
  readonly accumulator: number;
  readonly dir: Direction;
  readonly turns: readonly Direction[];
  readonly snake: readonly Cell[];
  readonly pellet: Cell | null;
  readonly obstacles: readonly Cell[];
  readonly steering: boolean;
  readonly travel: boolean;
  readonly pelletRespawn: boolean;
  readonly nextPellet: Cell | null;
  readonly biteTime: number;
  readonly pointerStarts: Readonly<Record<number, number | null>>;
  readonly assets: Assets;
}

export interface CoilSnapshot {
  readonly version: 1;
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly mode: "classic";
  readonly score: number;
  readonly best: number;
  readonly combo: number;
  readonly comboWindow: number;
  readonly muted: boolean;
  readonly ticks: number;
  readonly simTime: number;
  readonly dir: Direction;
  readonly turns: readonly Direction[];
  readonly snake: readonly Cell[];
  readonly pellet: Cell | null;
  readonly obstacles: readonly Cell[];
  readonly steering: boolean;
  readonly travel: boolean;
  readonly pelletRespawn: boolean;
  readonly nextPellet: Cell | null;
}

export interface CoilDebugApi {
  readonly version: 1;
  reset(state: DeepReadonly<CoilState>): CoilState;
  reconcile(state: DeepReadonly<CoilState>): CoilState;
  snapshot(state: DeepReadonly<CoilState>): CoilSnapshot;
  menuItemRect(state: DeepReadonly<CoilState>, index: number): MenuRect | null;
  setScreen(state: DeepReadonly<CoilState>, screen: Screen): CoilState;
  setMenuIndex(state: DeepReadonly<CoilState>, index: number): CoilState;
  setScore(state: DeepReadonly<CoilState>, points: number): CoilState;
  setBest(state: DeepReadonly<CoilState>, points: number): CoilState;
  setCombo(state: DeepReadonly<CoilState>, multiplier: number): CoilState;
  setComboWindow(state: DeepReadonly<CoilState>, seconds: number): CoilState;
  setSnake(state: DeepReadonly<CoilState>, cells: readonly Cell[]): CoilState;
  setDirection(state: DeepReadonly<CoilState>, dir: Direction): CoilState;
  clearTurns(state: DeepReadonly<CoilState>): CoilState;
  setSnakeSteering(state: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setSnakeTravel(state: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setPellet(
    state: DeepReadonly<CoilState>,
    col: number,
    row: number,
  ): CoilState;
  clearPellet(state: DeepReadonly<CoilState>): CoilState;
  setPelletRespawn(state: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setNextPellet(
    state: DeepReadonly<CoilState>,
    col: number,
    row: number,
  ): CoilState;
  drawPelletCell(state: DeepReadonly<CoilState>): Cell | null;
}

const HOWTO_ITEMS = ["BACK"] as const;
const MENU_W = 360;
const MENU_H = 58;
const MENU_GAP = 18;
const PANEL = "rgba(4, 12, 25, 0.82)";

function cloneCell(cell: DeepReadonly<Cell>): Cell {
  return { col: cell.col, row: cell.row };
}

function cloneCells(cells: readonly DeepReadonly<Cell>[]): Cell[] {
  return cells.map(cloneCell);
}

function sameCell(
  a: DeepReadonly<Cell> | null,
  b: DeepReadonly<Cell> | null,
): boolean {
  return a !== null && b !== null && a.col === b.col && a.row === b.row;
}

function isDirection(value: string): value is Direction {
  return (DIRECTIONS as readonly string[]).includes(value);
}

function assertWhole(value: number, name: string): void {
  if (!Number.isInteger(value))
    throw new RangeError(`${name} must be a whole number`);
}

function assertCellInGrid(col: number, row: number): void {
  assertWhole(col, "col");
  assertWhole(row, "row");
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
    throw new RangeError(`cell (${col}, ${row}) is outside the grid`);
  }
}

function isInterior(cell: DeepReadonly<Cell>): boolean {
  return (
    cell.col >= INTERIOR_MIN_COL &&
    cell.col <= INTERIOR_MAX_COL &&
    cell.row >= INTERIOR_MIN_ROW &&
    cell.row <= INTERIOR_MAX_ROW
  );
}

function isWall(cell: DeepReadonly<Cell>): boolean {
  return (
    cell.col === 0 ||
    cell.row === 0 ||
    cell.col === GRID_COLS - 1 ||
    cell.row === GRID_ROWS - 1
  );
}

function hasCell(
  cells: readonly DeepReadonly<Cell>[],
  cell: DeepReadonly<Cell>,
): boolean {
  return cells.some((candidate) => sameCell(candidate, cell));
}

function menuItems(screen: Screen): readonly string[] {
  if (screen === "title") return TITLE_ITEMS;
  if (screen === "howto") return HOWTO_ITEMS;
  if (screen === "paused") return PAUSE_ITEMS;
  if (screen === "gameover" || screen === "cleared") return OVER_ITEMS;
  return [];
}

function menuRect(
  state: DeepReadonly<CoilState>,
  index: number,
): MenuRect | null {
  assertWhole(index, "index");
  if (index < 0) throw new RangeError("index must be at least 0");
  const items = menuItems(state.screen);
  if (index >= items.length) return null;
  const totalH = items.length * MENU_H + (items.length - 1) * MENU_GAP;
  let startY = STAGE_H / 2 - totalH / 2;
  if (state.screen === "title") startY = 440;
  if (state.screen === "howto") startY = 610;
  if (state.screen === "paused") startY = 320;
  if (state.screen === "gameover" || state.screen === "cleared") startY = 430;
  return {
    x: STAGE_CX - MENU_W / 2,
    y: startY + index * (MENU_H + MENU_GAP),
    w: MENU_W,
    h: MENU_H,
  };
}

function menuIndexAt(
  state: DeepReadonly<CoilState>,
  x: number,
  y: number,
): number | null {
  const items = menuItems(state.screen);
  for (let index = 0; index < items.length; index += 1) {
    const rect = menuRect(state, index);
    if (
      rect &&
      x >= rect.x &&
      x <= rect.x + rect.w &&
      y >= rect.y &&
      y <= rect.y + rect.h
    )
      return index;
  }
  return null;
}

function directionDelta(dir: Direction): Cell {
  if (dir === "up") return { col: 0, row: -1 };
  if (dir === "down") return { col: 0, row: 1 };
  if (dir === "left") return { col: -1, row: 0 };
  return { col: 1, row: 0 };
}

function perpendicular(a: Direction, b: Direction): boolean {
  return (
    ((a === "left" || a === "right") && (b === "up" || b === "down")) ||
    ((a === "up" || a === "down") && (b === "left" || b === "right"))
  );
}

function validPelletCells(
  state: DeepReadonly<CoilState>,
  currentPellet: Cell | null,
): Cell[] {
  const cells: Cell[] = [];
  for (let row = INTERIOR_MIN_ROW; row <= INTERIOR_MAX_ROW; row += 1) {
    for (let col = INTERIOR_MIN_COL; col <= INTERIOR_MAX_COL; col += 1) {
      const cell = { col, row };
      if (
        !hasCell(state.snake, cell) &&
        !hasCell(state.obstacles, cell) &&
        !sameCell(currentPellet, cell)
      ) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

function drawRandomCell(cells: readonly Cell[]): Cell | null {
  if (cells.length === 0) return null;
  return cloneCell(cells[Math.floor(Math.random() * cells.length)]);
}

function spawnPellet(
  state: DeepReadonly<CoilState>,
  currentPellet: Cell | null,
): { pellet: Cell | null; nextPellet: null } {
  const valid = validPelletCells(state, currentPellet);
  const posed = state.nextPellet;
  if (posed && valid.some((cell) => sameCell(cell, posed)))
    return { pellet: cloneCell(posed), nextPellet: null };
  return { pellet: drawRandomCell(valid), nextPellet: null };
}

function openingState(assets: Assets, muted: boolean): CoilState {
  return {
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    score: 0,
    best: 0,
    combo: 1,
    comboWindow: 0,
    muted,
    ticks: 0,
    simTime: 0,
    accumulator: 0,
    dir: START_DIR,
    turns: [],
    snake: cloneCells(START_CELLS),
    pellet: null,
    obstacles: cloneCells(OBSTACLE_CELLS),
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: null,
    biteTime: BITE_SECONDS,
    pointerStarts: {},
    assets,
  };
}

function beginRound(
  state: DeepReadonly<CoilState>,
  api: UpdateApi | null,
): CoilState {
  const base: CoilState = {
    ...state,
    screen: "playing",
    menuIndex: 0,
    score: 0,
    combo: 1,
    comboWindow: 0,
    ticks: 0,
    simTime: 0,
    accumulator: 0,
    dir: START_DIR,
    turns: [],
    snake: cloneCells(START_CELLS),
    pellet: null,
    obstacles: cloneCells(OBSTACLE_CELLS),
    steering: true,
    travel: true,
    pelletRespawn: true,
    biteTime: BITE_SECONDS,
    pointerStarts: {},
  };
  const spawned = spawnPellet(base, null);
  if (api && !api.audio.looping(CUES.music)) api.audio.loop(CUES.music);
  return { ...base, pellet: spawned.pellet, nextPellet: spawned.nextPellet };
}

function endRound(
  state: CoilState,
  screen: "gameover" | "cleared",
  api: UpdateApi,
): CoilState {
  api.audio.stop(CUES.music);
  return {
    ...state,
    screen,
    menuIndex: 0,
    accumulator: 0,
    turns: [],
    pointerStarts: {},
  };
}

function enqueueTurn(state: CoilState, dir: Direction): CoilState {
  if (!state.steering || state.turns.length >= TURN_QUEUE_MAX) return state;
  return { ...state, turns: [...state.turns, dir] };
}

function drainCombo(
  combo: number,
  comboWindow: number,
): { combo: number; comboWindow: number } {
  const nextWindow = Math.max(0, comboWindow - TICK_SECONDS);
  return nextWindow === 0
    ? { combo: 1, comboWindow: 0 }
    : { combo, comboWindow: nextWindow };
}

function resolveTick(
  input: DeepReadonly<CoilState>,
  api: UpdateApi,
): CoilState {
  let state: CoilState = {
    ...input,
    snake: cloneCells(input.snake),
    turns: [...input.turns],
    ticks: input.ticks + 1,
  };
  let dir = state.dir;
  let turns = [...state.turns];
  if (state.steering && turns.length > 0) {
    const [request, ...rest] = turns;
    turns = rest;
    if (perpendicular(dir, request)) dir = request;
  }
  state = { ...state, dir, turns };

  if (!state.travel) {
    const drained = drainCombo(state.combo, state.comboWindow);
    return { ...state, ...drained };
  }

  const head = state.snake[0];
  const delta = directionDelta(dir);
  const nextHead = { col: head.col + delta.col, row: head.row + delta.row };
  const eats = state.pellet !== null && sameCell(nextHead, state.pellet);
  const bodyToTest = eats ? state.snake : state.snake.slice(0, -1);
  const fatal =
    isWall(nextHead) ||
    hasCell(state.obstacles, nextHead) ||
    hasCell(bodyToTest.slice(1), nextHead);
  if (fatal) {
    api.audio.play(CUES.death);
    return endRound({ ...state, accumulator: 0 }, "gameover", api);
  }

  const snake = eats
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];
  state = { ...state, snake };

  if (eats) {
    const oldCombo = state.combo;
    const combo =
      state.comboWindow > 0 ? Math.min(COMBO_MAX, state.combo + 1) : 1;
    const score = state.score + PELLET_POINTS * combo;
    api.audio.play(CUES.eat);
    if (combo > oldCombo) api.audio.play(CUES.comboUp);
    state = {
      ...state,
      combo,
      comboWindow: COMBO_WINDOW,
      score,
      best: Math.max(state.best, score),
      biteTime: 0,
    };
    if (state.pelletRespawn) {
      const spawned = spawnPellet(state, state.pellet);
      state = {
        ...state,
        pellet: spawned.pellet,
        nextPellet: spawned.nextPellet,
      };
      const drained = drainCombo(state.combo, state.comboWindow);
      if (spawned.pellet === null)
        return endRound({ ...state, ...drained }, "cleared", api);
    } else {
      state = { ...state, pellet: null };
    }
  }

  const drained = drainCombo(state.combo, state.comboWindow);
  return { ...state, ...drained };
}

function handleConfirm(state: CoilState, api: UpdateApi): CoilState {
  if (state.screen === "title") {
    const titleIndex = state.menuIndex;
    if (state.menuIndex === 0) return beginRound({ ...state, titleIndex }, api);
    return {
      ...state,
      titleIndex,
      screen: "howto",
      menuIndex: 0,
      pointerStarts: {},
    };
  }
  if (state.screen === "howto")
    return {
      ...state,
      screen: "title",
      menuIndex: state.titleIndex,
      pointerStarts: {},
    };
  if (state.screen === "paused") {
    if (state.menuIndex === 0)
      return { ...state, screen: "playing", menuIndex: 0, pointerStarts: {} };
    if (state.menuIndex === 1) return beginRound(state, api);
    api.audio.stop(CUES.music);
    return {
      ...state,
      screen: "title",
      menuIndex: state.titleIndex,
      pointerStarts: {},
    };
  }
  if (state.screen === "gameover" || state.screen === "cleared") {
    if (state.menuIndex === 0) return beginRound(state, api);
    return {
      ...state,
      screen: "title",
      menuIndex: state.titleIndex,
      pointerStarts: {},
    };
  }
  return state;
}

function handleBack(state: CoilState): CoilState {
  if (state.screen === "playing")
    return { ...state, screen: "paused", menuIndex: 0, pointerStarts: {} };
  if (
    state.screen === "howto" ||
    state.screen === "gameover" ||
    state.screen === "cleared"
  ) {
    return {
      ...state,
      screen: "title",
      menuIndex: state.titleIndex,
      pointerStarts: {},
    };
  }
  if (state.screen === "paused")
    return { ...state, screen: "playing", menuIndex: 0, pointerStarts: {} };
  return state;
}

function handleMenuInput(state: CoilState, api: UpdateApi): CoilState {
  const items = menuItems(state.screen);
  if (items.length === 0) return state;
  let next = state;
  if (api.input.pressed("up"))
    next = {
      ...next,
      menuIndex: (next.menuIndex + items.length - 1) % items.length,
    };
  if (api.input.pressed("down"))
    next = { ...next, menuIndex: (next.menuIndex + 1) % items.length };
  if (api.input.pressed("confirm")) next = handleConfirm(next, api);
  return next;
}

function handlePointerMenus(state: CoilState, api: UpdateApi): CoilState {
  if (menuItems(state.screen).length === 0) return state;
  let next = state;
  let starts: Record<number, number | null> = { ...state.pointerStarts };
  const samples: PointerSample[] = api.input.pointerSamples();
  for (const sample of samples) {
    const item = menuIndexAt(next, sample.x, sample.y);
    if (item !== null) next = { ...next, menuIndex: item };
    if (sample.type === "down" && sample.buttons.includes("primary")) {
      starts = { ...starts, [sample.id]: item };
    } else if (sample.type === "up") {
      const startItem = starts[sample.id] ?? null;
      const { [sample.id]: _removed, ...rest } = starts;
      starts = rest;
      if (item !== null && item === startItem)
        next = handleConfirm({ ...next, menuIndex: item }, api);
    }
  }
  return { ...next, pointerStarts: starts };
}

function readDirectionalInput(state: CoilState, api: UpdateApi): CoilState {
  let next = state;
  for (const dir of DIRECTIONS) {
    if (api.input.pressed(dir)) next = enqueueTurn(next, dir);
  }
  return next;
}

function updateState(
  state: DeepReadonly<CoilState>,
  api: UpdateApi,
  dt: number,
): CoilState {
  let next: CoilState = {
    ...state,
    snake: cloneCells(state.snake),
    turns: [...state.turns],
    best: Math.max(state.best, state.score),
  };
  if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
  next = { ...next, muted: api.audio.muted() };

  if (next.screen === "playing") {
    next = readDirectionalInput(next, api);
    if (api.input.pressed("back") || api.input.pressed("pause")) {
      return { ...next, screen: "paused", menuIndex: 0, pointerStarts: {} };
    }
  } else {
    if (api.input.pressed("back")) next = handleBack(next);
    if (next.screen === "paused" && api.input.pressed("pause"))
      next = { ...next, screen: "playing", menuIndex: 0, pointerStarts: {} };
    next = handleMenuInput(next, api);
    next = handlePointerMenus(next, api);
    return { ...next, muted: api.audio.muted() };
  }

  next = {
    ...next,
    simTime: next.simTime + dt,
    accumulator: next.accumulator + dt,
    biteTime: Math.min(BITE_SECONDS, next.biteTime + dt),
  };
  while (
    next.screen === "playing" &&
    next.accumulator + Number.EPSILON >= TICK_SECONDS
  ) {
    next = resolveTick(
      { ...next, accumulator: next.accumulator - TICK_SECONDS },
      api,
    );
    if (next.screen !== "playing") next = { ...next, accumulator: 0 };
  }
  return {
    ...next,
    muted: api.audio.muted(),
    best: Math.max(next.best, next.score),
  };
}

function snapshot(state: DeepReadonly<CoilState>): CoilSnapshot {
  return {
    version: COIL_DEBUG_VERSION,
    screen: state.screen,
    menuIndex: state.menuIndex,
    titleIndex: state.titleIndex,
    mode: MODE,
    score: state.score,
    best: state.best,
    combo: state.combo,
    comboWindow: state.comboWindow,
    muted: state.muted,
    ticks: state.ticks,
    simTime: state.simTime,
    dir: state.dir,
    turns: [...state.turns],
    snake: cloneCells(state.snake),
    pellet: state.pellet ? cloneCell(state.pellet) : null,
    obstacles: cloneCells(state.obstacles),
    steering: state.steering,
    travel: state.travel,
    pelletRespawn: state.pelletRespawn,
    nextPellet: state.nextPellet ? cloneCell(state.nextPellet) : null,
  };
}

function validateMenuIndex(
  state: DeepReadonly<CoilState>,
  index: number,
): void {
  assertWhole(index, "index");
  const items = menuItems(state.screen);
  if (state.screen === "playing") {
    if (index !== 0) throw new RangeError("playing only accepts menu index 0");
    return;
  }
  if (index < 0 || index >= items.length)
    throw new RangeError(`menu index ${index} is not on ${state.screen}`);
}

function validateSnake(
  cells: readonly Cell[],
  obstacles: readonly DeepReadonly<Cell>[],
): void {
  if (cells.length === 0)
    throw new RangeError("snake must hold at least one cell");
  const seen = new Set<string>();
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    assertCellInGrid(cell.col, cell.row);
    if (!isInterior(cell)) throw new RangeError("snake cells must be interior");
    if (hasCell(obstacles, cell))
      throw new RangeError("snake cannot occupy an obstacle");
    const key = `${cell.col},${cell.row}`;
    if (seen.has(key)) throw new RangeError("snake cells cannot repeat");
    seen.add(key);
    if (index > 0) {
      const previous = cells[index - 1];
      if (
        Math.abs(previous.col - cell.col) +
          Math.abs(previous.row - cell.row) !==
        1
      ) {
        throw new RangeError("snake cells must be orthogonally adjacent");
      }
    }
  }
}

function makeDebug(assets: Assets): CoilDebugApi {
  return {
    version: COIL_DEBUG_VERSION,
    reset: (state) => openingState(assets, state.muted),
    reconcile: (state) => ({
      ...state,
      snake: cloneCells(state.snake),
      turns: [...state.turns],
    }),
    snapshot,
    menuItemRect: menuRect,
    setScreen: (state, screen) => {
      if (!(SCREENS as readonly string[]).includes(screen))
        throw new RangeError(`invalid screen ${screen}`);
      return { ...state, screen };
    },
    setMenuIndex: (state, index) => {
      validateMenuIndex(state, index);
      return { ...state, menuIndex: index };
    },
    setScore: (state, points) => {
      assertWhole(points, "points");
      if (points < 0) throw new RangeError("points must be at least 0");
      return { ...state, score: points };
    },
    setBest: (state, points) => {
      assertWhole(points, "points");
      if (points < 0) throw new RangeError("points must be at least 0");
      return { ...state, best: points };
    },
    setCombo: (state, multiplier) => {
      assertWhole(multiplier, "multiplier");
      if (multiplier < 1 || multiplier > COMBO_MAX)
        throw new RangeError("multiplier is outside the combo range");
      return { ...state, combo: multiplier };
    },
    setComboWindow: (state, seconds) => {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > COMBO_WINDOW) {
        throw new RangeError("combo window is outside its range");
      }
      return { ...state, comboWindow: seconds };
    },
    setSnake: (state, cells) => {
      const posed = cloneCells(cells);
      validateSnake(posed, state.obstacles);
      return { ...state, snake: posed };
    },
    setDirection: (state, dir) => {
      if (!isDirection(dir)) throw new RangeError(`invalid direction ${dir}`);
      return { ...state, dir };
    },
    clearTurns: (state) => ({ ...state, turns: [] }),
    setSnakeSteering: (state, enabled) => ({ ...state, steering: enabled }),
    setSnakeTravel: (state, enabled) => ({ ...state, travel: enabled }),
    setPellet: (state, col, row) => {
      const pellet = { col, row };
      assertCellInGrid(col, row);
      if (
        !isInterior(pellet) ||
        hasCell(state.snake, pellet) ||
        hasCell(state.obstacles, pellet)
      ) {
        throw new RangeError("pellet cell is not valid");
      }
      return { ...state, pellet };
    },
    clearPellet: (state) => ({ ...state, pellet: null }),
    setPelletRespawn: (state, enabled) => ({
      ...state,
      pelletRespawn: enabled,
    }),
    setNextPellet: (state, col, row) => {
      assertCellInGrid(col, row);
      return { ...state, nextPellet: { col, row } };
    },
    drawPelletCell: (state) =>
      drawRandomCell(validPelletCells(state, state.pellet)),
  };
}

function registerDiagnostics(api: InitApi<CoilState>): void {
  api.diagnostics.register("screen", (s) => s.screen);
  api.diagnostics.register("score", (s) => s.score);
  api.diagnostics.register("best", (s) => s.best);
  api.diagnostics.register(
    "combo",
    (s) => `x${s.combo} ${s.comboWindow.toFixed(2)}s`,
  );
  api.diagnostics.register("dir", (s) => s.dir);
  api.diagnostics.register("length", (s) => s.snake.length);
  api.diagnostics.register(
    "head",
    (s) => `${s.snake[0].col},${s.snake[0].row}`,
  );
  api.diagnostics.register("pellet", (s) =>
    s.pellet ? `${s.pellet.col},${s.pellet.row}` : "none",
  );
}

function angleFor(dir: Direction): number {
  if (dir === "down") return Math.PI / 2;
  if (dir === "left") return Math.PI;
  if (dir === "up") return -Math.PI / 2;
  return 0;
}

function connectionDir(
  from: DeepReadonly<Cell>,
  to: DeepReadonly<Cell>,
): Direction {
  if (to.col > from.col) return "right";
  if (to.col < from.col) return "left";
  if (to.row > from.row) return "down";
  return "up";
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  cell: DeepReadonly<Cell>,
  angle: number,
): void {
  const x = BOARD_X + cell.col * CELL;
  const y = BOARD_Y + cell.row * CELL;
  ctx.save();
  ctx.translate(x + CELL / 2, y + CELL / 2);
  ctx.rotate(angle);
  ctx.drawImage(image, -CELL / 2, -CELL / 2, CELL, CELL);
  ctx.restore();
}

function cornerAngle(a: Direction, b: Direction): number {
  const pair = new Set([a, b]);
  if (pair.has("right") && pair.has("down")) return 0;
  if (pair.has("down") && pair.has("left")) return Math.PI / 2;
  if (pair.has("left") && pair.has("up")) return Math.PI;
  return -Math.PI / 2;
}

function drawBoard(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#07182a";
  ctx.fillRect(BOARD_X, BOARD_Y, GRID_COLS * CELL, GRID_ROWS * CELL);
  ctx.strokeStyle = "rgba(52, 248, 255, 0.16)";
  ctx.lineWidth = 1;
  for (let col = 1; col < GRID_COLS; col += 1) {
    const x = BOARD_X + col * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, BOARD_Y);
    ctx.lineTo(x, BOARD_Y + GRID_ROWS * CELL);
    ctx.stroke();
  }
  for (let row = 1; row < GRID_ROWS; row += 1) {
    const y = BOARD_Y + row * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(BOARD_X, y);
    ctx.lineTo(BOARD_X + GRID_COLS * CELL, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#12304f";
  for (let col = 0; col < GRID_COLS; col += 1) {
    ctx.fillRect(BOARD_X + col * CELL, BOARD_Y, CELL, CELL);
    ctx.fillRect(
      BOARD_X + col * CELL,
      BOARD_Y + (GRID_ROWS - 1) * CELL,
      CELL,
      CELL,
    );
  }
  for (let row = 0; row < GRID_ROWS; row += 1) {
    ctx.fillRect(BOARD_X, BOARD_Y + row * CELL, CELL, CELL);
    ctx.fillRect(
      BOARD_X + (GRID_COLS - 1) * CELL,
      BOARD_Y + row * CELL,
      CELL,
      CELL,
    );
  }
  ctx.strokeStyle = "#39f8ff";
  ctx.lineWidth = 3;
  ctx.strokeRect(
    BOARD_X + 1.5,
    BOARD_Y + 1.5,
    GRID_COLS * CELL - 3,
    GRID_ROWS * CELL - 3,
  );
}

function drawPellet(
  ctx: CanvasRenderingContext2D,
  pellet: DeepReadonly<Cell> | null,
  t: number,
): void {
  if (!pellet) return;
  const cx = BOARD_X + pellet.col * CELL + CELL / 2;
  const cy = BOARD_Y + pellet.row * CELL + CELL / 2;
  const pulse = 1 + Math.sin(t * 12) * 0.12;
  const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
  gradient.addColorStop(0, "#fff8b6");
  gradient.addColorStop(0.45, "#ff3f7b");
  gradient.addColorStop(1, "rgba(255, 63, 123, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 18 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff45c";
  ctx.beginPath();
  ctx.arc(cx, cy, 7 * pulse, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  ctx.imageSmoothingEnabled = false;
  const headFrame =
    state.biteTime >= BITE_SECONDS
      ? 0
      : Math.min(
          HEAD_FRAMES - 1,
          1 + Math.floor((state.biteTime / BITE_SECONDS) * (HEAD_FRAMES - 1)),
        );
  for (let index = state.snake.length - 1; index >= 0; index -= 1) {
    const cell = state.snake[index];
    if (index === 0) {
      drawSprite(ctx, state.assets.head[headFrame], cell, angleFor(state.dir));
    } else if (index === state.snake.length - 1) {
      drawSprite(
        ctx,
        state.assets.tail,
        cell,
        angleFor(connectionDir(cell, state.snake[index - 1])),
      );
    } else {
      const a = connectionDir(cell, state.snake[index - 1]);
      const b = connectionDir(cell, state.snake[index + 1]);
      if ((a === "left" && b === "right") || (a === "right" && b === "left")) {
        drawSprite(ctx, state.assets.body, cell, 0);
      } else if ((a === "up" && b === "down") || (a === "down" && b === "up")) {
        drawSprite(ctx, state.assets.body, cell, Math.PI / 2);
      } else {
        drawSprite(ctx, state.assets.corner, cell, cornerAngle(a, b));
      }
    }
  }
  ctx.imageSmoothingEnabled = true;
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  ctx.fillStyle = "#06111f";
  ctx.fillRect(0, 0, STAGE_W, BOARD_Y);
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillStyle = "#7df8ff";
  ctx.textAlign = "left";
  ctx.fillText(SCORE_LABEL, 180, 34);
  ctx.fillText(String(state.score), 180, 72);
  ctx.fillText(BEST_LABEL, 350, 34);
  ctx.fillText(String(state.best), 350, 72);
  ctx.textAlign = "center";
  ctx.fillText(MODE_LABEL, STAGE_CX, 42);
  if (state.combo >= 2) {
    ctx.fillStyle = "#fff45c";
    ctx.font = "30px system-ui, sans-serif";
    ctx.fillText(`x${state.combo}`, 825, 52);
    ctx.fillStyle = "rgba(255, 244, 92, 0.2)";
    ctx.fillRect(770, 68, 110, 10);
    ctx.fillStyle = "#fff45c";
    ctx.fillRect(770, 68, 110 * (state.comboWindow / COMBO_WINDOW), 10);
  }
  ctx.textAlign = "right";
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillStyle = state.muted ? "#ff7fa3" : "#7df8ff";
  ctx.fillText(state.muted ? "MUTED" : "SOUND", 1096, 52);
}

function drawMenu(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  const items = menuItems(state.screen);
  if (items.length === 0) return;
  for (let index = 0; index < items.length; index += 1) {
    const rect = menuRect(state, index);
    if (!rect) continue;
    const active = index === state.menuIndex;
    ctx.fillStyle = active
      ? "rgba(57, 248, 255, 0.22)"
      : "rgba(8, 24, 42, 0.88)";
    ctx.strokeStyle = active ? "#39f8ff" : "rgba(125, 248, 255, 0.35)";
    ctx.lineWidth = active ? 3 : 1;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    ctx.fillStyle = active ? "#f6feff" : "#bdefff";
    ctx.font = "26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(items[index], rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  ctx.textBaseline = "alphabetic";
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  ctx.fillStyle = PANEL;
  ctx.fillRect(390, 95, 500, 300);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f6feff";
  ctx.font = "96px system-ui, sans-serif";
  ctx.fillText(TITLE_TEXT, STAGE_CX, 205);
  ctx.fillStyle = "#39f8ff";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText(TAGLINE_TEXT, STAGE_CX, 248);
  ctx.fillStyle = "#bdefff";
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(BEST_LABEL, STAGE_CX, 310);
  ctx.fillStyle = "#fff45c";
  ctx.font = "42px system-ui, sans-serif";
  ctx.fillText(String(state.best), STAGE_CX, 360);
  drawMenu(ctx, state);
}

function drawHowTo(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  ctx.fillStyle = PANEL;
  ctx.fillRect(250, 90, 780, 500);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f6feff";
  ctx.font = "52px system-ui, sans-serif";
  ctx.fillText("HOW TO PLAY", STAGE_CX, 160);
  ctx.textAlign = "left";
  ctx.fillStyle = "#d5f8ff";
  ctx.font = "24px system-ui, sans-serif";
  const lines = [
    "The serpent never stops. Arrow keys or WASD queue a turn for the next tick.",
    "You can turn only at right angles, so doubling back into your neck is blocked.",
    "Eat pellets to grow by one cell. Walls and your own body end the round.",
    "Fast pellets build the combo up to x5. When the bar drains, it falls to x1.",
    "Enter or Space confirms. Esc or P pauses. M toggles sound.",
  ];
  lines.forEach((line, index) => ctx.fillText(line, 310, 245 + index * 52));
  drawMenu(ctx, state);
}

function drawOverlayScreen(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  if (state.screen === "title") drawTitle(ctx, state);
  if (state.screen === "howto") drawHowTo(ctx, state);
  if (state.screen === "paused") {
    ctx.fillStyle = PANEL;
    ctx.fillRect(410, 180, 460, 330);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f6feff";
    ctx.font = "60px system-ui, sans-serif";
    ctx.fillText("PAUSED", STAGE_CX, 270);
    drawMenu(ctx, state);
  }
  if (state.screen === "gameover" || state.screen === "cleared") {
    ctx.fillStyle = PANEL;
    ctx.fillRect(380, 130, 520, 430);
    ctx.textAlign = "center";
    ctx.fillStyle = state.screen === "cleared" ? "#fff45c" : "#ff7fa3";
    ctx.font = "54px system-ui, sans-serif";
    ctx.fillText(
      state.screen === "cleared" ? CLEARED_TEXT : GAMEOVER_TEXT,
      STAGE_CX,
      215,
    );
    ctx.fillStyle = "#bdefff";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText(SCORE_LABEL, 540, 292);
    ctx.fillText(BEST_LABEL, 740, 292);
    ctx.fillStyle = "#f6feff";
    ctx.font = "42px system-ui, sans-serif";
    ctx.fillText(String(state.score), 540, 345);
    ctx.fillText(String(state.best), 740, 345);
    drawMenu(ctx, state);
  }
}

export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(
    api: InitApi<CoilState>,
  ): Promise<[CoilState, CoilDebugApi]> {
    for (const action of ACTIONS)
      api.input.register(action, { keys: [...BINDINGS[action]] });
    await Promise.all(
      Object.entries(CUE_PATHS).map(([cue, path]) => api.audio.load(cue, path)),
    );
    const [head, body, corner, tail] = await Promise.all([
      Promise.all(SPRITE_PATHS.head.map((path) => api.assets.loadImage(path))),
      api.assets.loadImage(SPRITE_PATHS.body),
      api.assets.loadImage(SPRITE_PATHS.corner),
      api.assets.loadImage(SPRITE_PATHS.tail),
    ]);
    const assets: Assets = { head, body, corner, tail };
    registerDiagnostics(api);
    const state = openingState(assets, false);
    return [state, makeDebug(assets)];
  },

  update(
    state: DeepReadonly<CoilState>,
    api: UpdateApi,
    dt: number,
  ): CoilState {
    return updateState(state, api, dt);
  },

  render(state: DeepReadonly<CoilState>, api: RenderApi): void {
    const { ctx } = api;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    drawHud(ctx, state);
    drawBoard(ctx);
    for (const obstacle of state.obstacles) {
      ctx.fillStyle = "#7440ff";
      ctx.fillRect(
        BOARD_X + obstacle.col * CELL,
        BOARD_Y + obstacle.row * CELL,
        CELL,
        CELL,
      );
    }
    drawPellet(ctx, state.pellet, state.simTime);
    drawSnake(ctx, state);
    drawOverlayScreen(ctx, state);
  },
};
