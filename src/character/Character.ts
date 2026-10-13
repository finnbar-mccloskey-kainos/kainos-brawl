import ProjectilePreset from "../entity/projectile/ProjectilePreset";

export default interface Character {
    get name(): string;
    get icon(): string;
    get collisionBox(): { width: number, height: number; };

    get projectilePreset(): ProjectilePreset;

    render(context: CanvasRenderingContext2D, position: { x: number, y: number; }, facing: "left" | "right"): void;
}