export default function boxesOverlap(
    box1: {
        topLeft: { x: number, y: number; };
        bottomRight: { x: number, y: number; };
    },
    box2: {
        topLeft: { x: number, y: number; };
        bottomRight: { x: number, y: number; };
    }
): boolean {
    return (
        box1.topLeft.x < box2.bottomRight.x &&
        box1.bottomRight.x > box2.topLeft.x &&
        box1.topLeft.y < box2.bottomRight.y &&
        box1.bottomRight.y > box2.topLeft.y
    );
}