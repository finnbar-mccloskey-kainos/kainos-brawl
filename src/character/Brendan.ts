import brendanSprite from "/characters/brendan/brendansprite.png?url";
import brendanFace from "/characters/brendan/face.jpeg?url";
import yetiMug from "/Items/YetiMug.png?url";
import { PlayerState, Stunned } from "../entity/Player";
import Character from "./Character";

export default class Brendan implements Character {

    private readonly sprite = new Image();

    constructor() {
        this.sprite.onerror = () => console.error(`Failed to load Brendan sprite: ${brendanSprite}`);
        this.sprite.src = brendanSprite;
    }

    get name(): string {
        return "Test Character";
    }

    get icon(): string {
        return brendanFace;
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

    get projectilePreset() {
        return {
            damage: 10,
            drag: 0.001,
            gravity: 0.0003,
            knockback: 0.3,
            maxLifetime: 2000,
            image: yetiMug,
            stunTime: 300,
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