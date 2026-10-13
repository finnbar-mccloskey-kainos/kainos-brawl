import Character from "./Character";

export default class TestCharacter implements Character {
    get name(): string {
        return "Test Character";
    }
}