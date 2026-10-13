export default interface Character {
    get name(): string;
    get icon(): string;

    render(context: CanvasRenderingContext2D, position: { x: number, y: number; }, facing: "left" | "right"): void;
}