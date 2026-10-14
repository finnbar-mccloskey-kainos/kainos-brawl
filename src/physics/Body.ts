import Game from "../state/Game";

export const REALISTIC_DRAG = 0.001;
export const REALISTIC_GRAVITY = 0.0003;

export default class Body {
    constructor(
        private game: Game,
        public position: { x: number; y: number; },
        public collisionBoxSize: { width: number; height: number; },
        public velocity: { x: number; y: number; } = { x: 0, y: 0 },
        public drag: number = REALISTIC_DRAG,
        public gravity: number = REALISTIC_GRAVITY,
        public readonly shouldPassthrough: (() => boolean) | undefined = undefined
    ) { }

    frame(delta: number, noPassthrough = false) {
        let passthrough: boolean;
        if (this.shouldPassthrough !== undefined) {
            if (noPassthrough) {
                passthrough = false;
            } else {
                passthrough = this.shouldPassthrough() || this.velocity.y < 0;
            }
        } else {
            passthrough = false;
        }


        const nextX = this.position.x + this.velocity.x * delta;
        const collisionX = this.game.map.getHorizontalCollisionX(this.position, nextX, this.collisionBoxSize);

        if (collisionX !== undefined) {
            this.position.x = collisionX;
            this.velocity.x = 0;
        } else {
            this.position.x = nextX;
        }

        const nextVelocityY = this.velocity.y + this.gravity * delta;
        const nextY = this.position.y + nextVelocityY * delta;
        const collisionY = this.game.map.getVerticalCollisionY(
            this.position,
            nextY,
            this.collisionBoxSize,
            passthrough
        );

        if (collisionY !== undefined) {
            this.position.y = collisionY;
            this.velocity.y = 0;
        } else {
            this.velocity.y = nextVelocityY;
            this.position.y = nextY;
        }

        this.velocity.x -= this.velocity.x * this.drag * delta;
        this.velocity.y -= this.velocity.y * this.drag * delta;
    }

    moveHorizontally(distance: number) {
        const nextX = this.position.x + distance;
        const collisionX = this.game.map.getHorizontalCollisionX(this.position, nextX, this.collisionBoxSize);
        this.position.x = collisionX ?? nextX;
    }

    isOnGround() {
        return this.game.map.isStandingOnPlatform(
            this.position,
            this.collisionBoxSize,
        );
    }

    getCollisionBox() {
        return {
            topLeft: { x: this.position.x, y: this.position.y - this.collisionBoxSize.height },
            bottomRight: { x: this.position.x + this.collisionBoxSize.width, y: this.position.y }
        };
    }
}