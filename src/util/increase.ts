export default function increase(box: { topLeft: { x: number, y: number; }; bottomRight: { x: number, y: number; }; }, amount: number) {
    return {
        topLeft: {
            x: box.topLeft.x - amount,
            y: box.topLeft.y - amount,
        },
        bottomRight: {
            x: box.bottomRight.x + amount,
            y: box.bottomRight.y + amount,
        },
    };
}