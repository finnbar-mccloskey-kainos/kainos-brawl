import Character from "../character/Character";
import { emit } from "../events";
import { playerControls, sounds } from "../main";
import Map from "../map/Map";
import TestMap, { OfficeMap } from "../map/TestMap";
import Game from "./Game";
import HELP_MESSAGE from "../constants/help.html?raw";
import Brendan from "../character/Brendan";
import Simon from "../character/Simon";
import Callum from "../character/Callum";
import { gamepad } from "../input";
import type { MusicPlayback } from "../sound";
import Zuzanna from "../character/zuzanna";

const characters: Character[] = [new Callum(), new Brendan(), new Simon(), new Zuzanna()];
const characterGridColumns = 2;
const stages = [
    { name: "Building", data: TestMap },
    { name: "Office", data: OfficeMap },
];

export default class MainMenu implements EventListenerObject {

    private selections: { number: number, confirmed: boolean; }[] = [{ number: 0, confirmed: false }, { number: 0, confirmed: false }];
    private gameStarted = false;
    private inputStartsAt = performance.now() + 1000;
    private menuMusic?: MusicPlayback;
    private menuMusicStarting = false;
    private menuAudioCleanedUp = false;
    private readonly mainMenu = document.createElement("div");
    private readonly characterList = document.createElement("div");
    private readonly help = document.createElement("div");
    private selectingStage = false;
    private selectedStage = 0;
    private activeStagePlayer = 0;
    private stageBackSelected = false;

    constructor() {
        window.addEventListener("keydown", this);
        this.requestMenuMusic();
        const characterList = this.characterList;
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
        const mainMenu = this.mainMenu;
        mainMenu.className = "main-menu";

        const help = this.help;
        help.className = "help";
        help.innerHTML = HELP_MESSAGE.replace("\n", "\r\n");
        mainMenu.replaceChildren(help, characterList);
        document.getElementById("ui")?.replaceChildren(mainMenu);
        this.refreshCharacterSelection();
    }

