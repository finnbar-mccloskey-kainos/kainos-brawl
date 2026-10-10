import { listen } from "../events";
import { DEBUG } from "../main";
import Map from "../map/Map";
import Player from "../Player";
import { mouse_pos } from "../main";

export default class Game {

    private listeners = [] as { unsubscribe: () => void; }[];

    constructor(
        public readonly players: Player[],
        public readonly map: Map,
    ) {
        document.getElementById("ui")!.replaceChildren(...players.map(player => {
            const div = document.createElement("div");
            div.className = "player";
            div.textContent = `${player.name}: ${player.health}`;
            this.listeners.push(listen("healthChange", ({ player: p, oldHealth: _, newHealth }) => {
                if (p === player) {
                    div.textContent = `${player.name}: ${newHealth}`;
                }
            }));
            return div;
        }));
    }

    cleanup() {
        for (let listener of this.listeners) {
            listener.unsubscribe();
        }
        for (let player of this.players) {
            player.cleanup();
        }
    }

    render(context: CanvasRenderingContext2D) {
        if (this.map.background) {
            context.drawImage(this.map.background, 0, 0, context.canvas.width, context.canvas.height);
        }
        for (let player of this.players) {
            context.fillStyle = "red";
            context.fillRect(Math.trunc(player.body.position.x), Math.trunc(player.body.position.y), 20, -20);
        }
        if (DEBUG) {
            context.fillStyle = "blue";
            context.fillRect(mouse_pos.x, mouse_pos.y, 1, 1);
        }
    }

}