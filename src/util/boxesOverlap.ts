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
    const box1MinX = Math.min(box1.topLeft.x, box1.bottomRight.x);
    const box1MaxX = Math.max(box1.topLeft.x, box1.bottomRight.x);
    const box1MinY = Math.min(box1.topLeft.y, box1.bottomRight.y);
    const box1MaxY = Math.max(box1.topLeft.y, box1.bottomRight.y);
    const box2MinX = Math.min(box2.topLeft.x, box2.bottomRight.x);
    const box2MaxX = Math.max(box2.topLeft.x, box2.bottomRight.x);
    const box2MinY = Math.min(box2.topLeft.y, box2.bottomRight.y);
    const box2MaxY = Math.max(box2.topLeft.y, box2.bottomRight.y);

    return (
        box1MinX <= box2MaxX &&
        box1MaxX >= box2MinX &&
        box1MinY <= box2MaxY &&
        box1MaxY >= box2MinY
    );
}