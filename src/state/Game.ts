import { listen } from "../events";
import { DEBUG, playerControls } from "../main";
import Map from "../map/Map";
import Player from "../entity/Player";
import { mouse_pos } from "../main";
import Character from "../character/Character";
import Entity from "../entity/Entity";

export default class Game {

    private listeners = [] as { unsubscribe: () => void; }[];

    players: Player[] = [];

    entities: Entity[] = [];

    constructor(
        public readonly map: Map,
        characters: Character[]
    ) {
        this.players = [new Player(this, "Player 1", playerControls[0], characters[0]), new Player(this, "Player 2", playerControls[1], characters[1])];
        this.entities = [...this.players];
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

        for (let entity of this.entities) {
            entity.frame(delta);
        }

        for (let entity of this.entities) {
            entity.render(context);
        }

        this.entities = this.entities.filter(entity => !entity.shouldDelete);

        if (DEBUG) {
            context.fillStyle = "blue";
            context.fillRect(mouse_pos.x, mouse_pos.y, 1, 1);
        }
    }

}