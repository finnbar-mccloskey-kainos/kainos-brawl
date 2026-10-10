import "./style.css";
import MainMenu from "./state/MainMenu";
import Game from "./state/Game";
import Player from "./Player";
import { emit, listen } from "./events";
import Map from "./map/Map";
import TestMap from "./map/TestMap";

export const DEBUG = true;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const context = canvas.getContext("2d")!;

export type GameState = (MainMenu | Game) & { cleanup(): void; render(context: CanvasRenderingContext2D): void; };

const map = new Map(TestMap);

export const gameState: GameState = new Game([new Player("Player 1", map)], map);

let lastFrameTime: number | undefined;
requestAnimationFrame(function gameLoop() {
    const delta = performance.now() - (lastFrameTime ?? performance.now());
    lastFrameTime = performance.now();

    emit("frame", { delta });

    gameState.render(context);

    requestAnimationFrame(gameLoop);
});

listen("stateChange", ({ oldState, newState: _ }) => {
    oldState.cleanup();
});

export let mouse_pos = { x: 0, y: 0 };

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