import ProjectilePreset from "../entity/projectile/ProjectilePreset";
import Character from "./Character";

export default class Callum implements Character {

    constructor() { }

    get name(): string {
        return "Callum";
    }

    get icon(): string {
        return "characters/callum/face.jpeg";
    }

    get collisionBox() {
        return { width: 20, height: 35 };
    }

    render(context: CanvasRenderingContext2D, position: { x: number, y: number; }, facing: "left" | "right"): void {
        context.fillStyle = "green";
        context.fillRect(Math.trunc(position.x), Math.trunc(position.y), 20, -35);
        context.fillRect(Math.trunc(position.x + 20), Math.trunc(position.y - 10), facing === "right" ? 20 : -40, 1);
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