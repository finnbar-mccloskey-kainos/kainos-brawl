import Character from "../character/Character";
import Entity from "./Entity";
import { emit } from "../events";
import { gamepad, isKeyPressed } from "../input";
import Body, { REALISTIC_DRAG, REALISTIC_GRAVITY } from "../physics/Body";
import Game from "../state/Game";
import boxesOverlap from "../util/boxesOverlap";
import boxTranslate from "../util/boxTranslate";
import Attackable, { isAttackable, type KnockbackProfile } from "./Attackable";
import Projectile from "./projectile/Projectile";
import increase from "../util/increase";
import { sounds } from "../main";

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
const PROJECTILE_CHARGE_START_DELAY = 150;
const PROJECTILE_SLOWDOWN_DELAY = 500;
const MAX_SHIELD_HEALTH = 75;
const SHIELD_DECAY_PER_SECOND = 9;
const SHIELD_REGEN_PER_SECOND = 4.8;
const SHIELD_DAMAGE_MULTIPLIER = 1.19;
const SHIELD_BREAK_LAUNCH_VELOCITY = -0.18;
const SHIELD_BREAK_STUN_DURATION = 2500;
const RESPAWN_INVINCIBILITY_DURATION = 3000;
const DOWNSMASH_EFFECT_FRAME_ENDS = [100, 230, 380, 510, 610, 660];
const DOWNSMASH_EFFECT_BASELINES = [25, 26, 27, 26, 28, 25];
const downsmashEffectImage = new Image();
downsmashEffectImage.src = "/downsmash.png";
const STALE_MOVE_REDUCTORS = [0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03345, 0.025];

class Normal {

    constructor(private player: Player) { }

    public readonly canAttack = true;

