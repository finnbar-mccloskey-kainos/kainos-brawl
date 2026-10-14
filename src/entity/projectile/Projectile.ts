import Body from "../../physics/Body";
import Game from "../../state/Game";
import boxesOverlap from "../../util/boxesOverlap";
import Entity from "../Entity";
import { isAttackable } from "../Attackable";
import ProjectilePreset from "./ProjectilePreset";

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
    ) {
        this.body = new Body(game, { ...source.body.position }, { width: 10, height: 10 });
    }

    render(context: CanvasRenderingContext2D): void {
        context.fillStyle = "red";
        context.fillRect(this.body.position.x, this.body.position.y - this.body.collisionBoxSize.height, this.body.collisionBoxSize.width, this.body.collisionBoxSize.height);
    }

    frame(delta: number) {
        this.body.frame(delta);

        const dbg = (fn: any, ...args: any) => {
            console.log(fn, ...args);
            const result = fn(...args);
            console.log("Result:", result);
            return result;
        };

        for (const entity of this.game.entities) {
            if (
                entity != this.source && isAttackable(entity) && boxesOverlap(
                    this.body.getCollisionBox(),
                    entity.body.getCollisionBox()
                )
            ) {
                let knockbackAngle = Math.atan2(
                    entity.body.position.y - this.body.position.y,
                    entity.body.position.x - this.body.position.x
                );
                entity.attack(this.preset.damage, { x: Math.cos(knockbackAngle) * this.preset.knockback, y: -Math.sin(knockbackAngle) * this.preset.knockback }, this.preset.stunTime);
                this._shouldDelete = true;
            }
        }
        if (this.body.isOnGround() || this.lifetime > 2000) {
            this._shouldDelete = true;
        }
        this.lifetime += delta;
    }

}