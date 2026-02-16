// Country data with flags, colors derived from national flags, and music facts

export interface CountryData {
  flag: string;
  name: string;
  primaryColor: string; // HSL format
  secondaryColor: string; // HSL format
  currency: string;
  musicFact: string;
}

export const countryData: Record<string, CountryData> = {
  "United Kingdom": {
    flag: "🇬🇧",
    name: "United Kingdom",
    primaryColor: "220 90% 40%", // Royal Blue
    secondaryColor: "0 80% 50%", // Red
    currency: "GBP",
    musicFact: "Birthplace of The Beatles, Rolling Stones, and modern rock music"
  },
  "United States": {
    flag: "🇺🇸",
    name: "United States",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 85% 50%", // Red
    currency: "USD",
    musicFact: "Home to jazz, blues, rock and roll, hip-hop, and country music"
  },
  "Spain": {
    flag: "🇪🇸",
    name: "Spain",
    primaryColor: "0 85% 50%", // Red
    secondaryColor: "45 100% 50%", // Yellow
    currency: "EUR",
    musicFact: "Famous for flamenco, classical guitar, and vibrant music festivals"
  },
  "France": {
    flag: "🇫🇷",
    name: "France",
    primaryColor: "220 90% 45%", // Blue
    secondaryColor: "0 80% 50%", // Red
    currency: "EUR",
    musicFact: "Rich tradition of chanson, electronic music, and iconic jazz scene"
  },
  "Germany": {
    flag: "🇩🇪",
    name: "Germany",
    primaryColor: "0 0% 15%", // Black
    secondaryColor: "45 100% 50%", // Gold
    currency: "EUR",
    musicFact: "Pioneer of electronic music, techno, and classical composers"
  },
  "Italy": {
    flag: "🇮🇹",
    name: "Italy",
    primaryColor: "145 65% 35%", // Green
    secondaryColor: "0 80% 50%", // Red
    currency: "EUR",
    musicFact: "Birthplace of opera and home to legendary venues like La Scala"
  },
  "Netherlands": {
    flag: "🇳🇱",
    name: "Netherlands",
    primaryColor: "15 90% 55%", // Orange
    secondaryColor: "220 80% 45%", // Blue
    currency: "EUR",
    musicFact: "Global hub for EDM, trance, and massive dance festivals"
  },
  "Belgium": {
    flag: "🇧🇪",
    name: "Belgium",
    primaryColor: "0 0% 15%", // Black
    secondaryColor: "45 100% 50%", // Yellow
    currency: "EUR",
    musicFact: "Known for electronic music festivals like Tomorrowland"
  },
  "Portugal": {
    flag: "🇵🇹",
    name: "Portugal",
    primaryColor: "145 65% 35%", // Green
    secondaryColor: "0 80% 50%", // Red
    currency: "EUR",
    musicFact: "Home of Fado, the soulful Portuguese folk music tradition"
  },
  "Austria": {
    flag: "🇦🇹",
    name: "Austria",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 100%", // White
    currency: "EUR",
    musicFact: "The land of Mozart, Strauss, and classical music heritage"
  },
  "Switzerland": {
    flag: "🇨🇭",
    name: "Switzerland",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 100%", // White
    currency: "CHF",
    musicFact: "Home to world-class concert halls and electronic music scene"
  },
  "Sweden": {
    flag: "🇸🇪",
    name: "Sweden",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "50 100% 50%", // Yellow
    currency: "SEK",
    musicFact: "Pop music powerhouse - ABBA, Swedish House Mafia, Max Martin"
  },
  "Norway": {
    flag: "🇳🇴",
    name: "Norway",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "220 80% 45%", // Blue
    currency: "NOK",
    musicFact: "Famous for black metal and distinctive Nordic music scene"
  },
  "Denmark": {
    flag: "🇩🇰",
    name: "Denmark",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 100%", // White
    currency: "DKK",
    musicFact: "Vibrant jazz scene and host to Europe's largest music festival"
  },
  "Finland": {
    flag: "🇫🇮",
    name: "Finland",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 0% 100%", // White
    currency: "EUR",
    musicFact: "Metal music capital with more metal bands per capita than anywhere"
  },
  "Ireland": {
    flag: "🇮🇪",
    name: "Ireland",
    primaryColor: "145 65% 35%", // Green
    secondaryColor: "25 95% 55%", // Orange
    currency: "EUR",
    musicFact: "Rich folk tradition and home to U2, The Cranberries, and traditional Irish music"
  },
  "Poland": {
    flag: "🇵🇱",
    name: "Poland",
    primaryColor: "0 0% 100%", // White
    secondaryColor: "0 80% 50%", // Red
    currency: "PLN",
    musicFact: "Chopin's homeland with thriving electronic and metal scenes"
  },
  "Czech Republic": {
    flag: "🇨🇿",
    name: "Czech Republic",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 80% 50%", // Red
    currency: "CZK",
    musicFact: "Classical music heritage and vibrant underground music scene"
  },
  "Hungary": {
    flag: "🇭🇺",
    name: "Hungary",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "145 65% 35%", // Green
    currency: "HUF",
    musicFact: "Home to Sziget Festival and rich folk music traditions"
  },
  "Greece": {
    flag: "🇬🇷",
    name: "Greece",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 0% 100%", // White
    currency: "EUR",
    musicFact: "Birthplace of rebetiko and Mediterranean music culture"
  },
  "Turkey": {
    flag: "🇹🇷",
    name: "Turkey",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 100%", // White
    currency: "TRY",
    musicFact: "Fusion of Eastern and Western musical traditions"
  },
  "Russia": {
    flag: "🇷🇺",
    name: "Russia",
    primaryColor: "0 0% 100%", // White
    secondaryColor: "220 80% 45%", // Blue
    currency: "RUB",
    musicFact: "Classical music giants like Tchaikovsky and Rachmaninoff"
  },
  "Japan": {
    flag: "🇯🇵",
    name: "Japan",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 100%", // White
    currency: "JPY",
    musicFact: "J-Pop, visual kei, and unique music subcultures"
  },
  "South Korea": {
    flag: "🇰🇷",
    name: "South Korea",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 80% 50%", // Red
    currency: "KRW",
    musicFact: "Global K-Pop phenomenon and innovative music industry"
  },
  "China": {
    flag: "🇨🇳",
    name: "China",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "45 100% 50%", // Yellow
    currency: "CNY",
    musicFact: "Ancient musical traditions meet modern C-Pop and rock"
  },
  "India": {
    flag: "🇮🇳",
    name: "India",
    primaryColor: "25 95% 55%", // Saffron
    secondaryColor: "145 65% 35%", // Green
    currency: "INR",
    musicFact: "Bollywood music industry and classical ragas tradition"
  },
  "Australia": {
    flag: "🇦🇺",
    name: "Australia",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 80% 50%", // Red
    currency: "AUD",
    musicFact: "AC/DC, INXS, and thriving indie rock scene"
  },
  "New Zealand": {
    flag: "🇳🇿",
    name: "New Zealand",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 80% 50%", // Red
    currency: "NZD",
    musicFact: "Lorde, Split Enz, and unique Polynesian influences"
  },
  "Brazil": {
    flag: "🇧🇷",
    name: "Brazil",
    primaryColor: "145 65% 35%", // Green
    secondaryColor: "50 100% 50%", // Yellow
    currency: "BRL",
    musicFact: "Samba, bossa nova, and world's biggest carnival"
  },
  "Argentina": {
    flag: "🇦🇷",
    name: "Argentina",
    primaryColor: "200 70% 60%", // Light Blue
    secondaryColor: "0 0% 100%", // White
    currency: "ARS",
    musicFact: "Birthplace of tango and passionate rock nacional"
  },
  "Mexico": {
    flag: "🇲🇽",
    name: "Mexico",
    primaryColor: "145 65% 35%", // Green
    secondaryColor: "0 80% 50%", // Red
    currency: "MXN",
    musicFact: "Mariachi, regional Mexican, and vibrant rock en español"
  },
  "Canada": {
    flag: "🇨🇦",
    name: "Canada",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 100%", // White
    currency: "CAD",
    musicFact: "Céline Dion, Drake, The Weeknd - diverse music talent"
  },
  "South Africa": {
    flag: "🇿🇦",
    name: "South Africa",
    primaryColor: "145 65% 35%", // Green
    secondaryColor: "45 100% 50%", // Yellow
    currency: "ZAR",
    musicFact: "Township jive, kwaito, and diverse African sounds"
  },
  "Egypt": {
    flag: "🇪🇬",
    name: "Egypt",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 15%", // Black
    currency: "EGP",
    musicFact: "Arabic music heritage and legendary Om Kolthoum"
  },
  "Nigeria": {
    flag: "🇳🇬",
    name: "Nigeria",
    primaryColor: "145 65% 35%", // Green
    secondaryColor: "0 0% 100%", // White
    currency: "NGN",
    musicFact: "Afrobeats capital - Fela Kuti's legacy lives on"
  },
  "Thailand": {
    flag: "🇹🇭",
    name: "Thailand",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "220 80% 45%", // Blue
    currency: "THB",
    musicFact: "Unique Thai pop and traditional mor lam music"
  },
  "Singapore": {
    flag: "🇸🇬",
    name: "Singapore",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 100%", // White
    currency: "SGD",
    musicFact: "Rising EDM scene and multicultural music fusion"
  },
  "Malaysia": {
    flag: "🇲🇾",
    name: "Malaysia",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "45 100% 50%", // Yellow
    currency: "MYR",
    musicFact: "Diverse music from Malay pop to traditional gamelan"
  },
  "Indonesia": {
    flag: "🇮🇩",
    name: "Indonesia",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "0 0% 100%", // White
    currency: "IDR",
    musicFact: "Gamelan traditions and thriving indie music scene"
  },
  "Philippines": {
    flag: "🇵🇭",
    name: "Philippines",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 80% 50%", // Red
    currency: "PHP",
    musicFact: "OPM (Original Pilipino Music) and amazing vocal talent"
  },
  "Vietnam": {
    flag: "🇻🇳",
    name: "Vietnam",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "45 100% 50%", // Yellow
    currency: "VND",
    musicFact: "V-Pop emerging scene and traditional music heritage"
  },
  "UAE": {
    flag: "🇦🇪",
    name: "United Arab Emirates",
    primaryColor: "145 65% 35%", // Green
    secondaryColor: "0 80% 50%", // Red
    currency: "AED",
    musicFact: "Growing music industry hub and international festivals"
  },
  "Israel": {
    flag: "🇮🇱",
    name: "Israel",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 0% 100%", // White
    currency: "ILS",
    musicFact: "Diverse music from traditional to world-class trance"
  },
  "Croatia": {
    flag: "🇭🇷",
    name: "Croatia",
    primaryColor: "0 80% 50%", // Red
    secondaryColor: "220 80% 45%", // Blue
    currency: "EUR",
    musicFact: "Home to Ultra Europe and stunning coastal festivals"
  },
  "Iceland": {
    flag: "🇮🇸",
    name: "Iceland",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "0 80% 50%", // Red
    currency: "ISK",
    musicFact: "Björk, Sigur Rós, and ethereal atmospheric music"
  },
  "Romania": {
    flag: "🇷🇴",
    name: "Romania",
    primaryColor: "220 80% 45%", // Blue
    secondaryColor: "45 100% 50%", // Yellow
    currency: "RON",
    musicFact: "Manele pop and rising electronic music scene"
  }
};

