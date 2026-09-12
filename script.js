const ROWS = 6;
const STORAGE_KEY = "wordle-game";
const STATS_KEY = "wordle-stats";
const LANG_KEY = "wordle-lang";
const THEME_KEY = "wordle-theme";
const LENGTH_KEY = "wordle-length";
const HUB_FAVORITES_KEY = "hub-favorites";
const HUB_LAST_GAME_KEY = "hub-last-game";
const HUB_THEME_KEY = "hub-look-theme";
const SEEN_BUILD_KEY = "wordle-seen-build";
const MODE_KEY = "wordle-play-mode";
const WORD_THEME_KEY = "wordle-word-theme";
const COLOR_THEME_KEY = "guessword-color-theme";

const GUESS_COLOR_THEMES = {
  ice: { id: "ice", label: "Ice", blurb: "cyan correct, violet present" },
  arcade: { id: "arcade", label: "Arcade", blurb: "neon mint correct, hot coral present" },
  warm: { id: "warm", label: "Warm", blurb: "teal correct, amber present" }
};

const HUB_THEMES = {
  classic: { label: "Classic", eyebrow: "Hub" },
  arcade: { label: "Arcade", eyebrow: "Arcade floor" },
  ice: { label: "Ice", eyebrow: "ICE_DRAGON" },
  retro: { label: "Retro", eyebrow: "Terminal" },
  workshop: { label: "Workshop", eyebrow: "Workshop" },
  poster: { label: "Poster wall", eyebrow: "Now playing" },
  aurora: { label: "Aurora", eyebrow: "Titles", ownerOnly: true },
  mono: { label: "Mono", eyebrow: "Titles", ownerOnly: true },
  tide: { label: "Tide", eyebrow: "Titles", ownerOnly: true }
};

const CREATOR_NAME = "ICE_DRAGON";
const SPECIAL_PLAYER_NAMES = {
  ice_dragon: {
    className: "player-name-creator",
    title: "Site owner",
    badge: { label: "OWNER", className: "player-title-owner" }
  },
  oscarvr29: {
    className: "player-name-oscar",
    title: "Original player",
    badge: { label: "OG", className: "player-title-og" }
  }
};

const CHANGELOG = {
  "20260913p": [
    "Fishing Idle: boat catch toast no longer shifts the Cast button"
  ],
  "20260913o": [
    "Fishing Idle: fix glitchy auto boat catch display (no more flicker)"
  ],
  "20260913n": [
    "Hub Feedback: fix send when Mantle is rate-limited — saves locally and queues sync; less API spam"
  ],
  "20260913m": [
    "Fishing Idle: fix auto boat catch feedback — fish show under the boat timer every haul"
  ],
  "20260913l": [
    "Fishing Idle: auto boat catches show fish art, name, and value"
  ],
  "20260913k": [
    "Fishing Idle: different fish shapes per species (catfish whiskers, snapper, eel, shark, ray…)"
  ],
  "20260913j": [
    "Fishing Idle: catch card + cooler chips show fish art with star, name, and value"
  ],
  "20260913i": [
    "Fishing Idle: more realistic cast pond — water, line, bobber dunk/splash, fish breach on catch"
  ],
  "20260913h": [
    "Fishing Idle: high rarities even rarer (another odds nerf)"
  ],
  "20260913g": [
    "Fishing Idle: higher rarities are rarer again (base odds, luck, and spot scaling)"
  ],
  "20260913f": [
    "Fishing Idle: more late gear + Perfect pay upgrades (bonus sell on perfect reels) — no new boats"
  ],
  "20260913e": [
    "Fishing Idle: more gear (rods, bait, luck, cooler, sell) plus Second catch nets — no new boats"
  ],
  "20260913d": [
    "Fishing Idle: remove Deep Yacht — Harbor Boat is the max boat again"
  ],
  "20260913c": [
    "Fishing Idle: more gear — late rods/luck/cooler, Sell boost line, Deep Yacht boat"
  ],
  "20260913b": [
    "ICE_DRAGON username is locked to its owner player code — nobody else can take it"
  ],
  "20260913a": [
    "Hub: all game cards use the same theme accent (no different middle-column color)"
  ],
  "20260912z": [
    "Hub: game cards tint and accent bars follow each hub look / theme"
  ],
  "20260912y": [
    "Fix Guessword stuck blank screen (hub theme init crash)"
  ],
  "20260912x": [
    "Players: each person gets a player code — rename keeps leaderboards/friends; restore on another device"
  ],
  "20260912w": [
    "Hub: ICE_DRAGON-only Aurora / Mono / Tide looks (same colors as animated titles)"
  ],
  "20260912v": [
    "Hub Ice look: cooler dark blue instead of bright white"
  ],
  "20260912u": [
    "My Games hub: same drifting glow / orb / sparkle background animation as Guessword"
  ],
  "20260912t": [
    "Hangman: same creamy keyboard thock as Guessword when guessing letters"
  ],
  "20260912s": [
    "Hangman: Guessword-style 3D QWERTY keyboard"
  ],
  "20260912r": [
    "Hangman: Ice / Arcade / Warm board colors + same animated backgrounds as Guessword"
  ],
  "20260912q": [
    "Guessword: stronger animated theme backgrounds (drifting orbs + sparkle)"
  ],
  "20260912p": [
    "Guessword: animated backgrounds that match Ice / Arcade / Warm themes"
  ],
  "20260912o": [
    "Guessword: quieter creamy key sounds"
  ],
  "20260912n": [
    "Guessword: typing uses your creamy keyboard recording"
  ],
  "20260912m": [
    "Guessword: real honey-key samples instead of beeps for typing ASMR"
  ],
  "20260912l": [
    "Guessword: creamy honey-keyboard ASMR key sound"
  ],
  "20260912k": [
    "Guessword: key ASMR sound less deep / less bassy"
  ],
  "20260912j": [
    "Guessword: softer ASMR-style key thock when typing"
  ],
  "20260912i": [
    "Guessword: chunkier mechanical key sound when typing"
  ],
  "20260912h": [
    "Guessword: more 3D keyboard keys (depth, press-in, themed edges)"
  ],
  "20260912g": [
    "What's new: old notes renamed to current game titles"
  ],
  "20260912f": [
    "Players: you stay listed as online when the shared DB is rate-limited"
  ],
  "20260912e": [
    "Players: title/color save works offline when the shared DB is rate-limited"
  ],
  "20260912d": [
    "Fishing Idle: rare+ fish are less rare (weights up, spot suppression softened)"
  ],
  "20260912c": [
    "Fishing Idle: fish guide odds are exact per fish (no more identical ultra-rare %)"
  ],
  "20260912b": [
    "Fishing Idle: new rarities Astral, Singularity, Omega (+ fish & late spots)"
  ],
  "20260912a": [
    "Fishing Idle: auto boat hire and upgrades cost much more"
  ],
  "20260911z": [
    "Fishing Idle: gear shop split into categories (Rods, Faster bites, Luck, Cooler, Auto boat)"
  ],
  "20260911y": [
    "Fishing Idle: full reset — progress + catch leaderboard wiped (other games untouched)"
  ],
  "20260911x": [
    "Fishing Idle: boat max speed 7.5s; upgrades add multi-catch chances"
  ],
  "20260911w": [
    "Fishing Idle: one upgradable auto boat instead of buying many boats"
  ],
  "20260911v": [
    "Fishing Idle: fish guide shows precise odds (and 1-in-N for ultra-rares)"
  ],
  "20260911u": [
    "Fishing Idle: leaderboard no longer resets ICE_DRAGON below a better-than-mythic catch"
  ],
  "20260911t": [
    "Cross Walk: smoother ice riding (sticky floe, no hop/snap jitter)"
  ],
  "20260911s": [
    "Cross Walk: more precise hops; ice floes no longer kill you in tiny gaps; fairer cart hits"
  ],
  "20260911r": [
    "Runosaur: low crystal bats require holding ↓ / S (or swipe down) to duck under"
  ],
  "20260911q": [
    "Guessword: ice-melt tile reveal + Flex 4/5/6 signature",
    "Runosaur: ice caves, frost spikes, crystal bats, dragon chase",
    "Cross Walk: fantasy lanes — lava carts, ice floes, crystal meadows"
  ],
  "20260911p": [
    "Wing Hop: fix crashed dragon draw (invalid colors broke body/wings)"
  ],
  "20260911o": [
    "Wing Hop: fix invisible dragon — body no longer blends into sky (Ember etc.)"
  ],
  "20260911n": [
    "Wing Hop: more realistic dragon — scales, bat wings, reptile head"
  ],
  "20260911m": [
    "Wing Hop: wings flap forward/back instead of mostly up/down"
  ],
  "20260911k": [
    "Wing Hop: slow the dragon wing flap to a calmer beat"
  ],
  "20260911j": [
    "Wing Hop: much flappier dragon wings (faster beat + big flap on tap)"
  ],
  "20260911i": [
    "Wing Hop: dragon redraw — gradients, bigger eye, cleaner silhouette"
  ],
  "20260911h": [
    "Wing Hop: prettier little dragon (wings, eye, horns, smile)"
  ],
  "20260911g": [
    "Wing Hop: little dragon + castle towers (no more bird/pipes look)"
  ],
  "20260911f": [
    "Guessword: keyboard keys use the same Ice/Arcade/Warm colors as the tiles"
  ],
  "20260911e": [
    "Guessword: stronger stamp reveal (manual animation — can’t be blocked by CSS)"
  ],
  "20260911d": [
    "Guessword: stamp reveal via Web Animations so the skew actually shows"
  ],
  "20260911c": [
    "Guessword: fix stamp reveal — transform transition was canceling the skew"
  ],
  "20260911b": [
    "Guessword: try stamp/skew tile reveal instead of classic 3D flip"
  ],
  "20260911a": [
    "Guessword: Ice / Arcade / Warm board colors, rounded glowing tiles, color picker in Menu"
  ],
  "20260910f": [
    "Safer names: Block Merge, Bounce Break, Cross Walk, Runosaur"
  ],
  "20260910e": [
    "Safer game names: Guessword, Drop Four, Wing Hop, Pixel Drop, Block Sweep"
  ],
  "20260910d": [
    "Rename Lemmings to Dudes"
  ],
  "20260910c": [
    "Players count: cut MantleDB rate-limit spam so the shared roster can load again"
  ],
  "20260910b": [
    "Stop forcing username changes — once your name is saved here, it stays"
  ],
  "20260910a": [
    "Fix school/offline username gate: don’t wipe names when the name server is blocked; allow local play"
  ],
  "20260909r": [
    "Lemmings: clear the level when the save goal is met even if a Blocker is left behind"
  ],
  "20260909q": [
    "Lemmings: fix Turn Around — IN was over water so the level was unwinnable"
  ],
  "20260909p": [
    "Remove Rainbow name color for all players"
  ],
  "20260909o": [
    "Lemmings: 6 new levels (12 total) — Block, Build, Bomb, Dig+Float, Bash, Climb+Build"
  ],
  "20260909n": [
    "Lemmings: pick any unlocked level from the Levels menu"
  ],
  "20260909m": [
    "Lemmings: clarify Climb is an ability (not ladders); enough Climb for every walker"
  ],
  "20260909k": [
    "Lemmings: fix Climb (and harden Bash/Dig) so skills actually work"
  ],
  "20260909j": [
    "Lemmings: Build bridge is walkable (same floor height, not a wall)"
  ],
  "20260909i": [
    "Lemmings: Build makes a real bridge across gaps (not stairs into the sky)"
  ],
  "20260909h": [
    "Lemmings: clearer IN / OUT doors so they don’t look like broken terrain"
  ],
  "20260909g": [
    "Lemmings: fix Block skill jitter / flip-flopping"
  ],
  "20260909f": [
    "Lemmings: clearer how-to, level tips, and How to play button"
  ],
  "20260909e": [
    "Lemmings: save level progress and continue where you left off"
  ],
  "20260909d": [
    "Lemmings: restart current level (button or R)"
  ],
  "20260909c": [
    "Lemmings: fix levels and physics so walkers can reach the exit"
  ],
  "20260909b": [
    "New game: Lemmings — assign skills and save the crew"
  ],
  "20260909a": [
    "Remove unused player nickname dragon from the players list"
  ],
  "20260908az": [
    "Block Blast: cleared rows/columns can be used again"
  ],
  "20260908ay": [
    "Block Blast: drag-and-drop, combos, and closer scoring feel"
  ],
  "20260908ax": [
    "New game: Block Blast — place blocks, clear rows and columns"
  ],
  "20260908aw": [
    "Mine Depth: reset ICE_DRAGON dig stats only"
  ],
  "20260908av": [
    "Mine Depth: 1000 layers and 1000 ores"
  ],
  "20260908au": [
    "Mine Depth: fix gear upgrades not applying / hard to buy"
  ],
  "20260908at": [
    "Mine Depth: many more layers and ores (to Absolute Zero)"
  ],
  "20260908as": [
    "Mine Depth: more layers and ores (down to Singularity)"
  ],
  "20260908ar": [
    "Mine Depth: leaderboards for best depth and best ore"
  ],
  "20260908aq": [
    "Mine Depth: dig clicks capped at 75ms"
  ],
  "20260908ap": [
    "Mine Depth: dig feels like going down a shaft"
  ],
  "20260908ao": [
    "New game: Mine Depth — dig down, sell ore, upgrade drills"
  ],
  "20260908an": [
    "Runosaur: larger playfield"
  ],
  "20260908am": [
    "Runosaur: W jumps, S ducks"
  ],
  "20260908al": [
    "New game: Runosaur — jump spikes, duck bats, chase a high score"
  ],
  "20260908ak": [
    "Fix online Quick Play: waiting rooms now find each other instead of getting stuck",
    "Notifications for new chat messages and when your streak is about to die"
  ],
  "20260908aj": [
    "Feedback: send bug reports and ideas to ICE from My Games"
  ],
  "20260908aa": [
    "New game: Cow Merge — buy calves, merge to evolve, milk idle income"
  ],
  "20260908z": [
    "Fishing Idle: save (pin) cooler fish so they won't sell until you unsaved them"
  ],
  "20260908y": [
    "Fishing Idle: Divine / Eternal / Cosmic rarities, more gear, late-game spots"
  ],
  "20260908u": [
    "Fishing Idle: rarer high-tier fish + new Secret rarity (extremely rare)"
  ],
  "20260908r": [
    "Fishing Idle: set ICE_DRAGON best catch to Abyss King on the leaderboard"
  ],
  "20260908q": [
    "Fishing Idle leaderboard is now best fish caught (rarity), not lifetime coins"
  ],
  "20260908j": [
    "Fishing Idle remade: cast, reel on the bite, cooler, spots — not a clicker clone"
  ],
  "20260908i": [
    "New game: Fishing Idle — cast for coins, buy boats, set sail for bigger voyages"
  ],
  "20260908h": [
    "New game: Cross Walk — hop across meadows, lava carts, and ice floes"
  ],
  "20260908g": [
    "New game: Tower Stack — drop blocks and climb the leaderboard"
  ],
  "20260908f": [
    "Quizmaster: removed math questions from the question bank"
  ],
  "20260908e": [
    "Show LEGEND title and yellow color to everyone (locked until earned)"
  ],
  "20260908d": [
    "Hide locked titles/colors (Tester, red, Aurora, Mono, Tide, Rainbow)"
  ],
  "20260908c": [
    "Fix online vs Time Online mismatch (hidden tabs drop presence; sync clocks)"
  ],
  "20260908b": [
    "Hangman: more misses on Easy / Medium / Hard"
  ],
  "20260908a": [
    "Rainbow color also available to ICE_DRAGON for testing"
  ],
  "20260907z": [
    "Rainbow name color unlocked for Oskar"
  ],
  "20260907y": [
    "Fix Time Online leaderboard freezing (sync was wiping live ticks)"
  ],
  "20260907x": [
    "Crystal Clicker: +100 click and +100 idle upgrades"
  ],
  "20260907w": [
    "Crystal Clicker: number labels past Dc (UDc…C) + scientific fallback"
  ],
  "20260907v": [
    "Crystal Clicker: more Sp–No tier click + idle upgrades"
  ],
  "20260907u": [
    "Crystal Clicker: rebirths cost ×100 from Qa onward"
  ],
  "20260907t": [
    "Crystal Clicker: matching idle pack + more click upgrades"
  ],
  "20260907s": [
    "Crystal Clicker: another wave of late-game upgrades"
  ],
  "20260907r": [
    "Crystal Clicker: more late-game click + idle upgrades"
  ],
  "20260907q": [
    "Fix garbled Menu / × / · text on game pages (UTF-8 encoding)"
  ],
  "20260907p": [
    "Fix group chat create glitch (polling race + form reset)"
  ],
  "20260907o": [
    "Chat: Global channel for everyone + friend group chats"
  ],
  "20260907n": [
    "Friend chat works in-game: floating Chat button + message toasts"
  ],
  "20260907m": [
    "Friends chat: message friends from the Friends panel"
  ],
  "20260907l": [
    "Wing Hop: character skins (Classic, Sky, Rose, Ember, Mint, Ice, Midnight, Gold)"
  ],
  "20260907k": [
    "Players: show last online time on all-time roster and friends list"
  ],
  "20260907j": [
    "Guessword themes like Hangman (Animals, Food, Flags, Sports, Nature, Space, Music, Movies) — Practice mode"
  ],
  "20260907i": [
    "Fix Crystal Clicker leaderboard: ICE_DRAGON wipe was blocking new scores"
  ],
  "20260907h": [
    "Crystal Clicker: reset ICE_DRAGON leaderboard + local progress"
  ],
  "20260907g": [
    "Crystal Clicker: lots more click power upgrades (through Source Strike)"
  ],
  "20260907f": [
    "Crystal Clicker: rebirth 3M → 30M → ×10 each"
  ],
  "20260907e": [
    "Crystal Clicker: rebirth 3M → 9M → ×3 each"
  ],
  "20260907d": [
    "Crystal Clicker: rebirth scale ×3 (1st 100M, 2nd 300M, …)"
  ],
  "20260907c": [
    "Crystal Clicker: rebirth costs ×100 (1st 100M, then ×10 each)"
  ],
  "20260907b": [
    "Crystal Clicker: huge upgrade pack (~70 total click + idle)"
  ],
  "20260907a": [
    "Crystal Clicker: even more upgrades (Nova Punch through Absolute Crystal)"
  ],
  "20260906z": [
    "Crystal Clicker: more click & idle upgrades (up to Infinity Vein)"
  ],
  "20260906y": [
    "Crystal Clicker: click upgrades back to earlier prices"
  ],
  "20260906x": [
    "Removed Back button from My Games hub (Esc still leaves)"
  ],
  "20260906w": [
    "Hub Settings moved to the top-left header button (Back is in the toolbar)"
  ],
  "20260906v": [
    "Hub Settings: switch looks — Classic, Arcade, Ice, Retro, Workshop, Poster wall"
  ],
  "20260906u": [
    "Hub My Games tries an arcade cabinet look (easy to switch off)"
  ],
  "20260906t": [
    "Crystal Clicker leaderboard uses K / M / B shorthand"
  ],
  "20260906s": [
    "Crystal Clicker shows next rebirth multiplier (Now ×1 → after ×2)"
  ],
  "20260906r": [
    "Crystal Clicker: max click speed capped at once per 50ms"
  ],
  "20260906q": [
    "Crystal Clicker: forced local save wipe (progress starts over for everyone)"
  ],
  "20260906p": [
    "Crystal Clicker progress & leaderboard reset for everyone (other games unchanged)"
  ],
  "20260906o": [
    "Crystal Clicker numbers use K / M / B / T shorthand"
  ],
  "20260906n": [
    "Crystal Clicker: click-power upgrades cost more"
  ],
  "20260906m": [
    "Crystal Clicker shop organized into Click power and Idle income"
  ],
  "20260906l": [
    "Crystal Clicker: more upgrades (cart, gloves, vault, singularity, and more)"
  ],
  "20260906k": [
    "Crystal Clicker shows your earnings multiplier on screen"
  ],
  "20260906j": [
    "Crystal Clicker: fixed Buy buttons not working while income was running"
  ],
  "20260906i": [
    "Crystal Clicker: 2nd rebirth costs 10M (then ×10 each time)"
  ],
  "20260906h": [
    "Crystal Clicker: Rebirth at 1M crystals for ×2 earnings (stacks each rebirth)"
  ],
  "20260906g": [
    "New game: Crystal Clicker — tap, buy upgrades, climb the lifetime crystal board"
  ],
  "20260906f": [
    "Leaderboards refresh every second while open"
  ],
  "20260906e": [
    "Time Online leaderboard — see who spent the most time on the site (#1, #2, #3…)"
  ],
  "20260906d": [
    "Friends has its own hub button (no longer inside Players)"
  ],
  "20260906c": [
    "CHEESY LIL GUY holes are small round dots again (not dark blobs)"
  ],
  "20260906b": [
    "CHEESY LIL GUY holes are clearer (fixed flat cheese override)"
  ],
  "20260906a": [
    "CHEESY LIL GUY color now looks like cheese with holes"
  ],
  "20260905z": [
    "New title CHEESY LIL GUY (cheese color) for OscarVR29"
  ],
  "20260905y": [
    "New Tide color (green↔blue) for ICE_DRAGON and OscarVR29"
  ],
  "20260905x": [
    "Hjalte streak set to 2 days (7/14/30 streak achievements kept)"
  ],
  "20260905w": [
    "See how long until your daily streak dies on the Games badge and in the menu"
  ],
  "20260905v": [
    "Hjalte: 30-day streak plus 7/14/30 streak achievements"
  ],
  "20260905u": [
    "Guessword Daily is always 5 letters — 4/6 lengths stay in Practice only"
  ],
  "20260905t": [
    "Creator OWNER badge follows your chosen color again (not stuck on blue)",
    "Mobile Guessword: credit no longer covers the keyboard"
  ],
  "20260905s": [
    "Creator credit text is white (not gray) on PC and phone",
    "OWNER badge stays upright on mobile"
  ],
  "20260905r": [
    "Hangman themes: Animals, Food, Flags, Sports, Nature, Space, Music, Movies"
  ],
  "20260905q": [
    "Friends: add by username, accept requests, and invite to play",
    "Online Tic Tac Toe & Connect Four: Quick Play, room codes, friend invites"
  ],
  "20260904s": [
    "Choose your name/title color in Players",
    "Color picker only appears if you have a title"
  ],
  "20260904r": [
    "Choose which title to show if you have more than one"
  ],
  "20260904q": [
    "Player titles: blue OWNER, green OG, yellow LEGEND for all achievements"
  ],
  "20260904p": [
    "All-time players now includes everyone with a claimed username (like OscarVR29)"
  ],
  "20260904o": [
    "Hints disabled for now in Guessword and Sudoku"
  ],
  "20260904n": [
    "Reset Sudoku stats for player hjalte (other games unchanged)"
  ],
  "20260904m": [
    "Tic Tac Toe Hard mode is tough but beatable now",
    "Leaderboards auto-refresh every 30 seconds while open"
  ],
  "20260904l": [
    "Online leaderboards for every game — compete for #1"
  ],
  "20260904k": [
    "View board after a win or loss in every game"
  ],
  "20260904j": [
    "Achievements list ordered from easy (top) to hard (bottom)"
  ],
  "20260904i": [
    "2048: View board after game over"
  ],
  "20260904h": [
    "Connect Four and Tic Tac Toe: View board after a win or loss"
  ],
  "20260904g": [
    "Online count now matches the visible online name list"
  ],
  "20260904f": [
    "2048 tiles now slide so you can see them move"
  ],
  "20260904e": [
    "OscarVR29 shows in green on the Players board"
  ],
  "20260904d": [
    "Fix username popup so Backspace and typing work in the name field"
  ],
  "20260904c": [
    "Username popup is required before you can play on the hub or any game"
  ],
  "20260904b": [
    "All-time players list now shows real nicknames instead of stuck Guest entries"
  ],
  "20260904a": [
    "Lots of new achievements across every game",
    "Space Shooter, Brick Breaker, Tic Tac Toe, and Pixletris now have achievements too"
  ],
  "20260903u": [
    "Hide old Guest placeholder names from the Players board"
  ],
  "20260903t": [
    "Updates list in the Games menu — tap a version to see what changed"
  ],
  "20260903s": [
    "Lock your username so it can’t be changed until you unlock it"
  ],
  "20260903r": [
    "Tap online or all-time on the Players board to see name lists"
  ],
  "20260903q": [
    "Username required to play — no more skipping"
  ],
  "20260903p": [
    "Guessword opens in Practice after you finish today's Daily"
  ],
  "20260903o": [
    "Bigger created-by credit on computer screens",
    "Created by ICE_DRAGON also shows in the menu"
  ],
  "20260903n": [
    "Side credit: created by ICE_DRAGON"
  ],
  "20260903m": [
    "ICE_DRAGON shows in blue on the Players board as the site creator"
  ],
  "20260903l": [
    "All-time player count — each person only adds +1 once",
    "Coming back online later does not increase the total again"
  ],
  "20260903k": [
    "See how many players are online right now",
    "Online count refreshes every minute"
  ],
  "20260903j": [
    "Player nicknames are unique — once taken, nobody else can use that name",
    "Case does not matter (ICE_DRAGON and ice_dragon are the same)"
  ],
  "20260903i": [
    "Players board — see recent nicknames and which games they opened",
    "Pick a player name once; it syncs across visitors"
  ],
  "20260903h": [
    "Confetti on wins in every game",
    "New high scores also get a confetti burst"
  ],
  "20260903g": [
    "Sound effects in every game — shared mute button",
    "Mute choice is remembered across the whole site"
  ],
  "20260903f": [
    "Sound effects in Guessword — keys, flips, win, and lose",
    "Mute button next to the theme toggle"
  ],
  "20260903e": [
    "Daily Guessword — everyone gets the same word each day",
    "Practice mode still lets you play extra random words",
    "Share today's colored-square result from the menu"
  ],
  "20260903d": [
    "Achievements across all games — unlock badges as you play",
    "New Achievements button in the games hub",
    "Toast popup when you unlock a badge"
  ],
  "20260903a": [
    "New Share moment button in the games hub",
    "Share sheet support on phone and copy fallback on desktop"
  ],
  "20260902h": [
    "Site ready for mygames.com hosting",
    "Site name and domain live in site-config.js — easy to change later"
  ],
  "20260902g": [
    "Menu reminder when your daily streak needs a play today",
    "What's new popup after updates",
    "Daily streak now resets after 48 hours without playing"
  ],
  "20260902f": [
    "Daily play streak across all games",
    "High scores, favorites, and continue last game",
    "Snake: slower speed and 4 apples"
  ]
};

