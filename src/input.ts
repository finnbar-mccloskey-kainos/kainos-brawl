let keyPressed: Record<string, boolean> = {};
window.addEventListener("keydown", (e) => {
    keyPressed[e.key] = true;
});
window.addEventListener("keyup", (e) => {
    keyPressed[e.key] = false;
});

export function isKeyPressed(key: string): boolean {
    return !!keyPressed[key];
}