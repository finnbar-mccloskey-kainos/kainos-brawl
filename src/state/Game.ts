import { listen } from "../events";
import { DEBUG, playerControls, WIDTH } from "../main";
import Map from "../map/Map";
import Player from "../entity/Player";
import { mouse_pos } from "../main";
import Character from "../character/Character";
import Entity from "../entity/Entity";
import collisionAudioUrl from "../../audio/Collision.wav?url";

export default class Game {

    private listeners = [] as { unsubscribe: () => void; }[];
    private audioContext = new AudioContext();
    private musicSource?: AudioBufferSourceNode;
    private cleanedUp = false;

    players: Player[] = [];

    entities: Entity[] = [];

    constructor(
        public readonly map: Map,
        characters: Character[]
    ) {
        void this.playMusic();

        this.players = [new Player(this, "Player 1", playerControls[0], characters[0]), new Player(this, "Player 2", playerControls[1], characters[1])];
        this.entities = [...this.players];

        const scoreBar = document.createElement("div");
        scoreBar.classList.add("score-bar");

        const blueScoreBar = document.createElement("div");
        blueScoreBar.classList.add("blue-score-bar");
        blueScoreBar.style.width = `calc(var(--pixel)*${WIDTH / 2})`;
        scoreBar.appendChild(blueScoreBar);

        listen("percentageChange", () => {
            const total = this.players[0].percentage + this.players[1].percentage;
            const ratio = this.players[1].percentage / total;
            blueScoreBar.style.width = `calc(var(--pixel)*${WIDTH * ratio})`;
        });

        document.getElementById("ui")!.replaceChildren(scoreBar);
    }

    cleanup() {
        this.cleanedUp = true;
        this.musicSource?.stop();
        void this.audioContext.close();

        for (let listener of this.listeners) {
            listener.unsubscribe();
        }
    }

    private async playMusic() {
        try {
            const [response] = await Promise.all([
                fetch(collisionAudioUrl),
                this.audioContext.resume(),
            ]);
            if (!response.ok) {
                throw new Error(`Failed to load music: ${response.status}`);
            }

            const audioBuffer = await this.audioContext.decodeAudioData(await response.arrayBuffer());
            if (this.cleanedUp) {
                return;
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;
            source.loopStart = 12.54;
            source.loopEnd = audioBuffer.duration;

            const volume = this.audioContext.createGain();
            volume.gain.value = 0.5;
            source.connect(volume);
            volume.connect(this.audioContext.destination);

            this.musicSource = source;
            source.start(0, 0);
        } catch (error) {
            console.error("Unable to play game music", error);
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
            if (entity instanceof Player) {
                if (entity === this.players[0]) {
                    context.fillStyle = "blue";
                } else if (entity === this.players[1]) {
                    context.fillStyle = "red";
                }
                context.font = "15px \"Kiwi Soda\"";
                context.fillText(
                    "v",
                    entity.body.position.x + (entity.body.collisionBoxSize.width / 3),
                    entity.body.position.y - 5 - entity.body.collisionBoxSize.height,
                );
            }
        }

        this.entities = this.entities.filter(entity => !entity.shouldDelete);

        if (DEBUG) {
            context.fillStyle = "blue";
            context.fillRect(mouse_pos.x, mouse_pos.y, 1, 1);
        }
    }

}