export type MapBounds = {
    topLeft: { x: number, y: number; },
    bottomRight: { x: number, y: number; };
};

export default interface MapData {
    background: string;
    // One-way surfaces: collide only when landing from above; passthrough allows dropping through.
    platforms: (MapBounds & { passthrough: boolean; })[];
    // Full rectangles for walls, ceilings, or other geometry that blocks movement on every side.
    solids?: MapBounds[];
}