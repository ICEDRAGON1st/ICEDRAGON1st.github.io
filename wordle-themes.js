/**
 * Wordle theme answer banks (English a–z, lengths 4 / 5 / 6).
 * Guesses still use the full dictionary. window.WORDLE_THEMES
 */
(function () {
  const THEMES = {
    classic: {
      id: "classic",
      label: "Classic",
      blurb: "Full dictionary answers"
    },
    animals: {
      id: "animals",
      label: "Animals",
      blurb: "Creatures from land, sea, and sky",
      words: [
        "ant", "ape", "bat", "bear", "bee", "bird", "boar", "bull", "calf", "carp",
        "clam", "colt", "crab", "crow", "deer", "dove", "duck", "dodo", "fawn", "fish",
        "foal", "frog", "goat", "hare", "hawk", "hen", "lamb", "lark", "lion", "lynx",
        "mole", "moth", "mule", "newt", "orca", "owl", "oxen", "pike", "pony", "puma",
        "seal", "slug", "swan", "toad", "tuna", "wasp", "wolf", "worm", "yak",
        "bison", "camel", "cobra", "crane", "eagle", "finch", "gecko", "goose", "heron",
        "hippo", "horse", "hound", "hyena", "koala", "lemur", "llama", "moose", "mouse",
        "otter", "panda", "raven", "rhino", "robin", "sheep", "shark", "skunk", "sloth",
        "snail", "snake", "squid", "stork", "tiger", "trout", "whale", "zebra", "viper",
        "badger", "beaver", "beetle", "bobcat", "canary", "condor", "coyote", "donkey",
        "falcon", "ferret", "gopher", "jaguar", "kitten", "lizard", "lobster", "monkey",
        "oyster", "parrot", "pigeon", "python", "rabbit", "salmon", "shrimp", "spider",
        "turkey", "turtle", "walrus", "weasel", "wombat"
      ]
    },
    food: {
      id: "food",
      label: "Food",
      blurb: "Meals, snacks, and ingredients",
      words: [
        "bean", "beef", "bun", "cake", "corn", "crab", "date", "dill", "egg", "fig",
        "fish", "fries", "gum", "ham", "honey", "jam", "kale", "kiwi", "leek", "lime",
        "loaf", "meat", "milk", "mint", "nut", "oats", "olive", "onion", "pear", "pie",
        "plum", "pork", "rice", "roll", "salt", "soda", "soup", "stew", "taco", "tart",
        "tofu", "tuna", "yam", "yolk",
        "apple", "bacon", "bagel", "basil", "berry", "bread", "candy", "chili", "chips",
        "cocoa", "cream", "crisp", "curry", "donut", "flour", "fruit", "grape", "gravy",
        "guava", "honey", "jelly", "juice", "lemon", "mango", "maple", "melon", "mocha",
        "olive", "onion", "pasta", "peach", "pizza", "salad", "salsa", "steak", "sugar",
        "sushi", "toast", "wheat",
        "banana", "biscuit", "burger", "butter", "carrot", "celery", "cereal", "cheese",
        "cherry", "cookie", "garlic", "ginger", "muffin", "noodle", "orange", "peanut",
        "pepper", "pickle", "potato", "pretzel", "pudding", "raisin", "salmon", "shrimp",
        "tomato", "waffle", "yogurt"
      ]
    },
    flags: {
      id: "flags",
      label: "Flags",
      blurb: "Countries and places",
      words: [
        "chad", "cuba", "fiji", "iran", "iraq", "laos", "mali", "oman", "peru", "togo",
        "chile", "china", "egypt", "ghana", "haiti", "india", "italy", "japan", "kenya",
        "korea", "libya", "malta", "nepal", "niger", "qatar", "samoa", "spain", "sudan",
        "syria", "tonga", "yemen", "benin", "gabon",
        "angola", "belize", "bhutan", "brazil", "brunei", "canada", "cyprus", "france",
        "greece", "guinea", "guyana", "israel", "jordan", "kuwait", "latvia", "malawi",
        "mexico", "monaco", "norway", "panama", "poland", "russia", "rwanda", "serbia",
        "sweden", "taiwan", "turkey", "uganda", "zambia"
      ]
    },
    sports: {
      id: "sports",
      label: "Sports",
      blurb: "Games, gear, and athletics",
      words: [
        "ball", "bat", "bout", "club", "coach", "foul", "goal", "golf", "gym", "heat",
        "ice", "judo", "kick", "lane", "lap", "match", "mat", "net", "oval", "par",
        "pitch", "play", "puck", "race", "rink", "run", "serve", "ski", "sled", "swim",
        "team", "tee", "throw", "tour", "win", "yoga",
        "arena", "bench", "bike", "boxer", "catch", "climb", "coach", "court", "cycle",
        "darts", "dive", "field", "final", "finish", "glide", "goal", "guard", "hockey",
        "hurdle", "jockey", "judge", "karate", "medal", "pitch", "rally", "rider", "rugby",
        "score", "skate", "ski", "spike", "sport", "squad", "track", "train", "vault",
        "boxer", "boxing", "cleats", "diving", "fencer", "finish", "goalie", "helmet",
        "huddle", "jumper", "league", "paddle", "player", "racket", "racing", "rowing",
        "runner", "soccer", "sprint", "strike", "tackle", "tennis", "trophy", "umpire",
        "volley"
      ]
    },
    nature: {
      id: "nature",
      label: "Nature",
      blurb: "Earth, weather, and outdoors",
      words: [
        "bay", "bush", "cave", "cliff", "cloud", "dew", "dune", "fern", "fog", "glade",
        "haze", "hill", "lake", "lava", "leaf", "mist", "moon", "moss", "mud", "oak",
        "peak", "pond", "rain", "reef", "rock", "sand", "sea", "sky", "snow", "soil",
        "star", "sun", "tide", "tree", "vale", "wave", "wind", "wood",
        "beach", "bluff", "brook", "cedar", "coast", "coral", "creek", "earth", "field",
        "fjord", "flood", "flora", "frost", "grass", "grove", "marsh", "ocean", "olive",
        "petal", "plant", "river", "shore", "storm", "swamp", "thorn", "trail", "water",
        "aurora", "canyon", "desert", "flower", "forest", "geyser", "glacier", "harbor",
        "island", "jungle", "lagoon", "meadow", "orchard", "pebble", "prairie", "rainbow",
        "spring", "stream", "summit", "tundra", "valley", "volcano"
      ]
    },
    space: {
      id: "space",
      label: "Space",
      blurb: "Planets, stars, and rockets",
      words: [
        "mars", "moon", "nova", "star", "sun", "void", "beam", "dust", "glow", "haze",
        "lens", "orbit", "ring", "ship", "warp", "zone", "apex", "axis", "core", "disk",
        "fuel", "gate", "hull", "iron", "mass", "mesh", "node", "pod", "ray", "seal",
        "alien", "comet", "earth", "flare", "lunar", "orbit", "pluto", "probe", "radar",
        "rover", "solar", "space", "venus", "orbit", "atlas", "bloom", "cargo", "delta",
        "drift", "flame", "orbit", "phase", "pulse", "quark", "relay", "sonic", "torch",
        "cosmos", "crater", "galaxy", "launch", "meteor", "nebula", "planet", "pulsar",
        "quasar", "rocket", "saturn", "shuttle", "uranus", "vacuum", "aurora", "binary",
        "corona", "engine", "module", "nebula", "photon", "signal", "system"
      ]
    },
    music: {
      id: "music",
      label: "Music",
      blurb: "Instruments, styles, and sound",
      words: [
        "band", "bass", "beat", "drum", "duet", "harp", "jazz", "lute", "note", "oboe",
        "rap", "rock", "song", "solo", "tune", "aria", "clef", "folk", "gong", "hymn",
        "pipe", "rave", "rest", "riff", "sing", "mute", "opus", "tone", "vibe", "wave",
        "banjo", "blues", "bongo", "cello", "choir", "chord", "flute", "lyric", "meter",
        "music", "opera", "organ", "piano", "scale", "tempo", "viola", "vocal", "waltz",
        "audio", "disco", "forte", "intro", "major", "minor", "remix", "score", "track",
        "ballad", "chorus", "cymbal", "guitar", "melody", "rhythm", "singer", "sonata",
        "string", "treble", "violin", "volume", "bridge", "chorus", "fiddle", "jingle",
        "lyrics", "octave", "refrain", "singer"
      ]
    },
    movies: {
      id: "movies",
      label: "Movies",
      blurb: "Film words and cinema vibes",
      words: [
        "cast", "clip", "film", "hero", "role", "scene", "shot", "star", "take", "reel",
        "plot", "prop", "show", "tape", "view", "act", "cut", "set", "boom", "cue",
        "fade", "lens", "mask", "mute", "take",
        "actor", "drama", "extra", "frame", "genre", "movie", "oscar", "props", "score",
        "script", "stage", "stunt", "title", "trailer", "scene", "debut", "focus", "lights",
        "movie", "scene", "short", "story", "theme",
        "camera", "cinema", "climax", "comedy", "credit", "editor", "horror", "screen",
        "sequel", "studio", "ticket", "villain", "action", "credits", "ending", "review",
        "script", "series"
      ]
    }
  };

  // Normalize: lowercase a–z only, keep lengths 4–6, unique per theme.
  Object.keys(THEMES).forEach((id) => {
    const theme = THEMES[id];
    if (!Array.isArray(theme.words)) return;
    const seen = new Set();
    theme.words = theme.words
      .map((w) => String(w || "").toLowerCase().replace(/[^a-z]/g, ""))
      .filter((w) => {
        if (w.length < 4 || w.length > 6) return false;
        if (seen.has(w)) return false;
        seen.add(w);
        return true;
      });
  });

  window.WORDLE_THEMES = THEMES;
})();
