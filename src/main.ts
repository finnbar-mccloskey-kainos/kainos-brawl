import "./style.css";
import MainMenu from "./state/MainMenu";
import Game from "./state/Game";
import { emit, listen } from "./events";
import { Controls } from "./entity/Player";
import { setGamepad } from "./input";

export let logo = new Image();
logo.src = "/logo.png";
logo.classList.add("logo");

export const DEBUG = true;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const context = canvas.getContext("2d", { alpha: false })!;
context.imageSmoothingEnabled = false;

export const WIDTH = context.canvas.width;

export type GameState = (MainMenu | Game) & { cleanup(): void; render(context: CanvasRenderingContext2D, delta: number): void; };

export const playerControls: Controls[] = [
    {
        left: {
            keyboard: "KeyA",
            controller: {
                type: "axis", direction: "negative", index: 1
            }
        },
        right: {
            keyboard: "KeyD",
            controller: {
                type: "axis", direction: "positive", index: 1
            }
        },
        up: {
            keyboard: "KeyW", controller: {
                type: "button", index: 15
            }
        },
        menuUp: {
            keyboard: "KeyW", controller: { type: "axis", direction: "positive", index: 0 }
        },
        down: {
            keyboard: "KeyS",
            controller: { type: "axis", direction: "negative", index: 0 }
        },
        primary: {
            keyboard: "ShiftLeft",
            controller: { type: "button", index: 13 }
        },
        secondary: {
            keyboard: "KeyC",
            controller: { type: "button", index: 14 }
        }
    },
    {
        left: {
            keyboard: "KeyJ",
            controller: { type: "axis", direction: "positive", index: 3 }
        },
        right: {
            keyboard: "KeyL",
            controller: { type: "axis", direction: "negative", index: 3 }
        },
        up: {
            keyboard: "KeyI",
            controller: { type: "button", index: 3 }
        },
        menuUp: {
            keyboard: "KeyI",
            controller: { type: "axis", direction: "negative", index: 2 }
        },
        down: {
            keyboard: "KeyK",
            controller: { type: "axis", direction: "positive", index: 2 }
        },
        primary: {
            keyboard: "KeyB",
            controller: { type: "button", index: 2 }
        },
        secondary: {
            keyboard: "Period",
            controller: { type: "button", index: 0 }
        }
    },
];

export let gameState: GameState = new MainMenu();
// export let gameState: GameState = new Game(new Map(TestMap), [new Brendan("green"), new Callum()]);

let lastFrameTime: number | undefined;
requestAnimationFrame(function gameLoop() {

    for (let gamepad of navigator.getGamepads()) {
        if (gamepad) {
            setGamepad(gamepad);
            break;
        }
    }

    const delta = performance.now() - (lastFrameTime ?? performance.now());
    lastFrameTime = performance.now();

    emit("frame", { delta });

    gameState.render(context, delta);

    requestAnimationFrame(gameLoop);
});

listen("stateChange", ({ oldState, newState }) => {
    oldState.cleanup();
    gameState = newState;
});

export let mouse_pos = { x: 0, y: 0 };

function updateGamePixelSize() {
    const pixelSize = canvas.getBoundingClientRect().width / canvas.width;
    document.documentElement.style.setProperty("--pixel", `${pixelSize}px`);
}

window.addEventListener("resize", updateGamePixelSize);

if (DEBUG) {
    document.onclick = () => {
        navigator.clipboard.writeText(`{x: ${mouse_pos.x}, y: ${mouse_pos.y}}`);
    };

    document.onmousemove = (event) => {
        const rect = canvas.getBoundingClientRect();
        mouse_pos.x = Math.floor((event.clientX - rect.left) * canvas.width / rect.width);
        mouse_pos.y = Math.floor((event.clientY - rect.top) * canvas.height / rect.height);
    };
}

updateGamePixelSize();