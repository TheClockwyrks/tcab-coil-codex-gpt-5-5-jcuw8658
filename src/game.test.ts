import { describe, expect, it } from "vitest";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import { game, type CoilDebugApi, type CoilState } from "./game";
import { CUES, TICK_SECONDS } from "./constants";

type Harness = {
  state: CoilState;
  debug: CoilDebugApi;
  api: UpdateApi;
  press(action: string): void;
  played: string[];
  looped: string[];
  stopped: string[];
};

const image = {} as ImageBitmap;

function initApi(): InitApi<CoilState> {
  return {
    input: {
      register: () => undefined,
      layout: () => null,
    },
    audio: {
      define: () => undefined,
      load: () => Promise.resolve(),
    },
    assets: {
      loadImage: () => Promise.resolve(image),
      loadAudio: () => Promise.resolve({} as AudioBuffer),
      load: () => Promise.resolve(new Blob()),
      resolve: (path) => `assets/${path}`,
    },
    diagnostics: {
      register: () => undefined,
    },
    events: {
      on: () => () => undefined,
    },
    viewport: () => ({
      width: 1280,
      height: 720,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }),
  };
}

async function makeHarness(): Promise<Harness> {
  const [state, debug] = await game.initialize(initApi());
  const pressed = new Set<string>();
  const played: string[] = [];
  const looped: string[] = [];
  const stopped: string[] = [];
  let muted = false;
  let musicLooping = false;
  const api: UpdateApi = {
    input: {
      value: () => 0,
      pressed: (action) => {
        const wasPressed = pressed.has(action);
        pressed.delete(action);
        return wasPressed;
      },
      pointer: () => ({
        x: 0,
        y: 0,
        down: false,
        device: "mouse",
        buttons: [],
      }),
      pointerPressed: () => false,
      pointerReleased: () => false,
      pointerSamples: () => [],
      pointerContacts: () => [],
      wheel: () => ({ x: 0, y: 0 }),
    },
    audio: {
      play: (cue) => {
        played.push(cue);
      },
      loop: (cue) => {
        looped.push(cue);
        if (cue === CUES.music) musicLooping = true;
      },
      stop: (cue) => {
        stopped.push(cue);
        if (cue === CUES.music) musicLooping = false;
      },
      looping: (cue) => cue === CUES.music && musicLooping,
      setMuted: (value) => {
        muted = value;
      },
      muted: () => muted,
    },
    frame: () => ({ count: 0, timeMs: 0, lastDeltaMs: 0 }),
    viewport: () => ({
      width: 1280,
      height: 720,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }),
  };
  return {
    state,
    debug,
    api,
    press(action) {
      pressed.add(action);
    },
    played,
    looped,
    stopped,
  };
}

function frame(harness: Harness, dt = TICK_SECONDS): void {
  harness.state = game.update(harness.state, harness.api, dt);
}

describe("Coil simulation", () => {
  it("starts on the title screen and reset restores the opening snapshot", async () => {
    const h = await makeHarness();
    h.state = h.debug.setScore(h.state, 90);
    h.state = h.debug.setBest(h.state, 120);
    h.state = h.debug.reset(h.state);

    expect(h.debug.snapshot(h.state)).toMatchObject({
      version: 1,
      screen: "title",
      score: 0,
      best: 0,
      combo: 1,
      comboWindow: 0,
      dir: "right",
      turns: [],
      pellet: null,
      steering: true,
      travel: true,
      pelletRespawn: true,
    });
  });

  it("starts a round with a posed first pellet and moves one cell per tick", async () => {
    const h = await makeHarness();
    h.state = h.debug.setNextPellet(h.state, 16, 8);
    h.press("confirm");
    frame(h, 0);

    expect(h.state.screen).toBe("playing");
    expect(h.state.pellet).toEqual({ col: 16, row: 8 });
    expect(h.looped).toEqual([CUES.music]);

    h.state = h.debug.setPelletRespawn(h.state, false);
    frame(h);

    expect(h.state.snake).toHaveLength(4);
    expect(h.state.score).toBe(10);
    expect(h.state.combo).toBe(1);
    expect(h.state.pellet).toBeNull();
    expect(h.played).toContain(CUES.eat);
  });

  it("queues two perpendicular turns across two ticks", async () => {
    const h = await makeHarness();
    h.press("confirm");
    frame(h, 0);
    h.press("down");
    h.press("left");
    frame(h);

    expect(h.state.dir).toBe("down");
    expect(h.state.turns).toEqual(["left"]);
    expect(h.state.snake[0]).toEqual({ col: 15, row: 9 });

    frame(h);

    expect(h.state.dir).toBe("left");
    expect(h.state.snake[0]).toEqual({ col: 14, row: 9 });
  });

  it("allows chasing the tail and ends the round on a body collision", async () => {
    const h = await makeHarness();
    h.state = h.debug.setScreen(h.state, "playing");
    h.state = h.debug.setSnake(h.state, [
      { col: 5, row: 5 },
      { col: 5, row: 6 },
      { col: 4, row: 6 },
      { col: 4, row: 5 },
    ]);
    h.state = h.debug.setDirection(h.state, "left");
    frame(h);

    expect(h.state.screen).toBe("playing");
    expect(h.state.snake[0]).toEqual({ col: 4, row: 5 });

    h.state = h.debug.setSnake(h.state, [
      { col: 5, row: 5 },
      { col: 4, row: 5 },
      { col: 4, row: 6 },
      { col: 5, row: 6 },
    ]);
    h.state = h.debug.setDirection(h.state, "left");
    frame(h);

    expect(h.state.screen).toBe("gameover");
    expect(h.played).toContain(CUES.death);
  });
});
