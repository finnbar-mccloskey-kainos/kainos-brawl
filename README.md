# How to run
1. Clone the repo
2.
```sh
npm install
npm run dev
```

## Down-smash
Hold down and secondary attack to down-smash. The attack checks the full vertical
path travelled each frame, so it can hit opponents below you even during a fast
fall. Its hitbox extends 20 game units around the player. It ends on landing or
an accepted hit; rejected hits do not interrupt the descent.
Holding down during the descent drops through passthrough platforms; releasing
down allows landing on them. Solid platforms always stop the descent.
