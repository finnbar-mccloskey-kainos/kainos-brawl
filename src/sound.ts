import collision from "/audio/Collision.wav?url";
import downsmash from "/audio/sfx/downsmash.wav?url";
import melee from "/audio/sfx/melee.wav?url";
import projectileLand from "/audio/sfx/projectile_land.flac?url";
import projectileLaunch from "/audio/sfx/projectile_launch.wav?url";
import roundEnd from "/audio/sfx/round_end.wav?url";

const soundUrls = { collision, downsmash, melee, projectileLand, projectileLaunch, roundEnd };

export type SoundPlayer = { [key in keyof typeof soundUrls]: () => HTMLAudioElement; };

export async function setupSounds(): Promise<SoundPlayer> {
    const entries = await Promise.all(Object.entries(soundUrls).map(async ([name, url]) => {
        const audio = document.createElement("audio");
        await new Promise<void>((resolve, reject) => {
            audio.oncanplay = () => {
                audio.oncanplay = null;
                audio.onerror = null;
                resolve();
            };
            audio.onerror = () => {
                audio.oncanplay = null;
                audio.onerror = null;
                reject(new Error(`Failed to load sound: ${url}`));
            };
            audio.src = url;
            audio.load();
        });
        return [name, () => audio.cloneNode(true) as HTMLAudioElement] as const;
    }));
    return Object.fromEntries(entries) as SoundPlayer;
}
