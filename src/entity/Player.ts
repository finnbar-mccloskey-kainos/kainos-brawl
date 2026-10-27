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
const MAX_SHIELD_HEALTH = 75;
const RESPAWN_INVINCIBILITY_DURATION = 3000;
const downsmashEffectImage = new Image();
downsmashEffectImage.src = "/downsmash.png";
const STALE_MOVE_REDUCTORS = [0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03345, 0.025];

class Normal {

    constructor(private player: Player) { }

    public readonly canAttack = true;

    frame(delta: number) {
        const SPEED = 0.15;

        if ((this.player.body.isOnGround() && this.player.jumpPressedThisFrame)) {
            this.player.body.velocity.x = 0;
            this.player.body.frame(delta, true);
            return;
        }

        const leftStrength = this.player.getControlStrength("left");
        const rightStrength = this.player.getControlStrength("right");
        if (leftStrength > 0) {
            this.player.body.moveHorizontally(-SPEED * delta * leftStrength);
            this.player.facing = "left";
        }
        if (rightStrength > 0) {
            this.player.body.moveHorizontally(SPEED * delta * rightStrength);
            this.player.facing = "right";
        }

        if (this.player.getControlStrength("primary") > 0) {
            sounds.melee().play();

            const attackHitbox = boxTranslate(
                this.player.body.getCollisionBox(),
                { x: this.player.facing === "right" ? 20 : -20, y: 0 }
            );
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

        if (this.player.getControlStrength("down") > 0 && this.player.getControlStrength("secondary") > 0) {
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

export type PlayerState = (Normal | Stunned | Downsmashing) & { get canAttack(): boolean; frame(delta: number): void; };

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

    private respawnInvincibilityRemaining = 0;
    private staleMoveHistory: string[] = [];

    private upwardKnockbackActive = false;

    get canBeKOdFromTop() {
        return this.upwardKnockbackActive;
    }

    getStaleDamageMultiplier(move: string) {
        let reduction = 0;
        for (const [index, entry] of this.staleMoveHistory.entries()) {
            if (entry === move) {
                reduction += STALE_MOVE_REDUCTORS[index];
            }
        }
        return reduction === 0 ? 1.05 : Math.max(0, 1 - reduction);
    }

    recordStaleMove(move: string) {
        this.staleMoveHistory.unshift(move);
        this.staleMoveHistory.length = Math.min(this.staleMoveHistory.length, STALE_MOVE_REDUCTORS.length);
    }

    attackWithStaling(target: Attackable, move: string, damage: number, knockback: { x: number, y: number; }, stunTime: number, knockbackMultiplier = 1) {
        const multiplier = this.getStaleDamageMultiplier(move);
        const hit = target.attack(
            damage * multiplier,
            { x: knockback.x * multiplier * knockbackMultiplier, y: knockback.y * multiplier * knockbackMultiplier },
            stunTime,
            move === "primary" ? { base: 15, scaling: 0.5 } : undefined
        );
        if (hit) {
            this.recordStaleMove(move);
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
        this.body = new Body(game, { x: 100, y: 0 }, this.character.collisionBox, { x: 0, y: 0 }, REALISTIC_DRAG, REALISTIC_GRAVITY, () => this.getControlStrength("down") > 0, LANDING_FRICTION_DURATION);
    }

    get state() {
        return this._state;
    }

    set state(value: PlayerState) {
        this._state = value;
    }

    frame(delta: number) {
        this.respawnInvincibilityRemaining = Math.max(0, this.respawnInvincibilityRemaining - delta);

        const jumpHeld = this.getControlStrength("up") > 0;
        this.jumpPressedThisFrame = jumpHeld && !this.jumpHeldLastFrame;
        this.jumpReleasedThisFrame = !jumpHeld && this.jumpHeldLastFrame;
        this.jumpHeldLastFrame = jumpHeld;

        if (this._state instanceof Normal) {
            const grounded = this.body.isOnGround();
            if (this.jumpPressedThisFrame && this.canJump(grounded)) {
                this.startJump(grounded);
            }
        }
        this._state.frame(delta);

        if (this.body.velocity.y >= 0) {
            this.upwardKnockbackActive = false;
        }
    }

    attack(damage: number, knockback: { x: number, y: number; }, stunTime: number, knockbackProfile?: KnockbackProfile): boolean {
        if (this._state.canAttack) {
            this.applyDamage(damage, knockback, stunTime, knockbackProfile);
            return true;
        }
        return false;
    }

    render(context: CanvasRenderingContext2D) {
        context.save();
        if (this.respawnInvincibilityRemaining > 0 && Math.floor(this.respawnInvincibilityRemaining / 100) % 2 === 0) {
            context.globalAlpha = 0.4;
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

        const jumpHeld = this.getControlStrength("up") > 1;
        const holdingAscent = jumpHeld && this.body.velocity.y < 0 && this.jumpHoldDuration < MAX_JUMP_HOLD_DURATION;
        if (holdingAscent) {
            this.jumpHoldDuration = Math.min(MAX_JUMP_HOLD_DURATION, this.jumpHoldDuration + delta);
        }
        return holdingAscent ? HELD_JUMP_GRAVITY_SCALE : 1;
    }

    private fireProjectile(chargeRatio: number) {
        sounds.projectileLaunch().play();
        const projectile = new Projectile(
            this.game,
            this,
            this.character.projectilePreset,
            this.projectileIcon,
            this.getStaleDamageMultiplier("projectile"),
            () => this.recordStaleMove("projectile"),
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

    private applyDamage(damage: number, knockback: { x: number, y: number; }, stunTime: number, knockbackProfile: KnockbackProfile = { base: 20, scaling: 1 }) {
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
        this.respawnInvincibilityRemaining = RESPAWN_INVINCIBILITY_DURATION;
        this.body.position = position;
        this.body.velocity = { x: 0, y: 0 };
        this.airJumpUsed = false;
        this._state = new Normal(this);
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