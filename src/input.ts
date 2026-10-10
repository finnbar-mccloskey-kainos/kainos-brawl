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