const HUB_GAMES = [
  { id: "wordle", name: "Guessword", path: null },
  { id: "space", name: "Space Shooter", path: "space-shooter/index.html" },
  { id: "quiz", name: "Quizmaster", path: "quiz/index.html" },
  { id: "breakout", name: "Bounce Break", path: "breakout/index.html" },
  { id: "hangman", name: "Hangman", path: "hangman/index.html" },
  { id: "2048", name: "Block Merge", path: "2048/index.html" },
  { id: "snake", name: "Snake", path: "snake/index.html" },
  { id: "memory", name: "Memory Match", path: "memory-match/index.html" },
  { id: "connect-four", name: "Drop Four", path: "connect-four/index.html" },
  { id: "math", name: "Math Sprint", path: "math/index.html" },
  { id: "sudoku", name: "Sudoku", path: "sudoku/index.html" },
  { id: "flappy", name: "Wing Hop", path: "flappy-bird/index.html" },
  { id: "tictactoe", name: "Tic Tac Toe", path: "tic-tac-toe/index.html" },
  { id: "pixletris", name: "Pixel Drop", path: "pixletris/index.html" },
  { id: "clicker", name: "Crystal Clicker", path: "clicker/index.html" },
  { id: "stacker", name: "Tower Stack", path: "stacker/index.html" },
  { id: "crossy", name: "Cross Walk", path: "crossy/index.html" },
  { id: "fishing", name: "Fishing Idle", path: "fishing/index.html" },
  { id: "cows", name: "Cow Merge", path: "cows/index.html" },
  { id: "dino", name: "Runosaur", path: "dino/index.html" },
  { id: "mine", name: "Mine Depth", path: "mine/index.html" },
  { id: "blockblast", name: "Block Sweep", path: "block-blast/index.html" },
  { id: "lemmings", name: "Dudes", path: "lemmings/index.html" }
];

/** Leaderboard tabs = hub-only boards first, then games (Mine Depth splits into depth + ore). */
const LEADERBOARD_GAMES = [
  { id: "online-time", name: "Time Online" },
  ...HUB_GAMES.flatMap((game) =>
    game.id === "mine"
      ? [
          { id: "mine", name: "Mine Depth" },
          { id: "mine-ore", name: "Mine Best Ore" }
        ]
      : [game]
  )
];

const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const messageEl = document.getElementById("message");
const menuModal = document.getElementById("menu-modal");
const menuTitle = document.getElementById("menu-title");
const menuSubtitle = document.getElementById("menu-subtitle");
const streakReminderEl = document.getElementById("streak-reminder");
const whatsNewModal = document.getElementById("whats-new-modal");
const whatsNewBuild = document.getElementById("whats-new-build");
const whatsNewList = document.getElementById("whats-new-list");
const whatsNewOkBtn = document.getElementById("whats-new-ok");
const statWins = document.getElementById("stat-wins");
const statWinPct = document.getElementById("stat-win-pct");
const statStreak = document.getElementById("stat-streak");
const statPlayed = document.getElementById("stat-played");
const menuResumeBtn = document.getElementById("menu-resume");
const menuViewBoardBtn = document.getElementById("menu-view-board");
const menuNewWordBtn = document.getElementById("menu-new-word");
const menuGamesBtn = document.getElementById("menu-games");
const wordThemePicker = document.getElementById("word-theme-picker");
const wordThemeHintEl = document.getElementById("word-theme-hint");
const colorThemePicker = document.getElementById("color-theme-picker");
const colorThemeHintEl = document.getElementById("color-theme-hint");
const menuBtn = document.getElementById("menu-btn");
const gamesScreen = document.getElementById("games-screen");
const gamesMessageEl = document.getElementById("games-message");
const continueLastBtn = document.getElementById("continue-last-btn");
const toggleScoresBtn = document.getElementById("toggle-scores-btn");
const toggleLeaderboardsBtn = document.getElementById("toggle-leaderboards-btn");
const toggleAchievementsBtn = document.getElementById("toggle-achievements-btn");
const togglePlayersBtn = document.getElementById("toggle-players-btn");
const toggleFriendsBtn = document.getElementById("toggle-friends-btn");
const toggleUpdatesBtn = document.getElementById("toggle-updates-btn");
const toggleFeedbackBtn = document.getElementById("toggle-feedback-btn");
const toggleSettingsBtn = document.getElementById("toggle-settings-btn");
const shareMomentBtn = document.getElementById("share-moment-btn");
const highScoresPanel = document.getElementById("high-scores-panel");
const highScoresList = document.getElementById("high-scores-list");
const leaderboardsPanel = document.getElementById("leaderboards-panel");
const leaderboardGamePicker = document.getElementById("leaderboard-game-picker");
const leaderboardList = document.getElementById("leaderboard-list");
const leaderboardEmpty = document.getElementById("leaderboard-empty");
const updatesPanel = document.getElementById("updates-panel");
const updatesList = document.getElementById("updates-list");
const updatesCount = document.getElementById("updates-count");
const feedbackPanel = document.getElementById("feedback-panel");
const feedbackForm = document.getElementById("feedback-form");
const feedbackType = document.getElementById("feedback-type");
const feedbackGame = document.getElementById("feedback-game");
const feedbackText = document.getElementById("feedback-text");
const feedbackCount = document.getElementById("feedback-count");
const feedbackStatus = document.getElementById("feedback-status");
const feedbackSendBtn = document.getElementById("feedback-send-btn");
const feedbackInbox = document.getElementById("feedback-inbox");
const feedbackList = document.getElementById("feedback-list");
const feedbackEmpty = document.getElementById("feedback-empty");
const feedbackUnread = document.getElementById("feedback-unread");
const feedbackRefreshBtn = document.getElementById("feedback-refresh-btn");
const playersPanel = document.getElementById("players-panel");
const friendsPanel = document.getElementById("friends-panel");
const friendsChatPoll = () => renderFriendsPanel();
let friendsComposingGroup = false;
let friendsCreatingGroupBusy = false;
const hubSettingsPanel = document.getElementById("hub-settings-panel");
const hubThemePicker = document.getElementById("hub-theme-picker");
const gamesEyebrow = document.getElementById("games-eyebrow");
const playersList = document.getElementById("players-list");
const playersTotals = document.getElementById("players-totals");
const playerNameInput = document.getElementById("player-name-input");
const savePlayerNameBtn = document.getElementById("save-player-name-btn");
const lockPlayerNameBtn = document.getElementById("lock-player-name-btn");
const playerNameLockHint = document.getElementById("player-name-lock-hint");
const playerNameModal = document.getElementById("player-name-modal");
const playerNameModalInput = document.getElementById("player-name-modal-input");
const playerNameSaveBtn = document.getElementById("player-name-save");
const achievementsPanel = document.getElementById("achievements-panel");
const achievementsGrid = document.getElementById("achievements-grid");
const achievementsCount = document.getElementById("achievements-count");
const achievementToast = document.getElementById("achievement-toast");
const gamesGrid = document.getElementById("games-grid");
const hubStreakBadge = document.getElementById("hub-streak-badge");
const hubStreakCount = document.getElementById("hub-streak-count");
const hubStreakTimer = document.getElementById("hub-streak-timer");
let streakTimerInterval = null;
const hintBtn = document.getElementById("hint-btn");
const langBtn = document.getElementById("lang-btn");
const themeBtn = document.getElementById("theme-btn");
const lengthBtn = document.getElementById("length-btn");
const modeBtn = document.getElementById("mode-btn");
const menuDailyBtn = document.getElementById("menu-daily");
const menuShareDailyBtn = document.getElementById("menu-share-daily");

const KEYBOARD_EN = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
];

const KEYBOARD_DA = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "Å"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Æ", "Ø"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
];

const KEYBOARD_IS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Á", "Ð", "É", "Í", "Ó", "Ö", "Ú", "Ý", "Þ", "Æ"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
];

const LANGUAGES = ["en", "da", "is"];

const LENGTHS = [4, 5, 6];
const DAILY_LENGTH = 5;

let currentLang = localStorage.getItem(LANG_KEY) || "en";
const savedLength = Number(localStorage.getItem(LENGTH_KEY));
let currentLength = LENGTHS.includes(savedLength) ? savedLength : 5;
let playMode = localStorage.getItem(MODE_KEY) === "practice" ? "practice" : "daily";
let wordTheme = localStorage.getItem(WORD_THEME_KEY) || "classic";
if (typeof WORDLE_THEMES !== "undefined" && !WORDLE_THEMES[wordTheme]) {
  wordTheme = "classic";
}
// Prefer Practice once today's 5-letter Daily (this language) is finished
if (isTodayDailyFinished(currentLang, DAILY_LENGTH)) {
  playMode = "practice";
  try {
    localStorage.setItem(MODE_KEY, "practice");
  } catch {}
}
if (playMode === "daily") {
  currentLength = DAILY_LENGTH;
}
let COLS = currentLength;
let state = loadState();
let submitting = false;

function getKeyboardRows() {
  if (currentLang === "da") return KEYBOARD_DA;
  if (currentLang === "is") return KEYBOARD_IS;
  return KEYBOARD_EN;
}

function getDictionaryWordList() {
  if (currentLength === 4) {
    if (currentLang === "da") return WORDS_DA_4;
    if (currentLang === "is") return WORDS_IS_4;
    return WORDS_4;
  }
  if (currentLength === 6) {
    if (currentLang === "da") return WORDS_DA_6;
    if (currentLang === "is") return WORDS_IS_6;
    return WORDS_6;
  }
  if (currentLang === "da") return WORDS_DA;
  if (currentLang === "is") return WORDS_IS;
  return WORDS;
}

function getWordThemeDef(id = wordTheme) {
  const themes = typeof WORDLE_THEMES !== "undefined" ? WORDLE_THEMES : null;
  return themes?.[id] || themes?.classic || null;
}

function isClassicWordTheme() {
  return wordTheme === "classic" || !Array.isArray(getWordThemeDef()?.words);
}

