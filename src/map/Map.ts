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
        for (let solid of this.data.solids ?? []) {
            if (x >= solid.topLeft.x && x <= solid.bottomRight.x &&
                y >= solid.topLeft.y && y <= solid.bottomRight.y) {
                return true;
            }
        }

        for (let platform of this.data.platforms) {
            if (platform.passthrough && passthrough) continue;
            if (x >= platform.topLeft.x && x <= platform.bottomRight.x &&
                y >= platform.topLeft.y && y <= platform.bottomRight.y) {
                return true;
            }
        }
        return false;
    }

    // Platforms block downward landings; solids also block upward movement into their undersides.
    public getVerticalCollisionY(
        from: { x: number, y: number; },
        toY: number,
        collisionBox: { width: number, height: number; },
        passthrough: boolean = false
    ): number | undefined {
        const movingDown = toY > from.y;
        const movingUp = toY < from.y;
        const fromTop = from.y - collisionBox.height;
        const toTop = toY - collisionBox.height;
        let collisionY: number | undefined;

        for (let solid of this.data.solids ?? []) {
            const overlapsHorizontally = from.x <= solid.bottomRight.x &&
                from.x + collisionBox.width > solid.topLeft.x;
            const crossesTop = movingDown && from.y <= solid.topLeft.y && toY >= solid.topLeft.y;
            const crossesBottom = movingUp && fromTop >= solid.bottomRight.y && toTop <= solid.bottomRight.y;

            if (overlapsHorizontally && (crossesTop || crossesBottom)) {
                const contactY = crossesTop
                    ? solid.topLeft.y
                    : solid.bottomRight.y + collisionBox.height;

                if (collisionY === undefined ||
                    (movingDown && contactY < collisionY) ||
                    (movingUp && contactY > collisionY)) {
                    collisionY = contactY;
                }
            }
        }

        for (let platform of this.data.platforms) {
            if (platform.passthrough && passthrough) continue;

            const overlapsHorizontally = from.x <= platform.bottomRight.x &&
                from.x + collisionBox.width > platform.topLeft.x;
            const crossesPlatformTop = movingDown && from.y <= platform.topLeft.y && toY >= platform.topLeft.y;

            if (overlapsHorizontally && crossesPlatformTop &&
                (collisionY === undefined || platform.topLeft.y < collisionY)) {
                collisionY = platform.topLeft.y;
            }
        }

        return collisionY;
    }

    // Horizontal collision applies only to full solids, never to one-way platforms.
    public getHorizontalCollisionX(
        from: { x: number, y: number; },
        toX: number,
        collisionBox: { width: number, height: number; }
    ): number | undefined {
        const fromRight = from.x + collisionBox.width;
        const fromTop = from.y - collisionBox.height;
        const movingRight = toX > from.x;
        const movingLeft = toX < from.x;
        let collisionX: number | undefined;

        for (let solid of this.data.solids ?? []) {
            const overlapsVertically = fromTop < solid.bottomRight.y && from.y > solid.topLeft.y;
            const crossesLeft = movingRight && fromRight <= solid.topLeft.x &&
                toX + collisionBox.width >= solid.topLeft.x;
            const crossesRight = movingLeft && from.x >= solid.bottomRight.x &&
                toX <= solid.bottomRight.x;

            if (overlapsVertically && (crossesLeft || crossesRight)) {
                const contactX = crossesLeft
                    ? solid.topLeft.x - collisionBox.width
                    : solid.bottomRight.x;

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
            position.x < platform.bottomRight.x &&
            position.x + collisionBox.width > platform.topLeft.x
        ) || (this.data.solids ?? []).some(solid =>
            position.y === solid.topLeft.y &&
            position.x < solid.bottomRight.x &&
            position.x + collisionBox.width > solid.topLeft.x
        );
    }
}