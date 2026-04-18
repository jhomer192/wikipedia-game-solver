/**
 * Daily Challenge system -- deterministic challenge-per-day, Wordle-style.
 *
 * Challenge #1 starts on 2026-04-19 (launch date).
 * The challenge list wraps every 365 entries.
 */

export interface DailyChallenge {
  date: string            // "2026-04-19"
  start: string           // "Pizza"
  end: string             // "Albert Einstein"
  challengeNumber: number // sequential from launch date
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface DailyResult {
  challengeNumber: number
  date: string
  hops: number
  timeSeconds: number
  path: string[]
  completed: boolean
}

export interface DailyStats {
  gamesPlayed: number
  currentStreak: number
  maxStreak: number
  totalHops: number
  totalTime: number
  hopDistribution: Record<number, number> // hops -> count
}

const LAUNCH_DATE = '2026-04-19'

/** 365 curated article pairs, mixing difficulties. */
const CHALLENGES: { start: string; end: string; difficulty: 'easy' | 'medium' | 'hard' }[] = [
  // --- Easy (approx 120) ---
  { start: 'Dog', end: 'Cat', difficulty: 'easy' },
  { start: 'Pizza', end: 'Italy', difficulty: 'easy' },
  { start: 'Baseball', end: 'United States', difficulty: 'easy' },
  { start: 'London', end: 'England', difficulty: 'easy' },
  { start: 'Guitar', end: 'Music', difficulty: 'easy' },
  { start: 'Mars', end: 'NASA', difficulty: 'easy' },
  { start: 'Soccer', end: 'FIFA', difficulty: 'easy' },
  { start: 'Sushi', end: 'Japan', difficulty: 'easy' },
  { start: 'Chocolate', end: 'Switzerland', difficulty: 'easy' },
  { start: 'Apple Inc.', end: 'Steve Jobs', difficulty: 'easy' },
  { start: 'Olympics', end: 'Greece', difficulty: 'easy' },
  { start: 'Sun', end: 'Solar System', difficulty: 'easy' },
  { start: 'Titanic', end: 'Atlantic Ocean', difficulty: 'easy' },
  { start: 'Shakespeare', end: 'Theater', difficulty: 'easy' },
  { start: 'Mount Everest', end: 'Nepal', difficulty: 'easy' },
  { start: 'Dinosaur', end: 'Extinction event', difficulty: 'easy' },
  { start: 'Football', end: 'Super Bowl', difficulty: 'easy' },
  { start: 'Paris', end: 'France', difficulty: 'easy' },
  { start: 'Elephant', end: 'Africa', difficulty: 'easy' },
  { start: 'Piano', end: 'Ludwig van Beethoven', difficulty: 'easy' },
  { start: 'Microsoft', end: 'Bill Gates', difficulty: 'easy' },
  { start: 'Moon', end: 'Apollo 11', difficulty: 'easy' },
  { start: 'Amazon (company)', end: 'Jeff Bezos', difficulty: 'easy' },
  { start: 'Tiger', end: 'India', difficulty: 'easy' },
  { start: 'Pyramid', end: 'Egypt', difficulty: 'easy' },
  { start: 'Coffee', end: 'Brazil', difficulty: 'easy' },
  { start: 'Smartphone', end: 'Internet', difficulty: 'easy' },
  { start: 'Vaccine', end: 'World Health Organization', difficulty: 'easy' },
  { start: 'Harry Potter', end: 'J. K. Rowling', difficulty: 'easy' },
  { start: 'Tesla, Inc.', end: 'Elon Musk', difficulty: 'easy' },
  { start: 'Bicycle', end: 'Tour de France', difficulty: 'easy' },
  { start: 'Shark', end: 'Ocean', difficulty: 'easy' },
  { start: 'Ice cream', end: 'Milk', difficulty: 'easy' },
  { start: 'Volcano', end: 'Lava', difficulty: 'easy' },
  { start: 'Eagle', end: 'Bird', difficulty: 'easy' },
  { start: 'Democracy', end: 'Athens', difficulty: 'easy' },
  { start: 'Violin', end: 'Orchestra', difficulty: 'easy' },
  { start: 'Kangaroo', end: 'Australia', difficulty: 'easy' },
  { start: 'Bread', end: 'Wheat', difficulty: 'easy' },
  { start: 'Radio', end: 'Television', difficulty: 'easy' },
  { start: 'Tornado', end: 'Weather', difficulty: 'easy' },
  { start: 'Penguin', end: 'Antarctica', difficulty: 'easy' },
  { start: 'Gold', end: 'Chemical element', difficulty: 'easy' },
  { start: 'Yoga', end: 'Meditation', difficulty: 'easy' },
  { start: 'Hollywood', end: 'Los Angeles', difficulty: 'easy' },
  { start: 'Passport', end: 'Citizenship', difficulty: 'easy' },
  { start: 'DNA', end: 'Genetics', difficulty: 'easy' },
  { start: 'Maple syrup', end: 'Canada', difficulty: 'easy' },
  { start: 'Chess', end: 'Board game', difficulty: 'easy' },
  { start: 'Samurai', end: 'Japan', difficulty: 'easy' },
  { start: 'Compass', end: 'Navigation', difficulty: 'easy' },
  { start: 'Wine', end: 'Grape', difficulty: 'easy' },
  { start: 'Coral reef', end: 'Great Barrier Reef', difficulty: 'easy' },
  { start: 'Honeybee', end: 'Pollination', difficulty: 'easy' },
  { start: 'Hurricane', end: 'Tropical cyclone', difficulty: 'easy' },
  { start: 'Einstein', end: 'Physics', difficulty: 'easy' },
  { start: 'Leonardo da Vinci', end: 'Mona Lisa', difficulty: 'easy' },
  { start: 'Netflix', end: 'Streaming media', difficulty: 'easy' },
  { start: 'Twitter', end: 'Social media', difficulty: 'easy' },
  { start: 'Spotify', end: 'Podcast', difficulty: 'easy' },
  { start: 'Whale', end: 'Mammal', difficulty: 'easy' },
  { start: 'Marathon', end: 'Running', difficulty: 'easy' },
  { start: 'Telescope', end: 'Astronomy', difficulty: 'easy' },
  { start: 'Rose', end: 'Flower', difficulty: 'easy' },
  { start: 'Saturn', end: 'Planet', difficulty: 'easy' },
  { start: 'Library', end: 'Book', difficulty: 'easy' },
  { start: 'Hospital', end: 'Medicine', difficulty: 'easy' },
  { start: 'Camera', end: 'Photography', difficulty: 'easy' },
  { start: 'Eiffel Tower', end: 'Paris', difficulty: 'easy' },
  { start: 'Statue of Liberty', end: 'New York City', difficulty: 'easy' },
  { start: 'Toyota', end: 'Automobile', difficulty: 'easy' },
  { start: 'Bitcoin', end: 'Cryptocurrency', difficulty: 'easy' },
  { start: 'YouTube', end: 'Google', difficulty: 'easy' },
  { start: 'Panda', end: 'China', difficulty: 'easy' },
  { start: 'Viking', end: 'Scandinavia', difficulty: 'easy' },
  { start: 'Tennis', end: 'Wimbledon Championships', difficulty: 'easy' },
  { start: 'Oxygen', end: 'Atmosphere', difficulty: 'easy' },
  { start: 'Rainforest', end: 'Amazon rainforest', difficulty: 'easy' },
  { start: 'Skiing', end: 'Snow', difficulty: 'easy' },
  { start: 'Beethoven', end: 'Symphony', difficulty: 'easy' },
  { start: 'Picasso', end: 'Cubism', difficulty: 'easy' },
  { start: 'Aristotle', end: 'Philosophy', difficulty: 'easy' },
  { start: 'Galileo Galilei', end: 'Telescope', difficulty: 'easy' },
  { start: 'Darwin', end: 'Evolution', difficulty: 'easy' },
  { start: 'Newton', end: 'Gravity', difficulty: 'easy' },
  { start: 'Cleopatra', end: 'Ancient Egypt', difficulty: 'easy' },
  { start: 'Abraham Lincoln', end: 'American Civil War', difficulty: 'easy' },
  { start: 'Mahatma Gandhi', end: 'India', difficulty: 'easy' },
  { start: 'Nelson Mandela', end: 'South Africa', difficulty: 'easy' },
  { start: 'Martin Luther King Jr.', end: 'Civil rights movement', difficulty: 'easy' },
  { start: 'Nobel Prize', end: 'Sweden', difficulty: 'easy' },
  { start: 'Roller coaster', end: 'Amusement park', difficulty: 'easy' },
  { start: 'Polar bear', end: 'Arctic', difficulty: 'easy' },
  { start: 'Cactus', end: 'Desert', difficulty: 'easy' },
  { start: 'Lighthouse', end: 'Ship', difficulty: 'easy' },
  { start: 'Niagara Falls', end: 'Waterfall', difficulty: 'easy' },
  { start: 'Grand Canyon', end: 'Arizona', difficulty: 'easy' },
  { start: 'Taj Mahal', end: 'India', difficulty: 'easy' },
  { start: 'Great Wall of China', end: 'China', difficulty: 'easy' },
  { start: 'Colosseum', end: 'Rome', difficulty: 'easy' },
  { start: 'Machu Picchu', end: 'Peru', difficulty: 'easy' },
  { start: 'Sahara', end: 'Africa', difficulty: 'easy' },
  { start: 'Bamboo', end: 'Grass', difficulty: 'easy' },
  { start: 'Octopus', end: 'Mollusk', difficulty: 'easy' },
  { start: 'Dolphin', end: 'Marine mammal', difficulty: 'easy' },
  { start: 'Parrot', end: 'Tropical bird', difficulty: 'easy' },
  { start: 'Insulin', end: 'Diabetes', difficulty: 'easy' },
  { start: 'Printing press', end: 'Johannes Gutenberg', difficulty: 'easy' },
  { start: 'Steam engine', end: 'Industrial Revolution', difficulty: 'easy' },
  { start: 'Airplane', end: 'Wright brothers', difficulty: 'easy' },
  { start: 'Subway', end: 'Public transport', difficulty: 'easy' },
  { start: 'Hamburger', end: 'Fast food', difficulty: 'easy' },
  { start: 'Silk', end: 'Silkworm', difficulty: 'easy' },
  { start: 'Perfume', end: 'Fragrance', difficulty: 'easy' },
  { start: 'Ballet', end: 'Dance', difficulty: 'easy' },
  { start: 'Opera', end: 'Singing', difficulty: 'easy' },
  { start: 'Origami', end: 'Paper', difficulty: 'easy' },
  { start: 'Tsunami', end: 'Earthquake', difficulty: 'easy' },
  { start: 'Aurora', end: 'Magnetosphere', difficulty: 'easy' },
  { start: 'Supernova', end: 'Star', difficulty: 'easy' },
  { start: 'Black hole', end: 'General relativity', difficulty: 'easy' },

  // --- Medium (approx 120) ---
  { start: 'Eiffel Tower', end: 'Basketball', difficulty: 'medium' },
  { start: 'Mozart', end: 'Bitcoin', difficulty: 'medium' },
  { start: 'Niagara Falls', end: 'Kung fu', difficulty: 'medium' },
  { start: 'Cleopatra', end: 'Jazz', difficulty: 'medium' },
  { start: 'Mount Kilimanjaro', end: 'Heavy metal music', difficulty: 'medium' },
  { start: 'Espresso', end: 'Samurai', difficulty: 'medium' },
  { start: 'Mars', end: 'Hip hop', difficulty: 'medium' },
  { start: 'Titanic', end: 'Reggae', difficulty: 'medium' },
  { start: 'Bermuda Triangle', end: 'Origami', difficulty: 'medium' },
  { start: 'Stonehenge', end: 'Robot', difficulty: 'medium' },
  { start: 'Pompeii', end: 'Video game', difficulty: 'medium' },
  { start: 'Marie Curie', end: 'Surfing', difficulty: 'medium' },
  { start: 'Fibonacci', end: 'Coral reef', difficulty: 'medium' },
  { start: 'Morse code', end: 'Skateboarding', difficulty: 'medium' },
  { start: 'Galileo Galilei', end: 'Karate', difficulty: 'medium' },
  { start: 'Renaissance', end: 'Snowboarding', difficulty: 'medium' },
  { start: 'Silk Road', end: 'Bluetooth', difficulty: 'medium' },
  { start: 'Viking', end: 'Anime', difficulty: 'medium' },
  { start: 'Trojan War', end: 'Photography', difficulty: 'medium' },
  { start: 'Atlantis', end: 'Electric guitar', difficulty: 'medium' },
  { start: 'Nikola Tesla', end: 'Samba', difficulty: 'medium' },
  { start: 'Alchemy', end: 'Roller coaster', difficulty: 'medium' },
  { start: 'Genghis Khan', end: 'Yoga', difficulty: 'medium' },
  { start: 'Machu Picchu', end: 'Cryptocurrency', difficulty: 'medium' },
  { start: 'Galileo Galilei', end: 'Chocolate', difficulty: 'medium' },
  { start: 'Plato', end: 'Skateboard', difficulty: 'medium' },
  { start: 'Pythagoras', end: 'Scuba diving', difficulty: 'medium' },
  { start: 'Alexander the Great', end: 'Reggae', difficulty: 'medium' },
  { start: 'Hieroglyphics', end: 'Broadway theatre', difficulty: 'medium' },
  { start: 'Napoleon', end: 'Manga', difficulty: 'medium' },
  { start: 'Copernicus', end: 'Surfboard', difficulty: 'medium' },
  { start: 'Archimedes', end: 'K-pop', difficulty: 'medium' },
  { start: 'Julius Caesar', end: 'Volleyball', difficulty: 'medium' },
  { start: 'Marco Polo', end: 'Artificial intelligence', difficulty: 'medium' },
  { start: 'Great Wall of China', end: 'Opera', difficulty: 'medium' },
  { start: 'Black Death', end: 'Snowboard', difficulty: 'medium' },
  { start: 'Magna Carta', end: 'Sushi', difficulty: 'medium' },
  { start: 'Ottoman Empire', end: 'Podcast', difficulty: 'medium' },
  { start: 'Salem witch trials', end: 'Tennis', difficulty: 'medium' },
  { start: 'Moby-Dick', end: 'Space station', difficulty: 'medium' },
  { start: 'Frankenstein', end: 'Solar panel', difficulty: 'medium' },
  { start: 'Dracula', end: 'Electric car', difficulty: 'medium' },
  { start: 'Sherlock Holmes', end: 'Photosynthesis', difficulty: 'medium' },
  { start: 'Alice in Wonderland', end: 'Nuclear power', difficulty: 'medium' },
  { start: 'Robin Hood', end: 'Drone', difficulty: 'medium' },
  { start: 'King Arthur', end: 'Smartphone', difficulty: 'medium' },
  { start: 'Odyssey', end: 'Virtual reality', difficulty: 'medium' },
  { start: 'Don Quixote', end: 'Satellite', difficulty: 'medium' },
  { start: 'Hamlet', end: 'Blockchain', difficulty: 'medium' },
  { start: 'Mona Lisa', end: 'Rugby', difficulty: 'medium' },
  { start: 'Sistine Chapel', end: 'Helicopter', difficulty: 'medium' },
  { start: 'Colosseum', end: 'Wi-Fi', difficulty: 'medium' },
  { start: 'Parthenon', end: 'Marathon', difficulty: 'medium' },
  { start: 'Angkor Wat', end: 'Pizza', difficulty: 'medium' },
  { start: 'Petra', end: 'Submarine', difficulty: 'medium' },
  { start: 'Easter Island', end: 'Telescope', difficulty: 'medium' },
  { start: 'Chichen Itza', end: 'Espresso', difficulty: 'medium' },
  { start: 'Great Pyramid of Giza', end: 'Motorcycle', difficulty: 'medium' },
  { start: 'Yellowstone', end: 'Ballet', difficulty: 'medium' },
  { start: 'Amazon River', end: 'Chess', difficulty: 'medium' },
  { start: 'Sahara', end: 'Ice hockey', difficulty: 'medium' },
  { start: 'Mariana Trench', end: 'Skateboarding', difficulty: 'medium' },
  { start: 'Mount Fuji', end: 'Salsa (dance)', difficulty: 'medium' },
  { start: 'Aurora', end: 'Tango (dance)', difficulty: 'medium' },
  { start: 'Tornado', end: 'Fencing', difficulty: 'medium' },
  { start: 'Tsunami', end: 'Archery', difficulty: 'medium' },
  { start: 'Eclipse', end: 'Parkour', difficulty: 'medium' },
  { start: 'Supernova', end: 'Judo', difficulty: 'medium' },
  { start: 'Neutron star', end: 'Bowling', difficulty: 'medium' },
  { start: 'Milky Way', end: 'Poker', difficulty: 'medium' },
  { start: 'Andromeda Galaxy', end: 'Taekwondo', difficulty: 'medium' },
  { start: 'Dark matter', end: 'Badminton', difficulty: 'medium' },
  { start: 'Photon', end: 'Lacrosse', difficulty: 'medium' },
  { start: 'Electron', end: 'Handball', difficulty: 'medium' },
  { start: 'Quantum mechanics', end: 'Curling', difficulty: 'medium' },
  { start: 'DNA', end: 'Skateboarding', difficulty: 'medium' },
  { start: 'Chromosome', end: 'Triathlon', difficulty: 'medium' },
  { start: 'Mitochondrion', end: 'Kayaking', difficulty: 'medium' },
  { start: 'Photosynthesis', end: 'Billiards', difficulty: 'medium' },
  { start: 'Penicillin', end: 'Surfing', difficulty: 'medium' },
  { start: 'Aspirin', end: 'Table tennis', difficulty: 'medium' },
  { start: 'Insulin', end: 'Golf', difficulty: 'medium' },
  { start: 'Antibody', end: 'Squash (sport)', difficulty: 'medium' },
  { start: 'Neuron', end: 'Paintball', difficulty: 'medium' },
  { start: 'Adrenaline', end: 'Polo', difficulty: 'medium' },
  { start: 'Caffeine', end: 'Rowing (sport)', difficulty: 'medium' },
  { start: 'Serotonin', end: 'Sailing', difficulty: 'medium' },
  { start: 'Dopamine', end: 'Waterskiing', difficulty: 'medium' },
  { start: 'Internet', end: 'Origami', difficulty: 'medium' },
  { start: 'World Wide Web', end: 'Calligraphy', difficulty: 'medium' },
  { start: 'Algorithm', end: 'Pottery', difficulty: 'medium' },
  { start: 'Machine learning', end: 'Knitting', difficulty: 'medium' },
  { start: 'Compiler', end: 'Woodworking', difficulty: 'medium' },
  { start: 'Linux', end: 'Gardening', difficulty: 'medium' },
  { start: 'Python (programming language)', end: 'Beekeeping', difficulty: 'medium' },
  { start: 'JavaScript', end: 'Mountaineering', difficulty: 'medium' },
  { start: 'Wikipedia', end: 'Scuba diving', difficulty: 'medium' },
  { start: 'Email', end: 'Bonsai', difficulty: 'medium' },
  { start: 'GPS', end: 'Pottery', difficulty: 'medium' },
  { start: 'Radar', end: 'Embroidery', difficulty: 'medium' },
  { start: 'Laser', end: 'Fishing', difficulty: 'medium' },
  { start: 'Fiber optics', end: 'Camping', difficulty: 'medium' },
  { start: 'Semiconductor', end: 'Juggling', difficulty: 'medium' },
  { start: '3D printing', end: 'Fencing', difficulty: 'medium' },
  { start: 'Nanotechnology', end: 'Rock climbing', difficulty: 'medium' },
  { start: 'Genetic engineering', end: 'Skydiving', difficulty: 'medium' },
  { start: 'CRISPR', end: 'Paragliding', difficulty: 'medium' },
  { start: 'Stem cell', end: 'Bungee jumping', difficulty: 'medium' },
  { start: 'Climate change', end: 'Circus', difficulty: 'medium' },
  { start: 'Fossil fuel', end: 'Magic (illusion)', difficulty: 'medium' },
  { start: 'Renewable energy', end: 'Puppetry', difficulty: 'medium' },
  { start: 'Nuclear fusion', end: 'Ventriloquism', difficulty: 'medium' },
  { start: 'Solar energy', end: 'Mime artist', difficulty: 'medium' },
  { start: 'Wind power', end: 'Stand-up comedy', difficulty: 'medium' },
  { start: 'Hydropower', end: 'Beatboxing', difficulty: 'medium' },
  { start: 'Geothermal energy', end: 'Breakdancing', difficulty: 'medium' },
  { start: 'Electric vehicle', end: 'Capoeira', difficulty: 'medium' },
  { start: 'Space elevator', end: 'Flamenco', difficulty: 'medium' },
  { start: 'Terraforming', end: 'Belly dance', difficulty: 'medium' },

  // --- Hard (approx 125) ---
  { start: 'Rasputin', end: 'Pok\u00e9mon', difficulty: 'hard' },
  { start: 'Quantum physics', end: 'Taylor Swift', difficulty: 'hard' },
  { start: 'Platypus', end: 'Stock market', difficulty: 'hard' },
  { start: 'Kombucha', end: 'Space Shuttle', difficulty: 'hard' },
  { start: 'Gregorian calendar', end: 'Pac-Man', difficulty: 'hard' },
  { start: 'Sourdough', end: 'International Space Station', difficulty: 'hard' },
  { start: 'Bioluminescence', end: 'The Beatles', difficulty: 'hard' },
  { start: 'Yodeling', end: 'Quantum computing', difficulty: 'hard' },
  { start: 'Morse code', end: 'Sumo', difficulty: 'hard' },
  { start: 'Fibonacci number', end: 'Tequila', difficulty: 'hard' },
  { start: 'Pangolin', end: 'Broadway theatre', difficulty: 'hard' },
  { start: 'Cuttlefish', end: 'Olympic Games', difficulty: 'hard' },
  { start: 'Barnacle', end: 'Hip hop music', difficulty: 'hard' },
  { start: 'Praying mantis', end: 'Nobel Prize in Literature', difficulty: 'hard' },
  { start: 'Tardigrade', end: 'World Cup', difficulty: 'hard' },
  { start: 'Axolotl', end: 'Renaissance', difficulty: 'hard' },
  { start: 'Narwhal', end: 'Silicon Valley', difficulty: 'hard' },
  { start: 'Capybara', end: 'Impressionism', difficulty: 'hard' },
  { start: 'Sloth', end: 'Formula One', difficulty: 'hard' },
  { start: 'Chameleon', end: 'Cold War', difficulty: 'hard' },
  { start: 'Hedgehog', end: 'Artificial intelligence', difficulty: 'hard' },
  { start: 'Flamingo', end: 'Cryptocurrency', difficulty: 'hard' },
  { start: 'Jellyfish', end: 'Baroque', difficulty: 'hard' },
  { start: 'Seahorse', end: 'Space exploration', difficulty: 'hard' },
  { start: 'Firefly', end: 'Gothic architecture', difficulty: 'hard' },
  { start: 'Dragonfly', end: 'Existentialism', difficulty: 'hard' },
  { start: 'Albatross', end: 'Cybersecurity', difficulty: 'hard' },
  { start: 'Toucan', end: 'Surrealism', difficulty: 'hard' },
  { start: 'Koala', end: 'Quantum entanglement', difficulty: 'hard' },
  { start: 'Lemur', end: 'Blockchain', difficulty: 'hard' },
  { start: 'Manatee', end: 'Art Nouveau', difficulty: 'hard' },
  { start: 'Ocelot', end: 'Machine learning', difficulty: 'hard' },
  { start: 'Quokka', end: 'Romanticism', difficulty: 'hard' },
  { start: 'Chinchilla', end: 'Deep learning', difficulty: 'hard' },
  { start: 'Salamander', end: 'Cubism', difficulty: 'hard' },
  { start: 'Piranha', end: 'String theory', difficulty: 'hard' },
  { start: 'Iguana', end: 'Dadaism', difficulty: 'hard' },
  { start: 'Meerkat', end: 'Cloud computing', difficulty: 'hard' },
  { start: 'Armadillo', end: 'Minimalism', difficulty: 'hard' },
  { start: 'Tapir', end: 'Augmented reality', difficulty: 'hard' },
  { start: 'Anteater', end: 'Pop art', difficulty: 'hard' },
  { start: 'Porcupine', end: 'Singularity', difficulty: 'hard' },
  { start: 'Wombat', end: 'Futurism', difficulty: 'hard' },
  { start: 'Ferret', end: 'Expressionism', difficulty: 'hard' },
  { start: 'Beaver', end: 'Nihilism', difficulty: 'hard' },
  { start: 'Otter', end: 'Postmodernism', difficulty: 'hard' },
  { start: 'Badger', end: 'Stoicism', difficulty: 'hard' },
  { start: 'Moose', end: 'Deconstructionism', difficulty: 'hard' },
  { start: 'Bison', end: 'Phenomenology (philosophy)', difficulty: 'hard' },
  { start: 'Wolverine', end: 'Brutalist architecture', difficulty: 'hard' },
  { start: 'Walrus', end: 'Esperanto', difficulty: 'hard' },
  { start: 'Yak', end: 'Bauhaus', difficulty: 'hard' },
  { start: 'Gazelle', end: 'Art Deco', difficulty: 'hard' },
  { start: 'Hyena', end: 'Steampunk', difficulty: 'hard' },
  { start: 'Cheetah', end: 'Origami', difficulty: 'hard' },
  { start: 'Lynx', end: 'Haiku', difficulty: 'hard' },
  { start: 'Manta ray', end: 'Kabuki', difficulty: 'hard' },
  { start: 'Pelican', end: 'Ukiyo-e', difficulty: 'hard' },
  { start: 'Woodpecker', end: 'Wabi-sabi', difficulty: 'hard' },
  { start: 'Hummingbird', end: 'Kintsugi', difficulty: 'hard' },
  { start: 'Crane (bird)', end: 'Mandelbrot set', difficulty: 'hard' },
  { start: 'Stork', end: 'Game theory', difficulty: 'hard' },
  { start: 'Raven', end: 'Chaos theory', difficulty: 'hard' },
  { start: 'Falcon', end: 'Topology', difficulty: 'hard' },
  { start: 'Osprey', end: 'Number theory', difficulty: 'hard' },
  { start: 'Kingfisher', end: "Gödel's incompleteness theorems", difficulty: 'hard' },
  { start: 'Condor', end: "Fermat's Last Theorem", difficulty: 'hard' },
  { start: 'Vulture', end: 'Riemann hypothesis', difficulty: 'hard' },
  { start: 'Barracuda', end: 'Turing machine', difficulty: 'hard' },
  { start: 'Swordfish', end: 'P versus NP problem', difficulty: 'hard' },
  { start: 'Stingray', end: 'Lambda calculus', difficulty: 'hard' },
  { start: 'Lobster', end: 'Cellular automaton', difficulty: 'hard' },
  { start: 'Crab', end: "Conway's Game of Life", difficulty: 'hard' },
  { start: 'Shrimp', end: 'Fibonacci number', difficulty: 'hard' },
  { start: 'Squid', end: 'Golden ratio', difficulty: 'hard' },
  { start: 'Starfish', end: 'Fractal', difficulty: 'hard' },
  { start: 'Sea urchin', end: 'Benford\'s law', difficulty: 'hard' },
  { start: 'Coral', end: 'Zipf\'s law', difficulty: 'hard' },
  { start: 'Sponge', end: 'Pareto principle', difficulty: 'hard' },
  { start: 'Anemone', end: 'Six degrees of separation', difficulty: 'hard' },
  { start: 'Kelp', end: 'Dunbar\'s number', difficulty: 'hard' },
  { start: 'Plankton', end: 'Paradox', difficulty: 'hard' },
  { start: 'Moss', end: 'Ship of Theseus', difficulty: 'hard' },
  { start: 'Fern', end: "Zeno's paradoxes", difficulty: 'hard' },
  { start: 'Lichen', end: "Schrödinger's cat", difficulty: 'hard' },
  { start: 'Mushroom', end: "Maxwell's demon", difficulty: 'hard' },
  { start: 'Truffle', end: "Newcomb's paradox", difficulty: 'hard' },
  { start: 'Yeast', end: "Pascal's wager", difficulty: 'hard' },
  { start: 'Sourdough', end: "Occam's razor", difficulty: 'hard' },
  { start: 'Kimchi', end: "Hanlon's razor", difficulty: 'hard' },
  { start: 'Miso', end: 'Dunning-Kruger effect', difficulty: 'hard' },
  { start: 'Tofu', end: 'Impostor syndrome', difficulty: 'hard' },
  { start: 'Tempeh', end: 'Stockholm syndrome', difficulty: 'hard' },
  { start: 'Sauerkraut', end: 'Baader-Meinhof phenomenon', difficulty: 'hard' },
  { start: 'Kefir', end: 'Mandela effect', difficulty: 'hard' },
  { start: 'Kombucha', end: 'Butterfly effect', difficulty: 'hard' },
  { start: 'Natto', end: 'Observer effect (physics)', difficulty: 'hard' },
  { start: 'Wasabi', end: 'Doppler effect', difficulty: 'hard' },
  { start: 'Turmeric', end: 'Casimir effect', difficulty: 'hard' },
  { start: 'Saffron', end: 'Mpemba effect', difficulty: 'hard' },
  { start: 'Cinnamon', end: 'Streisand effect', difficulty: 'hard' },
  { start: 'Cardamom', end: 'Cobra effect', difficulty: 'hard' },
  { start: 'Paprika', end: 'Matthew effect', difficulty: 'hard' },
  { start: 'Nutmeg', end: 'Halo effect', difficulty: 'hard' },
  { start: 'Vanilla', end: 'Placebo', difficulty: 'hard' },
  { start: 'Clove', end: 'Nocebo', difficulty: 'hard' },
  { start: 'Ginger', end: 'Synesthesia', difficulty: 'hard' },
  { start: 'Basil', end: 'Aphantasia', difficulty: 'hard' },
  { start: 'Oregano', end: 'Prosopagnosia', difficulty: 'hard' },
  { start: 'Thyme', end: 'Misophonia', difficulty: 'hard' },
  { start: 'Rosemary', end: 'Trypophobia', difficulty: 'hard' },
  { start: 'Sage', end: 'Pareidolia', difficulty: 'hard' },
  { start: 'Mint', end: 'Apophenia', difficulty: 'hard' },
  { start: 'Lavender', end: 'Deja vu', difficulty: 'hard' },
  { start: 'Chamomile', end: 'Jamais vu', difficulty: 'hard' },
  { start: 'Hibiscus', end: 'Presque vu', difficulty: 'hard' },
  { start: 'Jasmine', end: "L'esprit de l'escalier", difficulty: 'hard' },
  { start: 'Dandelion', end: 'Sonder', difficulty: 'hard' },
  { start: 'Sunflower', end: 'Weltschmerz', difficulty: 'hard' },
  { start: 'Tulip', end: 'Schadenfreude', difficulty: 'hard' },
  { start: 'Orchid', end: 'Wanderlust', difficulty: 'hard' },
  { start: 'Lily', end: 'Zeitgeist', difficulty: 'hard' },
  { start: 'Daisy', end: 'Kindergarten', difficulty: 'hard' },
  { start: 'Iris (plant)', end: 'Doppelganger', difficulty: 'hard' },
  { start: 'Peony', end: 'Angst', difficulty: 'hard' },
  { start: 'Magnolia', end: 'Kitsch', difficulty: 'hard' },
  { start: 'Chrysanthemum', end: 'Poltergeist', difficulty: 'hard' },
  { start: 'Carnation', end: 'Wanderlust', difficulty: 'hard' },
]

/** Parse "YYYY-MM-DD" as UTC midnight. */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Format Date as "YYYY-MM-DD" in UTC. */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Today's date as "YYYY-MM-DD" in the user's local timezone. */
export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get the daily challenge for a given date string.
 * Challenge number is days since launch. Index wraps over 365.
 */
export function getDailyChallenge(date?: string): DailyChallenge {
  const dateStr = date ?? todayLocal()
  const target = parseDate(dateStr)
  const launch = parseDate(LAUNCH_DATE)
  const diffMs = target.getTime() - launch.getTime()
  const challengeNumber = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1
  const index = ((challengeNumber - 1) % CHALLENGES.length + CHALLENGES.length) % CHALLENGES.length
  const pair = CHALLENGES[index]
  return {
    date: dateStr,
    start: pair.start,
    end: pair.end,
    challengeNumber,
    difficulty: pair.difficulty,
  }
}

// ---- localStorage persistence ----

const RESULTS_KEY = 'daily-results'
const STATS_KEY = 'daily-stats'

export function getSavedResults(): Record<string, DailyResult> {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function getSavedResult(date: string): DailyResult | null {
  return getSavedResults()[date] ?? null
}

export function saveDailyResult(result: DailyResult): void {
  const all = getSavedResults()
  all[result.date] = result
  localStorage.setItem(RESULTS_KEY, JSON.stringify(all))
  recalcStats()
}

export function getDailyStats(): DailyStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through */ }
  return { gamesPlayed: 0, currentStreak: 0, maxStreak: 0, totalHops: 0, totalTime: 0, hopDistribution: {} }
}