function getThemeWordsForLength() {
  const theme = getWordThemeDef();
  if (!Array.isArray(theme?.words)) return [];
  return theme.words.filter((w) => w.length === currentLength);
}

function getWordList() {
  // Daily is always the shared classic dictionary word.
  if (isDailyMode() || isClassicWordTheme()) return getDictionaryWordList();
  const themed = getThemeWordsForLength();
  if (themed.length >= 8) return themed;
  return getDictionaryWordList();
}

function getValidGuesses() {
  let guesses;
  if (currentLength === 4) {
    if (currentLang === "da") guesses = VALID_GUESSES_DA_4;
    else if (currentLang === "is") guesses = VALID_GUESSES_IS_4;
    else guesses = VALID_GUESSES_4;
  } else if (currentLength === 6) {
    if (currentLang === "da") guesses = VALID_GUESSES_DA_6;
    else if (currentLang === "is") guesses = VALID_GUESSES_IS_6;
    else guesses = VALID_GUESSES_6;
  } else if (currentLang === "da") {
    guesses = VALID_GUESSES_DA;
  } else if (currentLang === "is") {
    guesses = VALID_GUESSES_IS;
  } else {
    guesses = VALID_GUESSES;
  }

  return guesses;
}

function isValidGuess(guess) {
  if (getValidGuesses().has(guess)) return true;
  if (getDictionaryWordList().includes(guess)) return true;
  return getThemeWordsForLength().includes(guess);
}

function getValidLetters() {
  if (currentLang === "da") return /^[A-ZÆØÅ]$/;
  if (currentLang === "is") return /^[A-ZÁÐÉÍÓÖÚÝÞÆ]$/;
  return /^[A-Z]$/;
}

function updateLangButton() {
  langBtn.textContent = currentLang.toUpperCase();
}

function updateLengthButton() {
  if (!lengthBtn) return;
  lengthBtn.textContent = `Flex ${currentLength}`;
  const daily = isDailyMode();
  lengthBtn.classList.toggle("hidden", daily);
  lengthBtn.disabled = daily;
  lengthBtn.title = daily
    ? "Daily Guessword is always 5 letters"
    : "Flex Length — Guessword's signature 4 / 5 / 6 (Practice)";
  lengthBtn.setAttribute("aria-hidden", daily ? "true" : "false");
  boardEl.classList.toggle("len-4", currentLength === 4);
  boardEl.classList.toggle("len-6", currentLength === 6);
}

function applyLengthForMode() {
  if (isDailyMode()) {
    currentLength = DAILY_LENGTH;
  } else {
    const saved = Number(localStorage.getItem(LENGTH_KEY));
    currentLength = LENGTHS.includes(saved) ? saved : DAILY_LENGTH;
  }
  COLS = currentLength;
  updateLengthButton();
}

function switchLength() {
  if (isDailyMode()) {
    showMessage("Daily is always 5 letters — switch to Practice to change length", true);
    return;
  }
  const idx = LENGTHS.indexOf(currentLength);
  currentLength = LENGTHS[(idx + 1) % LENGTHS.length];
  COLS = currentLength;
  localStorage.setItem(LENGTH_KEY, String(currentLength));
  updateLengthButton();
  reloadBoard();
}

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  themeBtn.textContent = theme === "light" ? "☾" : "☀";
  themeBtn.title = theme === "light" ? "Switch to dark background" : "Switch to light background";
}

function getGuessColorThemeId() {
  const raw = localStorage.getItem(COLOR_THEME_KEY) || "ice";
  return GUESS_COLOR_THEMES[raw] ? raw : "ice";
}

function updateColorThemePicker() {
  const id = getGuessColorThemeId();
  colorThemePicker?.querySelectorAll("[data-guess-colors]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.guessColors === id);
  });
  const def = GUESS_COLOR_THEMES[id];
  if (colorThemeHintEl && def) {
    colorThemeHintEl.textContent = `${def.label} · ${def.blurb}`;
  }
}

function applyGuessColorTheme(themeId = getGuessColorThemeId()) {
  const id = GUESS_COLOR_THEMES[themeId] ? themeId : "ice";
  try {
    localStorage.setItem(COLOR_THEME_KEY, id);
  } catch {}
  document.body.setAttribute("data-guess-colors", id);
  updateColorThemePicker();
}

function setGuessColorTheme(themeId) {
  if (!GUESS_COLOR_THEMES[themeId]) return;
  applyGuessColorTheme(themeId);
  showMessage(`${GUESS_COLOR_THEMES[themeId].label} colors`, false, 1200);
}

function toggleTheme() {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

function playSound(kind, extra) {
  window.HubSound?.play(kind, extra);
}

function switchLanguage() {
  const idx = LANGUAGES.indexOf(currentLang);
  currentLang = LANGUAGES[(idx + 1) % LANGUAGES.length];
  localStorage.setItem(LANG_KEY, currentLang);
  updateLangButton();
  reloadBoard();
}

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDailyShort(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ letter: "", status: null }))
  );
}

function pickSecretWord() {
  const words = getWordList();
  return words[Math.floor(Math.random() * words.length)];
}

function pickDailyWord() {
  const words = getWordList();
  if (!words.length) return pickSecretWord();
  const seed = hashSeed(`wordle-daily|${todayLocal()}|${currentLang}|${DAILY_LENGTH}`);
  return words[seed % words.length];
}

function isDailyMode() {
  return playMode === "daily";
}

function isTodayDailyFinished(lang = currentLang, length = DAILY_LENGTH) {
  try {
    const key = `${STORAGE_KEY}-daily-${lang}-${length}-${todayLocal()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data && (data.gameStatus === "won" || data.gameStatus === "lost");
  } catch {
    return false;
  }
}

function setPlayMode(mode) {
  playMode = mode === "practice" ? "practice" : "daily";
  localStorage.setItem(MODE_KEY, playMode);
  applyLengthForMode();
}

function updateModeButton() {
  if (!modeBtn) return;
  if (isDailyMode()) {
    modeBtn.textContent = `Daily · ${formatDailyShort(todayLocal())}`;
    modeBtn.classList.add("is-daily");
    modeBtn.title = "Playing today's shared 5-letter word. Tap to switch to Practice.";
  } else {
    const label = getWordThemeDef()?.label || "Classic";
    modeBtn.textContent = label === "Classic" ? "Practice" : `Practice · ${label}`;
    modeBtn.classList.remove("is-daily");
    modeBtn.title =
      "Practice: themed word packs + Flex Length (4/5/6). Tap for today's Daily Guessword.";
  }
}

function togglePlayMode() {
  setPlayMode(isDailyMode() ? "practice" : "daily");
  reloadBoard();
  showMessage(
    isDailyMode() ? "Today's Daily Guessword" : "Practice · themes + Flex 4/5/6"
  );
}

function loadState() {
  try {
    let saved = localStorage.getItem(storageKey());
    // Older classic Practice saves had no theme suffix.
    if (!saved && !isDailyMode() && isClassicWordTheme()) {
      saved = localStorage.getItem(`${STORAGE_KEY}-${currentLang}-${currentLength}`);
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed.secretWord &&
        parsed.secretWord.length === currentLength &&
        parsed.board &&
        typeof parsed.currentRow === "number" &&
        typeof parsed.currentCol === "number" &&
        parsed.gameStatus &&
        (!isDailyMode() || parsed.dailyDate === todayLocal())
      ) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return newGameState();
}

function newGameState() {
  return {
    secretWord: isDailyMode() ? pickDailyWord() : pickSecretWord(),
    board: createEmptyBoard(),
    currentRow: 0,
    currentCol: 0,
    gameStatus: "playing",
    keyStates: {},
    dailyDate: isDailyMode() ? todayLocal() : null
  };
}

function storageKey() {
  if (isDailyMode()) {
    return `${STORAGE_KEY}-daily-${currentLang}-${currentLength}-${todayLocal()}`;
  }
  const themePart = isClassicWordTheme() ? "classic" : wordTheme;
  return `${STORAGE_KEY}-${currentLang}-${currentLength}-${themePart}`;
}

function saveState() {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function loadStats() {
  try {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        gamesPlayed: parsed.gamesPlayed ?? 0,
        wins: parsed.wins ?? 0,
        currentStreak: parsed.currentStreak ?? 0
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return { gamesPlayed: 0, wins: 0, currentStreak: 0 };
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function getWinPercent(stats) {
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((stats.wins / stats.gamesPlayed) * 100);
}

function recordGameResult(won) {
  const stats = loadStats();
  stats.gamesPlayed += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
  } else {
    stats.currentStreak = 0;
  }
  saveStats(stats);
  if (stats.wins > 0) window.HubLeaderboard?.submit("wordle", stats.wins);
  return stats;
}

function formatStreakTimeLeft(hours) {
  if (!(hours > 0)) return "";
  const totalMins = Math.max(1, Math.round(Number(hours) * 60));
  const days = Math.floor(totalMins / (60 * 24));
  const hrs = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (days > 0) return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
  if (hrs > 0) return mins > 0 && hrs < 8 ? `${hrs}h ${mins}m` : `${hrs}h`;
  return `${mins}m`;
}

function formatStreakHoursLeft(hours) {
  return formatStreakTimeLeft(hours) || null;
}

function renderStreakReminder() {
  if (!streakReminderEl || typeof HubStreak === "undefined") {
    streakReminderEl?.classList.add("hidden");
    return;
  }

  const status = HubStreak.getStatus();
  streakReminderEl.classList.remove("is-urgent", "is-done");
  const left = formatStreakTimeLeft(status.hoursLeft);

  if (status.playedToday && status.streak > 0) {
    const dayLabel = status.streak === 1 ? "day" : "days";
    streakReminderEl.textContent = left
      ? `Streak saved today! 🔥 ${status.streak} ${dayLabel} · dies in ${left} if you stop playing.`
      : `Streak saved for today! 🔥 ${status.streak} ${dayLabel}.`;
    streakReminderEl.classList.add("is-done");
    streakReminderEl.classList.remove("hidden");
    return;
  }

  if (status.streak > 0 && left) {
    streakReminderEl.textContent = `You haven't played today — streak dies in ${left}.`;
    streakReminderEl.classList.add("is-urgent");
    streakReminderEl.classList.remove("hidden");
    return;
  }

  if (status.streak === 0) {
    streakReminderEl.textContent = "Play any game today to start a daily streak.";
    streakReminderEl.classList.remove("hidden");
    return;
  }

  streakReminderEl.classList.add("hidden");
}

function getSeenBuild() {
  return localStorage.getItem(SEEN_BUILD_KEY) || "";
}

function markBuildSeen() {
  const build = window.WORDLE_BUILD || "";
  if (build) localStorage.setItem(SEEN_BUILD_KEY, build);
}

function showWhatsNew() {
  const build = window.WORDLE_BUILD || "";
  if (!build || build === getSeenBuild()) return false;

  const notes = CHANGELOG[build];
  if (!notes?.length) {
    markBuildSeen();
    return false;
  }

  if (whatsNewBuild) whatsNewBuild.textContent = build;
  if (whatsNewList) {
    whatsNewList.innerHTML = notes.map((note) => `<li>${note}</li>`).join("");
  }
  whatsNewModal?.classList.remove("hidden");
  return true;
}

function hideWhatsNew() {
  whatsNewModal?.classList.add("hidden");
  markBuildSeen();
}

function getChangelogEntries() {
  return Object.keys(CHANGELOG)
    .filter((id) => Array.isArray(CHANGELOG[id]) && CHANGELOG[id].length)
    .sort((a, b) => b.localeCompare(a))
    .map((id) => ({ id, notes: CHANGELOG[id] }));
}

function formatUpdateBuildLabel(build) {
  const raw = String(build || "");
  // 20260903t → Sep 3, 2026
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})([a-z]?)$/i);
  if (!m) return raw;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1] || m[2];
  const day = String(Number(m[3]));
  const letter = m[4] ? ` · ${m[4].toUpperCase()}` : "";
  return `${month} ${day}, ${m[1]}${letter}`;
}

function countUnseenUpdates() {
  const seen = getSeenBuild();
  const current = window.WORDLE_BUILD || "";
  if (!current || current === seen) return 0;
  return getChangelogEntries().filter((e) => e.id.localeCompare(seen) > 0).length;
}

function updateUpdatesButtonLabel(open = false) {
  if (!toggleUpdatesBtn) return;
  const unseen = countUnseenUpdates();
  if (open) {
    toggleUpdatesBtn.textContent = unseen > 0 ? `Hide updates · ${unseen} new` : "Hide updates";
  } else {
    toggleUpdatesBtn.textContent = unseen > 0 ? `Updates · ${unseen} new` : "Updates";
  }
}

function renderUpdatesPanel() {
  if (!updatesList) return;
  const entries = getChangelogEntries();
  const seen = getSeenBuild();
  const current = window.WORDLE_BUILD || "";
  if (updatesCount) updatesCount.textContent = `${entries.length}`;

  if (!entries.length) {
    updatesList.innerHTML = `<li class="updates-empty">No updates listed yet.</li>`;
    updateUpdatesButtonLabel(!updatesPanel?.classList.contains("hidden"));
    return;
  }

  updatesList.innerHTML = entries
    .map((entry, index) => {
      const isLatest = entry.id === current || index === 0;
      const isUnseen = entry.id.localeCompare(seen) > 0;
      const badges = [
        isLatest ? `<span class="updates-badge is-latest">Latest</span>` : "",
        isUnseen ? `<span class="updates-badge is-new">New</span>` : ""
      ]
        .filter(Boolean)
        .join("");
      const notes = entry.notes
        .map((note) => `<li>${escapeHtml(note)}</li>`)
        .join("");
      return `<li class="updates-item${isUnseen ? " is-unseen" : ""}">
        <details ${isLatest ? "open" : ""}>
          <summary>
            <span class="updates-summary-main">
              <span class="updates-build">${escapeHtml(formatUpdateBuildLabel(entry.id))}</span>
              <span class="updates-build-id">${escapeHtml(entry.id)}</span>
            </span>
            <span class="updates-badges">${badges}</span>
          </summary>
          <ul class="updates-notes">${notes}</ul>
        </details>
      </li>`;
    })
    .join("");

  updateUpdatesButtonLabel(!updatesPanel?.classList.contains("hidden"));
}

function applySiteConfig() {
  const cfg = window.SITE_CONFIG || { name: "My Games", domain: "" };
  document.title = cfg.name;
  const gamesTitle = document.getElementById("games-title");
  if (gamesTitle) gamesTitle.textContent = cfg.name;
}

function hideMenu() {
  menuModal.classList.add("hidden");
}

function updateWordThemePicker() {
  const daily = isDailyMode();
  wordThemePicker?.querySelectorAll("[data-word-theme]").forEach((btn) => {
    const id = btn.dataset.wordTheme;
    const active = daily ? id === "classic" : id === wordTheme;
    btn.classList.toggle("active", active);
    btn.disabled = daily && id !== "classic";
  });
  if (wordThemeHintEl) {
    const def = getWordThemeDef(daily ? "classic" : wordTheme);
    wordThemeHintEl.textContent = daily
      ? "Daily is always Classic · Themes unlock in Practice"
      : `${def?.label || "Classic"}${def?.blurb ? ` · ${def.blurb}` : ""} · Guesses still use the full dictionary`;
  }
}

function setWordTheme(mode) {
  const def = getWordThemeDef(mode);
  if (!def) return;
  const next = def.id;
  const wasDaily = isDailyMode();
  const changed = next !== wordTheme || (next !== "classic" && wasDaily);
  wordTheme = next;
  try {
    localStorage.setItem(WORD_THEME_KEY, next);
  } catch {}
  if (next !== "classic" && wasDaily) {
    setPlayMode("practice");
  }
  updateWordThemePicker();
  if (!changed) return;
  stopConfetti();
  submitting = false;
  state = newGameState();
  saveState();
  render();
  updateModeButton();
  updateLengthButton();
  showMessage(`Theme: ${def.label}`);
}

function showMenu() {
  hideGamesScreen();
  const stats = loadStats();
  const won = state.gameStatus === "won";
  const lost = state.gameStatus === "lost";
  const finished = won || lost;
  const theme = getWordThemeDef(isDailyMode() ? "classic" : wordTheme);

  if (won) {
    menuTitle.textContent = isDailyMode() ? "Daily solved!" : "You Won!";
    menuSubtitle.textContent = getWinMessage(Math.max(0, state.currentRow));
  } else if (lost) {
    menuTitle.textContent = isDailyMode() ? "Daily complete" : "Game Over";
    menuSubtitle.textContent = `The word was ${state.secretWord.toUpperCase()}`;
  } else if (isDailyMode()) {
    menuTitle.textContent = "Daily Guessword";
    menuSubtitle.textContent = `Today's shared ${currentLength}-letter word · ${currentLang.toUpperCase()}. Same for everyone.`;
  } else {
    menuTitle.textContent = "Menu";
    menuSubtitle.textContent = `${theme?.label || "Classic"} practice · Resume or start a new word.`;
  }

  menuResumeBtn.classList.toggle("hidden", won);
  menuViewBoardBtn?.classList.toggle("hidden", !finished);
  if (menuNewWordBtn) {
    menuNewWordBtn.textContent = isDailyMode() ? "Practice" : "New Word";
  }
  menuDailyBtn?.classList.toggle("hidden", isDailyMode());
  menuShareDailyBtn?.classList.toggle("hidden", !(isDailyMode() && finished));
  updateWordThemePicker();
  updateColorThemePicker();

  statWins.textContent = stats.wins;
  statWinPct.textContent = getWinPercent(stats);
  statStreak.textContent = stats.currentStreak;
  statPlayed.textContent = stats.gamesPlayed;
  renderStreakReminder();
  menuModal.classList.remove("hidden");
}

function isGamesScreenOpen() {
  return !gamesScreen.classList.contains("hidden");
}

function readNumberKey(key) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function readJsonKey(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function maxAcrossKeys(keys) {
  return keys.reduce((best, key) => Math.max(best, readNumberKey(key)), 0);
}

function formatSeconds(total) {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

function getTodayDailyHubLabel() {
  const today = todayLocal();
  const prefix = `${STORAGE_KEY}-daily-`;
  const suffix = `-${today}`;
  let inProgress = false;
  let lost = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;
      const data = readJsonKey(key);
      if (!data) continue;
      if (data.gameStatus === "won") return "Daily solved";
      if (data.gameStatus === "lost") lost = true;
      if (data.gameStatus === "playing" && data.currentRow > 0) inProgress = true;
    }
  } catch {
    return "";
  }
  if (lost) return "Daily finished";
  if (inProgress) return "Daily in progress";
  return "";
}

