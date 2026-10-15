import MapData from "./MapData";

export default {
    background: "officebg.jpg",
    platforms: [
        {
            topLeft: { x: 20, y: 182 },
            bottomRight: { x: 332, y: 182 },
            passthrough: false
        },

        {
            topLeft: { x: 20, y: 114 },
            bottomRight: { x: 332, y: 114 },
            passthrough: true,
        },

        {
            topLeft: { x: 20, y: 45 },
            bottomRight: { x: 332, y: 45 },
            passthrough: true,
        }
    ]
} satisfies MapData;