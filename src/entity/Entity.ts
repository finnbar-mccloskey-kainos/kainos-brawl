import Body from "../physics/Body";

export default interface Entity {

    get body(): Body;

    frame(delta: number): void;

    render(context: CanvasRenderingContext2D): void;

    get shouldDelete(): boolean;

}