function getHubScore(gameId) {
  switch (gameId) {
    case "wordle": {
      const stats = readJsonKey(STATS_KEY, null);
      const daily = getTodayDailyHubLabel();
      if (!stats || !stats.gamesPlayed) {
        return { label: daily || "No games yet", sort: 0 };
      }
      const pct = stats.gamesPlayed
        ? Math.round((stats.wins / stats.gamesPlayed) * 100)
        : 0;
      const base = `${stats.wins} wins · ${pct}% · streak ${stats.currentStreak || 0}`;
      return {
        label: daily ? `${daily} · ${base}` : base,
        sort: stats.wins || 0
      };
    }
    case "space": {
      const score = maxAcrossKeys([
        "space-shooter-high-score-easy",
        "space-shooter-high-score-medium",
        "space-shooter-high-score-hard",
        "space-shooter-high-score"
      ]);
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "quiz": {
      const score = maxAcrossKeys([
        "quizmaster-high-score-easy",
        "quizmaster-high-score-medium",
        "quizmaster-high-score-hard",
        "quizmaster-high-score"
      ]);
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "breakout": {
      const score = readNumberKey("brick-breaker-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "hangman": {
      const legacy = readJsonKey("hangman-stats", {});
      let bestStreak = legacy.bestStreak || 0;
      let wins = legacy.wins || 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("hangman-stats-")) continue;
        const stats = readJsonKey(key, {});
        bestStreak = Math.max(bestStreak, stats.bestStreak || 0);
        wins += stats.wins || 0;
      }
      if (!wins && !bestStreak) return { label: "No wins yet", sort: 0 };
      return { label: `${wins} wins · best streak ${bestStreak}`, sort: bestStreak };
    }
    case "2048": {
      const score = readNumberKey("2048-best-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "snake": {
      const score = readNumberKey("snake-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "memory": {
      const best = readJsonKey("memory-match-best", {});
      let top = null;
      for (const entry of Object.values(best || {})) {
        if (!entry || typeof entry.time !== "number") continue;
        if (!top || entry.time < top.time || (entry.time === top.time && entry.moves < top.moves)) {
          top = entry;
        }
      }
      if (!top) return { label: "No clear yet", sort: 0 };
      return {
        label: `Best ${formatSeconds(top.time)} · ${top.moves} moves`,
        sort: 100000 - top.time
      };
    }
    case "connect-four": {
      const stats = readJsonKey("connect-four-stats", {});
      let wins = 0;
      for (const entry of Object.values(stats || {})) wins += entry.wins || 0;
      return { label: wins ? `${wins} CPU wins` : "No wins yet", sort: wins };
    }
    case "math": {
      const score = maxAcrossKeys([
        "math-sprint-high-score-easy",
        "math-sprint-high-score-medium",
        "math-sprint-high-score-hard"
      ]);
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "sudoku": {
      const times = readJsonKey("sudoku-best-times", {});
      const values = Object.values(times || {}).filter((n) => Number.isFinite(n) && n > 0);
      if (!values.length) return { label: "No clear yet", sort: 0 };
      const best = Math.min(...values);
      return { label: `Best ${formatSeconds(best)}`, sort: 100000 - best };
    }
    case "flappy": {
      const score = readNumberKey("flappy-bird-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "tictactoe": {
      const stats = readJsonKey("tic-tac-toe-stats", {});
      let wins = 0;
      for (const entry of Object.values(stats || {})) wins += entry.wins || 0;
      return { label: wins ? `${wins} CPU wins` : "No wins yet", sort: wins };
    }
    case "pixletris": {
      const score = readNumberKey("pixletris-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "clicker": {
      const score = readNumberKey("clicker-high-score-v3");
      if (!score) return { label: "No score yet", sort: 0 };
      const compact =
        typeof HubLeaderboard !== "undefined" && HubLeaderboard.formatScore
          ? HubLeaderboard.formatScore("clicker", score).replace(/^Best\s+/, "")
          : String(score);
      return { label: `Best ${compact}`, sort: score };
    }
    case "stacker": {
      const score = readNumberKey("stacker-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "crossy": {
      const score = readNumberKey("crossy-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "fishing": {
      const score = readNumberKey("fishing-best-catch-v1");
      if (!score) return { label: "No catch yet", sort: 0 };
      const label =
        typeof HubLeaderboard !== "undefined" && HubLeaderboard.formatScore
          ? HubLeaderboard.formatScore("fishing", score)
          : String(score);
      return { label: label.startsWith("Best ") ? label : `Best ${label}`, sort: score };
    }
    case "cows": {
      const score = readNumberKey("cows-best-tier-v1");
      if (!score) return { label: "No herd yet", sort: 0 };
      const label =
        typeof HubLeaderboard !== "undefined" && HubLeaderboard.formatScore
          ? HubLeaderboard.formatScore("cows", score)
          : String(score);
      return { label: label.startsWith("Best ") ? label : `Best ${label}`, sort: score };
    }
    case "dino": {
      const score = readNumberKey("dino-run-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "blockblast": {
      const score = readNumberKey("block-blast-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "lemmings": {
      const score = readNumberKey("lemmings-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "mine": {
      const depth = readNumberKey("mine-depth-best-v1");
      const oreScore = readNumberKey("mine-best-ore-v1");
      const oreLabel =
        typeof HubLeaderboard !== "undefined" && HubLeaderboard.formatScore
          ? HubLeaderboard.formatScore("mine-ore", oreScore)
          : "";
      if (!depth && !oreScore) return { label: "No digs yet", sort: 0 };
      const depthPart = depth ? `${depth}m` : "—";
      const orePart = oreScore && oreLabel && oreLabel !== "—" ? ` · ${oreLabel}` : "";
      return { label: `Best ${depthPart}${orePart}`, sort: depth || oreScore };
    }
    default:
      return { label: "—", sort: 0 };
  }
}

function loadFavorites() {
  const list = readJsonKey(HUB_FAVORITES_KEY, []);
  return Array.isArray(list) ? list.filter((id) => HUB_GAMES.some((g) => g.id === id)) : [];
}

function saveFavorites(list) {
  localStorage.setItem(HUB_FAVORITES_KEY, JSON.stringify(list));
}

function isFavorite(gameId) {
  return loadFavorites().includes(gameId);
}

function toggleFavorite(gameId) {
  const list = loadFavorites();
  const idx = list.indexOf(gameId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(gameId);
  saveFavorites(list);
  refreshGamesHub();
}

function getLastGameId() {
  const id = localStorage.getItem(HUB_LAST_GAME_KEY);
  return HUB_GAMES.some((g) => g.id === id) ? id : null;
}

function setLastGameId(gameId) {
  if (!HUB_GAMES.some((g) => g.id === gameId)) return;
  localStorage.setItem(HUB_LAST_GAME_KEY, gameId);
}

function getHubGame(gameId) {
  return HUB_GAMES.find((g) => g.id === gameId) || null;
}

function renderContinueButton() {
  const lastId = getLastGameId();
  const game = lastId ? getHubGame(lastId) : null;
  if (!game || !continueLastBtn) {
    continueLastBtn?.classList.add("hidden");
    return;
  }
  continueLastBtn.classList.remove("hidden");
  continueLastBtn.textContent = `Continue · ${game.name}`;
}

function renderCardScoresAndFavorites() {
  const favorites = new Set(loadFavorites());
  document.querySelectorAll(".game-card[data-game]").forEach((card) => {
    const id = card.dataset.game;
    card.classList.toggle("is-favorite", favorites.has(id));
    const favBtn = card.querySelector(".fav-btn");
    if (favBtn) {
      favBtn.textContent = favorites.has(id) ? "★" : "☆";
      favBtn.classList.toggle("active", favorites.has(id));
      favBtn.setAttribute("aria-pressed", favorites.has(id) ? "true" : "false");
    }
    const scoreEl = card.querySelector(`[data-score-for="${id}"]`);
    if (scoreEl) scoreEl.textContent = getHubScore(id).label;
  });
}

function sortGamesGrid() {
  if (!gamesGrid) return;
  const favorites = loadFavorites();
  const cards = [...gamesGrid.querySelectorAll(".game-card[data-game]")];
  cards.sort((a, b) => {
    const af = favorites.includes(a.dataset.game) ? 0 : 1;
    const bf = favorites.includes(b.dataset.game) ? 0 : 1;
    if (af !== bf) return af - bf;
    return 0;
  });
  cards.forEach((card) => gamesGrid.appendChild(card));
}

let selectedLeaderboardGame = "online-time";

function renderHighScoresList() {
  if (!highScoresList) return;
  const rows = HUB_GAMES.map((game) => {
    const score = getHubScore(game.id);
    return { name: game.name, label: score.label, sort: score.sort, fav: isFavorite(game.id) };
  }).sort((a, b) => {
    if (a.fav !== b.fav) return a.fav ? -1 : 1;
    return b.sort - a.sort;
  });

  highScoresList.innerHTML = rows
    .map(
      (row) =>
        `<li><span class="hs-name">${row.fav ? "★ " : ""}${row.name}</span><span class="hs-score">${row.label}</span></li>`
    )
    .join("");
}

function renderLeaderboardPicker() {
  if (!leaderboardGamePicker) return;
  leaderboardGamePicker.innerHTML = LEADERBOARD_GAMES.map(
    (game) =>
      `<button type="button" class="leaderboard-game-btn${
        game.id === selectedLeaderboardGame ? " active" : ""
      }" data-game="${game.id}">${escapeHtml(game.name)}</button>`
  ).join("");
}

function renderLeaderboardList() {
  if (!leaderboardList || !leaderboardEmpty) return;
  if (typeof HubLeaderboard === "undefined") {
    leaderboardList.innerHTML = "";
    leaderboardEmpty.textContent = "Leaderboards unavailable right now.";
    leaderboardEmpty.classList.remove("hidden");
    return;
  }

  const rows = HubLeaderboard.getBoard(selectedLeaderboardGame);
  if (!rows.length) {
    leaderboardList.innerHTML = "";
    leaderboardEmpty.textContent =
      selectedLeaderboardGame === "online-time"
        ? "No time logged yet — stay on the site with a username to claim #1."
        : "No scores yet — play to claim #1.";
    leaderboardEmpty.classList.remove("hidden");
    return;
  }

  leaderboardEmpty.classList.add("hidden");
  leaderboardList.innerHTML = rows
    .map((row) => {
      const rankClass = row.rank <= 3 ? "lb-rank top" : "lb-rank";
      return `<li class="${row.isYou ? "is-you" : ""}">
        <span class="${rankClass}">#${row.rank}</span>
        <span class="lb-name">${formatPlayerNameHtml(row.name)}${row.isYou ? " (you)" : ""}</span>
        <span class="lb-score">${escapeHtml(row.label)}</span>
      </li>`;
    })
    .join("");
}

async function refreshLeaderboardsPanel(opts = {}) {
  if (!leaderboardsPanel || leaderboardsPanel.classList.contains("hidden")) return;
  const doSync = opts.sync !== false;
  if (typeof HubPlays !== "undefined") {
    HubPlays.tickOnlineTime?.();
    HubPlays.reconcileOnlineSeconds?.();
  }
  renderLeaderboardPicker();
  if (doSync && typeof HubLeaderboard !== "undefined") {
    try {
      await HubLeaderboard.sync(true);
    } catch {}
    HubPlays?.reconcileOnlineSeconds?.();
  }
  renderLeaderboardList();
}

let leaderboardRefreshTimer = null;
let leaderboardRefreshTick = 0;

function startLeaderboardRefresh() {
  stopLeaderboardRefresh();
  leaderboardRefreshTick = 0;
  refreshLeaderboardsPanel({ sync: true });
  leaderboardRefreshTimer = setInterval(() => {
    leaderboardRefreshTick += 1;
    // Re-render every second; sync from network every 5s.
    refreshLeaderboardsPanel({ sync: leaderboardRefreshTick % 5 === 0 });
  }, 1000);
}

function stopLeaderboardRefresh() {
  if (!leaderboardRefreshTimer) return;
  clearInterval(leaderboardRefreshTimer);
  leaderboardRefreshTimer = null;
}

function getShareRows(limit = 3) {
  return HUB_GAMES.map((game) => {
    const score = getHubScore(game.id);
    return { name: game.name, label: score.label, sort: score.sort };
  })
    .filter((row) => row.sort > 0)
    .sort((a, b) => b.sort - a.sort)
    .slice(0, limit);
}

function buildShareMomentText() {
  const cfg = window.SITE_CONFIG || { name: "My Games" };
  const status = typeof HubStreak !== "undefined" ? HubStreak.getStatus() : null;
  const streak = status?.streak || 0;
  const rows = getShareRows(3);
  const url = window.location.origin + "/#games";

  const lines = [
    `🎮 ${cfg.name}`,
    `🔥 Daily streak: ${streak} ${streak === 1 ? "day" : "days"}`
  ];
  const left = formatStreakTimeLeft(status?.hoursLeft || 0);
  if (streak > 0 && left) {
    lines.push(`⏳ Dies in ${left} without another play`);
  }
  if (rows.length) {
    lines.push("🏆 Top scores:");
    rows.forEach((row) => lines.push(`• ${row.name}: ${row.label}`));
  }
  lines.push(url);
  return lines.join("\n");
}

async function shareMoment() {
  const cfg = window.SITE_CONFIG || { name: "My Games" };
  const text = buildShareMomentText();
  const url = window.location.origin + "/#games";
  const payload = {
    title: cfg.name,
    text,
    url
  };

  try {
    if (navigator.share) {
      await navigator.share(payload);
      showGamesMessage("Shared! 🚀", 1800);
      return;
    }
  } catch {
    // fall back to clipboard
  }

  try {
    await navigator.clipboard.writeText(text);
    showGamesMessage("Share text copied. Paste it anywhere!", 2600);
  } catch {
    showGamesMessage("Sharing not available on this browser yet.", 2600);
  }
}

function recordHubDailyPlay() {
  if (typeof HubStreak === "undefined") return null;
  const result = HubStreak.recordPlay();
  if (window.HubAchievements && result) {
    if (result.streak >= 3)  HubAchievements.unlock("streak_3");
    if (result.streak >= 7)  HubAchievements.unlock("streak_7");
    if (result.streak >= 14) HubAchievements.unlock("streak_14");
    if (result.streak >= 30) HubAchievements.unlock("streak_30");
  }
  return result;
}

function renderDailyStreak() {
  if (!hubStreakBadge || !hubStreakCount || typeof HubStreak === "undefined") return;

  const status = HubStreak.getStatus();
  hubStreakCount.textContent = String(status.streak);
  hubStreakBadge.classList.toggle("is-active", status.streak > 0 && !status.playedToday);
  hubStreakBadge.classList.toggle("is-done", !!status.playedToday && status.streak > 0);
  hubStreakBadge.classList.toggle("is-urgent", status.streak > 0 && !status.playedToday);

  const left = formatStreakTimeLeft(status.hoursLeft);
  if (hubStreakTimer) {
    if (status.streak > 0 && left) {
      hubStreakTimer.textContent = status.playedToday ? `· ${left} left` : `· dies in ${left}`;
      hubStreakTimer.classList.remove("hidden");
      hubStreakBadge.title = status.playedToday
        ? `Streak saved today. Play again within ${left} to keep it alive.`
        : `Play any game within ${left} or your streak dies.`;
    } else {
      hubStreakTimer.textContent = "";
      hubStreakTimer.classList.add("hidden");
      hubStreakBadge.title = "Play any game within 48 hours to keep your streak";
    }
  }

  if (status.celebrate) {
    const dayLabel = status.streak === 1 ? "day" : "days";
    const tip = left ? ` Dies in ${left} if you don't play again.` : "";
    showGamesMessage(`🔥 ${status.streak} ${dayLabel} streak!${tip}`, 3500);
    HubStreak.clearCelebration();
  }
}

function startStreakCountdown() {
  if (streakTimerInterval) return;
  streakTimerInterval = setInterval(() => {
    if (!gamesScreen || gamesScreen.classList.contains("hidden")) return;
    renderDailyStreak();
  }, 30000);
}

function stopStreakCountdown() {
  if (!streakTimerInterval) return;
  clearInterval(streakTimerInterval);
  streakTimerInterval = null;
}

function refreshGamesHub() {
  renderContinueButton();
  renderCardScoresAndFavorites();
  sortGamesGrid();
  renderHighScoresList();
  renderDailyStreak();
}

function showGamesMessage(text, duration = 2000) {
  gamesMessageEl.textContent = text;
  gamesMessageEl.classList.add("visible");
  clearTimeout(showGamesMessage._timer);
  if (duration > 0) {
    showGamesMessage._timer = setTimeout(() => {
      gamesMessageEl.classList.remove("visible");
    }, duration);
  }
}

function isHubOwner() {
  return isCreatorName(
    (typeof HubPlays !== "undefined" && HubPlays.getName?.()) || ""
  );
}

function canUseHubTheme(themeId) {
  const def = HUB_THEMES[themeId];
  if (!def) return false;
  if (def.ownerOnly && !isHubOwner()) return false;
  return true;
}

function getHubThemeId() {
  const raw = localStorage.getItem(HUB_THEME_KEY) || "classic";
  return canUseHubTheme(raw) ? raw : "classic";
}

function updateHubThemePicker() {
  const owner = isHubOwner();
  hubThemePicker?.querySelectorAll("[data-hub-theme]").forEach((btn) => {
    const id = btn.dataset.hubTheme;
    const def = HUB_THEMES[id];
    const show = !def?.ownerOnly || owner;
    btn.hidden = !show;
    btn.classList.toggle("hidden", !show);
  });
}

function applyHubTheme(themeId = getHubThemeId()) {
  const id = canUseHubTheme(themeId) ? themeId : "classic";
  try {
    localStorage.setItem(HUB_THEME_KEY, id);
  } catch {}
  if (gamesScreen) {
    [...gamesScreen.classList].forEach((cls) => {
      if (cls.startsWith("hub-theme-")) gamesScreen.classList.remove(cls);
    });
    if (id !== "classic") gamesScreen.classList.add(`hub-theme-${id}`);
  }
  if (gamesEyebrow) gamesEyebrow.textContent = HUB_THEMES[id].eyebrow;
  updateHubThemePicker();
  hubThemePicker?.querySelectorAll("[data-hub-theme]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.hubTheme === id);
  });
}

function showGamesScreen() {
  hideMenu();
  gamesMessageEl.classList.remove("visible");
  gamesMessageEl.textContent = "";
  if (highScoresPanel) highScoresPanel.classList.add("hidden");
  if (leaderboardsPanel) leaderboardsPanel.classList.add("hidden");
  if (hubSettingsPanel) hubSettingsPanel.classList.add("hidden");
  if (feedbackPanel) feedbackPanel.classList.add("hidden");
  if (toggleLeaderboardsBtn) toggleLeaderboardsBtn.textContent = "Leaderboards";
  if (toggleSettingsBtn) toggleSettingsBtn.textContent = "⚙ Settings";
  if (toggleFeedbackBtn) updateFeedbackButtonLabel(false);
  stopLeaderboardRefresh();
  applyHubTheme();
  refreshGamesHub();
  gamesScreen.classList.remove("hidden");
  startStreakCountdown();
  setTimeout(checkPendingAchievements, 400);
  maybeAskPlayerName();
  if (window.HubPlays) HubPlays.sync().catch(() => {});
  if (window.HubFeedback) HubFeedback.sync().catch(() => {});
  if (window.HubNotifications) HubNotifications.start?.();
  refreshOnlineCount();
  startOnlineCountPolling();
  updateUpdatesButtonLabel(false);
  updateFeedbackButtonLabel(false);
  maybeOpenHubHash();
}

function hideGamesScreen() {
  stopStreakCountdown();
  gamesScreen.classList.add("hidden");
}

function backFromGames() {
  hideGamesScreen();
  showMenu();
}

function selectGame(gameId) {
  if (!requirePlayerName()) return;
  const game = getHubGame(gameId);
  if (!game) {
    showGamesMessage("Coming soon");
    return;
  }

  setLastGameId(gameId);
  recordHubDailyPlay();
  if (window.HubPlays) HubPlays.record(gameId);
  // Track all-rounder achievement
  if (window.HubAchievements) {
    try {
      const played = JSON.parse(localStorage.getItem("hub-played-games") || "[]");
      if (!played.includes(gameId)) played.push(gameId);
      localStorage.setItem("hub-played-games", JSON.stringify(played));
      if (played.length >= 5) HubAchievements.unlock("five_games");
      const allIds = HUB_GAMES.map(g => g.id);
      if (allIds.every(id => played.includes(id))) HubAchievements.unlock("all_rounder");
    } catch {}
  }

  if (!game.path) {
    setPlayMode(isTodayDailyFinished() ? "practice" : "daily");
    reloadBoard();
    hideMenu();
    hideGamesScreen();
    if (isTodayDailyFinished()) {
      showMessage("Daily done — Practice mode");
    }
    return;
  }

  window.location.href = game.path;
}

function showMessage(text, isError = false, duration = 2000) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
  messageEl.classList.add("visible");
  clearTimeout(showMessage._timer);
  if (duration > 0) {
    showMessage._timer = setTimeout(() => {
      messageEl.classList.remove("visible");
    }, duration);
  }
}

function evaluateGuess(guess, secret) {
  const result = Array(COLS).fill("absent");
  const secretCounts = {};

  for (const letter of secret) {
    secretCounts[letter] = (secretCounts[letter] || 0) + 1;
  }

  for (let i = 0; i < COLS; i++) {
    if (guess[i] === secret[i]) {
      result[i] = "correct";
      secretCounts[guess[i]]--;
    }
  }

  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;
    const letter = guess[i];
    if (secretCounts[letter] > 0) {
      result[i] = "present";
      secretCounts[letter]--;
    }
  }

  return result;
}

function updateKeyState(letter, status) {
  const rank = { absent: 0, present: 1, correct: 2 };
  const key = String(letter || "").toUpperCase();
  if (!key || !status) return;
  const current = state.keyStates[key];
  if (!current || rank[status] > rank[current]) {
    state.keyStates[key] = status;
  }
}

function paintKeyboardKey(letter) {
  const key = String(letter || "").toUpperCase();
  const status = state.keyStates[key];
  if (!key || !status || !keyboardEl) return;
  const btn = keyboardEl.querySelector(`[data-key="${key}"]`);
  if (!btn) return;
  btn.classList.remove("correct", "present", "absent");
  btn.classList.add(status);
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.dataset.row = r;

    for (let c = 0; c < COLS; c++) {
      const cell = state.board[r][c];
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.col = c;

      if (cell.letter) {
        tile.textContent = cell.letter;
        tile.classList.add("filled");
      }
      if (cell.status) {
        tile.classList.add(cell.status);
      }

      rowEl.appendChild(tile);
    }
    boardEl.appendChild(rowEl);
  }
}

function renderKeyboard() {
  keyboardEl.innerHTML = "";
  for (const row of getKeyboardRows()) {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";

    for (const key of row) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.dataset.key = key;

      if (key === "ENTER" || key === "BACK") {
        btn.classList.add("wide");
        btn.textContent = key === "BACK" ? "⌫" : "ENTER";
        btn.setAttribute("aria-label", key === "BACK" ? "Backspace" : "Enter");
      } else {
        btn.textContent = key;
        const keyStatus = state.keyStates[key];
        if (keyStatus) btn.classList.add(keyStatus);
      }

      btn.addEventListener("click", () => handleKey(key));
      rowEl.appendChild(btn);
    }
    keyboardEl.appendChild(rowEl);
  }
}

function getUnusedAbsentLetters() {
  const secret = state.secretWord.toUpperCase();
  let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (currentLang === "da") alphabet += "ÆØÅ";
  if (currentLang === "is") alphabet += "ÁÐÉÍÓÖÚÝÞÆ";
  return [...alphabet].filter(
    (letter) => !secret.includes(letter) && !state.keyStates[letter]
  );
}

function updateHintButton() {
  if (!hintBtn) return;
  hintBtn.disabled = true;
  hintBtn.hidden = true;
  hintBtn.classList.add("hidden");
  hintBtn.title = "Hints are disabled for now";
}

function useHint() {
  showMessage("Hints are disabled for now", true);
}

function render() {
  renderBoard();
  renderKeyboard();
  updateHintButton();
}

function getCurrentGuess() {
  return state.board[state.currentRow].map((cell) => cell.letter).join("");
}

async function submitGuess() {
  if (!requirePlayerName()) return;
  if (submitting || state.gameStatus !== "playing") return;
  if (state.currentCol < COLS) {
    showMessage("Not enough letters", true);
    shakeRow(state.currentRow);
    playSound("error");
    return;
  }

  const guess = getCurrentGuess().toLowerCase();
  if (!isValidGuess(guess)) {
    showMessage(`Not in dictionary (${currentLength} ${currentLang.toUpperCase()})`, true);
    shakeRow(state.currentRow);
    playSound("error");
    return;
  }

  submitting = true;
  recordHubDailyPlay();
  try {
    const evaluation = evaluateGuess(guess, state.secretWord);
    const row = state.currentRow;

    for (let i = 0; i < COLS; i++) {
      state.board[row][i].status = evaluation[i];
      updateKeyState(state.board[row][i].letter, evaluation[i]);
    }

    saveState();
    await animateRowFlip(row);

    if (guess === state.secretWord) {
      handleWin(row);
      return;
    }

    state.currentRow++;
    state.currentCol = 0;

    if (state.currentRow >= ROWS) {
      handleLoss();
      return;
    }

    saveState();
    render();
  } finally {
    submitting = false;
  }
}

function getWinMessage(row) {
  const messages = ["Genius", "Magnificent", "Impressive", "Splendid", "Great", "Phew"];
  return messages[row] ?? "Nice";
}

function handleWin(row) {
  state.gameStatus = "won";
  const stats = recordGameResult(true);
  if (window.HubAchievements) {
    HubAchievements.unlock("wordle_first_win");
    if (row === 0) HubAchievements.unlock("wordle_guess_1");
    if (row <= 1) HubAchievements.unlock("wordle_guess_2");
    if (row <= 2) HubAchievements.unlock("wordle_guess_3");
    if (stats.wins >= 5) HubAchievements.unlock("wordle_win_5");
    if (stats.wins >= 10) HubAchievements.unlock("wordle_win_10");
    if (stats.wins >= 25) HubAchievements.unlock("wordle_win_25");
    if (stats.currentStreak >= 3) HubAchievements.unlock("wordle_streak_3");
    if (isDailyMode()) HubAchievements.unlock("wordle_daily");
  }
  showMessage(getWinMessage(row), false, 0);
  saveState();
  renderKeyboard();
  updateHintButton();
  playSound("win");
  setTimeout(checkPendingAchievements, 600);
  showMenu();
}

function handleLoss() {
  state.gameStatus = "lost";
  recordGameResult(false);
  const answer = state.secretWord.toUpperCase();
  showMessage(answer, false, 0);
  saveState();
  renderKeyboard();
  updateHintButton();
  playSound("lose");
  showMenu();
}

function stopConfetti() {
  window.HubConfetti?.stop();
}

function launchConfetti() {
  window.HubConfetti?.burst();
}

function shakeRow(rowIndex) {
  const rowEl = boardEl.querySelector(`[data-row="${rowIndex}"]`);
  if (!rowEl) return;
  rowEl.style.animation = "none";
  void rowEl.offsetWidth;
  rowEl.style.animation = "shake 0.5s ease";
  rowEl.addEventListener(
    "animationend",
    () => {
      rowEl.style.animation = "";
    },
    { once: true }
  );
}

function stampTile(tile, duration = 700) {
  return new Promise((resolve) => {
    const prevTransition = tile.style.transition;
    const prevAnimation = tile.style.animation;
    const prevTransform = tile.style.transform;
    const prevFilter = tile.style.filter;
    tile.style.transition = "none";
    tile.style.animation = "none";
    tile.classList.add("flip");

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Ice melt: freeze up → drip/squash → settle into color
      let sx = 1;
      let sy = 1;
      let y = 0;
      let bright = 1;
      let sat = 1;
      if (t < 0.32) {
        const p = t / 0.32;
        sx = 0.92 + 0.02 * p;
        sy = 1.18 - 0.08 * p;
        y = -12 + 4 * p;
        bright = 1.4 - 0.15 * p;
        sat = 0.35 + 0.2 * p;
      } else if (t < 0.58) {
        const p = (t - 0.32) / 0.26;
        const ease = p * p;
        sx = 0.94 + 0.22 * ease;
        sy = 1.1 - 0.42 * ease;
        y = -8 + 22 * ease;
        bright = 1.25 - 0.2 * p;
        sat = 0.55 + 0.35 * p;
      } else {
        const p = (t - 0.58) / 0.42;
        const ease = 1 - Math.pow(1 - p, 3);
        sx = 1.16 - 0.16 * ease;
        sy = 0.68 + 0.32 * ease;
        y = 14 - 14 * ease;
        bright = 1.05 - 0.05 * ease;
        sat = 0.9 + 0.1 * ease;
      }
      tile.style.transform = `translateY(${y}px) scale(${sx}, ${sy})`;
      tile.style.filter = `brightness(${bright}) saturate(${sat})`;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        tile.style.transform = prevTransform;
        tile.style.filter = prevFilter;
        tile.style.transition = prevTransition;
        tile.style.animation = prevAnimation;
        tile.classList.remove("flip");
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

async function animateRowFlip(rowIndex) {
  const rowEl = boardEl.querySelector(`[data-row="${rowIndex}"]`);
  if (!rowEl) return;

  const tiles = rowEl.querySelectorAll(".tile");
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const status = state.board[rowIndex][i].status;
    playSound("flip", status);

    const paintTimer = setTimeout(() => {
      tile.classList.add(status);
      paintKeyboardKey(state.board[rowIndex][i].letter);
    }, 380);

    await stampTile(tile, 700);
    clearTimeout(paintTimer);
    tile.classList.add(status);
    paintKeyboardKey(state.board[rowIndex][i].letter);
    await delay(60);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMenuOpen() {
  return !menuModal.classList.contains("hidden") || isGamesScreenOpen();
}

function addLetter(letter) {
  if (!hasPlayerName()) {
    requirePlayerName();
    return;
  }
  if (submitting || state.gameStatus !== "playing" || isMenuOpen()) return;
  if (state.currentCol >= COLS) return;

  state.board[state.currentRow][state.currentCol].letter = letter;
  state.currentCol++;
  saveState();
  renderBoard();
  playSound("key");
}

function removeLetter() {
  if (!hasPlayerName()) {
    requirePlayerName();
    return;
  }
  if (submitting || state.gameStatus !== "playing" || isMenuOpen()) return;
  if (state.currentCol <= 0) return;

  state.currentCol--;
  state.board[state.currentRow][state.currentCol].letter = "";
  saveState();
  renderBoard();
  playSound("back");
}

function handleKey(key) {
  if (submitting || isMenuOpen()) return;
  if (key === "ENTER") {
    submitGuess();
    return;
  }
  if (key === "BACK") {
    removeLetter();
    return;
  }
  addLetter(key);
}

function isUsernameGateOpen() {
  const hubModal = document.getElementById("player-name-modal");
  if (hubModal && !hubModal.classList.contains("hidden")) return true;
  const gate = document.getElementById("username-gate-modal");
  if (gate && !gate.classList.contains("hidden")) return true;
  return typeof HubPlays !== "undefined" && !hasPlayerName();
}

function isTypingInField(event) {
  const el = event?.target;
  if (!el) return false;
  const tag = String(el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || !!el.isContentEditable;
}

function handlePhysicalKeyboard(event) {
  // Let username / text fields keep Backspace, letters, Enter, etc.
  if (isTypingInField(event) || isUsernameGateOpen()) return;

  if (isGamesScreenOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      backFromGames();
    }
    return;
  }
  if (isMenuOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      resumeGame();
    }
    return;
  }
  if (state.gameStatus !== "playing" || submitting) return;

  const key = event.key.toUpperCase();

  if (key === "ENTER") {
    event.preventDefault();
    submitGuess();
    return;
  }

  if (key === "BACKSPACE") {
    event.preventDefault();
    removeLetter();
    return;
  }

  if (getValidLetters().test(key)) {
    event.preventDefault();
    addLetter(key);
  }
}

function injectShakeAnimation() {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
}

function startPracticeGame() {
  setPlayMode("practice");
  stopConfetti();
  submitting = false;
  hideMenu();
  hideGamesScreen();
  state = newGameState();
  saveState();
  render();
  updateModeButton();
  messageEl.classList.remove("visible");
  messageEl.textContent = "";
  showMessage("Practice game started");
}

function goToDaily() {
  setPlayMode("daily");
  reloadBoard();
  hideMenu();
  hideGamesScreen();
  showMessage("Today's Daily Guessword");
}

function reloadBoard() {
  stopConfetti();
  submitting = false;
  state = loadState();
  saveState();
  render();
  updateModeButton();
}

function resumeGame() {
  hideMenu();
  hideGamesScreen();
}

function buildDailyShareText() {
  const cfg = window.SITE_CONFIG || { name: "My Games" };
  const guesses = state.gameStatus === "won" ? state.currentRow + 1 : "X";
  const rows = state.board
    .filter((row) => row.some((cell) => cell.status))
    .map((row) =>
      row
        .map((cell) => {
          if (cell.status === "correct") return "🟩";
          if (cell.status === "present") return "🟨";
          return "⬛";
        })
        .join("")
    )
    .join("\n");
  return `${cfg.name} Daily ${currentLength}\n${guesses}/${ROWS}\n${rows}`;
}

async function shareDailyResult() {
  const text = buildDailyShareText();
  try {
    if (navigator.share) {
      await navigator.share({ title: "Daily Guessword", text });
      showMessage("Shared!");
      return;
    }
  } catch {
    // clipboard fallback
  }
  try {
    await navigator.clipboard.writeText(text);
    showMessage("Result copied");
  } catch {
    showMessage("Sharing not available", true);
  }
}

injectShakeAnimation();
updateLangButton();
updateLengthButton();
updateModeButton();
applyTheme(localStorage.getItem(THEME_KEY) || "dark");
applyGuessColorTheme();
applyHubTheme();
render();
document.addEventListener("keydown", handlePhysicalKeyboard);
menuBtn.addEventListener("click", () => showMenu());
menuResumeBtn.addEventListener("click", () => {
  if (!requirePlayerName()) return;
  resumeGame();
});
menuViewBoardBtn?.addEventListener("click", () => {
  if (state.gameStatus !== "won" && state.gameStatus !== "lost") return;
  hideMenu();
  if (messageEl && !/menu/i.test(messageEl.textContent || "")) {
    const base = (messageEl.textContent || "").trim();
    messageEl.textContent = base
      ? `${base} · Tap Menu for options.`
      : "Tap Menu to return to the result screen.";
  }
});
menuNewWordBtn.addEventListener("click", () => {
  if (!requirePlayerName()) return;
  startPracticeGame();
});
menuDailyBtn?.addEventListener("click", () => {
  if (!requirePlayerName()) return;
  goToDaily();
});
menuShareDailyBtn?.addEventListener("click", () => shareDailyResult());
menuGamesBtn.addEventListener("click", () => showGamesScreen());
wordThemePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-word-theme]");
  if (!btn || btn.disabled) return;
  if (!requirePlayerName()) return;
  setWordTheme(btn.dataset.wordTheme);
});
colorThemePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-guess-colors]");
  if (!btn) return;
  setGuessColorTheme(btn.dataset.guessColors);
});
continueLastBtn?.addEventListener("click", () => {
  if (!requirePlayerName()) return;
  const lastId = getLastGameId();
  if (lastId) selectGame(lastId);
});
toggleScoresBtn?.addEventListener("click", () => {
  if (!highScoresPanel) return;
  const open = highScoresPanel.classList.toggle("hidden") === false;
  toggleScoresBtn.textContent = open ? "Hide scores" : "High scores";
  if (open) {
    if (leaderboardsPanel) leaderboardsPanel.classList.add("hidden");
    if (toggleLeaderboardsBtn) toggleLeaderboardsBtn.textContent = "Leaderboards";
    stopLeaderboardRefresh();
    renderHighScoresList();
  }
});

toggleLeaderboardsBtn?.addEventListener("click", () => {
  if (!leaderboardsPanel) return;
  const open = leaderboardsPanel.classList.toggle("hidden") === false;
  toggleLeaderboardsBtn.textContent = open ? "Hide leaderboards" : "Leaderboards";
  if (open) {
    if (highScoresPanel) highScoresPanel.classList.add("hidden");
    if (toggleScoresBtn) toggleScoresBtn.textContent = "High scores";
    refreshLeaderboardsPanel();
    startLeaderboardRefresh();
  } else {
    stopLeaderboardRefresh();
  }
});

leaderboardGamePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-game]");
  if (!btn) return;
  selectedLeaderboardGame = btn.dataset.game;
  renderLeaderboardPicker();
  renderLeaderboardList();
});

toggleAchievementsBtn?.addEventListener("click", () => {
  if (!achievementsPanel) return;
  const open = achievementsPanel.classList.toggle("hidden") === false;
  toggleAchievementsBtn.textContent = open ? "Hide achievements" : "🏆 Achievements";
  if (open) renderAchievementsPanel();
});

toggleUpdatesBtn?.addEventListener("click", () => {
  if (!updatesPanel) return;
  const open = updatesPanel.classList.toggle("hidden") === false;
  if (open) {
    renderUpdatesPanel();
    markBuildSeen();
    renderUpdatesPanel();
  }
  updateUpdatesButtonLabel(open);
});

function escapeFeedbackHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatFeedbackTime(at) {
  const d = new Date(Number(at) || 0);
  if (!Number.isFinite(d.getTime()) || d.getTime() <= 0) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updateFeedbackButtonLabel(open) {
  if (!toggleFeedbackBtn) return;
  const unread =
    typeof HubFeedback !== "undefined" && HubFeedback.isOwner?.()
      ? HubFeedback.unreadCount?.() || 0
      : 0;
  if (open) {
    toggleFeedbackBtn.textContent = unread > 0 ? `Hide feedback · ${unread} new` : "Hide feedback";
  } else {
    toggleFeedbackBtn.textContent = unread > 0 ? `Feedback · ${unread} new` : "Feedback";
  }
}

function fillFeedbackGameOptions() {
  if (!feedbackGame) return;
  const current = feedbackGame.value;
  const options = [`<option value="">General / hub</option>`].concat(
    HUB_GAMES.map(
      (g) => `<option value="${escapeFeedbackHtml(g.id)}">${escapeFeedbackHtml(g.name)}</option>`
    )
  );
  feedbackGame.innerHTML = options.join("");
  if ([...feedbackGame.options].some((o) => o.value === current)) feedbackGame.value = current;
}

function setFeedbackStatus(text, kind = "") {
  if (!feedbackStatus) return;
  feedbackStatus.textContent = text || "";
  feedbackStatus.classList.remove("is-ok", "is-err");
  if (kind) feedbackStatus.classList.add(kind);
}

function updateFeedbackCharCount() {
  if (!feedbackText || !feedbackCount) return;
  const max = (typeof HubFeedback !== "undefined" && HubFeedback.MAX_TEXT) || 400;
  feedbackCount.textContent = `${feedbackText.value.length} / ${max}`;
}

function renderFeedbackInbox() {
  if (!feedbackInbox || !feedbackList) return;
  const owner = typeof HubFeedback !== "undefined" && HubFeedback.isOwner?.();
  feedbackInbox.classList.toggle("hidden", !owner);
  if (!owner) return;
  const items = HubFeedback.list?.() || [];
  const readAt =
    typeof HubFeedback !== "undefined"
      ? Math.max(0, Number(localStorage.getItem("hub-feedback-read-at-v1")) || 0)
      : 0;
  if (feedbackUnread) {
    const unread = HubFeedback.unreadCount?.() || 0;
    feedbackUnread.textContent = unread ? `${unread} new` : "";
    feedbackUnread.classList.toggle("hidden", unread <= 0);
  }
  if (!items.length) {
    feedbackList.innerHTML = "";
    feedbackEmpty?.classList.remove("hidden");
    return;
  }
  feedbackEmpty?.classList.add("hidden");
  feedbackList.innerHTML = items
    .map((item) => {
      const isNew = item.at > readAt;
      const gameLabel = item.game
        ? HUB_GAMES.find((g) => g.id === item.game)?.name || item.game
        : "General";
      return `<li class="feedback-item${isNew ? " is-new" : ""}">
        <div class="feedback-item-top">
          <span class="feedback-item-type">${escapeFeedbackHtml(item.type)}</span>
          <span>${escapeFeedbackHtml(item.fromName)}</span>
          <span>${escapeFeedbackHtml(gameLabel)}</span>
          <span>${escapeFeedbackHtml(formatFeedbackTime(item.at))}</span>
        </div>
        <p class="feedback-item-text">${escapeFeedbackHtml(item.text)}</p>
      </li>`;
    })
    .join("");
}

async function openFeedbackPanel() {
  if (!requirePlayerName()) {
    feedbackPanel?.classList.add("hidden");
    updateFeedbackButtonLabel(false);
    return;
  }
  fillFeedbackGameOptions();
  updateFeedbackCharCount();
  setFeedbackStatus("");
  if (typeof HubFeedback !== "undefined") {
    try {
      if (!HubFeedback.isRateLimited?.()) {
        await HubFeedback.sync(true);
        await HubFeedback.flushPending?.();
      } else {
        setFeedbackStatus("Server is cooling down — showing saved messages", "");
      }
    } catch {}
  }
  renderFeedbackInbox();
  updateFeedbackButtonLabel(true);
}

toggleFeedbackBtn?.addEventListener("click", () => {
  if (!feedbackPanel) return;
  const open = feedbackPanel.classList.toggle("hidden") === false;
  if (open) {
    openFeedbackPanel();
  } else if (typeof HubFeedback !== "undefined" && HubFeedback.isOwner?.()) {
    HubFeedback.markAllRead?.();
  }
  updateFeedbackButtonLabel(open);
});

feedbackText?.addEventListener("input", updateFeedbackCharCount);

feedbackForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requirePlayerName()) return;
  if (typeof HubFeedback === "undefined") {
    setFeedbackStatus("Feedback is unavailable right now", "is-err");
    return;
  }
  if (feedbackSendBtn) feedbackSendBtn.disabled = true;
  setFeedbackStatus("Sending…");
  const result = await HubFeedback.submit({
    text: feedbackText?.value || "",
    type: feedbackType?.value || "idea",
    game: feedbackGame?.value || ""
  });
  if (feedbackSendBtn) feedbackSendBtn.disabled = false;
  if (!result?.ok) {
    setFeedbackStatus(result?.error || "Could not send", "is-err");
    return;
  }
  if (feedbackText) feedbackText.value = "";
  updateFeedbackCharCount();
  setFeedbackStatus(
    result.warning || (result.queued ? "Saved — will sync to ICE when the server is free" : "Sent to ICE — thanks!"),
    "is-ok"
  );
  window.HubSound?.play?.("win");
  renderFeedbackInbox();
  updateFeedbackButtonLabel(true);
});

