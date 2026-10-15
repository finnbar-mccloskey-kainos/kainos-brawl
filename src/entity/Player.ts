import Character from "../character/Character";
import Entity from "./Entity";
import { emit } from "../events";
import { gamepad, isKeyPressed } from "../input";
import Body, { REALISTIC_DRAG, REALISTIC_GRAVITY } from "../physics/Body";
import Game from "../state/Game";
import boxesOverlap from "../util/boxesOverlap";
import boxTranslate from "../util/boxTranslate";
import Attackable from "./Attackable";
import Projectile from "./projectile/Projectile";

export type Control = {
    keyboard: string;
    controller: { type: "button", index: number; } | { type: "axis", direction: "positive" | "negative", index: number; };
};

export type Controls = {
    left: Control,
    right: Control,
    up: Control,
    down: Control;
    primary: Control;
    secondary: Control;
};

type ProjectileChargeState =
    | { type: "idle"; }
    | { type: "charging"; duration: number; };

const CONTROLLER_DEADZONE = 0.15;
const MAX_JUMP_HOLD_DURATION = 280;
const HELD_JUMP_GRAVITY_SCALE = 0.45;
const SHORT_HOP_VELOCITY_SCALE = 0.45;
const LANDING_FRICTION_DURATION = 120;
const MAX_PROJECTILE_CHARGE_DURATION = 3000;

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
        this.body = new Body(game, { x: 100, y: 0 }, this.character.collisionBox, { x: 0, y: 0 }, REALISTIC_DRAG, REALISTIC_GRAVITY, () => this.isControlPressed("down"), LANDING_FRICTION_DURATION);
    }

    private stunTime: number = 0;
    private airJumpUsed = false;
    private jumpHeldLastFrame = false;
    private jumpHoldDuration = 0;
    private projectileChargeState: ProjectileChargeState = { type: "idle" };
    private secondaryHeldLastFrame = false;

    get isChargingProjectile() {
        return this.projectileChargeState.type === "charging";
    }

    get projectileChargeRatio() {
        return this.projectileChargeState.type === "charging"
            ? this.projectileChargeState.duration / MAX_PROJECTILE_CHARGE_DURATION
            : 0;
    }

    private fireProjectile(chargeRatio: number) {
        const projectile = new Projectile(this.game, this, this.character.projectilePreset);
        projectile.body.position = {
            x: this.facing === "right"
                ? this.body.position.x + this.body.collisionBoxSize.width
                : this.body.position.x - projectile.body.collisionBoxSize.width,
            y: this.body.position.y - 5,
        };
        projectile.body.gravity *= 1 - chargeRatio;
        projectile.body.velocity = {
            x: this.facing === "right" ? 0.3 : -0.3,
            y: -0.2 * (1 - chargeRatio),
        };
        this.game.entities.push(projectile);
        this.stunTime = 500;
    }

    frame(delta: number) {
        const SPEED = 0.1;
        const secondaryHeld = this.isControlPressed("secondary");
        const secondaryPressed = secondaryHeld && !this.secondaryHeldLastFrame;
        const secondaryReleased = !secondaryHeld && this.secondaryHeldLastFrame;
        this.secondaryHeldLastFrame = secondaryHeld;
        const jumpHeld = this.isControlPressed("up");
        const jumpPressed = jumpHeld && !this.jumpHeldLastFrame;
        const jumpReleased = !jumpHeld && this.jumpHeldLastFrame;
        this.jumpHeldLastFrame = jumpHeld;
        const grounded = this.body.isOnGround();

        if (grounded) {
            this.airJumpUsed = false;
        }

        if (this.projectileChargeState.type === "idle" && secondaryPressed && this.stunTime <= 0) {
            this.projectileChargeState = { type: "charging", duration: 0 };
        }

        if (this.projectileChargeState.type === "charging") {
            if (secondaryHeld && this.stunTime <= 0) {
                const duration = Math.min(
                    MAX_PROJECTILE_CHARGE_DURATION,
                    this.projectileChargeState.duration + delta
                );
                if (duration >= MAX_PROJECTILE_CHARGE_DURATION) {
                    this.fireProjectile(1);
                    this.projectileChargeState = { type: "idle" };
                } else {
                    this.projectileChargeState = { type: "charging", duration };
                }
            } else if (secondaryReleased) {
                if (this.stunTime <= 0) {
                    this.fireProjectile(this.projectileChargeRatio);
                }
                this.projectileChargeState = { type: "idle" };
            }
        }

        if (this.stunTime > 0) {
            this.stunTime -= delta;
            this.body.frame(delta, true);
        } else {
            const leftStrength = this.getControlStrength("left");
            const rightStrength = this.getControlStrength("right");
            if (leftStrength > 0) {
                this.body.moveHorizontally(-SPEED * delta * leftStrength);
                this.facing = "left";
            }
            if (rightStrength > 0) {
                this.body.moveHorizontally(SPEED * delta * rightStrength);
                this.facing = "right";
            }
            if (jumpPressed && (grounded || !this.airJumpUsed)) {
                this.body.velocity = { x: this.body.velocity.x, y: -0.25 };
                if (!grounded) {
                    this.airJumpUsed = true;
                }
                this.jumpHoldDuration = 0;
            }

            if (this.isControlPressed("primary")) {
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

            if (jumpReleased && this.body.velocity.y < 0 && this.jumpHoldDuration < MAX_JUMP_HOLD_DURATION) {
                this.body.velocity = { x: this.body.velocity.x, y: this.body.velocity.y * SHORT_HOP_VELOCITY_SCALE };
            }

            const holdingJumpAscent = jumpHeld && this.body.velocity.y < 0 && this.jumpHoldDuration < MAX_JUMP_HOLD_DURATION;
            if (holdingJumpAscent) {
                this.jumpHoldDuration = Math.min(MAX_JUMP_HOLD_DURATION, this.jumpHoldDuration + delta);
            }
            this.body.frame(delta, false, holdingJumpAscent ? HELD_JUMP_GRAVITY_SCALE : 1);
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

    isControlPressed(control: keyof typeof this.controls): boolean {
        return this.getControlStrength(control) > 0;
    }

    private getControlStrength(control: keyof typeof this.controls): number {
        if (isKeyPressed(this.controls[control].keyboard)) {
            return 1;
        }

        if (!gamepad) {
            return 0;
        }

        const controllerControl = this.controls[control].controller;
        if (controllerControl.type === "button") {
            return gamepad.buttons[controllerControl.index]?.pressed ? 1 : 0;
        }

        const axisValue = gamepad.axes[controllerControl.index] ?? 0;
        const displacement = controllerControl.direction === "negative" ? -axisValue : axisValue;
        if (displacement <= CONTROLLER_DEADZONE) {
            return 0;
        }

        return Math.min(1, (displacement - CONTROLLER_DEADZONE) / (1 - CONTROLLER_DEADZONE));
    }
}
