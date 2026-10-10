export default function boxTranslate(box: {
    topLeft: { x: number, y: number; };
    bottomRight: { x: number, y: number; };
}, by: { x: number, y: number; }) {
    return {
        topLeft: { x: box.topLeft.x + by.x, y: box.topLeft.y + by.y },
        bottomRight: { x: box.bottomRight.x + by.x, y: box.bottomRight.y + by.y }
    };
}