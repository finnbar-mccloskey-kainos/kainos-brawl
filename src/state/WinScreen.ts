import Player from "../entity/Player";
import { isKeyPressed } from "../input";
import { sounds } from "../main";

export default class WinScreen {
    private confirmWasPressed = false;
    private winMusic?: HTMLAudioElement;

    constructor(private winner: Player) {
        this.confirmWasPressed = this.isConfirmButtonPressed();
        this.winMusic = sounds.win();
        void this.winMusic.play().catch(error => console.error("Unable to play win music", error));
        const ui = document.getElementById("ui");
        const winScreen = document.createElement("div");
        winScreen.classList.add("win-screen");
        winScreen.textContent = `Winner: ${this.winner.name}`;
        winScreen.style.backgroundImage = `url(${this.winner.character.icon})`;
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
        if (this.winMusic) {
            this.winMusic.pause();
            this.winMusic.currentTime = 0;
            this.winMusic = undefined;
        }
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