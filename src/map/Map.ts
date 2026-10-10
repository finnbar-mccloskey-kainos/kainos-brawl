import MapData from "./MapData";

export default class Map {
    constructor(public data: MapData) {
        let background = new Image();
        background.src = "/maps/" + this.data.background;
        background.onload = () => {
            this.background = background;
        };
    }

    public background: HTMLImageElement | undefined;

    public isSolid({ x, y }: { x: number, y: number; }, passthrough: boolean = false) {
        for (let platform of this.data.platforms) {
            if (platform.passthrough && passthrough) continue;
            if (x >= platform.topLeft.x && x <= platform.bottomRight.x &&
                y >= platform.topLeft.y && y <= platform.bottomRight.y) {
                return true;
            }
        }
        return false;
    }

    public getVerticalCollisionY(
        from: { x: number, y: number; },
        toY: number,
        collisionBox: { width: number, height: number; },
        passthrough: boolean = false
    ): number | undefined {
        const fromTop = from.y - collisionBox.height;
        const toTop = toY - collisionBox.height;
        const movingDown = toY > from.y;
        const movingUp = toY < from.y;
        let collisionY: number | undefined;

        for (let platform of this.data.platforms) {
            if (platform.passthrough && passthrough) continue;

            const overlapsHorizontally = from.x <= platform.bottomRight.x &&
                from.x + collisionBox.width >= platform.topLeft.x;
            const crossesPlatformTop = movingDown && from.y <= platform.topLeft.y && toY >= platform.topLeft.y;
            const crossesPlatformBottom = movingUp && fromTop >= platform.bottomRight.y && toTop <= platform.bottomRight.y;

            if (overlapsHorizontally && (crossesPlatformTop || crossesPlatformBottom)) {
                const contactY = crossesPlatformTop
                    ? platform.topLeft.y
                    : platform.bottomRight.y + collisionBox.height;

                if (collisionY === undefined ||
                    (movingDown && contactY < collisionY) ||
                    (movingUp && contactY > collisionY)) {
                    collisionY = contactY;
                }
            }
        }

        return collisionY;
    }

    public getHorizontalCollisionX(
        from: { x: number, y: number; },
        toX: number,
        collisionBox: { width: number, height: number; },
        passthrough: boolean = false
    ): number | undefined {
        const fromRight = from.x + collisionBox.width;
        const fromTop = from.y - collisionBox.height;
        const movingRight = toX > from.x;
        const movingLeft = toX < from.x;
        let collisionX: number | undefined;

        for (let platform of this.data.platforms) {
            if (platform.passthrough && passthrough) continue;

            const overlapsVertically = fromTop < platform.bottomRight.y && from.y > platform.topLeft.y;
            const crossesPlatformLeft = movingRight && fromRight <= platform.topLeft.x &&
                toX + collisionBox.width >= platform.topLeft.x;
            const crossesPlatformRight = movingLeft && from.x >= platform.bottomRight.x &&
                toX <= platform.bottomRight.x;

            if (overlapsVertically && (crossesPlatformLeft || crossesPlatformRight)) {
                const contactX = crossesPlatformLeft
                    ? platform.topLeft.x - collisionBox.width
                    : platform.bottomRight.x;

                if (collisionX === undefined ||
                    (movingRight && contactX < collisionX) ||
                    (movingLeft && contactX > collisionX)) {
                    collisionX = contactX;
                }
            }
        }

        return collisionX;
    }

    public isStandingOnPlatform(
        position: { x: number, y: number; },
        collisionBox: { width: number, height: number; },
        passthrough: boolean = false
    ) {
        return this.data.platforms.some(platform =>
            !(platform.passthrough && passthrough) &&
            position.y === platform.topLeft.y &&
            position.x <= platform.bottomRight.x &&
            position.x + collisionBox.width >= platform.topLeft.x
        );
    }
}