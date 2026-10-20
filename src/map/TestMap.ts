import MapData from "./MapData";

export default {
    background: "building.png",
    solids: [
        {
            topLeft: { x: 48, y: 208 },
            bottomRight: { x: 304, y: 324 },
        },
    ],
    platforms: [
        {
            topLeft: { x: 48, y: 208 },
            bottomRight: { x: 304, y: 208 },
            passthrough: false
        },

        {
            topLeft: { x: 48, y: 136 },
            bottomRight: { x: 304, y: 136 },
            passthrough: true,
        },

        {
            topLeft: { x: 48, y: 60 },
            bottomRight: { x: 304, y: 60 },
            passthrough: true,
        }
    ]
} satisfies MapData;

export const OfficeMap = {
    background: "office.png",
    solids: [
        {
            topLeft: { x: -100, y: 182 },
            bottomRight: { x: 452, y: 324 },
        },
    ],
    platforms: [
        {
            topLeft: { x: 0, y: 182 },
            bottomRight: { x: 352, y: 182 },
            passthrough: false,
        },
        {
            topLeft: { x: 178, y: 130 },
            bottomRight: { x: 254, y: 130 },
            passthrough: true,
        },
        {
            topLeft: { x: 30, y: 114 },
            bottomRight: { x: 92, y: 114 },
            passthrough: true,
        },
        {
            topLeft: { x: 266, y: 114 },
            bottomRight: { x: 328, y: 114 },
            passthrough: true,
        },
    ],
} satisfies MapData;