    frame(delta: number) {
        const SPEED = 0.15;
        const grounded = this.player.body.isOnGround();

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

        if (!this.player.isPreparingProjectile && this.player.isControlPressed("primary")) {
            if (this.player.primaryPressedThisFrame) {
                sounds.melee().play();
            }

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
                            y: -Math.abs(this.player.character.primaryAttackKnockback.y)
                        },
                        150,
                        12);
                    this.player.state = new Stunned(this.player, 500);
                }
            }
        }

        if (this.player.isControlPressed("down") && this.player.isControlPressed("secondary")) {
            this.player.startDownsmash();
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
        player.queueDownsmashLandingEffect();
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

        const landed = this.player.body.isOnGround();
        if (landed || attacked) {
            sounds.downsmash().play();
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

    public stocks = 3;

    public facing: "left" | "right" = "right";

    private projectileIcon: HTMLImageElement;

    public readonly body: Body;
    private _state: PlayerState;
    private airJumpUsed = false;
    private jumpHeldLastFrame = false;
    private jumpReleasedThisFrame = false;
    public jumpPressedThisFrame = false;
    private jumpHoldDuration = 0;
    private primaryHeldLastFrame = false;
    private primaryBlockedUntilRelease = false;
    public primaryPressedThisFrame = false;
    private chargingProjectile = false;
    private projectileChargeDuration = 0;
    private secondaryHeldLastFrame = false;
    private downsmashBlockedUntilRelease = false;
    private shieldHealth = MAX_SHIELD_HEALTH;
    private respawnInvincibilityRemaining = 0;
    private upwardKnockbackActive = false;
    private downsmashEffect?: { x: number; y: number; elapsed: number; };
    private downsmashLandingPending = false;
    private staleMoveHistory: { move: string; shieldFactor: number; }[] = [];
    private _attackDebugHitboxes: { topLeft: { x: number; y: number; }; bottomRight: { x: number; y: number; }; }[] = [];

    get isPreparingProjectile() {
        return this.chargingProjectile;
    }

    get isChargingProjectile() {
        return this.chargingProjectile && this.projectileChargeDuration >= PROJECTILE_CHARGE_START_DELAY;
    }

    get isInvincible() {
        return this.respawnInvincibilityRemaining > 0;
    }

    get canBeKOdFromTop() {
        return this.upwardKnockbackActive;
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

    queueDownsmashLandingEffect() {
        this.downsmashLandingPending = true;
    }

    startDownsmash() {
        if (this.downsmashBlockedUntilRelease || this.chargingProjectile) return;
        this.downsmashBlockedUntilRelease = true;
        this._state = new Downsmashing(this);
    }

    private startDownsmashLandingEffect() {
        this.downsmashLandingPending = false;
        this.downsmashEffect = {
            x: this.body.position.x + this.body.collisionBoxSize.width / 2,
            y: this.body.position.y,
            elapsed: 0,
        };
    }

    get projectileChargeRatio() {
        return this.isChargingProjectile ? this.projectileChargeDuration / MAX_PROJECTILE_CHARGE_DURATION : 0;
    }

    get isShielding() {
        return !this.chargingProjectile && this._state instanceof Normal && this.shieldHealth > 0 && this.body.isOnGround() && this.isControlPressed("shield");
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
            stunTime,
            move === "primary" ? { base: 15, scaling: 0.5 } : undefined
        );
        if (hit) {
            this.recordStaleMove(move, hitShield);
            if (move === "primary") {
                sounds.punch().play();
            }
        }
        return hit;
    }

    constructor(
        public readonly game: Game,
        public readonly name: string,
        public readonly controls: Controls,
        public readonly character: Character
    ) {
        this.projectileIcon = new Image();
        this.projectileIcon.src = this.character.projectilePreset.image;
        this._state = new Normal(this);
        this.body = new Body(game, { x: 100, y: 0 }, this.character.collisionBox, { x: 0, y: 0 }, REALISTIC_DRAG, REALISTIC_GRAVITY, () => this.isControlPressed("down"), LANDING_FRICTION_DURATION);
        this.primaryBlockedUntilRelease = this.getControlStrength("primary") > 0;
    }

    get state() {
        return this._state;
    }

    set state(value: PlayerState) {
        this._state = value;
    }

    frame(delta: number) {
        this.respawnInvincibilityRemaining = Math.max(0, this.respawnInvincibilityRemaining - delta);
        if (!this.isControlPressed("secondary")) {
            this.downsmashBlockedUntilRelease = false;
        }
        this._attackDebugHitboxes = [];
        if (this.downsmashEffect && downsmashEffectImage.complete && downsmashEffectImage.naturalWidth > 0) {
            this.downsmashEffect.elapsed += delta;
            if (this.downsmashEffect.elapsed >= 660) {
                this.downsmashEffect = undefined;
            }
        }
        const jumpHeld = this.isControlPressed("up");
        this.jumpPressedThisFrame = jumpHeld && !this.jumpHeldLastFrame;
        this.jumpReleasedThisFrame = !jumpHeld && this.jumpHeldLastFrame;
        this.jumpHeldLastFrame = jumpHeld;
        const primaryHeld = this.isControlPressed("primary");
        this.primaryPressedThisFrame = primaryHeld && !this.primaryHeldLastFrame;
        this.primaryHeldLastFrame = primaryHeld;

        this.updateShield(delta);
        if (this._state instanceof Normal) {
            const grounded = this.body.isOnGround();
            if (this.jumpPressedThisFrame && this.canJump(grounded)) {
                this.startJump(grounded);
            }
            this.updateProjectileCharge(delta);
        }
        this._state.frame(delta);
        if (this.downsmashLandingPending && this.body.isOnGround()) {
            this.startDownsmashLandingEffect();
        }
        if (this.body.velocity.y >= 0) {
            this.upwardKnockbackActive = false;
        }
    }

    attack(damage: number, knockback: { x: number, y: number; }, stunTime: number, knockbackProfile?: KnockbackProfile): boolean {
        if (this.isInvincible) return false;

        if (this._state instanceof ShieldBroken) {
            if (!this._state.hasLanded) return false;
            this.shieldHealth = MAX_SHIELD_HEALTH * 0.75;
            this.applyDamage(damage, knockback, stunTime, knockbackProfile);
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
            this.applyDamage(damage, knockback, stunTime, knockbackProfile);
            return true;
        }
        return false;
    }

    render(context: CanvasRenderingContext2D) {
        if (this.isShielding) {
            this.renderShield(context);
        }

        context.save();
        if (this.isInvincible && Math.floor(this.respawnInvincibilityRemaining / 100) % 2 === 0) {
            context.globalAlpha = 0.4;
        }
        if (this._state instanceof ShieldBroken) {
            context.filter = "brightness(0.8)";
        }
        this.character.render(this._state, context, { x: this.body.position.x, y: this.body.position.y }, this.facing);
        context.restore();

        if (this.downsmashEffect && downsmashEffectImage.complete && downsmashEffectImage.naturalWidth > 0) {
            const frame = DOWNSMASH_EFFECT_FRAME_ENDS.findIndex(end => this.downsmashEffect!.elapsed < end);
            context.drawImage(
                downsmashEffectImage,
                frame * 50, 0, 50, 30,
                this.downsmashEffect.x - 25,
                this.downsmashEffect.y - DOWNSMASH_EFFECT_BASELINES[frame],
                50, 30
            );
        }
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
        this.downsmashLandingPending = false;
        this.upwardKnockbackActive = false;
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

        const jumpHeld = this.isControlPressed("up");
        const holdingAscent = jumpHeld && this.body.velocity.y < 0 && this.jumpHoldDuration < MAX_JUMP_HOLD_DURATION;
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
        sounds.projectileLaunch().play();
        const projectile = new Projectile(
            this.game,
            this,
            this.character.projectilePreset,
            this.projectileIcon,
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
        this.downsmashLandingPending = false;
        this.upwardKnockbackActive = false;
        this._state = new ShieldBroken(this);
    }

    private applyDamage(damage: number, knockback: { x: number, y: number; }, stunTime: number, knockbackProfile: KnockbackProfile = { base: 20, scaling: 1 }) {
        this.downsmashLandingPending = false;
        this.percentage += damage;
        const knockbackScale = (this.percentage * knockbackProfile.scaling + knockbackProfile.base) / 100;
        this.body.velocity = {
            x: this.body.velocity.x + knockback.x * knockbackScale,
            y: this.body.velocity.y + knockback.y * knockbackScale,
        };
        this.upwardKnockbackActive = knockback.y < 0 && this.body.velocity.y < 0;
        this._state = new Stunned(this, stunTime);
    }

    loseStock() {
        this.stocks = Math.max(0, this.stocks - 1);
        this.percentage = 0;
        return this.stocks;
    }

    respawn(position: { x: number; y: number; }) {
        this.upwardKnockbackActive = false;
        this.downsmashEffect = undefined;
        this.downsmashLandingPending = false;
        this.respawnInvincibilityRemaining = RESPAWN_INVINCIBILITY_DURATION;
        this.body.position = position;
        this.body.velocity = { x: 0, y: 0 };
        this.shieldHealth = MAX_SHIELD_HEALTH;
        this.chargingProjectile = false;
        this.projectileChargeDuration = 0;
        this.airJumpUsed = false;
        this._state = new Normal(this);
    }

    private renderShield(context: CanvasRenderingContext2D) {
        const pixelSize = 3;
        const radius = 18 + this.shieldHealthRatio * 12;
        const centerX = this.body.position.x + this.body.collisionBoxSize.width / 2;
        const centerY = this.body.position.y - this.body.collisionBoxSize.height / 2;
        const gridRadius = Math.ceil(radius / pixelSize);
        const isPlayerOne = this.name === "Player 1";
        const fillColor = isPlayerOne ? "rgba(21, 84, 163, 0.14)" : "rgba(46, 179, 83, 0.14)";
        const edgeColor = isPlayerOne ? "#4c91d4" : "#2eb353";

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
        const pressed = this.getControlStrength(control) > 0;
        if (control === "primary" && this.primaryBlockedUntilRelease) {
            this.primaryBlockedUntilRelease = pressed;
            return false;
        }
        return pressed;
    }
}