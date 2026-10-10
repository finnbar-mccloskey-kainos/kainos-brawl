export default interface MapData {
    background: string;
    platforms: {
        topLeft: { x: number, y: number; },
        bottomRight: { x: number, y: number; },
        passthrough: boolean;
    }[];
}