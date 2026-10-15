import { PlayerState } from "../entity/Player";
import Character from "./Character";

export default class Simon implements Character {

    constructor(private colour: string) { }

    get name(): string {
        return "Test Character";
    }

    get icon(): string {
        return "characters/simon/face.jpeg";
    }

    get collisionBox() {
        return { width: 20, height: 35 };
    }

    render(_: PlayerState, context: CanvasRenderingContext2D, position: { x: number, y: number; }, facing: "left" | "right"): void {
        context.fillStyle = this.colour;
        context.fillRect(Math.trunc(position.x), Math.trunc(position.y), 20, -35);
        context.fillRect(Math.trunc(position.x + 20), Math.trunc(position.y - 10), facing === "right" ? 20 : -40, 1);
    }

    get projectilePreset() {
        return {
            damage: 10,
            drag: 0.001,
            gravity: 0.0003,
            knockback: 0.03,
            maxLifetime: 2000,
            stunTime: 300,
            image: "Items/Eggy.png"
        };
    }

    get primaryAttackKnockback(): { x: number; y: number; } {
        return { x: 0.03, y: 0.03 };
    }

    get primaryAttackStrength(): number {
        return 10;
    }

    get downsmashKnockback(): number {
        return 0.3;
    }

    get downsmashStrength(): number {
        return 20;
    }
}