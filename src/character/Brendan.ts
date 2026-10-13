import Character from "./Character";

export default class Brendan implements Character {

    constructor(private colour: string) { }

    get name(): string {
        return "Test Character";
    }

    get icon(): string {
        return "characters/brendan/face.jpeg";
    }

    render(context: CanvasRenderingContext2D, position: { x: number, y: number; }, facing: "left" | "right"): void {
        context.fillStyle = this.colour;
        context.fillRect(Math.trunc(position.x), Math.trunc(position.y), 20, -35);
        context.fillRect(Math.trunc(position.x + 20), Math.trunc(position.y - 10), facing === "right" ? 20 : -40, 1);
    }
}