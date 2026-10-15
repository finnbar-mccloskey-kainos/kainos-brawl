import Player from "../entity/Player";
import { isKeyPressed } from "../input";

export default class WinScreen {
    private confirmWasPressed = false;

    constructor(private winner: Player) {
        this.confirmWasPressed = this.isConfirmButtonPressed();
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
    }

    render(context: CanvasRenderingContext2D, _: number) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);

        const confirmPressed = this.isConfirmButtonPressed();
        if (confirmPressed && !this.confirmWasPressed) {
            location.reload();
        }
        this.confirmWasPressed = confirmPressed;
    }

    private isConfirmButtonPressed() {
        const winnerButtonIndexes = Object.values(this.winner.controls).flatMap(control =>
            control.controller.type === "button" ? [control.controller.index] : []
        );

        return isKeyPressed("KeyA") || Array.from(navigator.getGamepads()).some(gamepad =>
            gamepad !== null && winnerButtonIndexes.some(index => gamepad.buttons[index]?.pressed ?? false)
        );
    }
}