    cleanup() {
        window.removeEventListener("keydown", this);
        this.menuAudioCleanedUp = true;
        this.menuMusic?.stop();
        this.menuMusic = undefined;
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
        const inputLocked = now < this.inputStartsAt;

        const backPressed = gamepad.buttons[8]?.pressed ?? false;
        const backWasPressed = this.heldControllerButtons.has("back");
        if (backPressed) {
            this.heldControllerButtons.add("back");
        } else {
            this.heldControllerButtons.delete("back");
        }
        if (!inputLocked && this.selectingStage && backPressed && !backWasPressed) {
            this.returnToCharacters(this.activeStagePlayer);
            return;
        }

        for (const [playerIndex, controls] of playerControls.entries()) {
            for (const [action, control] of Object.entries(controls)) {
                const controllerControl = control.controller;
                const controlKey = `${playerIndex}:${action}`;

                if (controllerControl.type === "button") {
                    const pressed = gamepad.buttons[controllerControl.index]?.pressed ?? false;
                    const wasPressed = this.heldControllerButtons.has(controlKey);
                    if (!inputLocked && pressed && !wasPressed) {
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
                if (inputLocked || displacement < 0.5) {
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
        if (this.gameStarted || performance.now() < this.inputStartsAt) return;
        this.requestMenuMusic();
        if (this.selectingStage) {
            this.activeStagePlayer = index;
            if (action === "left" && !this.stageBackSelected) {
                this.selectedStage = Math.max(0, this.selectedStage - 1);
            } else if (action === "right" && !this.stageBackSelected) {
                this.selectedStage = Math.min(stages.length - 1, this.selectedStage + 1);
            } else if (action === "down") {
                this.stageBackSelected = true;
            } else if (action === "menuUp" || action === "up") {
                this.stageBackSelected = false;
            } else if (action === "primary") {
                if (this.stageBackSelected) {
                    this.returnToCharacters(index);
                } else {
                    this.startGame();
                }
                return;
            } else if (action === "secondary") {
                this.returnToCharacters(index);
                return;
            }
            this.refreshStageSelection();
            return;
        }
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
                this.activeStagePlayer = index;
            }
        }
        this.refreshCharacterSelection();
    }

    private requestMenuMusic() {
        if (this.menuAudioCleanedUp || this.menuMusic || this.menuMusicStarting) return;
        this.menuMusicStarting = true;
        void sounds.playLoopingMusic("anticipation", { loopStart: 5.65, volume: 0.5 })
            .then(music => {
                this.menuMusicStarting = false;
                if (this.menuAudioCleanedUp) {
                    music.stop();
                } else {
                    this.menuMusic = music;
                }
            })
            .catch(error => {
                this.menuMusicStarting = false;
                console.warn("Unable to play menu music", error);
            });
    }

    refreshCharacterSelection() {
        const characterElements = document.querySelectorAll(".character");

        for (const characterElement of characterElements) {
            for (const index of this.selections.keys()) {
                characterElement.classList.remove(`player${index + 1}-selection`);
                characterElement.classList.remove(`player${index + 1}-confirmed`);
            }
        }

        for (const [index, selection] of this.selections.entries()) {
            const characterElement = characterElements[selection.number];
            if (characterElement) {
                characterElement.classList.add(`player${index + 1}-selection`);
                if (selection.confirmed) {
                    characterElement.classList.add(`player${index + 1}-confirmed`);
                }
            }
        }

        if (!this.gameStarted && !this.selectingStage && this.selections.every(selection => selection.confirmed)) {
            this.showStageSelection();
        }
    }

    private showStageSelection() {
        this.inputStartsAt = performance.now();
        this.nextAxisRepeat.clear();
        for (const [index, controls] of playerControls.entries()) {
            const confirm = controls.primary.controller;
            if (confirm.type === "button" && gamepad?.buttons[confirm.index]?.pressed) {
                this.heldControllerButtons.add(`${index}:primary`);
            }
        }
        this.selectingStage = true;
        this.stageBackSelected = false;
        this.mainMenu.classList.add("stage-selection");

        const heading = document.createElement("h1");
        heading.textContent = "Choose Stage";

        const stageList = document.createElement("div");
        stageList.className = "stage-list";
        for (const [index, stage] of stages.entries()) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "stage";
            const preview = new Image();
            preview.src = `/maps/${stage.data.background}`;
            preview.alt = `${stage.name} stage preview`;
            const name = document.createElement("span");
            name.textContent = stage.name;
            button.append(preview, name);
            button.addEventListener("click", () => {
                if (performance.now() < this.inputStartsAt) return;
                this.selectedStage = index;
                this.startGame();
            });
            stageList.appendChild(button);
        }

        const back = document.createElement("button");
        back.type = "button";
        back.className = "stage-back";
        back.textContent = "Back";
        back.addEventListener("click", () => this.returnToCharacters(this.activeStagePlayer));
        this.mainMenu.replaceChildren(heading, stageList, back);
        this.refreshStageSelection();
    }

    private refreshStageSelection() {
        for (const [index, stage] of this.mainMenu.querySelectorAll(".stage").entries()) {
            const selected = !this.stageBackSelected && index === this.selectedStage;
            stage.classList.toggle("selected", selected);
            stage.setAttribute("aria-pressed", String(selected));
        }
        this.mainMenu.querySelector(".stage-back")?.classList.toggle("selected", this.stageBackSelected);
    }

    private returnToCharacters(index: number) {
        if (performance.now() < this.inputStartsAt) return;
        this.inputStartsAt = performance.now() + 1000;
        this.selectingStage = false;
        this.selections[index].confirmed = false;
        this.mainMenu.classList.remove("stage-selection");
        this.mainMenu.replaceChildren(this.help, this.characterList);
        this.refreshCharacterSelection();
    }

    private startGame() {
        if (this.gameStarted || performance.now() < this.inputStartsAt) return;
        this.gameStarted = true;
        emit("stateChange", {
            oldState: this,
            newState: new Game(new Map(stages[this.selectedStage].data), this.selections.map(selection => characters[selection.number])),
        });
    }
}