export const getCountryData = (country: string): CountryData | null => {
  return countryData[country] || null;
};

// Alias map for country abbreviations used in the database
const countryAliases: Record<string, string> = {
  "USA": "United States",
  "UAE": "United Arab Emirates",
  "UK": "United Kingdom",
};

const resolveCountry = (country: string): string => {
  return countryAliases[country] || country;
};

export const getCountryFlag = (country: string): string => {
  return countryData[resolveCountry(country)]?.flag || "🏳️";
};

// ISO 3166-1 alpha-2 codes for flag-icons CSS library
const countryIsoCodes: Record<string, string> = {
  "United Kingdom": "gb", "United States": "us", "Spain": "es", "France": "fr",
  "Germany": "de", "Japan": "jp", "Brazil": "br", "Australia": "au",
  "Sweden": "se", "Jamaica": "jm", "South Korea": "kr", "Nigeria": "ng",
  "Italy": "it", "Canada": "ca", "Mexico": "mx", "Argentina": "ar",
  "India": "in", "South Africa": "za", "Cuba": "cu", "Ireland": "ie",
  "Netherlands": "nl", "Belgium": "be", "Austria": "at", "Norway": "no",
  "Denmark": "dk", "Finland": "fi", "Portugal": "pt", "Colombia": "co",
  "Chile": "cl", "Peru": "pe", "Thailand": "th", "Indonesia": "id",
  "Philippines": "ph", "Turkey": "tr", "Israel": "il", "Egypt": "eg",
  "Morocco": "ma", "Kenya": "ke", "Ghana": "gh", "Ethiopia": "et",
  "Tanzania": "tz", "Senegal": "sn", "Poland": "pl", "Czech Republic": "cz",
  "Hungary": "hu", "Greece": "gr", "Switzerland": "ch", "New Zealand": "nz",
  "China": "cn", "Taiwan": "tw", "Vietnam": "vn", "Malaysia": "my",
  "Singapore": "sg", "United Arab Emirates": "ae", "Saudi Arabia": "sa",
  "Russia": "ru", "Ukraine": "ua", "Serbia": "rs", "Croatia": "hr",
  "Iceland": "is", "Romania": "ro", "Puerto Rico": "pr",
};

export const getCountryIsoCode = (country: string): string | null => {
  const resolved = resolveCountry(country);
  return countryIsoCodes[resolved] || null;
};

export const getCountryColors = (country: string): { primary: string; secondary: string } => {
  const data = countryData[resolveCountry(country)];
  return {
    primary: data?.primaryColor || "220 80% 45%",
    secondary: data?.secondaryColor || "0 80% 50%"
  };
};
