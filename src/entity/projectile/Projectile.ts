import Body from "../../physics/Body";
import Game from "../../state/Game";
import boxesOverlap from "../../util/boxesOverlap";
import Entity from "../Entity";
import { isAttackable } from "../Attackable";
import ProjectilePreset from "./ProjectilePreset";
import { sounds } from "../../main";

export default class Projectile implements Entity {

    private lifetime: number = 0;

    public readonly body: Body;

    private _shouldDelete: boolean = false;

    get shouldDelete(): boolean {
        return this._shouldDelete;
    }

    constructor(
        private readonly game: Game,
        public readonly source: Entity,
        public preset: ProjectilePreset,
        private readonly image: HTMLImageElement,
        private readonly staleDamageMultiplier = 1,
        private readonly onHit?: () => void,
        private readonly chargeDamageMultiplier = 1,
    ) {
        this.body = new Body(game, { ...source.body.position }, { width: image.width, height: image.height });
    }

    render(context: CanvasRenderingContext2D): void {
        context.drawImage(this.image, this.body.position.x, this.body.position.y - this.body.collisionBoxSize.height, this.body.collisionBoxSize.width, this.body.collisionBoxSize.height);
    }

    frame(delta: number) {
        this.body.frame(delta);

        for (const entity of this.game.entities) {
            if (
                entity != this.source && isAttackable(entity) && boxesOverlap(
                    this.body.getCollisionBox(),
                    entity.body.getCollisionBox()
                )
            ) {
                sounds.projectileLand().play();
                let knockbackAngle = Math.atan2(
                    entity.body.position.y - this.body.position.y,
                    entity.body.position.x - this.body.position.x
                );
                const hitShield = "isShielding" in entity && entity.isShielding === true;
                const hit = entity.attack(
                    this.preset.damage * this.staleDamageMultiplier * this.chargeDamageMultiplier,
                    {
                        x: Math.cos(knockbackAngle) * this.preset.knockback * this.staleDamageMultiplier,
                        y: -Math.sin(knockbackAngle) * this.preset.knockback * this.staleDamageMultiplier,
                    },
                    this.preset.stunTime
                );
                if (hit) {
                    this.onHit?.();
                }
                this._shouldDelete = true;
                break;
            }
        }
        if (this.body.isOnGround() || this.lifetime > 2000) {
            this._shouldDelete = true;
        }
        this.lifetime += delta;
    }

}