function recalcStats(): void {
  const results = getSavedResults()
  const completed = Object.values(results).filter((r) => r.completed)
  const gamesPlayed = completed.length
  let totalHops = 0
  let totalTime = 0
  const hopDistribution: Record<number, number> = {}

  for (const r of completed) {
    totalHops += r.hops
    totalTime += r.timeSeconds
    hopDistribution[r.hops] = (hopDistribution[r.hops] || 0) + 1
  }

  // Streak: count consecutive days ending today (or most recent completed)
  const dates = completed.map((r) => r.date).sort()
  let currentStreak = 0
  let maxStreak = 0

  if (dates.length > 0) {
    // Walk backwards from today
    const today = todayLocal()
    let check = today
    let streak = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (results[check]?.completed) {
        streak++
        // Previous day
        const d = parseDate(check)
        d.setUTCDate(d.getUTCDate() - 1)
        check = formatDate(d)
      } else {
        break
      }
    }
    currentStreak = streak

    // Max streak across all time
    let s = 1
    maxStreak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = parseDate(dates[i - 1])
      const curr = parseDate(dates[i])
      const diff = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000)
      if (diff === 1) {
        s++
        if (s > maxStreak) maxStreak = s
      } else {
        s = 1
      }
    }
    if (gamesPlayed === 0) maxStreak = 0
  }

  const stats: DailyStats = { gamesPlayed, currentStreak, maxStreak, totalHops, totalTime, hopDistribution }
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
}

/**
 * Build a shareable text block for a completed challenge.
 */
export function buildShareText(result: DailyResult, challenge: DailyChallenge): string {
  const squares = Array(result.hops).fill('\u{1f7e9}').join('')
  const time = result.timeSeconds < 60
    ? `${result.timeSeconds.toFixed(0)}s`
    : `${Math.floor(result.timeSeconds / 60)}m${Math.floor(result.timeSeconds % 60)}s`
  return [
    `Wikipedia Game #${challenge.challengeNumber}`,
    `${challenge.start} \u2192 ${challenge.end}`,
    `${result.hops} hops in ${time}`,
    squares,
    'jhomer192.github.io/wikipedia-game-solver',
  ].join('\n')
}
