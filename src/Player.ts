import { emit, listen } from "./events";
import { isKeyPressed } from "./input";
import Map from "./map/Map";
import Body from "./physics/Body";

export default class Player {

    private _health: number = 100;

    public body: Body;

    constructor(
        public readonly name: string,
        map: Map,
    ) {
        this.body = new Body(this, map);
    }

    frame(delta: number) {
        const SPEED = 0.05;

        if (isKeyPressed("ArrowLeft")) {
            this.body.moveHorizontally(-SPEED * delta);
        }
        if (isKeyPressed("ArrowRight")) {
            this.body.moveHorizontally(SPEED * delta);
        }
        if (isKeyPressed("ArrowUp") && this.body.isOnGround()) {
            this.body.velocity = { x: this.body.velocity.x, y: -0.3 };
        }

        this.body.frame(delta);
    }

    get health() {
        return this._health;
    }

    set health(value: number) {
        const oldHealth = this._health;
        this._health = value;
        emit("healthChange", { player: this, oldHealth, newHealth: this._health });
    }

}
