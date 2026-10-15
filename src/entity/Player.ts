import Character from "../character/Character";
import Entity from "./Entity";
import { emit } from "../events";
import { gamepad, isKeyPressed } from "../input";
import Body, { REALISTIC_DRAG, REALISTIC_GRAVITY } from "../physics/Body";
import Game from "../state/Game";
import boxesOverlap from "../util/boxesOverlap";
import boxTranslate from "../util/boxTranslate";
import Attackable, { isAttackable } from "./Attackable";
import Projectile from "./projectile/Projectile";

export type Control = {
    keyboard: string;
    controller: { type: "button", index: number; } | { type: "axis", direction: "positive" | "negative", index: number; };
};

export type Controls = {
    left: Control,
    right: Control,
    up: Control,
    menuUp: Control;
    down: Control;
    primary: Control;
    secondary: Control;
};

class Normal {

    constructor(private player: Player) { }

    public readonly canAttack = true;

    frame(delta: number) {

        const SPEED = 0.1;

        if (this.player.isControlPressed("left")) {
            this.player.body.moveHorizontally(-SPEED * delta);
            this.player.facing = "left";
        }
        if (this.player.isControlPressed("right")) {
            this.player.body.moveHorizontally(SPEED * delta);
            this.player.facing = "right";
        }
        if (this.player.isControlPressed("up") && this.player.body.isOnGround()) {
            this.player.body.velocity = { x: this.player.body.velocity.x, y: -0.25 };
        }

        if (this.player.isControlPressed("primary")) {
            for (const player of this.player.game.players) {
                if (player === this.player) continue;
                if (
                    boxesOverlap(
                        boxTranslate(
                            this.player.body.getCollisionBox(),
                            { x: this.player.facing === "right" ? 20 : -20, y: 0 }
                        ),
                        player.body.getCollisionBox()
                    )
                ) {
                    player.attack(10, { x: this.player.facing === "right" ? 0.1 : -0.1, y: -0.1 }, 150);
                    this.player.state = new Stunned(this.player, 300);
                }
            }
        }

        if (this.player.isControlPressed("secondary") && !this.player.isControlPressed("up") && !this.player.isControlPressed("down")) {
            const projectile = new Projectile(this.player.game, this.player, this.player.character.projectilePreset);
            this.player.game.entities.push(projectile);
            this.player.state = new Stunned(this.player, 500);
            projectile.body.velocity = { x: this.player.facing === "right" ? 0.3 : -0.3, y: -0.2 };
        }

        if (this.player.isControlPressed("down") && this.player.isControlPressed("secondary")) {
            this.player.state = new Downsmashing(this.player);
        }
        this.player.body.frame(delta, false);

    }

}
class Stunned {

    public readonly canAttack = false;

    constructor(public player: Player, public stunTime: number) {
    }

    frame(delta: number) {
        if (this.stunTime <= 0) {
            this.player.state = new Normal(this.player);
            return;
        }
        this.stunTime -= delta;
        this.player.body.frame(delta, false);
    }

}

class Downsmashing {

    private originalGravity: number;

    private startTime: number;

    constructor(public player: Player) {
        this.originalGravity = this.player.body.gravity;
        this.player.body.gravity = 0;
        this.startTime = Date.now();
    }

    public readonly canAttack = true;

    frame(delta: number) {
        this.player.body.frame(delta);

        this.player.body.velocity.y = 0.3;

        if (this.player.body.isOnGround()) {
            const endTime = Date.now();
            const duration = endTime - this.startTime;
            const multiplier = Math.min(duration / 500, 1);
            this.player.body.gravity = this.originalGravity;
            for (const entity of this.player.game.entities) {
                if (entity != this.player && isAttackable(entity) && boxesOverlap(
                    this.player.body.getCollisionBox(),
                    entity.body.getCollisionBox()
                )) {
                    let knockbackAngle = Math.atan2(
                        entity.body.position.y - this.player.body.position.y,
                        entity.body.position.x - this.player.body.position.x
                    );
                    entity.attack(25 * multiplier, { x: Math.cos(knockbackAngle) * 0.3 * multiplier, y: -0.3 * multiplier }, 150);
                }
            }
            this.player.state = new Stunned(this.player, 700);
        }
    }

}

type PlayerState = (Normal | Stunned | Downsmashing) & { get canAttack(): boolean; frame(delta: number): void; };

export default class Player implements Entity, Attackable {

    private _percentage: number = 0;

    public facing: "left" | "right" = "right";

    public readonly body: Body;

    constructor(
        public readonly game: Game,
        public readonly name: string,
        public readonly controls: Controls,
        public readonly character: Character
    ) {
        this._state = new Normal(this);
        this.body = new Body(game, { x: 100, y: 0 }, this.character.collisionBox, { x: 0, y: 0 }, REALISTIC_DRAG, REALISTIC_GRAVITY, () => this.isControlPressed("down"));
    }

    private _state: PlayerState;

    get state() {
        return this._state;
    }

    set state(value: PlayerState) {
        this._state = value;
    }

    frame(delta: number) {
        this._state.frame(delta);
    }

    attack(damage: number, knockback: { x: number, y: number; }, stunTime: number) {
        if (this._state.canAttack) {
            this.percentage += damage;
            this.body.velocity = { x: this.body.velocity.x + knockback.x * (this.percentage / 100), y: this.body.velocity.y + knockback.y * (this.percentage / 100) };
            this._state = new Stunned(this, stunTime);
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

    isControlPressed(control: keyof typeof this.controls): boolean {
        if (isKeyPressed(this.controls[control].keyboard)) {
            return true;
        }

        if (gamepad) {
            const controllerControl = this.controls[control].controller;
            if (controllerControl.type === "button") {
                if (gamepad.buttons[controllerControl.index].pressed) {
                    return true;
                }
            } else if (controllerControl.type === "axis") {
                if (controllerControl.direction === "negative") {
                    return gamepad.axes[controllerControl.index].valueOf() < 0;
                }
                if (controllerControl.direction === "positive") {
                    return gamepad.axes[controllerControl.index].valueOf() > 0;
                }

            }
        }
        return false;

    }
}