import downsmash from "/audio/sfx/downsmash.wav?url";
import melee from "/audio/sfx/melee.wav?url";
import projectileLand from "/audio/sfx/projectile_land.flac?url";
import projectileLaunch from "/audio/sfx/projectile_launch.wav?url";
import roundEnd from "/audio/sfx/round_end.wav?url";
import win from "../audio/UWin.wav?url";
import collision from "/audio/Collision.wav?url";
import anticipation from "../audio/Anticipation.wav?url";

const soundUrls = { downsmash, melee, projectileLand, projectileLaunch, roundEnd, win };
const musicUrls = { collision, anticipation };

export type MusicTrack = keyof typeof musicUrls;
export type MusicOptions = { loopStart?: number; startAtFromEnd?: number; volume?: number; };
export type MusicPlayback = { stop(): void; };

export type SoundPlayer = { [key in keyof typeof soundUrls]: () => HTMLAudioElement; } & {
    playLoopingMusic(track: MusicTrack, options?: MusicOptions): Promise<MusicPlayback>;
};

export async function setupSounds(): Promise<SoundPlayer> {
    const audioContext = new AudioContext();
    const [entries, musicEntries] = await Promise.all([
        Promise.all(Object.entries(soundUrls).map(async ([name, url]) => {
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
            return [name, () => {
                const clone = audio.cloneNode(true) as HTMLAudioElement;
                clone.volume = 0.7;
                return clone;
            }] as const;
        })),
        Promise.all(Object.entries(musicUrls).map(async ([name, url]) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load music: ${response.status}`);
            }
            const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
            return [name, buffer] as const;
        })),
    ]);

    const musicBuffers = Object.fromEntries(musicEntries) as Record<MusicTrack, AudioBuffer>;
    const sounds = Object.fromEntries(entries) as { [key in keyof typeof soundUrls]: () => HTMLAudioElement; };

    return {
        ...sounds,
        async playLoopingMusic(track, options = {}) {
            const buffer = musicBuffers[track];
            await audioContext.resume();

            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.loopStart = options.loopStart ?? 0;
            source.loopEnd = buffer.duration;

            const volume = audioContext.createGain();
            volume.gain.value = options.volume ?? 0.5;
            source.connect(volume);
            volume.connect(audioContext.destination);

            let stopped = false;
            source.start(0, options.startAtFromEnd === undefined
                ? 0
                : Math.max(0, buffer.duration - options.startAtFromEnd));

            return {
                stop() {
                    if (stopped) return;
                    stopped = true;
                    source.stop();
                    source.disconnect();
                    volume.disconnect();
                },
            };
        },
    };
}
