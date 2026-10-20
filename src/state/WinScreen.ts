import Player from "../entity/Player";
import { isKeyPressed } from "../input";
import { sounds } from "../main";

type ConfettiParticle = {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    width: number;
    height: number;
    rotation: number;
    spin: number;
    age: number;
    lifetime: number;
    color: string;
};

export default class WinScreen {
    private confirmWasPressed = false;
    private inputStartsAt = performance.now() + 5000;
    private readonly playAgainButton = document.createElement("button");
    private winSound?: HTMLAudioElement;
    private confettiCanvas: HTMLCanvasElement;
    private confettiParticles: ConfettiParticle[] = [];
    private confettiInitialized = false;
    private confettiDelayRemaining = 3000;

    constructor(private winner: Player) {
        this.confirmWasPressed = this.isConfirmButtonPressed();
        this.winSound = sounds.win();
        void this.winSound.play().catch(error => console.error("Unable to play UWin", error));
        const ui = document.getElementById("ui");
        const winScreen = document.createElement("div");
        winScreen.classList.add("win-screen");
        winScreen.style.backgroundImage = `url(${this.winner.character.icon})`;

        this.confettiCanvas = document.createElement("canvas");
        this.confettiCanvas.classList.add("win-confetti");
        this.confettiCanvas.setAttribute("aria-hidden", "true");

        const content = document.createElement("div");
        content.classList.add("win-screen-content");
        const title = document.createElement("div");
        title.classList.add("win-screen-title");
        title.textContent = `Winner: ${this.winner.name}`;
        content.appendChild(title);
        const button = this.playAgainButton;
        button.classList.add("button");
        button.textContent = "Play again";
        button.disabled = true;
        button.style.visibility = "hidden";
        button.addEventListener("click", () => {
            if (performance.now() < this.inputStartsAt) return;
            location.reload();
        });
        content.appendChild(button);
        winScreen.append(this.confettiCanvas, content);
        ui?.replaceChildren(winScreen);
    }

    cleanup() {
        if (this.winSound) {
            this.winSound.pause();
            this.winSound.currentTime = 0;
            this.winSound = undefined;
        }
    }

    render(context: CanvasRenderingContext2D, _: number) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        this.renderConfetti(_);

        const canExit = performance.now() >= this.inputStartsAt;
        this.playAgainButton.disabled = !canExit;
        this.playAgainButton.style.visibility = canExit ? "visible" : "hidden";
        const confirmPressed = this.isConfirmButtonPressed();
        if (canExit && confirmPressed && !this.confirmWasPressed) {
            location.reload();
        }
        this.confirmWasPressed = confirmPressed;
    }

    private renderConfetti(delta: number) {
        const canvas = this.confettiCanvas;
        const context = canvas.getContext("2d");
        const { width, height } = canvas.getBoundingClientRect();
        if (!context || width === 0 || height === 0) return;

        const pixelRatio = window.devicePixelRatio || 1;
        const canvasWidth = Math.round(width * pixelRatio);
        const canvasHeight = Math.round(height * pixelRatio);
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
        }

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);

        if (!this.confettiInitialized) {
            this.confettiDelayRemaining -= delta;
            if (this.confettiDelayRemaining > 0) return;

            const colors = ["#2eb353", "#ffd43b", "#39d98a", "#1554a3", "#5cced1", "#fff1dc"];
            this.confettiParticles = Array.from({ length: 50 }, () => {
                const angle = Math.random() * Math.PI * 2;
                const speed = 180 + Math.random() * 420;
                return {
                    x: width / 2,
                    y: height / 2,
                    velocityX: Math.cos(angle) * speed,
                    velocityY: Math.sin(angle) * speed - 80,
                    width: 3 + Math.random() * 5,
                    height: 3 + Math.random() * 5,
                    rotation: Math.random() * Math.PI,
                    spin: (Math.random() - 0.5) * 12,
                    age: 0,
                    lifetime: 2 + Math.random() * 1.5,
                    color: colors[Math.floor(Math.random() * colors.length)],
                };
            });
            this.confettiInitialized = true;
        }

        const elapsed = delta / 1000;
        for (const particle of this.confettiParticles) {
            if (particle.age >= particle.lifetime) continue;

            particle.age += elapsed;
            particle.x += particle.velocityX * elapsed;
            particle.y += particle.velocityY * elapsed;
            particle.velocityY += 360 * elapsed;
            particle.rotation += particle.spin * elapsed;

            context.save();
            context.globalAlpha = Math.min(1, (particle.lifetime - particle.age) / 0.4);
            context.translate(particle.x, particle.y);
            context.rotate(particle.rotation);
            context.fillStyle = particle.color;
            context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
            context.restore();
        }
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