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
import increase from "../util/increase";

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
const PROJECTILE_SLOWDOWN_DELAY = 500;
const MAX_SHIELD_HEALTH = 75;
const SHIELD_DECAY_PER_SECOND = 9;
const SHIELD_REGEN_PER_SECOND = 4.8;
const SHIELD_DAMAGE_MULTIPLIER = 1.19;
const SHIELD_BREAK_LAUNCH_VELOCITY = -0.18;
const SHIELD_BREAK_STUN_DURATION = 2500;
const STALE_MOVE_REDUCTORS = [0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03345, 0.025];

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

        const movementSpeed = SPEED * (this.player.isProjectileSlowdownActive ? 0.5 : 1);
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
            const attackHitbox = boxTranslate(
                this.player.body.getCollisionBox(),
                { x: this.player.facing === "right" ? 20 : -20, y: 0 }
            );
            this.player.addAttackDebugHitbox(attackHitbox);
            for (const player of this.player.game.players) {
                if (player === this.player) continue;
                if (
                    boxesOverlap(attackHitbox, player.body.getCollisionBox())
                ) {
                    this.player.attackWithStaling(
                        player,
                        "primary",
                        this.player.character.primaryAttackStrength,
                        {
                            x: this.player.character.primaryAttackKnockback.x
                                * (this.player.facing === "right" ? 1 : -1),
                            y: this.player.character.primaryAttackKnockback.y
                        },
                        150,
                        3);
                    this.player.state = new Stunned(this.player, 500);
                }
            }
        }

        if (this.player.isControlPressed("down") && this.player.isControlPressed("secondary")) {
            this.player.state = new Downsmashing(this.player);
        }
        this.player.body.frame(delta, false, this.player.updateJumpPhysics(delta));

    }

}
export class Stunned {

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

    private startTime: number;

    constructor(public player: Player) {
        this.startTime = Date.now();
    }

    public readonly canAttack = true;

    frame(delta: number) {
        const previousY = this.player.body.position.y;
        this.player.body.velocity.y = 0.3;
        this.player.body.frame(delta);

        const hitbox = increase(this.player.body.getCollisionBox(), 20);
        // Body resolves horizontal movement first, then vertical movement.
        hitbox.topLeft.y = Math.min(hitbox.topLeft.y, previousY - this.player.body.collisionBoxSize.height - 20);
        hitbox.bottomRight.y = Math.max(hitbox.bottomRight.y, previousY + 20);
        this.player.addAttackDebugHitbox(hitbox);

        let attacked = false;

        const multiplier = (Date.now() - this.startTime) / 200;
        console.log(multiplier);

        for (const entity of this.player.game.entities) {
            if (entity != this.player && isAttackable(entity) && boxesOverlap(
                hitbox,
                entity.body.getCollisionBox()
            )) {
                let knockbackAngle = Math.atan2(
                    entity.body.position.y - this.player.body.position.y,
                    entity.body.position.x - this.player.body.position.x
                );

                const hit = this.player.attackWithStaling(entity, "downsmash", multiplier * this.player.character.downsmashStrength, { x: Math.cos(knockbackAngle) * this.player.character.downsmashKnockback * multiplier, y: -this.player.character.downsmashKnockback * multiplier }, 150);
                attacked = attacked || hit;
            }
        }

        if (this.player.body.isOnGround() || attacked) {
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

export type PlayerState = (Normal | Stunned | Downsmashing | ShieldBroken) & { get canAttack(): boolean; frame(delta: number): void; };

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
    private staleMoveHistory: { move: string; shieldFactor: number; }[] = [];
    private _attackDebugHitboxes: { topLeft: { x: number; y: number; }; bottomRight: { x: number; y: number; }; }[] = [];

    get isChargingProjectile() {
        return this.chargingProjectile;
    }

    get isProjectileSlowdownActive() {
        return this.chargingProjectile && this.projectileChargeDuration >= PROJECTILE_SLOWDOWN_DELAY;
    }

    get attackDebugHitboxes() {
        return this._attackDebugHitboxes;
    }

    addAttackDebugHitbox(hitbox: { topLeft: { x: number; y: number; }; bottomRight: { x: number; y: number; }; }) {
        this._attackDebugHitboxes.push(hitbox);
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

    get downsmashHitbox() {
        if (!(this._state instanceof Downsmashing)) {
            return undefined;
        }

        return increase(this.body.getCollisionBox(), 20);
    }

    getStaleDamageMultiplier(move: string) {
        let reduction = 0;
        for (const [index, entry] of this.staleMoveHistory.entries()) {
            if (entry.move === move) {
                reduction += STALE_MOVE_REDUCTORS[index] * entry.shieldFactor;
            }
        }
        return reduction === 0 ? 1.05 : Math.max(0, 1 - reduction);
    }

    recordStaleMove(move: string, hitShield = false) {
        this.staleMoveHistory.unshift({ move, shieldFactor: hitShield ? 0.85 : 1 });
        this.staleMoveHistory.length = Math.min(this.staleMoveHistory.length, STALE_MOVE_REDUCTORS.length);
    }

    attackWithStaling(target: Attackable, move: string, damage: number, knockback: { x: number, y: number; }, stunTime: number, knockbackMultiplier = 1) {
        const multiplier = this.getStaleDamageMultiplier(move);
        const hitShield = target instanceof Player && target.isShielding;
        const hit = target.attack(
            damage * multiplier,
            { x: knockback.x * multiplier * knockbackMultiplier, y: knockback.y * multiplier * knockbackMultiplier },
            stunTime
        );
        if (hit) {
            this.recordStaleMove(move, hitShield);
        }
        return hit;
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
        this._attackDebugHitboxes = [];
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

    attack(damage: number, knockback: { x: number, y: number; }, stunTime: number): boolean {
        if (this._state instanceof ShieldBroken) {
            if (!this._state.hasLanded) return false;
            this.shieldHealth = MAX_SHIELD_HEALTH * 0.75;
            this.applyDamage(damage, knockback, stunTime);
            return true;
        }

        if (this.isShielding) {
            this.shieldHealth = Math.max(0, this.shieldHealth - damage * SHIELD_DAMAGE_MULTIPLIER);
            if (this.shieldHealth === 0) {
                this.breakShield();
            }
            return true;
        }

        if (this._state.canAttack) {
            this.applyDamage(damage, knockback, stunTime);
            return true;
        }
        return false;
    }

    render(context: CanvasRenderingContext2D) {
        if (this.isShielding) {
            this.renderShield(context);
        }

        context.save();
        if (this._state instanceof ShieldBroken) {
            context.filter = "brightness(0.8)";
        }
        this.character.render(this._state, context, { x: this.body.position.x, y: this.body.position.y }, this.facing);
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
        const projectile = new Projectile(
            this.game,
            this,
            this.character.projectilePreset,
            this.getStaleDamageMultiplier("projectile"),
            hitShield => this.recordStaleMove("projectile", hitShield),
            1 + chargeRatio
        );
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
        const knockbackScale = (this.percentage + 20) / 100;
        this.body.velocity = {
            x: this.body.velocity.x + knockback.x * knockbackScale,
            y: this.body.velocity.y + knockback.y * knockbackScale,
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