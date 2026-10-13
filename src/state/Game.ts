import { listen } from "../events";
import { DEBUG, playerControls } from "../main";
import Map from "../map/Map";
import Player from "../Player";
import { mouse_pos } from "../main";

export default class Game {

    private listeners = [] as { unsubscribe: () => void; }[];

    players: Player[] = [];

    constructor(
        public readonly map: Map,
    ) {
        this.players = [new Player(map, this, "Player 1", playerControls[0]), new Player(map, this, "Player 2", playerControls[1])];
        document.getElementById("ui")!.replaceChildren(...this.players.map(player => {
            const div = document.createElement("div");
            div.className = "player";
            div.textContent = `${player.name}: ${player.percentage}`;
            this.listeners.push(listen("percentageChange", ({ player: p, oldPercentage: _, newPercentage: newHealth }) => {
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
    }

    render(context: CanvasRenderingContext2D, delta: number) {

        if (this.map.background) {
            context.drawImage(this.map.background, 0, 0, context.canvas.width, context.canvas.height);
        }

        for (let player of this.players) {
            player.frame(delta);
        }

        for (let player of this.players) {
            player.render(context);
        }

        if (DEBUG) {
            context.fillStyle = "blue";
            context.fillRect(mouse_pos.x, mouse_pos.y, 1, 1);
        }
    }

}