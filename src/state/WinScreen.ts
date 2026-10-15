import Player from "../entity/Player";
import { gamepad } from "../input";

export default class WinScreen {

    constructor(private winner: Player) {
        const ui = document.getElementById("ui");
        const winScreen = document.createElement("div");
        winScreen.classList.add("win-screen");
        winScreen.textContent = `Winner: ${this.winner.name}`;
        const button = document.createElement("button");
        button.classList.add("button");
        button.textContent = "Play again";
        button.addEventListener("click", () => {
            location.reload();
        });
        winScreen.appendChild(button);
        ui?.replaceChildren(winScreen);
    }

    cleanup() {
        if (gamepad) {
            for (const button of gamepad.buttons) {
                if (button.pressed) {
                    location.reload();
                }
            }
        }
    }

    render(context: CanvasRenderingContext2D, _: number) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
}