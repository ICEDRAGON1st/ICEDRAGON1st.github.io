/**
 * Hangman theme word banks (English, letters a–z only, no spaces).
 * window.HANGMAN_THEMES
 */
(function () {
  const THEMES = {
    classic: {
      id: "classic",
      label: "Classic",
      blurb: "Mixed dictionary words",
      words: null
    },
    animals: {
      id: "animals",
      label: "Animals",
      blurb: "Creatures from land, sea, and sky",
      words: [
        "ant", "ape", "bat", "bear", "bee", "bird", "boar", "buffalo", "camel", "cat",
        "cheetah", "chicken", "cobra", "cow", "crab", "crane", "crow", "deer", "dog",
        "dolphin", "donkey", "dove", "duck", "eagle", "eel", "elephant", "elk", "falcon",
        "ferret", "finch", "fish", "flamingo", "fox", "frog", "gazelle", "gecko", "goat",
        "goose", "gorilla", "hamster", "hawk", "hedgehog", "heron", "hippo", "horse",
        "hound", "hyena", "iguana", "jaguar", "jellyfish", "kangaroo", "kitten", "koala",
        "lamb", "lemur", "leopard", "lion", "lizard", "llama", "lobster", "lynx", "mole",
        "monkey", "moose", "mouse", "mule", "newt", "octopus", "orca", "ostrich", "otter",
        "owl", "ox", "panda", "panther", "parrot", "peacock", "pelican", "penguin", "pig",
        "pigeon", "pony", "puma", "puppy", "rabbit", "raccoon", "ram", "rat", "raven",
        "rhino", "robin", "salmon", "seal", "shark", "sheep", "shrimp", "skunk", "sloth",
        "snail", "snake", "sparrow", "spider", "squid", "squirrel", "starfish", "stork",
        "swan", "tiger", "toad", "turkey", "turtle", "viper", "walrus", "wasp", "whale",
        "wolf", "wombat", "worm", "yak", "zebra"
      ]
    },
    food: {
      id: "food",
      label: "Food",
      blurb: "Meals, snacks, and ingredients",
      words: [
        "apple", "avocado", "bacon", "bagel", "banana", "basil", "bean", "beef", "berry",
        "biscuit", "bread", "broccoli", "brownie", "burger", "butter", "cabbage", "cake",
        "candy", "carrot", "cereal", "cheese", "cherry", "chicken", "chili", "chips",
        "chocolate", "cinnamon", "coconut", "coffee", "cookie", "corn", "couscous", "crab",
        "cream", "croissant", "cucumber", "cupcake", "curry", "donut", "dumpling", "egg",
        "falafel", "fig", "fish", "flour", "fries", "garlic", "ginger", "grape", "gravy",
        "honey", "hotdog", "hummus", "icecream", "jam", "jelly", "juice", "kale", "kebab",
        "kiwi", "lasagna", "lemon", "lettuce", "lime", "lobster", "mango", "maple", "meat",
        "melon", "milk", "muffin", "mushroom", "mustard", "noodle", "nut", "oatmeal",
        "olive", "onion", "orange", "pancake", "papaya", "pasta", "peach", "peanut", "pear",
        "pepper", "pickle", "pie", "pineapple", "pizza", "plum", "popcorn", "potato",
        "pretzel", "pudding", "pumpkin", "quinoa", "radish", "ramen", "rice", "salad",
        "salsa", "sandwich", "sausage", "shrimp", "soup", "spaghetti", "spinach", "steak",
        "strawberry", "sugar", "sushi", "taco", "toast", "tofu", "tomato", "tortilla",
        "waffle", "walnut", "watermelon", "yogurt", "zucchini"
      ]
    },
    flags: {
      id: "flags",
      label: "Flags",
      blurb: "Countries around the world",
      words: [
        "algeria", "angola", "argentina", "armenia", "australia", "austria", "bahamas",
        "bahrain", "bangladesh", "barbados", "belgium", "belize", "bhutan", "bolivia",
        "botswana", "brazil", "brunei", "bulgaria", "burundi", "cambodia", "cameroon",
        "canada", "chad", "chile", "china", "colombia", "comoros", "croatia", "cuba",
        "cyprus", "denmark", "djibouti", "dominica", "ecuador", "egypt", "estonia",
        "eswatini", "ethiopia", "fiji", "finland", "france", "gabon", "gambia", "georgia",
        "germany", "ghana", "greece", "grenada", "guatemala", "guinea", "guyana", "haiti",
        "honduras", "hungary", "iceland", "india", "indonesia", "iran", "iraq", "ireland",
        "israel", "italy", "jamaica", "japan", "jordan", "kazakhstan", "kenya", "kiribati",
        "kuwait", "laos", "latvia", "lebanon", "lesotho", "liberia", "libya", "lithuania",
        "luxembourg", "madagascar", "malawi", "malaysia", "maldives", "mali", "malta",
        "mauritius", "mexico", "moldova", "mongolia", "montenegro", "morocco", "mozambique",
        "myanmar", "namibia", "nepal", "netherlands", "nicaragua", "niger", "nigeria",
        "norway", "oman", "pakistan", "palau", "panama", "paraguay", "peru", "philippines",
        "poland", "portugal", "qatar", "romania", "russia", "rwanda", "samoa", "senegal",
        "serbia", "seychelles", "singapore", "slovakia", "slovenia", "somalia", "spain",
        "sudan", "suriname", "sweden", "switzerland", "syria", "taiwan", "tajikistan",
        "tanzania", "thailand", "togo", "tonga", "tunisia", "turkey", "tuvalu", "uganda",
        "ukraine", "uruguay", "uzbekistan", "vanuatu", "venezuela", "vietnam", "yemen",
        "zambia", "zimbabwe"
      ]
    },
    sports: {
      id: "sports",
      label: "Sports",
      blurb: "Games, gear, and athletics",
      words: [
        "archery", "arena", "athlete", "badminton", "baseball", "basketball", "bat",
        "batting", "bike", "billiards", "bowling", "boxing", "canoe", "catcher", "cleats",
        "climb", "coach", "cricket", "cycling", "darts", "defense", "diving", "dribble",
        "fencing", "field", "finish", "football", "foul", "frisbee", "goal", "goalie",
        "golf", "gym", "gymnastics", "handball", "helmet", "hockey", "huddle", "hurdle",
        "icing", "jersey", "jockey", "judo", "jump", "karate", "kayak", "kick", "lacrosse",
        "league", "marathon", "match", "medal", "offense", "olympic", "paddle", "penalty",
        "pitch", "player", "polo", "puck", "race", "racket", "rally", "referee", "relay",
        "riding", "rink", "rowing", "rugby", "runner", "sailing", "score", "serve",
        "skating", "skiing", "sled", "soccer", "softball", "spike", "sprint", "stadium",
        "strike", "surf", "swim", "tackle", "target", "team", "tennis", "throw", "track",
        "trophy", "umpire", "volley", "wrestling", "yacht", "yoga"
      ]
    },
    nature: {
      id: "nature",
      label: "Nature",
      blurb: "Earth, weather, and outdoors",
      words: [
        "aurora", "beach", "bluff", "breeze", "brook", "cactus", "canyon", "cave", "cedar",
        "cliff", "cloud", "coast", "coral", "creek", "desert", "dew", "dune", "earth",
        "eclipse", "fern", "fjord", "flood", "flower", "fog", "forest", "frost", "geyser",
        "glacier", "grass", "grove", "harbor", "haze", "hill", "horizon", "island", "jungle",
        "lagoon", "lake", "lava", "leaf", "lightning", "meadow", "mist", "moon", "moss",
        "mountain", "mud", "oasis", "ocean", "orchard", "peak", "pebble", "pine", "pond",
        "prairie", "rain", "rainbow", "reef", "river", "rock", "sand", "savanna", "sea",
        "shore", "sky", "snow", "soil", "spring", "star", "storm", "stream", "summit",
        "sun", "swamp", "thunder", "tide", "tree", "tundra", "valley", "volcano", "waterfall",
        "wave", "wind", "woodland"
      ]
    },
    space: {
      id: "space",
      label: "Space",
      blurb: "Planets, stars, and rockets",
      words: [
        "alien", "asteroid", "astronaut", "atmosphere", "blackhole", "comet", "constellation",
        "cosmos", "crater", "earth", "eclipse", "galaxy", "gravity", "jupiter", "launch",
        "lunar", "mars", "mercury", "meteor", "moon", "nebula", "neptune", "orbit", "planet",
        "pluto", "probe", "pulsar", "quasar", "radar", "rocket", "rover", "satellite",
        "saturn", "shuttle", "solar", "spaceship", "star", "sun", "supernova", "telescope",
        "uranus", "venus", "wormhole"
      ]
    },
    music: {
      id: "music",
      label: "Music",
      blurb: "Instruments, styles, and sound",
      words: [
        "accordion", "album", "banjo", "bass", "beat", "blues", "bongo", "cello", "choir",
        "chord", "clarinet", "composer", "concert", "cymbal", "dance", "drum", "duet",
        "flute", "guitar", "harmony", "harp", "jazz", "keyboard", "lyrics", "melody",
        "microphone", "music", "note", "oboe", "opera", "orchestra", "organ", "piano",
        "playlist", "pop", "quartet", "rap", "record", "rhythm", "rock", "saxophone",
        "sing", "song", "soprano", "symphony", "tempo", "trumpet", "tuba", "ukulele",
        "violin", "vocal", "waltz", "xylophone"
      ]
    },
    movies: {
      id: "movies",
      label: "Movies",
      blurb: "Film words and cinema vibes",
      words: [
        "actor", "actress", "adventure", "animation", "audience", "camera", "cast", "cinema",
        "climax", "comedy", "costume", "credits", "director", "drama", "dvd", "editor",
        "fantasy", "film", "genre", "horror", "movie", "oscar", "plot", "popcorn", "premiere",
        "producer", "projector", "reel", "scene", "screen", "script", "sequel", "set",
        "soundtrack", "stage", "studio", "stunt", "theater", "thriller", "trailer", "villain"
      ]
    }
  };

  window.HANGMAN_THEMES = THEMES;
})();
