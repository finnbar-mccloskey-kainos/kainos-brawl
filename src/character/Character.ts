import { PlayerState } from "../entity/Player";
import ProjectilePreset from "../entity/projectile/ProjectilePreset";

export default interface Character {
    get name(): string;
    get icon(): string;
    get collisionBox(): { width: number, height: number; };

    get projectilePreset(): ProjectilePreset;

    render(state: PlayerState, context: CanvasRenderingContext2D, position: { x: number, y: number; }, facing: "left" | "right"): void;
}