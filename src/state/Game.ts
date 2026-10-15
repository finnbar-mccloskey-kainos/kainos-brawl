import { emit, listen } from "../events";
import { DEBUG, playerControls, sounds } from "../main";
import Map from "../map/Map";
import Player from "../entity/Player";
import { mouse_pos } from "../main";
import Character from "../character/Character";
import Entity from "../entity/Entity";
import Projectile from "../entity/projectile/Projectile";
import WinScreen from "./WinScreen";

export default class Game {

    private listeners = [] as { unsubscribe: () => void; }[];
    private music?: HTMLAudioElement;
    private currentAnimationInterval?: number;
    private over = false;

    players: Player[] = [];

    entities: Entity[] = [];

    constructor(
        public readonly map: Map,
        characters: Character[]
    ) {
        void this.playMusic();

        this.players = [new Player(this, "Player 1", playerControls[0], characters[0]), new Player(this, "Player 2", playerControls[1], characters[1])];
        this.players[1].facing = "left";
        this.entities = [...this.players];

        const spawnPlatform = this.map.data.platforms
            .filter(platform => !platform.passthrough)
            .sort((left, right) => right.topLeft.y - left.topLeft.y)[0];

        if (spawnPlatform) {
            const edgeInset = 12;
            this.players[0].body.position = {
                x: spawnPlatform.topLeft.x + edgeInset,
                y: spawnPlatform.topLeft.y,
            };
            this.players[1].body.position = {
                x: spawnPlatform.bottomRight.x - this.players[1].body.collisionBoxSize.width - edgeInset,
                y: spawnPlatform.topLeft.y,
            };
        }

        const scoreBar = document.createElement("div");
        scoreBar.classList.add("score-bar");

        const blueScoreBar = document.createElement("div");
        blueScoreBar.classList.add("blue-score-bar");
        scoreBar.appendChild(blueScoreBar);

        const redScoreBar = document.createElement("div");
        redScoreBar.classList.add("red-score-bar");
        scoreBar.appendChild(redScoreBar);

        const embers: { element: HTMLSpanElement; side: "blue" | "red"; startFraction: number; }[] = [];
        const addEmbers = (bar: HTMLDivElement, side: "blue" | "red") => {
            for (let index = 0; index < 12; index++) {
                const ember = document.createElement("span");
                ember.classList.add("score-ember", `${side}-ember`);
                ember.style.setProperty("--ember-duration", `${1.8 + Math.random() * 2.2}s`);
                ember.style.setProperty("--ember-delay", `${-Math.random() * 3.5}s`);
                ember.style.setProperty("--ember-drift", `${14 + Math.random() * 5}px`);
                ember.style.setProperty("--ember-scale", `${0.65 + Math.random() * 0.7}`);
                bar.appendChild(ember);
                embers.push({ element: ember, side, startFraction: (index + Math.random()) / 12 });
            }
        };

        addEmbers(blueScoreBar, "blue");
        addEmbers(redScoreBar, "red");

        const bluePercentage = document.createElement("span");
        bluePercentage.classList.add("score-percentage", "blue-percentage");
        scoreBar.appendChild(bluePercentage);

        const redPercentage = document.createElement("span");
        redPercentage.classList.add("score-percentage", "red-percentage");
        scoreBar.appendChild(redPercentage);

        const divider = document.createElement("span");
        divider.classList.add("score-divider");
        const currentCanvas = document.createElement("canvas");
        currentCanvas.classList.add("game-score-current-canvas");
        currentCanvas.setAttribute("aria-hidden", "true");
        divider.appendChild(currentCanvas);
        scoreBar.appendChild(divider);

        const getPercentageColor = (percentage: number) => {
            const progress = Math.max(0, Math.min(1, percentage / 200));
            const red = Math.round(255 + (88 - 255) * progress);
            const greenBlue = Math.round(255 * (1 - progress));
            return `rgb(${red}, ${greenBlue}, ${greenBlue})`;
        };

        const updateScoreBar = () => {
            const [bluePlayer, redPlayer] = this.players;
            const total = bluePlayer.percentage + redPlayer.percentage;
            const ratio = total === 0 ? 0.5 : redPlayer.percentage / total;
            const split = Math.max(0, Math.min(1, ratio));

            scoreBar.style.setProperty("--score-split", `${split * 100}%`);
            for (const ember of embers) {
                const start = ember.side === "blue"
                    ? ember.startFraction * split
                    : split + ember.startFraction * (1 - split);
                ember.element.style.setProperty("--ember-start", `${start * 100}%`);
            }
            bluePercentage.textContent = `${Math.round(bluePlayer.percentage)}%`;
            redPercentage.textContent = `${Math.round(redPlayer.percentage)}%`;
            bluePercentage.style.color = getPercentageColor(bluePlayer.percentage);
            redPercentage.style.color = getPercentageColor(redPlayer.percentage);
        };

        listen("percentageChange", updateScoreBar);
        updateScoreBar();

        document.getElementById("ui")!.replaceChildren(scoreBar);
        this.paintElectricCurrent(currentCanvas, scoreBar, blueScoreBar, redScoreBar);
        this.currentAnimationInterval = window.setInterval(() => this.paintElectricCurrent(currentCanvas, scoreBar, blueScoreBar, redScoreBar), 1000 / 24);
    }

