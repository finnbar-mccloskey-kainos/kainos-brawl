import Character from "../character/Character";
import { emit } from "../events";
import { playerControls } from "../main";
import Map from "../map/Map";
import TestMap from "../map/TestMap";
import Game from "./Game";
import HELP_MESSAGE from "../constants/help.html?raw";
import Brendan from "../character/Brendan";
import Simon from "../character/Simon";
import Callum from "../character/Callum";
import { gamepad } from "../input";
import Zuzanna from "../character/zuzanna";

const characters: Character[] = [new Callum(), new Brendan(), new Simon(), new Zuzanna()];
const characterGridColumns = 2;

export default class MainMenu implements EventListenerObject {

    private selections: { number: number, confirmed: boolean; }[] = [{ number: 0, confirmed: false }, { number: 0, confirmed: false }];
    private gameStarted = false;
    private controllerInputStartsAt = performance.now() + 1000;

    constructor() {
        window.addEventListener("keydown", this);
        const characterList = document.createElement("div");
        characterList.className = "character-list";
        characterList.replaceChildren(...characters.map(character => {
            const div = document.createElement("div");
            div.className = "character";
            const icon = new Image();
            icon.className = "character-icon";
            icon.src = character.icon;
            div.appendChild(icon);
            return div;
        }));
        let mainMenu = document.createElement("div");
        mainMenu.className = "main-menu";

        const help = document.createElement("div");
        help.className = "help";
        help.innerHTML = HELP_MESSAGE.replace("\n", "\r\n");
        mainMenu.replaceChildren(help, characterList);
        document.getElementById("ui")?.replaceChildren(mainMenu);
        this.refreshCharacterSelection();
    }

    cleanup() {
        window.removeEventListener("keydown", this);
    }

    private heldControllerButtons = new Set<string>();
    private nextAxisRepeat = new globalThis.Map<string, number>();

    render(context: CanvasRenderingContext2D) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);

        if (!gamepad) {
            this.heldControllerButtons.clear();
            this.nextAxisRepeat.clear();
            return;
        }

        const now = performance.now();
        if (now < this.controllerInputStartsAt) {
            return;
        }

        for (const [playerIndex, controls] of playerControls.entries()) {
            for (const [action, control] of Object.entries(controls)) {
                const controllerControl = control.controller;
                const controlKey = `${playerIndex}:${action}`;

                if (controllerControl.type === "button") {
                    const pressed = gamepad.buttons[controllerControl.index]?.pressed ?? false;
                    const wasPressed = this.heldControllerButtons.has(controlKey);
                    if (pressed && !wasPressed) {
                        this.handleControl(playerIndex, action);
                        if (this.gameStarted) return;
                    }
                    if (pressed) {
                        this.heldControllerButtons.add(controlKey);
                    } else {
                        this.heldControllerButtons.delete(controlKey);
                    }
                    continue;
                }

                const axisValue = gamepad.axes[controllerControl.index] ?? 0;
                const displacement = controllerControl.direction === "negative" ? -axisValue : axisValue;
                if (displacement < 0.5) {
                    this.nextAxisRepeat.delete(controlKey);
                    continue;
                }

                const nextRepeat = this.nextAxisRepeat.get(controlKey);
                if (nextRepeat === undefined || now >= nextRepeat) {
                    this.handleControl(playerIndex, action);
                    this.nextAxisRepeat.set(controlKey, now + 220);
                    if (this.gameStarted) return;
                }
            }
        }

    }

    handleEvent(event: Event) {
        if (event instanceof KeyboardEvent) {
            if (event.repeat) return;

            for (const [index, controls] of playerControls.entries()) {
                for (const [action, key] of Object.entries(controls)) {
                    if (event.code === key.keyboard) {

                        this.handleControl(index, action);

                        break;
                    }
                }
            }
        }
    }

    handleControl(index: number, action: string) {
        if (this.selections[index].confirmed) {
            if (action === "primary" || action === "secondary") {
                this.selections[index].confirmed = false;
            }
        } else {
            if (action === "left" && this.selections[index].number > 0) {
                this.selections[index].number--;
            } else if (action === "right" && this.selections[index].number < characters.length - 1) {
                this.selections[index].number++;
            } else if ((action === "menuUp" || action === "up") && this.selections[index].number >= characterGridColumns) {
                this.selections[index].number -= characterGridColumns;
            } else if (action === "down" && this.selections[index].number < characters.length - characterGridColumns) {
                this.selections[index].number += characterGridColumns;
            } else if (action === "primary") {
                this.selections[index].confirmed = true;
            }
        }
        this.refreshCharacterSelection();
    }

    refreshCharacterSelection() {
        const characterElements = document.querySelectorAll(".character");

        for (const characterElement of characterElements) {
            for (const index of this.selections.keys()) {
                characterElement.classList.remove(`player${index + 1}-selection`);
            }
            characterElement.classList.remove("confirmed");
        }

        for (const [index, selection] of this.selections.entries()) {
            const characterElement = characterElements[selection.number];
            if (characterElement) {
                characterElement.classList.add(`player${index + 1}-selection`);
                if (selection.confirmed) {
                    characterElement.classList.add("confirmed");
                }
            }
        }

        if (!this.gameStarted && this.selections.every(selection => selection.confirmed)) {
            this.gameStarted = true;
            emit("stateChange", { oldState: this, newState: new Game(new Map(TestMap), this.selections.map(selection => characters[selection.number])) });
        }
    }
}