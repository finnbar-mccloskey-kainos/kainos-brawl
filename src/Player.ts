import { emit, listen } from "./events";
import { isKeyPressed } from "./input";
import Map from "./map/Map";
import Body from "./physics/Body";

export default class Player {

    private _health: number = 100;

    public body: Body;

    private listeners = [] as { unsubscribe: () => void; }[];

    constructor(
        public readonly name: string,
        map: Map,
    ) {
        this.body = new Body(this, map);
        this.listeners.push(listen("frame", ({ delta }) => {

            const SPEED = 0.05;

            if (isKeyPressed("ArrowLeft")) {
                this.body.moveHorizontally(-SPEED * delta);
            }
            if (isKeyPressed("ArrowRight")) {
                this.body.moveHorizontally(SPEED * delta);
            }
            if (isKeyPressed("ArrowUp") && this.body.isOnGround()) {
                this.body.velocity = { x: this.body.velocity.x, y: -0.4 };
            }
        }));
    }

    get health() {
        return this._health;
    }

    set health(value: number) {
        const oldHealth = this._health;
        this._health = value;
        emit("healthChange", { player: this, oldHealth, newHealth: this._health });
    }



    cleanup() {
        for (let listener of this.listeners) {
            listener.unsubscribe();
        }
        this.body.cleanup();
    }

}
