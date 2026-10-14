let keyPressed: Record<string, boolean> = {};
window.addEventListener("keydown", (e) => {
    keyPressed[e.code] = true;

});
window.addEventListener("keyup", (e) => {
    keyPressed[e.code] = false;
});

export function isKeyPressed(key: string): boolean {
    return !!keyPressed[key];
}

export let gamepad: Gamepad | null = null;

function setGamepad(gp: Gamepad | null) {
    gamepad = gp;
}
export { setGamepad };

window.addEventListener("gamepadconnected", e => {
    gamepad = e.gamepad;
    console.log(gamepad);
});

window.addEventListener("gamepaddisconnected", e => {
    if (gamepad && e.gamepad.index === gamepad.index) {
        gamepad = null;
    }
});

