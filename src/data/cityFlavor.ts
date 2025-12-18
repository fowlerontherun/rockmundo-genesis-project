// City-specific flavor data for immersive location experience

export interface CityFlavor {
  landmarks: string[];
  cuisine: string[];
  funFacts: string[];
  musicVenues: string[];
  localSlang?: string;
}

export const cityFlavor: Record<string, CityFlavor> = {
  // United Kingdom
  "London": {
    landmarks: ["Big Ben", "Tower Bridge", "Buckingham Palace", "The Shard"],
    cuisine: ["Fish & Chips", "Sunday Roast", "Full English Breakfast", "Pie & Mash"],
    funFacts: ["The Tube is the world's oldest underground railway", "Over 300 languages spoken", "Ravens at the Tower protect the kingdom"],
    musicVenues: ["The O2", "Royal Albert Hall", "Brixton Academy", "Camden venues"]
  },
  "Manchester": {
    landmarks: ["Old Trafford", "Manchester Town Hall", "The Lowry", "Beetham Tower"],
    cuisine: ["Manchester Tart", "Eccles Cake", "Meat & Potato Pie", "Bury Black Pudding"],
    funFacts: ["Birthplace of the Industrial Revolution", "The first computer was built here", "Madchester music scene changed Britain"],
    musicVenues: ["Manchester Arena", "Albert Hall", "Gorilla", "Band on the Wall"]
  },
  "Liverpool": {
    landmarks: ["Royal Liver Building", "Anfield", "The Cavern Club", "Albert Dock"],
    cuisine: ["Scouse", "Liverpool Tart", "Wet Nelly", "Lobscouse"],
    funFacts: ["The Beatles started here", "More museums than any UK city outside London", "First city to have an overhead electric railway"],
    musicVenues: ["The Cavern Club", "Liverpool Philharmonic", "O2 Academy", "Arts Club"]
  },
  "Birmingham": {
    landmarks: ["Bullring", "Cadbury World", "Birmingham Library", "Selfridges Building"],
    cuisine: ["Balti", "Faggots & Peas", "Birmingham Bread", "Orange Chips"],
    funFacts: ["More canals than Venice", "Invented the steam engine", "JRR Tolkien grew up here"],
    musicVenues: ["O2 Academy", "Symphony Hall", "Hare & Hounds", "The Rainbow"]
  },
  "Glasgow": {
    landmarks: ["Glasgow Cathedral", "George Square", "Riverside Museum", "Kelvingrove"],
    cuisine: ["Deep Fried Mars Bar", "Haggis", "Irn-Bru", "Glasgow Roll"],
    funFacts: ["UNESCO City of Music", "Second largest city in UK", "More parks per capita than any European city"],
    musicVenues: ["Barrowland Ballroom", "King Tut's", "OVO Hydro", "SWG3"]
  },
  "Edinburgh": {
    landmarks: ["Edinburgh Castle", "Royal Mile", "Arthur's Seat", "Calton Hill"],
    cuisine: ["Haggis Neeps & Tatties", "Cullen Skink", "Shortbread", "Edinburgh Rock"],
    funFacts: ["Host of world's largest arts festival", "First city to have its own fire brigade", "Birthplace of Harry Potter ideas"],
    musicVenues: ["Usher Hall", "Corn Exchange", "Liquid Room", "Sneaky Pete's"]
  },

  // United States
  "New York": {
    landmarks: ["Statue of Liberty", "Empire State Building", "Central Park", "Times Square"],
    cuisine: ["New York Pizza", "Bagels", "Cheesecake", "Hot Dogs"],
    funFacts: ["More than 800 languages spoken", "The birthplace of hip-hop", "Subway runs 24/7"],
    musicVenues: ["Madison Square Garden", "Radio City", "Brooklyn Steel", "Bowery Ballroom"]
  },
  "Los Angeles": {
    landmarks: ["Hollywood Sign", "Griffith Observatory", "Santa Monica Pier", "Walt Disney Concert Hall"],
    cuisine: ["Tacos", "In-N-Out Burger", "Avocado Toast", "Korean BBQ"],
    funFacts: ["Entertainment capital of the world", "More cars than people", "70+ miles of beaches"],
    musicVenues: ["The Forum", "Hollywood Bowl", "The Troubadour", "Greek Theatre"]
  },
  "Chicago": {
    landmarks: ["Willis Tower", "Cloud Gate (The Bean)", "Navy Pier", "Magnificent Mile"],
    cuisine: ["Deep Dish Pizza", "Chicago Hot Dog", "Italian Beef", "Garrett Popcorn"],
    funFacts: ["Reversed the flow of the Chicago River", "Birthplace of Chicago Blues", "Home of the first skyscraper"],
    musicVenues: ["United Center", "Metro", "Thalia Hall", "Kingston Mines"]
  },
  "Nashville": {
    landmarks: ["Grand Ole Opry", "Ryman Auditorium", "Broadway Honky Tonks", "Parthenon"],
    cuisine: ["Hot Chicken", "Meat & Three", "Biscuits & Gravy", "Goo Goo Clusters"],
    funFacts: ["Music City USA", "Record labels on every corner", "Country music was born here"],
    musicVenues: ["Grand Ole Opry", "Ryman Auditorium", "Bluebird Cafe", "3rd & Lindsley"]
  },
  "Austin": {
    landmarks: ["Texas State Capitol", "Lady Bird Lake", "South Congress", "Zilker Park"],
    cuisine: ["BBQ Brisket", "Breakfast Tacos", "Queso", "Tex-Mex"],
    funFacts: ["Live Music Capital of the World", "Home to SXSW", "Keep Austin Weird is the motto"],
    musicVenues: ["Moody Theater", "Stubb's", "Antone's", "Continental Club"]
  },
  "Miami": {
    landmarks: ["South Beach", "Art Deco District", "Vizcaya Museum", "Little Havana"],
    cuisine: ["Cuban Sandwich", "Stone Crab", "Ceviche", "Arroz con Pollo"],
    funFacts: ["Only US city founded by a woman", "Gateway to Latin America", "Art Basel draws global crowds"],
    musicVenues: ["LIV", "E11EVEN", "The Fillmore", "Ball & Chain"]
  },
  "Seattle": {
    landmarks: ["Space Needle", "Pike Place Market", "Mount Rainier View", "Museum of Pop Culture"],
    cuisine: ["Salmon", "Coffee", "Geoduck", "Teriyaki"],
    funFacts: ["Grunge music was born here", "Starbucks started here", "Rainiest reputation (but not rainiest city)"],
    musicVenues: ["The Showbox", "Neumos", "The Crocodile", "Paramount Theatre"]
  },
  "New Orleans": {
    landmarks: ["French Quarter", "Jackson Square", "Garden District", "St. Louis Cathedral"],
    cuisine: ["Gumbo", "Beignets", "Po'Boys", "Jambalaya"],
    funFacts: ["Birthplace of jazz", "Mardi Gras is legendary", "Above-ground cemeteries are cities of the dead"],
    musicVenues: ["Preservation Hall", "Tipitina's", "House of Blues", "The Spotted Cat"]
  },
  "Las Vegas": {
    landmarks: ["The Strip", "Bellagio Fountains", "Fremont Street", "High Roller"],
    cuisine: ["Buffets", "Prime Rib", "Shrimp Cocktail", "Everything 24/7"],
    funFacts: ["Entertainment capital", "Residencies make careers", "What happens here..."],
    musicVenues: ["MGM Grand", "T-Mobile Arena", "House of Blues", "Brooklyn Bowl"]
  },
  "Detroit": {
    landmarks: ["GM Renaissance Center", "The Fist", "Belle Isle", "Guardian Building"],
    cuisine: ["Coney Dogs", "Detroit Pizza", "Vernors", "Better Made Chips"],
    funFacts: ["Motown Records was founded here", "Techno was invented here", "Motor City legacy"],
    musicVenues: ["Fox Theatre", "Masonic Temple", "Saint Andrew's Hall", "El Club"]
  },

  // Spain
  "Barcelona": {
    landmarks: ["La Sagrada Familia", "Park Güell", "La Rambla", "Camp Nou"],
    cuisine: ["Paella", "Tapas", "Patatas Bravas", "Crema Catalana"],
    funFacts: ["Gaudí's masterpieces everywhere", "Still building Sagrada Familia since 1882", "La Rambla never sleeps"],
    musicVenues: ["Palau de la Música", "Razzmatazz", "Sala Apolo", "Jamboree"]
  },
  "Madrid": {
    landmarks: ["Royal Palace", "Plaza Mayor", "Prado Museum", "Puerta del Sol"],
    cuisine: ["Cocido Madrileño", "Bocadillo de Calamares", "Churros con Chocolate", "Tortilla Española"],
    funFacts: ["Highest capital in Europe", "Nightlife starts at midnight", "More bars than any EU city"],
    musicVenues: ["WiZink Center", "Sala Riviera", "Joy Eslava", "Moby Dick Club"]
  },
  "Seville": {
    landmarks: ["Alcázar", "Seville Cathedral", "Plaza de España", "Metropol Parasol"],
    cuisine: ["Gazpacho", "Salmorejo", "Jamón Ibérico", "Pescaíto Frito"],
    funFacts: ["Flamenco capital of the world", "Filmed Game of Thrones scenes", "Spring Fair is legendary"],
    musicVenues: ["Casa de la Memoria", "La Carbonería", "Fun Club", "Teatro Lope de Vega"]
  },

  // France
  "Paris": {
    landmarks: ["Eiffel Tower", "Louvre", "Notre-Dame", "Arc de Triomphe"],
    cuisine: ["Croissants", "Escargot", "Coq au Vin", "Crêpes"],
    funFacts: ["City of Light", "Most visited city in the world", "Underground catacombs hold millions"],
    musicVenues: ["Olympia", "Bataclan", "Zénith", "Le Trabendo"]
  },
  "Lyon": {
    landmarks: ["Basilica of Notre-Dame de Fourvière", "Old Town", "Place Bellecour", "Musée des Confluences"],
    cuisine: ["Quenelles", "Andouillette", "Cervelle de Canut", "Saucisson Brioché"],
    funFacts: ["Gastronomic capital of France", "Cinema was invented here", "Traboules are secret passages"],
    musicVenues: ["Le Transbordeur", "Ninkasi", "Le Périscope", "Rock n Eat"]
  },
  "Marseille": {
    landmarks: ["Vieux Port", "Notre-Dame de la Garde", "Calanques", "MuCEM"],
    cuisine: ["Bouillabaisse", "Panisse", "Navettes", "Pastis"],
    funFacts: ["Oldest city in France", "Birthplace of French hip-hop", "Mediterranean vibes"],
    musicVenues: ["Le Dôme", "L'Affranchi", "Espace Julien", "Le Molotov"]
  },

  // Germany
  "Berlin": {
    landmarks: ["Brandenburg Gate", "Berlin Wall", "Reichstag", "TV Tower"],
    cuisine: ["Currywurst", "Döner Kebab", "Berliner Pfannkuchen", "Eisbein"],
    funFacts: ["Techno capital of the world", "More bridges than Venice", "Clubs have no closing time"],
    musicVenues: ["Berghain", "Columbiahalle", "SO36", "Lido"]
  },
  "Munich": {
    landmarks: ["Marienplatz", "Neuschwanstein Castle", "BMW World", "English Garden"],
    cuisine: ["Weisswurst", "Pretzels", "Schweinshaxe", "Obatzda"],
    funFacts: ["Oktoberfest draws millions", "Beer gardens everywhere", "FC Bayern dominates"],
    musicVenues: ["Olympiahalle", "Muffathalle", "Backstage", "Theatron"]
  },
  "Hamburg": {
    landmarks: ["Elbphilharmonie", "Speicherstadt", "St. Pauli", "Miniatur Wunderland"],
    cuisine: ["Fischbrötchen", "Labskaus", "Franzbrötchen", "Aalsuppe"],
    funFacts: ["The Beatles played here before fame", "More bridges than Venice", "Red light district is famous"],
    musicVenues: ["Elbphilharmonie", "Reeperbahn venues", "Große Freiheit 36", "Mojo Club"]
  },

  // Italy
  "Rome": {
    landmarks: ["Colosseum", "Vatican", "Trevi Fountain", "Pantheon"],
    cuisine: ["Carbonara", "Cacio e Pepe", "Supplì", "Maritozzi"],
    funFacts: ["Eternal City with 3000 years of history", "Throw coins in Trevi", "Cats rule the ruins"],
    musicVenues: ["Auditorium Parco della Musica", "Monk", "Lanificio 159", "Atlantico"]
  },
  "Milan": {
    landmarks: ["Duomo", "La Scala", "Galleria Vittorio Emanuele II", "The Last Supper"],
    cuisine: ["Risotto alla Milanese", "Ossobuco", "Cotoletta", "Panettone"],
    funFacts: ["Fashion capital of Italy", "La Scala is opera's heart", "Aperitivo culture is sacred"],
    musicVenues: ["La Scala", "Forum", "Alcatraz", "Fabrique"]
  },

  // Netherlands
  "Amsterdam": {
    landmarks: ["Anne Frank House", "Rijksmuseum", "Canals", "Van Gogh Museum"],
    cuisine: ["Stroopwafel", "Bitterballen", "Herring", "Poffertjes"],
    funFacts: ["More bikes than people", "Liberal coffee shop culture", "Built on millions of wooden poles"],
    musicVenues: ["Ziggo Dome", "Paradiso", "Melkweg", "Concertgebouw"]
  },

  // Sweden
  "Stockholm": {
    landmarks: ["Gamla Stan", "Vasa Museum", "Royal Palace", "ABBA Museum"],
    cuisine: ["Meatballs", "Gravlax", "Kanelbullar", "Toast Skagen"],
    funFacts: ["Built on 14 islands", "Home of ABBA and Spotify", "Nobel Prizes awarded here"],
    musicVenues: ["Globen", "Berns", "Debaser", "Södra Teatern"]
  },

  // Norway
  "Oslo": {
    landmarks: ["Opera House", "Vigeland Park", "Akershus Fortress", "Viking Ship Museum"],
    cuisine: ["Brunost", "Fårikål", "Gravlaks", "Lefse"],
    funFacts: ["One of the most expensive cities", "Black metal capital", "Munch's Scream lives here"],
    musicVenues: ["Spektrum", "Rockefeller", "Blå", "Sentrum Scene"]
  },

  // Denmark
  "Copenhagen": {
    landmarks: ["Tivoli Gardens", "Little Mermaid", "Nyhavn", "Christiania"],
    cuisine: ["Smørrebrød", "Danish Pastry", "Frikadeller", "Flæskesteg"],
    funFacts: ["World's oldest amusement park", "Happiest city", "Freetown Christiania is unique"],
    musicVenues: ["Royal Arena", "VEGA", "Rust", "Pumpehuset"]
  },

  // Australia
  "Sydney": {
    landmarks: ["Opera House", "Harbour Bridge", "Bondi Beach", "The Rocks"],
    cuisine: ["Meat Pie", "Vegemite Toast", "Flat White", "Pavlova"],
    funFacts: ["Opera House took 16 years to build", "NYE fireworks are famous", "Most multicultural city"],
    musicVenues: ["Sydney Opera House", "Hordern Pavilion", "Enmore Theatre", "The Metro"]
  },
  "Melbourne": {
    landmarks: ["Federation Square", "MCG", "Laneways", "St Kilda Beach"],
    cuisine: ["Coffee Culture", "Souvlaki", "Dim Sims", "Parma"],
    funFacts: ["Coffee capital of Australia", "Street art is legendary", "Sports obsessed city"],
    musicVenues: ["Rod Laver Arena", "Forum Melbourne", "The Corner Hotel", "Northcote Social Club"]
  },

  // Japan
  "Tokyo": {
    landmarks: ["Tokyo Tower", "Shibuya Crossing", "Senso-ji Temple", "Imperial Palace"],
    cuisine: ["Sushi", "Ramen", "Tempura", "Wagyu Beef"],
    funFacts: ["Largest metropolitan area", "Trains are incredibly punctual", "Capsule hotels were invented here"],
    musicVenues: ["Tokyo Dome", "Budokan", "Shibuya WWW", "Unit"]
  },
  "Osaka": {
    landmarks: ["Osaka Castle", "Dotonbori", "Shinsekai", "Universal Studios Japan"],
    cuisine: ["Takoyaki", "Okonomiyaki", "Kushikatsu", "Kitsune Udon"],
    funFacts: ["Kitchen of Japan", "People here love comedy", "More outgoing than Tokyo"],
    musicVenues: ["Zepp Osaka", "Festival Hall", "Club Quattro", "BIG CAT"]
  },

  // South Korea
  "Seoul": {
    landmarks: ["Gyeongbokgung Palace", "N Seoul Tower", "Bukchon Hanok Village", "Dongdaemun"],
    cuisine: ["Korean BBQ", "Bibimbap", "Tteokbokki", "Fried Chicken"],
    funFacts: ["K-Pop capital of the world", "24/7 city that never sleeps", "PC Bang gaming culture"],
    musicVenues: ["Olympic Hall", "MUV Hall", "Rolling Hall", "Hongdae clubs"]
  },

  // Brazil
  "Rio de Janeiro": {
    landmarks: ["Christ the Redeemer", "Copacabana", "Sugarloaf Mountain", "Maracanã"],
    cuisine: ["Feijoada", "Pão de Queijo", "Brigadeiro", "Açaí"],
    funFacts: ["Carnival is the world's largest party", "Samba was born here", "Most dramatic skyline"],
    musicVenues: ["Circo Voador", "Lapa venues", "Rio Scenarium", "Vivo Rio"]
  },
  "São Paulo": {
    landmarks: ["Paulista Avenue", "Ibirapuera Park", "MASP", "Edifício Itália"],
    cuisine: ["Coxinha", "Mortadella Sandwich", "Pizza Paulistana", "Pastel"],
    funFacts: ["Largest city in South America", "More helicopters than anywhere", "24/7 nightlife"],
    musicVenues: ["Allianz Parque", "Via Funchal", "Audio Club", "D-Edge"]
  },

  // Argentina
  "Buenos Aires": {
    landmarks: ["La Boca", "Plaza de Mayo", "Teatro Colón", "Recoleta Cemetery"],
    cuisine: ["Asado", "Empanadas", "Dulce de Leche", "Alfajores"],
    funFacts: ["Birthplace of tango", "Most bookstores per capita", "Passionate about football"],
    musicVenues: ["Teatro Colón", "Luna Park", "La Trastienda", "Niceto Club"]
  },

  // Mexico
  "Mexico City": {
    landmarks: ["Zócalo", "Chapultepec Castle", "Palacio de Bellas Artes", "Teotihuacan nearby"],
    cuisine: ["Tacos al Pastor", "Mole", "Chilaquiles", "Churros"],
    funFacts: ["Built on a lake", "Sinking 10 inches per year", "More museums than any city"],
    musicVenues: ["Foro Sol", "Auditorio Nacional", "Salón Los Angeles", "El Plaza Condesa"]
  },

  // Canada
  "Toronto": {
    landmarks: ["CN Tower", "Royal Ontario Museum", "Distillery District", "Casa Loma"],
    cuisine: ["Peameal Bacon", "Poutine", "BeaverTails", "Butter Tarts"],
    funFacts: ["Most multicultural city", "Drake put it on the map", "Hollywood North"],
    musicVenues: ["Scotiabank Arena", "Massey Hall", "Danforth Music Hall", "Lee's Palace"]
  },
  "Montreal": {
    landmarks: ["Mount Royal", "Old Montreal", "Notre-Dame Basilica", "Olympic Stadium"],
    cuisine: ["Poutine", "Smoked Meat", "Bagels", "Sugar Pie"],
    funFacts: ["North America's party city", "Festival capital", "French-speaking vibe"],
    musicVenues: ["Bell Centre", "Métropolis", "SAT", "Casa del Popolo"]
  },
  "Vancouver": {
    landmarks: ["Stanley Park", "Granville Island", "Capilano Bridge", "Steam Clock"],
    cuisine: ["Salmon", "Japadog", "Sushi", "Nanaimo Bars"],
    funFacts: ["Hollywood North", "Most Asian city outside Asia", "Surrounded by nature"],
    musicVenues: ["Rogers Arena", "Commodore Ballroom", "Vogue Theatre", "Fortune Sound Club"]
  }
};

// Add more cities with generic fallback data
const defaultFlavor: CityFlavor = {
  landmarks: ["City Center", "Main Square", "Historic District", "Local Park"],
  cuisine: ["Local Specialties", "Street Food", "Traditional Dishes", "Regional Favorites"],
  funFacts: ["Rich local history", "Unique cultural heritage", "Vibrant local scene"],
  musicVenues: ["Main Arena", "Local Clubs", "Historic Theater", "Underground Venues"]
};

export const getCityFlavor = (cityName: string): CityFlavor => {
  return cityFlavor[cityName] || defaultFlavor;
};

export const getRandomFact = (cityName: string): string => {
  const flavor = getCityFlavor(cityName);
  return flavor.funFacts[Math.floor(Math.random() * flavor.funFacts.length)];
};

export const getRandomCuisine = (cityName: string): string => {
  const flavor = getCityFlavor(cityName);
  return flavor.cuisine[Math.floor(Math.random() * flavor.cuisine.length)];
};

export const getRandomLandmark = (cityName: string): string => {
  const flavor = getCityFlavor(cityName);
  return flavor.landmarks[Math.floor(Math.random() * flavor.landmarks.length)];
};
