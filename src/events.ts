import type { GameState } from "./main";
import type Player from "./Player";

const subscriptions: { [K in keyof EventTypes]?: ((data: EventTypes[K]) => void)[] } = {};

export type EventTypes = {
    "stateChange": { oldState: GameState; newState: GameState; };
    "frame": { delta: number; };
    "render": { context: CanvasRenderingContext2D; };
    "healthChange": { player: Player; oldHealth: number; newHealth: number; };
};

export function emit<const T extends keyof EventTypes>(event: T, data: EventTypes[T]) {
    if (!subscriptions[event]) {
        return;
    }
    subscriptions[event].forEach(callback => callback(data));
}

export function listen<const T extends keyof EventTypes>(event: T, callback: (data: EventTypes[T]) => void): { unsubscribe: () => void; } {
    if (!subscriptions[event]) {
        subscriptions[event] = [];
    }
    subscriptions[event].push(callback);
    return {
        unsubscribe: () => {
            subscriptions[event] = (subscriptions[event] ?? []).filter(cb => cb !== callback) as any;
        }
    };
}