feedbackRefreshBtn?.addEventListener("click", async () => {
  if (typeof HubFeedback === "undefined") return;
  setFeedbackStatus("Refreshing…");
  try {
    await HubFeedback.sync(true);
    renderFeedbackInbox();
    setFeedbackStatus("Inbox updated", "is-ok");
  } catch {
    setFeedbackStatus("Could not refresh", "is-err");
  }
  updateFeedbackButtonLabel(true);
});

toggleSettingsBtn?.addEventListener("click", () => {
  if (!hubSettingsPanel) return;
  const open = hubSettingsPanel.classList.toggle("hidden") === false;
  toggleSettingsBtn.textContent = open ? "Hide settings" : "⚙ Settings";
  if (open) {
    applyHubTheme();
    refreshNotificationPermStatus();
  }
});

hubThemePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-hub-theme]");
  if (!btn || btn.hidden) return;
  const id = btn.dataset.hubTheme;
  if (!canUseHubTheme(id)) {
    showGamesMessage("That hub look is for ICE_DRAGON only", 1800);
    return;
  }
  applyHubTheme(id);
  showGamesMessage(`Hub look: ${HUB_THEMES[id]?.label || "Classic"}`, 1600);
});

function refreshNotificationPermStatus() {
  const el = document.getElementById("notifications-perm-status");
  const btn = document.getElementById("enable-notifications-btn");
  if (!el) return;
  if (typeof Notification === "undefined") {
    el.textContent = "Browser notifications are not supported here.";
    if (btn) btn.disabled = true;
    return;
  }
  const perm = Notification.permission;
  if (perm === "granted") {
    el.textContent = "Browser notifications are on.";
    if (btn) btn.textContent = "Notifications enabled";
    if (btn) btn.disabled = true;
  } else if (perm === "denied") {
    el.textContent = "Blocked in browser settings — allow notifications for this site.";
    if (btn) btn.disabled = true;
  } else {
    el.textContent = "Optional: also alert you when the tab is in the background.";
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enable browser notifications";
    }
  }
}

