import Character from "../character/Character";
import { emit } from "../events";
import { logo, playerControls } from "../main";
import Map from "../map/Map";
import TestMap from "../map/TestMap";
import Game from "./Game";
import HELP_MESSAGE from "../constants/help.html?raw";
import Brendan from "../character/Brendan";
import Simon from "../character/Simon";
import Callum from "../character/Callum";

const characters: Character[] = [new Callum(), new Brendan("yellow"), new Simon("blue")];
const characterGridColumns = 8;

export default class MainMenu implements EventListenerObject {

    private selections: { number: number, confirmed: boolean; }[] = [{ number: 0, confirmed: false }, { number: 0, confirmed: false }];
    private gameStarted = false;

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
        mainMenu.replaceChildren(logo, characterList, help);
        document.getElementById("ui")?.replaceChildren(mainMenu);
    }

    cleanup() {
        window.removeEventListener("keydown", this);
    }

    render(context: CanvasRenderingContext2D) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }

    handleEvent(event: Event) {
        if (event instanceof KeyboardEvent) {
            for (const [index, controls] of playerControls.entries()) {
                for (const [action, key] of Object.entries(controls)) {
                    if (event.code === key.keyboard) {
                        if (this.selections[index].confirmed) {
                            if (action === "primary" || action === "secondary") {
                                this.selections[index].confirmed = false;
                            }
                        } else {
                            if (action === "left" && this.selections[index].number > 0) {
                                this.selections[index].number--;
                            } else if (action === "right" && this.selections[index].number < characters.length - 1) {
                                this.selections[index].number++;
                            } else if (action === "up" && this.selections[index].number >= characterGridColumns) {
                                this.selections[index].number -= characterGridColumns;
                            } else if (action === "down" && this.selections[index].number < characters.length - characterGridColumns) {
                                this.selections[index].number += characterGridColumns;
                            } else if (action === "primary") {
                                this.selections[index].confirmed = true;
                            } else {
                                continue;
                            }
                        }
                    }
                    this.refreshCharacterSelection();
                }
            }
        }
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