    cleanup() {
        if (this.currentAnimationInterval !== undefined) {
            window.clearInterval(this.currentAnimationInterval);
        }
        this.stopMusic();

        for (let listener of this.listeners) {
            listener.unsubscribe();
        }
    }

    private paintElectricCurrent(canvas: HTMLCanvasElement, scoreBar: HTMLDivElement, blueBar: HTMLDivElement, redBar: HTMLDivElement) {
        const context = canvas.getContext("2d");
        const { width, height } = canvas.getBoundingClientRect();
        if (!context || width === 0 || height === 0) {
            return;
        }

        const gamePixel = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pixel")) || 1;
        const canvasWidth = Math.max(1, Math.ceil(width / gamePixel));
        const canvasHeight = Math.max(1, Math.ceil(height / gamePixel));
        const scoreRect = scoreBar.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        context.imageSmoothingEnabled = false;
        context.lineCap = "square";
        context.lineJoin = "miter";

        const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
        const drawPath = (points: { x: number; y: number; }[], color: string, lineWidth: number) => {
            context.beginPath();
            context.moveTo(points[0].x, points[0].y);
            for (const point of points.slice(1)) {
                context.lineTo(point.x, point.y);
            }
            context.strokeStyle = color;
            context.lineWidth = lineWidth;
            context.shadowBlur = 0;
            context.stroke();
        };

        const segmentCount = Math.max(3, Math.min(8, canvasHeight - 1));
        const center = Math.floor(canvasWidth / 2) + 0.5;
        const maxJitter = Math.max(2, Math.round(canvasWidth * 0.12));
        const maxOffset = canvasWidth * 0.34;
        const current = [{ x: center, y: 0 }];
        for (let segment = 1; segment <= segmentCount; segment++) {
            const previous = current[segment - 1];
            const isLastSegment = segment === segmentCount;
            current.push({
                x: isLastSegment
                    ? center
                    : clamp(previous.x + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * maxJitter)), center - maxOffset, center + maxOffset),
                y: canvasHeight * segment / segmentCount,
            });
        }

        const seam = current.map(point => ({
            x: clamp(((canvasRect.left - scoreRect.left + point.x * canvasRect.width / canvasWidth) / scoreRect.width) * 100, 0, 100),
            y: clamp(point.y / canvasHeight * 100, 0, 100),
        }));
        const seamVertices = seam.map(point => `${point.x.toFixed(2)}% ${point.y.toFixed(2)}%`);
        blueBar.style.clipPath = `polygon(0 0, ${seamVertices.join(", ")}, 0 100%)`;
        redBar.style.clipPath = `polygon(${seam[0].x.toFixed(2)}% 0, 100% 0, 100% 100%, ${seamVertices.slice().reverse().join(", ")})`;

        for (let branch = 0; branch < 6; branch++) {
            const origin = current[1 + Math.floor(Math.random() * (segmentCount - 1))];
            const direction = Math.random() < 0.5 ? -1 : 1;
            const points = [origin];
            let x = origin.x;
            let y = origin.y;
            const branchSteps = 2 + Math.floor(Math.random() * 2);
            for (let step = 0; step < branchSteps; step++) {
                x = clamp(x + direction * (1 + Math.floor(Math.random() * 2)), 0.5, canvasWidth - 0.5);
                y = clamp(y + (Math.random() < 0.5 ? -1 : 1), 0, canvasHeight);
                points.push({ x, y });
            }
            drawPath(points, "#ffdc5b", 1);
        }

        drawPath(current, "#ffca3a", 2);
        drawPath(current, "#fffbd5", 1);
    }

    private async playMusic() {
        const music = sounds.collision();
        this.music = music;
        music.volume = 0.5;
        music.onended = () => {
            music.currentTime = 12.54;
            void music.play().catch(error => {
                console.error("Unable to loop game music", error);
            });
        };
        try {
            await music.play();
        } catch (error) {
            console.error("Unable to play game music", error);
        }
    }

    private stopMusic() {
        if (this.music) {
            this.music.onended = null;
            this.music.pause();
            this.music.currentTime = 0;
            this.music = undefined;
        }
    }

    render(context: CanvasRenderingContext2D, delta: number) {
        if (this.over) {
            return;
        }

        if (this.map.background) {
            context.drawImage(this.map.background, 0, 0, context.canvas.width, context.canvas.height);
        }

        for (let entity of this.entities) {
            entity.frame(delta);

            const BOUNDS = 100;

            if (entity.body.position.x < -BOUNDS || entity.body.position.y < -BOUNDS || entity.body.position.x > context.canvas.width + BOUNDS || entity.body.position.y > context.canvas.height + BOUNDS) {
                if (entity instanceof Player) {
                    const winner = this.players.find(p => p !== entity)!;

                    this.stopMusic();
                    sounds.roundEnd().play();

                    this.over = true;
                    setTimeout(() => {
                        emit("stateChange", { oldState: this, newState: new WinScreen(winner) });
                    }, 1000);
                } else {
                    this.entities = this.entities.filter(e => e !== entity);
                }
            }

            for (let entity of this.entities) {
                if (DEBUG && entity instanceof Player) {
                    const playerHitbox = entity.body.getCollisionBox();
                    context.strokeStyle = "#36f1b2";
                    context.lineWidth = 1;
                    context.strokeRect(
                        playerHitbox.topLeft.x,
                        playerHitbox.topLeft.y,
                        playerHitbox.bottomRight.x - playerHitbox.topLeft.x,
                        playerHitbox.bottomRight.y - playerHitbox.topLeft.y
                    );

                    for (const hitbox of entity.attackDebugHitboxes) {
                        context.fillStyle = "rgba(255, 140, 0, 0.3)";
                        context.fillRect(
                            hitbox.topLeft.x,
                            hitbox.topLeft.y,
                            hitbox.bottomRight.x - hitbox.topLeft.x,
                            hitbox.bottomRight.y - hitbox.topLeft.y
                        );
                        context.strokeStyle = "#ff8c00";
                        context.strokeRect(
                            hitbox.topLeft.x,
                            hitbox.topLeft.y,
                            hitbox.bottomRight.x - hitbox.topLeft.x,
                            hitbox.bottomRight.y - hitbox.topLeft.y
                        );
                    }
                } else if (DEBUG && entity instanceof Projectile) {
                    const hitbox = entity.body.getCollisionBox();
                    context.strokeStyle = "#ff8c00";
                    context.lineWidth = 1;
                    context.strokeRect(
                        hitbox.topLeft.x,
                        hitbox.topLeft.y,
                        hitbox.bottomRight.x - hitbox.topLeft.x,
                        hitbox.bottomRight.y - hitbox.topLeft.y
                    );
                }
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

                    if (entity.isChargingProjectile) {
                        const meterWidth = 20;
                        const meterHeight = 3;
                        const meterX = entity.body.position.x + (entity.body.collisionBoxSize.width - meterWidth) / 2;
                        const meterY = entity.body.position.y - entity.body.collisionBoxSize.height - 25;

                        context.fillStyle = "#240a10";
                        context.fillRect(meterX, meterY, meterWidth, meterHeight);
                        context.fillStyle = "#f04452";
                        context.fillRect(meterX, meterY, meterWidth * entity.projectileChargeRatio, meterHeight);
                        context.strokeStyle = "#ffe4c7";
                        context.lineWidth = 1;
                        context.strokeRect(meterX, meterY, meterWidth, meterHeight);
                    }
                }
            }

            this.entities = this.entities.filter(entity => !entity.shouldDelete);

            if (DEBUG) {
                context.fillStyle = "blue";
                context.fillRect(mouse_pos.x, mouse_pos.y, 1, 1);
            }
        }
    }

}