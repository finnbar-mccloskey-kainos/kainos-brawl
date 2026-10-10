import { isKeyPressed } from "../input";
import Map from "../map/Map";
import Player from "../Player";

export default class Body {
    constructor(public readonly player: Player, public readonly map: Map) { }

    public position: { x: number; y: number; } = { x: 0, y: 0 };
    public collisionBox: { width: number; height: number; } = { width: 20, height: 20 };
    public velocity: { x: number; y: number; } = { x: 0, y: 0 };

    frame(delta: number) {
        {

            console.info(this.shouldPassthrough());

            const nextX = this.position.x + this.velocity.x * delta;
            const collisionX = this.map.getHorizontalCollisionX(this.position, nextX, this.collisionBox);

            if (collisionX !== undefined) {
                this.position.x = collisionX;
                this.velocity.x = 0;
            } else {
                this.position.x = nextX;
            }

            const nextVelocityY = this.velocity.y + 0.0003 * delta;
            const nextY = this.position.y + nextVelocityY * delta;
            const collisionY = this.map.getVerticalCollisionY(
                this.position,
                nextY,
                this.collisionBox,
                this.shouldPassthrough()
            );

            if (collisionY !== undefined) {
                this.position.y = collisionY;
                this.velocity.y = 0;
            } else {
                this.velocity.y = nextVelocityY;
                this.position.y = nextY;
            }

            const DRAG = 0.001;
            this.velocity.x -= this.velocity.x * DRAG * delta;
            this.velocity.y -= this.velocity.y * DRAG * delta;

        }
    }

    moveHorizontally(distance: number) {
        const nextX = this.position.x + distance;
        const collisionX = this.map.getHorizontalCollisionX(this.position, nextX, this.collisionBox);
        this.position.x = collisionX ?? nextX;
    }

    isOnGround() {
        return this.map.isStandingOnPlatform(
            this.position,
            this.collisionBox,
            this.shouldPassthrough()
        );
    }

    private shouldPassthrough() {
        return isKeyPressed("ArrowDown") || this.velocity.y < 0;
    }
}