document.getElementById("enable-notifications-btn")?.addEventListener("click", async () => {
  if (typeof HubNotifications === "undefined") {
    refreshNotificationPermStatus();
    return;
  }
  await HubNotifications.requestPermission(true);
  refreshNotificationPermStatus();
  showGamesMessage("Notification permission updated", 1600);
});

function maybeOpenHubHash() {
  const hash = String(location.hash || "").replace(/^#/, "").toLowerCase();
  if (!hash) return;
  if (hash === "friends") {
    friendsPanel?.classList.remove("hidden");
    renderFriendsPanel?.();
    toggleFriendsBtn && (toggleFriendsBtn.textContent = "Hide friends");
  } else if (hash === "feedback") {
    feedbackPanel?.classList.remove("hidden");
    openFeedbackPanel?.();
    updateFeedbackButtonLabel(true);
  } else if (hash === "games" || hash === "games") {
    // already on games screen
  }
}

togglePlayersBtn?.addEventListener("click", () => {
  if (!playersPanel) return;
  const open = playersPanel.classList.toggle("hidden") === false;
  updateOnlineCountDisplay(
    typeof HubPlays !== "undefined" ? HubPlays.getOnlineCount() : 0,
    typeof HubPlays !== "undefined" ? HubPlays.getAllTimeCount() : 0
  );
  if (open) {
    maybeAskPlayerName();
    renderPlayersPanel();
  }
});

toggleFriendsBtn?.addEventListener("click", () => {
  if (!friendsPanel) return;
  const open = friendsPanel.classList.toggle("hidden") === false;
  toggleFriendsBtn.textContent = open ? "Hide friends" : "Friends";
  if (open) {
    maybeAskPlayerName();
    renderFriendsPanel();
    if (typeof HubFriends !== "undefined") {
      HubFriends.startPolling?.(friendsChatPoll);
    }
    if (typeof HubChat !== "undefined") {
      HubChat.startPolling?.(friendsChatPoll);
    }
  } else {
    if (typeof HubFriends !== "undefined") HubFriends.stopPolling?.();
    if (typeof HubChat !== "undefined") {
      HubChat.closeThread?.();
      HubChat.stopPolling?.(friendsChatPoll);
    }
    friendsPanel.classList.remove("is-chatting");
    document.getElementById("friends-chat")?.classList.add("hidden");
  }
});

document.getElementById("friend-add-btn")?.addEventListener("click", async () => {
  if (typeof HubFriends === "undefined") return;
  const input = document.getElementById("friend-add-input");
  const name = input?.value?.trim() || "";
  if (!name) {
    setFriendsStatus("Enter a username", true);
    return;
  }
  setFriendsStatus("Sending…");
  const result = await HubFriends.sendRequest(name);
  if (!result.ok) {
    setFriendsStatus(result.error || "Couldn't add friend", true);
    return;
  }
  if (input) input.value = "";
  setFriendsStatus(result.alreadyFriends ? "Already friends" : "Request sent");
  renderFriendsPanel();
});

document.getElementById("friend-add-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("friend-add-btn")?.click();
});

document.getElementById("friends-panel")?.addEventListener("click", async (e) => {
  if (typeof HubFriends === "undefined") return;
  const accept = e.target.closest("[data-friend-accept]");
  const decline = e.target.closest("[data-friend-decline]");
  const remove = e.target.closest("[data-friend-remove]");
  const declineInvite = e.target.closest("[data-invite-decline]");
  const openChat = e.target.closest("[data-friend-chat]");
  const openChannel = e.target.closest("[data-chat-open]");
  const openGroup = e.target.closest("[data-group-chat]");
  if (accept) {
    await HubFriends.acceptRequest(accept.dataset.friendAccept);
    renderFriendsPanel();
    return;
  }
  if (decline) {
    await HubFriends.declineRequest(decline.dataset.friendDecline);
    renderFriendsPanel();
    return;
  }
  if (remove) {
    await HubFriends.removeFriend(remove.dataset.friendRemove);
    if (typeof HubChat !== "undefined" && HubChat.getActiveFriendId?.() === remove.dataset.friendRemove) {
      HubChat.closeThread();
    }
    renderFriendsPanel();
    return;
  }
  if (declineInvite) {
    await HubFriends.respondInvite(declineInvite.dataset.inviteDecline, false);
    renderFriendsPanel();
    return;
  }
  if (openChannel?.dataset.chatOpen === "global" && typeof HubChat !== "undefined") {
    if (!requirePlayerName()) return;
    HubChat.openGlobal?.();
    hideGroupCreate();
    renderFriendsPanel();
    document.getElementById("friends-chat-input")?.focus();
    return;
  }
  if (openGroup && typeof HubChat !== "undefined") {
    if (!requirePlayerName()) return;
    HubChat.openGroup?.(openGroup.dataset.groupChat);
    hideGroupCreate();
    renderFriendsPanel();
    document.getElementById("friends-chat-input")?.focus();
    return;
  }
  if (openChat && typeof HubChat !== "undefined") {
    if (!requirePlayerName()) return;
    HubChat.openThread(openChat.dataset.friendChat);
    hideGroupCreate();
    renderFriendsPanel();
    document.getElementById("friends-chat-input")?.focus();
  }
});

document.getElementById("friends-new-group-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!requirePlayerName()) return;
  if (typeof HubChat !== "undefined") HubChat.closeThread?.();
  showGroupCreate();
});

document.getElementById("friends-group-create-btn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (typeof HubChat === "undefined") return;
  if (!requirePlayerName()) return;
  if (friendsCreatingGroupBusy) return;
  const name = document.getElementById("friends-group-name")?.value || "";
  const picks = [
    ...document.querySelectorAll("#friends-group-picks input:checked")
  ].map((el) => el.value);
  friendsCreatingGroupBusy = true;
  setFriendsStatus("Creating…");
  try {
    const result = await HubChat.createGroup(name, picks);
    if (!result.ok) {
      setFriendsStatus(result.error || "Couldn't create group", true);
      return;
    }
    hideGroupCreate();
    setFriendsStatus("Group created");
    renderFriendsPanel();
  } finally {
    friendsCreatingGroupBusy = false;
  }
});

document.getElementById("friends-chat-back")?.addEventListener("click", () => {
  if (typeof HubChat !== "undefined") HubChat.closeThread?.();
  hideGroupCreate();
  renderFriendsPanel();
});

document.getElementById("friends-chat-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (typeof HubChat === "undefined") return;
  const channel = HubChat.getActiveChannel?.();
  const input = document.getElementById("friends-chat-input");
  const text = input?.value || "";
  if (!channel) return;
  if (!requirePlayerName()) return;
  setFriendsStatus("Sending…");
  const result = await HubChat.sendTo(channel.type, channel.id, text);
  if (!result.ok) {
    setFriendsStatus(result.error || "Couldn't send", true);
    return;
  }
  if (input) input.value = "";
  setFriendsStatus("");
  renderFriendsPanel();
  const log = document.getElementById("friends-chat-log");
  if (log) log.scrollTop = log.scrollHeight;
});

function showGroupCreate() {
  const box = document.getElementById("friends-group-create");
  const chat = document.getElementById("friends-chat");
  const panel = document.getElementById("friends-panel");
  const form = document.getElementById("friends-chat-form");
  const log = document.getElementById("friends-chat-log");
  const title = document.getElementById("friends-chat-title");
  const picks = document.getElementById("friends-group-picks");
  friendsComposingGroup = true;
  panel?.classList.add("is-chatting");
  chat?.classList.remove("hidden");
  box?.classList.remove("hidden");
  form?.classList.add("hidden");
  if (log) log.innerHTML = "";
  if (title) title.textContent = "New group";
  const friends = HubFriends.getFriends?.() || [];
  if (picks) {
    picks.innerHTML = friends.length
      ? friends
          .map(
            (f) =>
              `<label><input type="checkbox" value="${escapeHtml(f.playerId)}"> ${escapeHtml(f.name)}</label>`
          )
          .join("")
      : `<span class="friends-last-online">Add friends first</span>`;
  }
  document.getElementById("friends-group-name")?.focus();
}

function hideGroupCreate() {
  friendsComposingGroup = false;
  document.getElementById("friends-group-create")?.classList.add("hidden");
  document.getElementById("friends-chat-form")?.classList.remove("hidden");
  const nameInput = document.getElementById("friends-group-name");
  if (nameInput) nameInput.value = "";
}

function hasPlayerName() {
  if (typeof HubPlays === "undefined") return false;
  if (typeof HubPlays.hasRequiredName === "function") {
    return HubPlays.hasRequiredName();
  }
  const name = HubPlays.getName();
  return !!(name && !/^guest-/i.test(name) && name.toLowerCase() !== "player");
}

function requirePlayerName(message) {
  if (hasPlayerName()) return true;
  maybeAskPlayerName(true);
  const msg = message || "Pick a username to play";
  showGamesMessage(msg, 2200);
  showMessage(msg, true, 2200);
  return false;
}

