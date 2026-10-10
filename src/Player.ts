import { emit } from "./events";
import { isKeyPressed } from "./input";
import Map from "./map/Map";
import Body from "./physics/Body";
import Game from "./state/Game";
import boxesOverlap from "./util/boxesOverlap";
import boxTranslate from "./util/boxTranslate";

export type Controls = {
    left: string,
    right: string,
    up: string,
    down: string;
    primary: string;
    secondary: string;
};

export default class Player {

    private _percentage: number = 1;

    public facing: "left" | "right" = "right";

    public body: Body;

    constructor(
        map: Map,
        private readonly game: Game,
        public readonly name: string,
        public readonly controls: Controls
    ) {
        this.body = new Body(this, map, controls.down);
    }

    private stunTime: number = 0;

    frame(delta: number) {
        const SPEED = 0.05;
        if (this.stunTime > 0) {
            this.stunTime -= delta;
            this.body.frame(delta, true);
        } else {
            if (isKeyPressed(this.controls.left)) {
                this.body.moveHorizontally(-SPEED * delta);
                this.facing = "left";
            }
            if (isKeyPressed(this.controls.right)) {
                this.body.moveHorizontally(SPEED * delta);
                this.facing = "right";
            }
            if (isKeyPressed(this.controls.up) && this.body.isOnGround()) {
                this.body.velocity = { x: this.body.velocity.x, y: -0.25 };
            }

            if (isKeyPressed(this.controls.primary)) {
                for (const player of this.game.players) {
                    if (player === this) continue;
                    if (
                        boxesOverlap(
                            boxTranslate(
                                this.body.getCollisionBox(),
                                { x: this.facing === "right" ? 20 : -20, y: 0 }
                            ),
                            player.body.getCollisionBox()
                        )
                    ) {
                        player.attack(10, { x: this.facing === "right" ? 0.05 : -0.05, y: -0.05 }, 150);
                        this.stunTime = 300;
                    }
                }
            }
            this.body.frame(delta, false);
        }



    }

    attack(damage: number, knockback: { x: number, y: number; }, stunTime: number) {
        if (this.stunTime <= 0) {
            this.percentage += damage;
            this.body.velocity = { x: this.body.velocity.x + knockback.x * (this.percentage / 100), y: this.body.velocity.y + knockback.y * (this.percentage / 100) };
            this.stunTime = stunTime;
        }
    }

    render(context: CanvasRenderingContext2D) {
        context.fillStyle = "red";
        context.fillRect(Math.trunc(this.body.position.x), Math.trunc(this.body.position.y), 20, -20);
        context.fillRect(Math.trunc(this.body.position.x + 20), Math.trunc(this.body.position.y - 10), this.facing === "right" ? 20 : -40, 1);
    }

    get percentage() {
        return this._percentage;
    }

    set percentage(value: number) {
        const oldPercentage = this._percentage;
        this._percentage = value;
        emit("percentageChange", { player: this, oldPercentage: oldPercentage, newPercentage: this._percentage });
    }

}
