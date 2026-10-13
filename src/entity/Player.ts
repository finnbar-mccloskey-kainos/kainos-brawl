import Character from "../character/Character";
import Entity from "./Entity";
import { emit } from "../events";
import { isKeyPressed } from "../input";
import Body from "../physics/Body";
import Game from "../state/Game";
import boxesOverlap from "../util/boxesOverlap";
import boxTranslate from "../util/boxTranslate";
import Attackable from "./Attackable";
import Projectile from "./projectile/Projectile";

export type Controls = {
    left: string,
    right: string,
    up: string,
    down: string;
    primary: string;
    secondary: string;
};

export default class Player implements Entity, Attackable {

    private _percentage: number = 0;

    public facing: "left" | "right" = "right";

    public body: Body;

    constructor(
        private readonly game: Game,
        public readonly name: string,
        public readonly controls: Controls,
        public readonly character: Character
    ) {
        this.body = new Body(game, { x: 100, y: 0 }, this.character.collisionBox, { x: 0, y: 0 }, controls.down);
    }

    private stunTime: number = 0;

    frame(delta: number) {
        const SPEED = 0.1;
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
                        player.attack(10, { x: this.facing === "right" ? 0.1 : -0.1, y: -0.1 }, 150);
                        this.stunTime = 300;
                    }
                }
            }

            if (isKeyPressed(this.controls.secondary) && !isKeyPressed(this.controls.up) && !isKeyPressed(this.controls.down)) {
                const projectile = new Projectile(this.game, this, 5, 0.3, 300);
                this.game.entities.push(projectile);
                this.stunTime = 500;
                projectile.body.velocity = { x: this.facing === "right" ? 0.3 : -0.3, y: -0.2 };
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
        this.character.render(context, { x: this.body.position.x, y: this.body.position.y }, this.facing);
    }

    get percentage() {
        return this._percentage;
    }

    set percentage(value: number) {
        const oldPercentage = this._percentage;
        this._percentage = value;
        emit("percentageChange", { player: this, oldPercentage: oldPercentage, newPercentage: this._percentage });
    }

    get shouldDelete() {
        return false;
    }
}
