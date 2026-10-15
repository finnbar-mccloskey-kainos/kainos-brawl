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
    shield: Control;
};

const CONTROLLER_DEADZONE = 0.15;
const MAX_JUMP_HOLD_DURATION = 280;
const HELD_JUMP_GRAVITY_SCALE = 0.45;
const SHORT_HOP_VELOCITY_SCALE = 0.45;
const LANDING_FRICTION_DURATION = 120;
const MAX_PROJECTILE_CHARGE_DURATION = 3000;
const MAX_SHIELD_HEALTH = 50;
const SHIELD_DECAY_PER_SECOND = 9;
const SHIELD_REGEN_PER_SECOND = 4.8;
const SHIELD_DAMAGE_MULTIPLIER = 1.19;
const SHIELD_BREAK_LAUNCH_VELOCITY = -0.18;
const SHIELD_BREAK_STUN_DURATION = 2500;

class Normal {

    constructor(private player: Player) { }

    public readonly canAttack = true;

    frame(delta: number) {
        const SPEED = 0.1;
        const grounded = this.player.body.isOnGround();
        if (this.player.jumpPressedThisFrame && this.player.canJump(grounded)) {
            this.player.startJump(grounded);
        }

        if (this.player.isShielding && !(grounded && this.player.jumpPressedThisFrame)) {
            this.player.body.velocity.x = 0;
            this.player.body.frame(delta, true);
            return;
        }

        const movementSpeed = SPEED * (this.player.isChargingProjectile ? 0.5 : 1);
        const leftStrength = this.player.getControlStrength("left");
        const rightStrength = this.player.getControlStrength("right");
        if (leftStrength > 0) {
            this.player.body.moveHorizontally(-movementSpeed * delta * leftStrength);
            this.player.facing = "left";
        }
        if (rightStrength > 0) {
            this.player.body.moveHorizontally(movementSpeed * delta * rightStrength);
            this.player.facing = "right";
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

        if (this.player.isControlPressed("down") && this.player.isControlPressed("secondary")) {
            this.player.state = new Downsmashing(this.player);
        }
        this.player.body.frame(delta, false, this.player.updateJumpPhysics(delta));

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
            const duration = Date.now() - this.startTime;
            const multiplier = Math.min(duration / 500, 1);
            this.player.body.gravity = this.originalGravity;
            for (const entity of this.player.game.entities) {
                if (entity !== this.player && isAttackable(entity) && boxesOverlap(
                    this.player.body.getCollisionBox(),
                    entity.body.getCollisionBox()
                )) {
                    const knockbackAngle = Math.atan2(
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

class ShieldBroken {
    public readonly canAttack = false;
    public hasLanded = false;
    private stunTime = 0;

    constructor(private readonly player: Player) {
        this.player.body.velocity = { x: 0, y: SHIELD_BREAK_LAUNCH_VELOCITY };
    }

    frame(delta: number) {
        const wasGrounded = this.player.body.isOnGround();
        this.player.body.velocity.x = 0;
        this.player.body.frame(delta, true);

        if (!this.hasLanded && !wasGrounded && this.player.body.isOnGround()) {
            this.hasLanded = true;
            this.stunTime = SHIELD_BREAK_STUN_DURATION;
        } else if (this.hasLanded) {
            this.stunTime -= delta;
            if (this.stunTime <= 0) {
                this.player.recoverShieldAfterBreak();
            }
        }
    }
}

type PlayerState = (Normal | Stunned | Downsmashing | ShieldBroken) & { get canAttack(): boolean; frame(delta: number): void; };

export default class Player implements Entity, Attackable {

    private _percentage: number = 0;

    public facing: "left" | "right" = "right";

    public readonly body: Body;
    private _state: PlayerState;
    private airJumpUsed = false;
    private jumpHeldLastFrame = false;
    private jumpReleasedThisFrame = false;
    public jumpPressedThisFrame = false;
    private jumpHoldDuration = 0;
    private chargingProjectile = false;
    private projectileChargeDuration = 0;
    private secondaryHeldLastFrame = false;
    private shieldHealth = MAX_SHIELD_HEALTH;

    get isChargingProjectile() {
        return this.chargingProjectile;
    }

    get projectileChargeRatio() {
        return this.projectileChargeDuration / MAX_PROJECTILE_CHARGE_DURATION;
    }

    get isShielding() {
        return this._state instanceof Normal && this.shieldHealth > 0 && this.body.isOnGround() && this.isControlPressed("shield");
    }

    get shieldHealthRatio() {
        return this.shieldHealth / MAX_SHIELD_HEALTH;
    }

    constructor(
        public readonly game: Game,
        public readonly name: string,
        public readonly controls: Controls,
        public readonly character: Character
    ) {
        this._state = new Normal(this);
        this.body = new Body(game, { x: 100, y: 0 }, this.character.collisionBox, { x: 0, y: 0 }, REALISTIC_DRAG, REALISTIC_GRAVITY, () => this.isControlPressed("down"), LANDING_FRICTION_DURATION);
    }

    get state() {
        return this._state;
    }

    set state(value: PlayerState) {
        this._state = value;
    }

    frame(delta: number) {
        const jumpHeld = this.isControlPressed("up");
        this.jumpPressedThisFrame = jumpHeld && !this.jumpHeldLastFrame;
        this.jumpReleasedThisFrame = !jumpHeld && this.jumpHeldLastFrame;
        this.jumpHeldLastFrame = jumpHeld;

        this.updateShield(delta);
        if (this._state instanceof Normal) {
            this.updateProjectileCharge(delta);
        }
        this._state.frame(delta);
    }

    attack(damage: number, knockback: { x: number, y: number; }, stunTime: number) {
        if (this._state instanceof ShieldBroken) {
            if (!this._state.hasLanded) return;
            this.shieldHealth = MAX_SHIELD_HEALTH * 0.75;
            this.applyDamage(damage, knockback, stunTime);
            return;
        }

        if (this.isShielding) {
            this.shieldHealth = Math.max(0, this.shieldHealth - damage * SHIELD_DAMAGE_MULTIPLIER);
            if (this.shieldHealth === 0) {
                this.breakShield();
            }
            return;
        }

        if (this._state.canAttack) {
            this.applyDamage(damage, knockback, stunTime);
        }
    }

    render(context: CanvasRenderingContext2D) {
        if (this.isShielding) {
            this.renderShield(context);
        }

        context.save();
        if (this._state instanceof ShieldBroken) {
            context.filter = "brightness(0.8)";
        }
        this.character.render(context, { x: this.body.position.x, y: this.body.position.y }, this.facing);
        context.restore();
    }

    getControlStrength(control: keyof typeof this.controls): number {
        if (isKeyPressed(this.controls[control].keyboard)) {
            return 1;
        }

        if (!gamepad) {
            return 0;
        }

        const mapping = this.controls[control].controller;
        if (mapping.type === "button") {
            return gamepad.buttons[mapping.index]?.pressed ? 1 : 0;
        }

        const axisValue = gamepad.axes[mapping.index] ?? 0;
        const displacement = mapping.direction === "negative" ? -axisValue : axisValue;
        if (displacement <= CONTROLLER_DEADZONE) {
            return 0;
        }
        return Math.min(1, (displacement - CONTROLLER_DEADZONE) / (1 - CONTROLLER_DEADZONE));
    }

    canJump(grounded: boolean) {
        if (grounded) {
            this.airJumpUsed = false;
        }
        return grounded || !this.airJumpUsed;
    }

    startJump(grounded: boolean) {
        this.body.velocity.y = -0.25;
        if (!grounded) {
            this.airJumpUsed = true;
        }
        this.jumpHoldDuration = 0;
    }

    updateJumpPhysics(delta: number) {
        if (this.jumpReleasedThisFrame && this.body.velocity.y < 0 && this.jumpHoldDuration < MAX_JUMP_HOLD_DURATION) {
            this.body.velocity.y *= SHORT_HOP_VELOCITY_SCALE;
        }

        const holdingAscent = this.isControlPressed("up") && this.body.velocity.y < 0 && this.jumpHoldDuration < MAX_JUMP_HOLD_DURATION;
        if (holdingAscent) {
            this.jumpHoldDuration = Math.min(MAX_JUMP_HOLD_DURATION, this.jumpHoldDuration + delta);
        }
        return holdingAscent ? HELD_JUMP_GRAVITY_SCALE : 1;
    }

    recoverShieldAfterBreak() {
        this.shieldHealth = MAX_SHIELD_HEALTH * 0.75;
        this._state = new Normal(this);
    }

    private updateShield(delta: number) {
        if (this._state instanceof ShieldBroken) {
            return;
        }

        const groundedJumpingOut = this.body.isOnGround() && this.jumpPressedThisFrame;
        if (this.isShielding && !groundedJumpingOut) {
            this.shieldHealth = Math.max(0, this.shieldHealth - SHIELD_DECAY_PER_SECOND * delta / 1000);
            if (this.shieldHealth === 0) {
                this.breakShield();
            }
        } else {
            this.shieldHealth = Math.min(MAX_SHIELD_HEALTH, this.shieldHealth + SHIELD_REGEN_PER_SECOND * delta / 1000);
        }
    }

    private updateProjectileCharge(delta: number) {
        const secondaryHeld = this.isControlPressed("secondary");
        const secondaryPressed = secondaryHeld && !this.secondaryHeldLastFrame;
        const secondaryReleased = !secondaryHeld && this.secondaryHeldLastFrame;
        this.secondaryHeldLastFrame = secondaryHeld;

        if (!this.chargingProjectile && secondaryPressed && !this.isControlPressed("down") && !this.isShielding) {
            this.chargingProjectile = true;
            this.projectileChargeDuration = 0;
        }
        if (!this.chargingProjectile) {
            return;
        }

        if (secondaryHeld) {
            this.projectileChargeDuration = Math.min(MAX_PROJECTILE_CHARGE_DURATION, this.projectileChargeDuration + delta);
        } else if (secondaryReleased) {
            this.fireProjectile(this.projectileChargeRatio);
        }
    }

    private fireProjectile(chargeRatio: number) {
        this.chargingProjectile = false;
        this.projectileChargeDuration = 0;
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
        this._state = new Stunned(this, 500);
    }

    private breakShield() {
        this._state = new ShieldBroken(this);
    }

    private applyDamage(damage: number, knockback: { x: number, y: number; }, stunTime: number) {
        this.percentage += damage;
        this.body.velocity = {
            x: this.body.velocity.x + knockback.x * (this.percentage / 100),
            y: this.body.velocity.y + knockback.y * (this.percentage / 100),
        };
        this._state = new Stunned(this, stunTime);
    }

    private renderShield(context: CanvasRenderingContext2D) {
        const pixelSize = 3;
        const radius = 18 + this.shieldHealthRatio * 12;
        const centerX = this.body.position.x + this.body.collisionBoxSize.width / 2;
        const centerY = this.body.position.y - this.body.collisionBoxSize.height / 2;
        const gridRadius = Math.ceil(radius / pixelSize);
        const isPlayerOne = this.name === "Player 1";
        const fillColor = isPlayerOne ? "rgba(55, 145, 255, 0.14)" : "rgba(255, 65, 82, 0.14)";
        const edgeColor = isPlayerOne ? "#66baff" : "#ff7882";

        for (let gridY = -gridRadius; gridY <= gridRadius; gridY++) {
            for (let gridX = -gridRadius; gridX <= gridRadius; gridX++) {
                const distance = Math.hypot(gridX * pixelSize, gridY * pixelSize);
                if (distance > radius) continue;
                context.fillStyle = distance >= radius - pixelSize * 1.5 ? edgeColor : fillColor;
                context.fillRect(centerX + gridX * pixelSize, centerY + gridY * pixelSize, pixelSize, pixelSize);
            }
        }
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
}