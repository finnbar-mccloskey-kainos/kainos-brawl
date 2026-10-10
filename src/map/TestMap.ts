import MapData from "./MapData";

export default {
    background: "testmap.png",
    platforms: [
        {
            topLeft: { x: 22, y: 160 },
            bottomRight: { x: 330, y: 160 },
            passthrough: false
        },

        {
            topLeft: { x: 40, y: 100 },
            bottomRight: { x: 118, y: 100 },
            passthrough: true,
        },

        {
            topLeft: { x: 136, y: 54 },
            bottomRight: { x: 214, y: 65 },
            passthrough: true,
        },

        {
            topLeft: { x: 226, y: 97 },
            bottomRight: { x: 304, y: 97 },
            passthrough: true,
        }
    ]
} satisfies MapData;