import "./style.css";
import MainMenu from "./state/MainMenu";
import Game from "./state/Game";
import { emit, listen } from "./events";

export const DEBUG = true;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const context = canvas.getContext("2d")!;

export type GameState = (MainMenu | Game) & { cleanup(): void; render(context: CanvasRenderingContext2D, delta: number): void; };

export const playerControls = [
    { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", primary: "ShiftLeft", secondary: "KeyC" }, { left: "KeyJ", right: "KeyL", up: "KeyI", down: "KeyK", primary: "KeyB", secondary: "Period" }];

export let gameState: GameState = new MainMenu();

let lastFrameTime: number | undefined;
requestAnimationFrame(function gameLoop() {
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