function maybeAskPlayerName(force = false) {
  if (typeof HubPlays === "undefined") return;
  if (typeof HubPlays.enforceUsernameGate === "function" && !hasPlayerName()) {
    HubPlays.enforceUsernameGate();
    return;
  }
  const existing = HubPlays.getName();
  if (existing && hasPlayerName()) {
    // Soft sync only — never wipe or force a rename once a name is saved here
    HubPlays.claimName(existing).then((result) => {
      if (result.ok) return;
      if (result.error) setPlayerNameStatus(result.error, true);
    });
    if (!force) return;
    return;
  }
  // Clear old guest / invalid names so they must pick a real username
  if (existing && !hasPlayerName()) {
    try {
      localStorage.removeItem("hub-player-name");
    } catch {}
    if (playerNameInput) playerNameInput.value = "";
  }
  if (typeof HubPlays.enforceUsernameGate === "function") {
    HubPlays.enforceUsernameGate();
    return;
  }
  playerNameModal?.classList.add("username-gate-force");
  playerNameModal?.classList.remove("hidden");
  document.body.classList.add("username-gate-open");
  playerNameModalInput?.focus();
}

function hidePlayerNameModal() {
  // Never dismiss until a real username is saved
  if (!hasPlayerName()) return;
  playerNameModal?.classList.add("hidden");
  playerNameModal?.classList.remove("username-gate-force");
  document.body.classList.remove("username-gate-open");
}

function setPlayerNameStatus(msg, isError) {
  const el = document.getElementById("player-name-status");
  const modalEl = document.getElementById("player-name-modal-status");
  [el, modalEl].forEach((node) => {
    if (!node) return;
    node.textContent = msg || "";
    node.classList.toggle("is-error", !!isError);
    node.classList.toggle("hidden", !msg);
  });
}

async function savePlayerNameFrom(value) {
  if (typeof HubPlays === "undefined") return;
  if (HubPlays.isNameLocked() && HubPlays.hasRequiredName()) {
    const current = HubPlays.getName();
    const next = HubPlays.sanitizeName(value || "");
    if (next.toLowerCase() !== current.toLowerCase()) {
      setPlayerNameStatus("Name is locked — unlock it to change", true);
      showGamesMessage("Name is locked — unlock it to change", 2200);
      applyNameLockUI();
      return;
    }
  }
  setPlayerNameStatus("Checking name…", false);
  savePlayerNameBtn && (savePlayerNameBtn.disabled = true);
  playerNameSaveBtn && (playerNameSaveBtn.disabled = true);
  try {
    const result = await HubPlays.claimName(value);
    if (!result.ok) {
      setPlayerNameStatus(result.error || "Name unavailable", true);
      showGamesMessage(result.error || "Name unavailable", 2200);
      playerNameModal?.classList.remove("hidden");
      return;
    }
    if (playerNameInput) playerNameInput.value = result.name;
    if (playerNameModalInput) playerNameModalInput.value = result.name;
    setPlayerNameStatus(
      result.offline
        ? `Playing as ${result.name} (offline / school mode)`
        : `Playing as ${result.name}`,
      false
    );
    hidePlayerNameModal();
    applyNameLockUI();
    applyHubTheme();
    renderPlayersPanel();
    showGamesMessage(
      result.offline
        ? `Playing as ${result.name} (saved on this device)`
        : `Playing as ${result.name} · code ${HubPlays.getPlayerCode?.() || ""}`,
      1800
    );
    if (window.__hubAfterUsername) {
      const next = window.__hubAfterUsername;
      window.__hubAfterUsername = null;
      next();
    }
  } finally {
    savePlayerNameBtn && (savePlayerNameBtn.disabled = false);
    playerNameSaveBtn && (playerNameSaveBtn.disabled = false);
    applyNameLockUI();
  }
}

function applyNameLockUI() {
  if (typeof HubPlays === "undefined") return;
  const locked = HubPlays.isNameLocked();
  const hasName = hasPlayerName();
  if (playerNameInput) {
    playerNameInput.readOnly = locked && hasName;
    playerNameInput.classList.toggle("is-locked", locked && hasName);
  }
  if (savePlayerNameBtn) {
    savePlayerNameBtn.disabled = locked && hasName;
    savePlayerNameBtn.title = locked && hasName ? "Unlock your name to change it" : "Save name";
  }
  if (lockPlayerNameBtn) {
    lockPlayerNameBtn.disabled = !hasName;
    lockPlayerNameBtn.classList.toggle("is-locked", locked);
    lockPlayerNameBtn.setAttribute("aria-pressed", locked ? "true" : "false");
    lockPlayerNameBtn.textContent = locked ? "🔒 Locked" : "🔓 Unlock";
    lockPlayerNameBtn.title = locked
      ? "Name is locked. Tap to unlock and allow changes."
      : "Lock your name so it can't be changed";
  }
  if (playerNameLockHint) {
    playerNameLockHint.textContent = locked
      ? "Name locked — unlock to change it."
      : "Lock your name to stop accidental changes.";
  }
}

function togglePlayerNameLock() {
  if (typeof HubPlays === "undefined") return;
  if (!hasPlayerName()) {
    setPlayerNameStatus("Pick a username before locking", true);
    maybeAskPlayerName(true);
    return;
  }
  const next = !HubPlays.isNameLocked();
  HubPlays.setNameLocked(next);
  applyNameLockUI();
  if (next && window.HubAchievements) {
    HubAchievements.unlock("name_locked");
    setTimeout(checkPendingAchievements, 400);
  }
  setPlayerNameStatus(
    next ? `Locked as ${HubPlays.getName()}` : "Name unlocked — you can change it",
    false
  );
  showGamesMessage(next ? "Name locked" : "Name unlocked", 1600);
}

function updateOnlineCountDisplay(onlineCount, allTimeCount) {
  const onlineEl = document.getElementById("players-online");
  const allTimeEl = document.getElementById("players-alltime");
  const n = Math.max(0, Number(onlineCount) || 0);
  const total =
    allTimeCount == null
      ? typeof HubPlays !== "undefined"
        ? HubPlays.getAllTimeCount()
        : 0
      : Math.max(0, Number(allTimeCount) || 0);
  if (onlineEl) {
    onlineEl.textContent = n === 1 ? "1 online" : `${n} online`;
    onlineEl.classList.toggle("is-empty", n === 0);
  }
  if (allTimeEl) {
    allTimeEl.textContent =
      total === 1 ? "· 1 all-time" : `· ${total} all-time`;
  }
  if (togglePlayersBtn) {
    const open = playersPanel && !playersPanel.classList.contains("hidden");
    togglePlayersBtn.textContent = open
      ? `Hide players · ${n}/${total}`
      : `Players · ${n}/${total}`;
  }
  if (playersRosterMode) renderPlayersRoster(playersRosterMode);
}

let playersRosterMode = null; // "online" | "alltime" | null

function setPlayersRosterMode(mode) {
  const roster = document.getElementById("players-roster");
  const onlineEl = document.getElementById("players-online");
  const allTimeEl = document.getElementById("players-alltime");
  if (playersRosterMode === mode) {
    playersRosterMode = null;
  } else {
    playersRosterMode = mode;
  }
  onlineEl?.setAttribute("aria-expanded", playersRosterMode === "online" ? "true" : "false");
  allTimeEl?.setAttribute("aria-expanded", playersRosterMode === "alltime" ? "true" : "false");
  if (!playersRosterMode) {
    roster?.classList.add("hidden");
    return;
  }
  renderPlayersRoster(playersRosterMode);
}

function renderPlayersRoster(mode) {
  const roster = document.getElementById("players-roster");
  const title = document.getElementById("players-roster-title");
  const list = document.getElementById("players-roster-list");
  if (!roster || !title || !list || typeof HubPlays === "undefined") return;

  const players =
    mode === "online"
      ? HubPlays.getOnlinePlayers()
      : HubPlays.getAllTimePlayers();
  const visible = players.filter((p) => !isGuestDisplayName(p.name));

  title.textContent =
    mode === "online"
      ? visible.length === 1
        ? "Online now · 1 player"
        : `Online now · ${visible.length} players`
      : visible.length === 1
        ? "All-time players · 1"
        : `All-time players · ${visible.length}`;

  if (!visible.length) {
    list.innerHTML = `<li class="players-empty">${
      mode === "online" ? "Nobody online right now." : "No players recorded yet."
    }</li>`;
  } else {
    list.innerHTML = visible
      .map((p) => {
        let when = "";
        if (mode === "online") {
          when = "online now";
        } else if (p.online) {
          when = "online now";
        } else if (p.lastAt) {
          when = `last online ${HubPlays.formatWhen(p.lastAt)}`;
        } else if (p.firstAt) {
          when = `joined ${HubPlays.formatWhen(p.firstAt)}`;
        }
        return `<li><span>${formatPlayerNameHtml(p.name)}</span><span class="players-when">${escapeHtml(when)}</span></li>`;
      })
      .join("");
  }
  roster.classList.remove("hidden");
}

async function refreshOnlineCount() {
  if (typeof HubPlays === "undefined") return;
  try {
    const n = await HubPlays.heartbeat();
    // All-time roster is refreshed inside heartbeat (~10 min). Avoid extra
    // MantleDB traffic here — that was blowing the free rate limit.
    updateOnlineCountDisplay(n, HubPlays.getAllTimeCount());
  } catch {
    updateOnlineCountDisplay(HubPlays.getOnlineCount(), HubPlays.getAllTimeCount());
  }
}

let onlineCountTimer = null;
function startOnlineCountPolling() {
  if (onlineCountTimer) return;
  onlineCountTimer = setInterval(() => {
    refreshOnlineCount();
    if (playersPanel && !playersPanel.classList.contains("hidden")) {
      renderPlayersPanel();
    }
  }, 60_000);
}

function paintPlayersPanelLists() {
  if (!playersList || typeof HubPlays === "undefined") return;
  renderTitlePicker();
  renderColorPicker();
  try {
    HubPlays.refreshCreatorCredits?.();
  } catch {}
  if (playersRosterMode) renderPlayersRoster(playersRosterMode);
  const status = HubPlays.getStatus();
  const countEntries = Object.entries(status.counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (playersTotals) {
    if (!countEntries.length) {
      playersTotals.textContent = "No plays logged yet — open a game to appear here.";
    } else {
      playersTotals.textContent = countEntries
        .map(([id, n]) => `${HubPlays.gameLabel(id)}: ${n}`)
        .join(" · ");
    }
  }
  const plays = (status.plays || []).filter((p) => !isGuestDisplayName(p.name));
  if (!plays.length) {
    playersList.innerHTML = `<li class="players-empty">No recent players yet.</li>`;
    return;
  }
  playersList.innerHTML = plays
    .slice(0, 25)
    .map(
      (p) =>
        `<li><span class="players-who">${formatPlayerNameHtml(p.name)} played ${escapeHtml(p.gameName || p.game)}</span><span class="players-when">${HubPlays.formatWhen(p.at)}</span></li>`
    )
    .join("");
}

function setFriendsStatus(text, isError = false) {
  const el = document.getElementById("friends-status");
  if (!el) return;
  if (!text) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.classList.toggle("is-error", !!isError);
  el.classList.remove("hidden");
}

function onlineNameSet() {
  if (typeof HubPlays === "undefined" || !HubPlays.getOnlinePlayers) return new Set();
  return new Set(
    (HubPlays.getOnlinePlayers() || []).map((p) =>
      String(p.name || "")
        .trim()
        .toLowerCase()
    )
  );
}

function renderFriendsChatPane(friends) {
  const panel = document.getElementById("friends-panel");
  const chat = document.getElementById("friends-chat");
  const title = document.getElementById("friends-chat-title");
  const log = document.getElementById("friends-chat-log");
  const createBox = document.getElementById("friends-group-create");
  if (!panel || !chat || !log || typeof HubChat === "undefined") return;

  if (createBox && (friendsComposingGroup || !createBox.classList.contains("hidden"))) {
    friendsComposingGroup = true;
    panel.classList.add("is-chatting");
    chat.classList.remove("hidden");
    createBox.classList.remove("hidden");
    document.getElementById("friends-chat-form")?.classList.add("hidden");
    return;
  }

  const channel = HubChat.getActiveChannel?.();
  if (!channel) {
    panel.classList.remove("is-chatting");
    chat.classList.add("hidden");
    return;
  }

  panel.classList.add("is-chatting");
  chat.classList.remove("hidden");
  createBox?.classList.add("hidden");
  document.getElementById("friends-chat-form")?.classList.remove("hidden");
  HubChat.markRead?.(channel.type, channel.id);

  if (channel.type === "global") {
    if (title) title.textContent = "Global chat";
  } else if (channel.type === "group") {
    const g = (HubChat.getGroups?.() || []).find((x) => x.id === channel.id);
    if (title) title.textContent = g?.name || "Group";
  } else {
    const friend = (friends || []).find((f) => f.playerId === channel.id);
    if (title) title.textContent = `Chat · ${friend?.name || "Friend"}`;
  }

  const me = HubPlays?.getPlayerId?.() || "";
  const messages = HubChat.getMessagesFor?.(channel.type, channel.id) || [];
  if (!messages.length) {
    log.innerHTML = `<li class="friends-chat-empty">No messages yet — say hi.</li>`;
    return;
  }

  const stickBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
  log.innerHTML = messages
    .map((m) => {
      const mine = m.from === me;
      const when =
        typeof HubPlays !== "undefined" && HubPlays.formatWhen
          ? HubPlays.formatWhen(m.at)
          : "";
      const who = mine ? "You" : escapeHtml(m.name || "Player");
      return `<li class="${mine ? "is-me" : ""}"><span class="friends-chat-meta">${who} · ${escapeHtml(when)}</span><span class="friends-chat-text">${escapeHtml(m.text)}</span></li>`;
    })
    .join("");
  if (stickBottom) log.scrollTop = log.scrollHeight;
}

function renderFriendsPanel() {
  const list = document.getElementById("friends-list");
  const incomingBox = document.getElementById("friends-incoming");
  const invitesBox = document.getElementById("friends-invites");
  const groupsBox = document.getElementById("friends-groups");
  if (!list || typeof HubFriends === "undefined") return;

  const online = onlineNameSet();
  const friends = HubFriends.getFriends?.() || [];
  const incoming = HubFriends.getIncoming?.() || [];
  const invites = HubFriends.getInvites?.() || [];
  const groups = typeof HubChat !== "undefined" ? HubChat.getGroups?.() || [] : [];

  const globalBtn = document.querySelector('[data-chat-open="global"]');
  if (globalBtn && typeof HubChat !== "undefined") {
    const gu = HubChat.unreadCount?.("global") || 0;
    globalBtn.innerHTML =
      gu > 0
        ? `Global chat <span class="friends-chat-unread">${gu > 9 ? "9+" : gu}</span>`
        : "Global chat";
  }

  if (incomingBox) {
    if (!incoming.length) {
      incomingBox.classList.add("hidden");
      incomingBox.innerHTML = "";
    } else {
      incomingBox.classList.remove("hidden");
      incomingBox.innerHTML = `<h5>Requests</h5><ul>${incoming
        .map(
          (f) =>
            `<li><span>${formatPlayerNameHtml(f.name)}</span><span class="friends-actions"><button type="button" class="hub-btn" data-friend-accept="${escapeHtml(f.playerId)}">Accept</button><button type="button" class="hub-btn" data-friend-decline="${escapeHtml(f.playerId)}">Decline</button></span></li>`
        )
        .join("")}</ul>`;
    }
  }

  if (invitesBox) {
    if (!invites.length) {
      invitesBox.classList.add("hidden");
      invitesBox.innerHTML = "";
    } else {
      invitesBox.classList.remove("hidden");
      invitesBox.innerHTML = `<h5>Game invites</h5><ul>${invites
        .map((inv) => {
          const gameLabel =
            inv.game === "connect-four" ? "Drop Four" : "Tic Tac Toe";
          const href =
            inv.game === "connect-four"
              ? `connect-four/index.html?invite=${encodeURIComponent(inv.id)}`
              : `tic-tac-toe/index.html?invite=${encodeURIComponent(inv.id)}`;
          return `<li><span>${formatPlayerNameHtml(inv.fromName)} · ${escapeHtml(gameLabel)}</span><span class="friends-actions"><a class="hub-btn" href="${href}">Open</a><button type="button" class="hub-btn" data-invite-decline="${escapeHtml(inv.id)}">Decline</button></span></li>`;
        })
        .join("")}</ul>`;
    }
  }

  if (groupsBox) {
    if (!groups.length) {
      groupsBox.classList.add("hidden");
      groupsBox.innerHTML = "";
    } else {
      groupsBox.classList.remove("hidden");
      groupsBox.innerHTML = `<h5>Groups</h5><ul>${groups
        .map((g) => {
          const badge =
            g.unread > 0
              ? `<span class="friends-chat-unread">${g.unread > 9 ? "9+" : g.unread}</span>`
              : "";
          return `<li><span>${escapeHtml(g.name)} · ${g.memberCount} members</span><span class="friends-actions"><button type="button" class="hub-btn" data-group-chat="${escapeHtml(g.id)}">Chat${badge}</button></span></li>`;
        })
        .join("")}</ul>`;
    }
  }

  if (!friends.length) {
    list.innerHTML = `<li class="players-empty">No friends yet — add someone by username.</li>`;
    renderFriendsChatPane([]);
    return;
  }

  list.innerHTML = friends
    .map((f) => {
      const isOn = online.has(String(f.name || "").trim().toLowerCase());
      const seen =
        typeof HubPlays.formatLastOnline === "function"
          ? HubPlays.formatLastOnline(f.playerId, {
              onlineLabel: "Online",
              prefix: "Last online",
              empty: "Offline"
            })
          : isOn
            ? "Online"
            : "Offline";
      const unread =
        typeof HubChat !== "undefined" ? HubChat.unreadCount?.("dm", f.playerId) || 0 : 0;
      const unreadBadge =
        unread > 0
          ? `<span class="friends-chat-unread" aria-label="${unread} unread">${unread > 9 ? "9+" : unread}</span>`
          : "";
      return `<li><span><span class="friends-online-dot${isOn ? "" : " is-offline"}" title="${escapeHtml(seen)}"></span>${formatPlayerNameHtml(f.name)}<span class="friends-last-online">${escapeHtml(seen)}</span></span><span class="friends-actions"><button type="button" class="hub-btn" data-friend-chat="${escapeHtml(f.playerId)}">Chat${unreadBadge}</button><a class="hub-btn" href="tic-tac-toe/index.html?inviteFriend=${encodeURIComponent(f.playerId)}">TTT</a><a class="hub-btn" href="connect-four/index.html?inviteFriend=${encodeURIComponent(f.playerId)}">C4</a><button type="button" class="hub-btn" data-friend-remove="${escapeHtml(f.playerId)}">Remove</button></span></li>`;
    })
    .join("");

  renderFriendsChatPane(friends);
}

async function renderPlayersPanel() {
  if (!playersList || typeof HubPlays === "undefined") return;
  if (playerNameInput && !playerNameInput.value) {
    playerNameInput.value = HubPlays.getName() || "";
  }
  applyNameLockUI();
  refreshPlayerCodeUI();
  try {
    await HubPlays.sync();
  } catch {}
  try {
    await HubPlays.ensurePlayerCodeRegistered?.();
  } catch {}
  refreshPlayerCodeUI();
  try {
    await refreshOnlineCount();
  } catch {}
  paintPlayersPanelLists();
}

function setPlayerCodeStatus(msg, isError) {
  const el = document.getElementById("player-code-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("is-error", !!isError);
  el.classList.toggle("hidden", !msg);
}

function refreshPlayerCodeUI() {
  const el = document.getElementById("player-code-value");
  if (!el || typeof HubPlays === "undefined") return;
  el.textContent = HubPlays.getPlayerCode?.() || "————";
}

document.getElementById("player-code-copy-btn")?.addEventListener("click", async () => {
  if (typeof HubPlays === "undefined") return;
  const code = HubPlays.getPlayerCode?.() || "";
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    setPlayerCodeStatus(`Copied ${code}`, false);
  } catch {
    setPlayerCodeStatus(`Your code is ${code}`, false);
  }
});

document.getElementById("player-code-restore-btn")?.addEventListener("click", async () => {
  if (typeof HubPlays === "undefined") return;
  const input = document.getElementById("player-code-restore-input");
  const raw = input?.value || "";
  setPlayerCodeStatus("Restoring…", false);
  const result = await HubPlays.restoreWithPlayerCode(raw);
  if (!result?.ok) {
    setPlayerCodeStatus(result?.error || "Couldn't restore", true);
    return;
  }
  if (result.already) {
    setPlayerCodeStatus("This device already uses that code", false);
    refreshPlayerCodeUI();
    return;
  }
  if (playerNameInput && result.name) playerNameInput.value = result.name;
  setPlayerCodeStatus(
    result.name
      ? `Restored as ${result.name}. Reloading…`
      : "Player restored. Reloading…",
    false
  );
  setTimeout(() => window.location.reload(), 700);
});

document.getElementById("player-code-restore-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("player-code-restore-btn")?.click();
  }
});

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isGuestDisplayName(name) {
  const n = String(name || "").trim().toLowerCase();
  return !n || n === "guest" || n.startsWith("guest-") || n === "player";
}

