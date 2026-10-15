import { PlayerState, Stunned } from "../entity/Player";
import ProjectilePreset from "../entity/projectile/ProjectilePreset";
import Character from "./Character";

export default class Callum implements Character {

    private readonly sprite = new Image();

    constructor() {
        this.sprite.onerror = () => console.error("Failed to load Callum sprite: characters/callum/testsprite.png");
        this.sprite.src = "characters/callum/testsprite.png";
    }

    get name(): string {
        return "Callum";
    }

    get icon(): string {
        return "characters/callum/face.jpeg";
    }

    get collisionBox() {
        return { width: 20, height: 35 };
    }

    render(state: PlayerState, context: CanvasRenderingContext2D, position: { x: number, y: number; }, facing: "left" | "right"): void {
        if (this.sprite.complete && this.sprite.naturalWidth > 0) {
            context.save();
            context.translate(
                Math.trunc(position.x) + (facing === "left" ? this.sprite.naturalWidth : 0),
                Math.trunc(position.y) - this.sprite.naturalHeight
            );
            context.scale(facing === "left" ? -1 : 1, 1);
            if (state instanceof Stunned) {
                context.filter = "brightness(200%)";
            }
            context.drawImage(this.sprite, 0, 0);
            context.filter = "none";
            context.restore();
        }
    }

    get projectilePreset(): ProjectilePreset {
        return {
            damage: 10,
            drag: 0.001,
            gravity: 0.0003,
            knockback: 0.3,
            maxLifetime: 2000,
            stunTime: 300
        };
    }
}