function isCreatorName(name) {
  return String(name || "").trim().toLowerCase() === CREATOR_NAME.toLowerCase();
}

function getSpecialPlayerStyle(name) {
  return SPECIAL_PLAYER_NAMES[String(name || "").trim().toLowerCase()] || null;
}

function getPlayerTitleBadges(name) {
  if (typeof HubPlays !== "undefined" && HubPlays.getActiveTitleBadge) {
    // Ensure self legend is reflected locally even before cloud sync finishes.
    if (
      typeof HubAchievements !== "undefined" &&
      HubAchievements.hasAllUnlocked?.() &&
      hasPlayerName() &&
      String(HubPlays.getName?.() || "").trim().toLowerCase() ===
        String(name || "").trim().toLowerCase()
    ) {
      HubPlays.markLegend?.().catch(() => {});
    }
    const badge = HubPlays.getActiveTitleBadge(name);
    return badge ? [badge] : [];
  }

  // Fallback if HubPlays title API is missing
  const badges = [];
  const special = getSpecialPlayerStyle(name);
  if (special?.badge) badges.push(special.badge);
  return badges.slice(0, 1);
}

function formatPlayerNameHtml(name) {
  const safe = escapeHtml(name);
  const special = getSpecialPlayerStyle(name);
  const accent =
    typeof HubPlays !== "undefined" ? HubPlays.getAccentColor?.(name) || "" : "";
  const extra = HubPlays?.EXTRA_COLORS?.[accent];
  const isAnimatedAccent = !!(extra && extra.animated);
  const isCheesyAccent = accent === "#f0b429";
  const nameStyle =
    accent && !isAnimatedAccent && !isCheesyAccent
      ? ` style="color:${escapeHtml(accent)}"`
      : "";
  let nameClass = "player-name-custom";
  if (extra?.nameClass) nameClass = extra.nameClass;
  else if (accent === "#f1c40f") nameClass = "player-name-legend";
  else if (isCheesyAccent) nameClass = "player-name-cheesy";
  else if (accent === "#2f9e44") nameClass = "player-name-oscar";
  else if (accent === "#1c7ed6") nameClass = "player-name-creator";
  else if (accent === "#e03131") nameClass = "player-name-tester";
  else if (!accent && special) nameClass = special.className;
  const nameHtml = accent || special
    ? `<strong class="${nameClass}" title="${escapeHtml(special?.title || "")}"${nameStyle}>${safe}</strong>`
    : `<strong>${safe}</strong>`;
  const badges = getPlayerTitleBadges(name)
    .map((b) => {
      const extraClass = b.colorClass ? ` ${escapeHtml(b.colorClass)}` : "";
      const style =
        b.color && !b.colorClass
          ? ` style="background:${escapeHtml(b.color)};color:${escapeHtml(b.textColor || "#fff")}"`
          : b.colorClass
            ? ` style="color:${escapeHtml(b.textColor || "#fff")}"`
            : "";
      return `<span class="player-title ${escapeHtml(b.className)}${extraClass}" title="${escapeHtml(b.label)}"${style}>${escapeHtml(b.label)}</span>`;
    })
    .join("");
  return badges ? `${nameHtml}${badges}` : nameHtml;
}

function renderTitlePicker() {
  const picker = document.getElementById("title-picker");
  const buttons = document.getElementById("title-picker-buttons");
  if (!picker || !buttons || typeof HubPlays === "undefined") return;

  if (!hasPlayerName()) {
    picker.classList.add("hidden");
    buttons.innerHTML = "";
    return;
  }

  // Show unlocked titles always; LEGEND stays visible even when locked.
  const showcase = (HubPlays.getTitleShowcase?.() || []).filter(
    (t) => t.unlocked || t.id === "legend"
  );
  if (!showcase.length) {
    picker.classList.add("hidden");
    buttons.innerHTML = "";
    return;
  }

  const active = HubPlays.getActiveTitleId?.() || "";
  const unlockedIds = new Set(showcase.filter((t) => t.unlocked).map((t) => t.id));
  const options = [...showcase];
  // "None" only works for accounts that can hide reserved titles (need LEGEND).
  if (unlockedIds.has("legend")) {
    options.push({ id: "none", label: "None", className: "player-title-none", unlocked: true });
  }

  picker.classList.remove("hidden");
  buttons.innerHTML = options
    .map((opt) => {
      const locked = !opt.unlocked;
      const selected = !locked && (active === opt.id || (opt.id === "none" && active === "none"));
      const hint = locked
        ? "Unlock all achievements"
        : opt.label;
      return `<button type="button" class="title-pick-btn ${escapeHtml(opt.className)}${
        selected ? " active" : ""
      }${locked ? " is-locked" : ""}" data-title="${escapeHtml(opt.id)}" data-locked="${
        locked ? "true" : "false"
      }" aria-pressed="${selected ? "true" : "false"}" aria-disabled="${
        locked ? "true" : "false"
      }" title="${escapeHtml(hint)}">${escapeHtml(opt.label)}${
        locked ? `<span class="title-lock-tag">Locked</span>` : ""
      }</button>`;
    })
    .join("");
}

function renderColorPicker() {
  const picker = document.getElementById("color-picker");
  const buttons = document.getElementById("color-picker-buttons");
  if (!picker || !buttons || typeof HubPlays === "undefined") return;

  if (!hasPlayerName()) {
    picker.classList.add("hidden");
    buttons.innerHTML = "";
    return;
  }

  const showcase = (
    HubPlays.getColorShowcase?.() ||
    HubPlays.getTitleShowcase?.() ||
    []
  ).filter((t) => t.unlocked || t.id === "legend");
  if (!showcase.length) {
    picker.classList.add("hidden");
    buttons.innerHTML = "";
    return;
  }

  const canPick = HubPlays.canPickAccentColors?.() || HubPlays.canMixTitleColors?.() || false;
  const activeColorId = HubPlays.getActiveAccentTitleId?.() || "";
  const label = picker.querySelector(".title-picker-label");
  if (label) {
    label.textContent = canPick ? "Your color (mix with title)" : "Title colors";
  }

  picker.classList.remove("hidden");
  buttons.innerHTML = showcase
    .map((opt) => {
      const locked = !opt.unlocked;
      const selected = !locked && activeColorId === opt.id;
      const extra = HubPlays.EXTRA_COLORS?.[opt.id];
      const isAnimated = !!(opt.animated || extra?.animated);
      const hint = locked
        ? "LEGEND yellow — unlock all achievements"
        : canPick
          ? isAnimated
            ? `${opt.label} animated color (keeps your title)`
            : `Use ${opt.label} color (keeps your title)`
          : `${opt.label} color`;
      const bgStyle =
        isAnimated || opt.id === "cheesy" ? "" : ` style="background:${escapeHtml(opt.color)}"`;
      const animClass = isAnimated
        ? opt.id === "aurora"
          ? " is-aurora"
          : opt.id === "mono"
            ? " is-mono"
            : opt.id === "tide"
              ? " is-tide"
              : " is-aurora"
        : opt.id === "cheesy"
          ? " is-cheesy"
          : "";
      return `<button type="button" class="color-pick-btn${selected ? " active" : ""}${
        locked ? " is-locked" : ""
      }${!canPick && !locked ? " is-fixed" : ""}${animClass}" data-title-color="${escapeHtml(
        opt.id
      )}" data-locked="${locked ? "true" : "false"}" title="${escapeHtml(hint)}" aria-label="${escapeHtml(
        hint
      )}" aria-disabled="${locked || !canPick ? "true" : "false"}"${bgStyle}>${
        locked ? `<span class="color-lock-mark" aria-hidden="true">🔒</span>` : ""
      }</button>`;
    })
    .join("");
}

savePlayerNameBtn?.addEventListener("click", () => savePlayerNameFrom(playerNameInput?.value));
lockPlayerNameBtn?.addEventListener("click", () => togglePlayerNameLock());
playerNameSaveBtn?.addEventListener("click", () => savePlayerNameFrom(playerNameModalInput?.value));
document.getElementById("title-picker-buttons")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-title]");
  if (!btn || typeof HubPlays === "undefined") return;
  if (btn.dataset.locked === "true") {
    const id = btn.dataset.title;
    setPlayerNameStatus(
      id === "legend"
        ? "LEGEND (yellow) unlocks when you complete all achievements"
        : id === "og"
          ? "OG (green) is a reserved title"
          : id === "tester"
            ? "TESTER (red) is a reserved title"
            : id === "cheesy"
              ? "CHEESY LIL GUY is reserved for OscarVR29"
              : "That title is locked",
      true
    );
    return;
  }
  const titleId = btn.dataset.title;
  btn.disabled = true;
  try {
    const result = await HubPlays.setActiveTitle(titleId);
    if (!result.ok) {
      setPlayerNameStatus(result.error || "Couldn't change title", true);
      return;
    }
    paintPlayersPanelLists();
    if (leaderboardsPanel && !leaderboardsPanel.classList.contains("hidden")) {
      renderLeaderboardList();
    }
    const label =
      titleId === "none"
        ? "Title hidden"
        : `Title set to ${(HubPlays.TITLE_DEFS?.[titleId] || {}).label || titleId}`;
    setPlayerNameStatus(label, false);
  } finally {
    btn.disabled = false;
  }
});
document.getElementById("color-picker-buttons")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-title-color]");
  if (!btn || typeof HubPlays === "undefined") return;
  const id = btn.dataset.titleColor;
  if (btn.dataset.locked === "true") {
    setPlayerNameStatus(
      id === "legend"
        ? "Yellow unlocks with LEGEND (all achievements)"
        : id === "og"
          ? "Green unlocks with the OG title"
          : id === "owner"
            ? "Blue is the OWNER color"
            : id === "tester"
              ? "Red unlocks with the TESTER title"
              : id === "cheesy"
                ? "Cheese color unlocks with CHEESY LIL GUY"
                : HubPlays.EXTRA_COLORS?.[id]
                ? `${HubPlays.EXTRA_COLORS[id].label} is a reserved color`
                : "That color is locked",
      true
    );
    return;
  }
  if (!(HubPlays.canPickAccentColors?.() || HubPlays.canMixTitleColors?.())) {
    setPlayerNameStatus("Unlock another title or special color to mix", true);
    return;
  }
  btn.disabled = true;
  try {
    const result = await HubPlays.setAccentFromTitle(id);
    if (!result.ok) {
      setPlayerNameStatus(result.error || "Couldn't change color", true);
      return;
    }
    paintPlayersPanelLists();
    if (leaderboardsPanel && !leaderboardsPanel.classList.contains("hidden")) {
      renderLeaderboardList();
    }
    const label =
      (HubPlays.EXTRA_COLORS?.[id] || {}).label ||
      (HubPlays.TITLE_DEFS?.[id] || {}).label ||
      id;
    setPlayerNameStatus(`Color set to ${label} (title unchanged)`, false);
  } finally {
    btn.disabled = false;
  }
});
document.getElementById("players-online")?.addEventListener("click", async () => {
  try {
    await refreshOnlineCount();
  } catch {}
  setPlayersRosterMode("online");
});
document.getElementById("players-alltime")?.addEventListener("click", async () => {
  try {
    await refreshOnlineCount();
  } catch {}
  setPlayersRosterMode("alltime");
});
playerNameModalInput?.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") savePlayerNameFrom(playerNameModalInput.value);
});
playerNameInput?.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") {
    if (typeof HubPlays !== "undefined" && HubPlays.isNameLocked()) return;
    savePlayerNameFrom(playerNameInput.value);
  }
});
playerNameModalInput?.addEventListener("keyup", (e) => e.stopPropagation());
playerNameInput?.addEventListener("keyup", (e) => e.stopPropagation());

function renderAchievementsPanel() {
  if (!achievementsGrid || typeof HubAchievements === "undefined") return;
  const all = HubAchievements.getAll();
  const unlocked = all.filter(a => a.unlocked).length;
  if (achievementsCount) achievementsCount.textContent = `${unlocked}/${all.length}`;
  achievementsGrid.innerHTML = "";
  // Show unlocked first, then locked
  const sorted = [...all.filter(a => a.unlocked), ...all.filter(a => !a.unlocked)];
  for (const a of sorted) {
    const card = document.createElement("div");
    card.className = "achievement-card " + (a.unlocked ? "unlocked" : "locked");
    card.title = a.desc;
    card.innerHTML = `<span class="achievement-emoji">${a.emoji}</span>` +
      `<span class="achievement-name">${a.name}</span>` +
      `<span class="achievement-desc">${a.desc}</span>`;
    achievementsGrid.appendChild(card);
  }
}

let toastTimer = null;
function showAchievementToast(id) {
  if (!achievementToast || typeof HubAchievements === "undefined") return;
  const def = HubAchievements.getDefinition(id);
  if (!def) return;
  achievementToast.classList.remove("hidden");
  achievementToast.textContent = `${def.emoji} Achievement unlocked: ${def.name}`;
  // Force reflow then animate in
  achievementToast.getBoundingClientRect();
  achievementToast.classList.add("show");
  playSound("achieve");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    achievementToast.classList.remove("show");
    setTimeout(() => achievementToast.classList.add("hidden"), 350);
  }, 3000);
}

// Poll for pending achievements every time we return to the hub
function checkPendingAchievements() {
  if (typeof HubAchievements === "undefined") return;
  const pending = HubAchievements.getPending();
  if (pending.length > 0) {
    // Show toasts sequentially
    let delay = 0;
    for (const id of pending) {
      setTimeout(() => showAchievementToast(id), delay);
      delay += 3500;
    }
    // Re-render panel if open
    if (achievementsPanel && !achievementsPanel.classList.contains("hidden")) {
      renderAchievementsPanel();
    }
  }
}

shareMomentBtn?.addEventListener("click", () => shareMoment());
document.querySelectorAll(".game-card[data-game]").forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest(".fav-btn")) return;
    selectGame(card.dataset.game);
  });
});
document.querySelectorAll(".fav-btn").forEach((btn) => {
  const toggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(btn.dataset.fav);
  };
  btn.addEventListener("click", toggle);
  btn.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") toggle(event);
  });
});
hintBtn.addEventListener("click", () => useHint());
langBtn.addEventListener("click", () => switchLanguage());
themeBtn.addEventListener("click", () => toggleTheme());
lengthBtn.addEventListener("click", () => switchLength());
modeBtn?.addEventListener("click", () => togglePlayMode());

// Confirm the newest files loaded (helps when browser cache sticks).
const sixCount = typeof WORDS_6 !== "undefined" ? WORDS_6.length : 0;
applySiteConfig();
showMessage(`Loaded · ${sixCount} six-letter words`);

let afterWhatsNew = null;
if (location.hash === "#wordle") {
  afterWhatsNew = showMenu;
} else {
  afterWhatsNew = showGamesScreen;
}

function bootAfterUsername() {
  if (showWhatsNew()) {
    whatsNewOkBtn?.addEventListener("click", () => {
      hideWhatsNew();
      afterWhatsNew?.();
    });
  } else {
    afterWhatsNew?.();
  }
}

if (!hasPlayerName()) {
  window.__hubAfterUsername = bootAfterUsername;
  maybeAskPlayerName(true);
} else {
  bootAfterUsername();
}

document.addEventListener("hub-username-ready", () => {
  if (window.__hubAfterUsername) {
    const next = window.__hubAfterUsername;
    window.__hubAfterUsername = null;
    next();
  }
});

// Block Escape from closing the required username popup
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Escape") return;
    if (!hasPlayerName() && playerNameModal && !playerNameModal.classList.contains("hidden")) {
      e.preventDefault();
      e.stopPropagation();
      playerNameModalInput?.focus();
    }
  },
  true
);
