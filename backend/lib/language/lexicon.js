/**
 * Romanized-text language evidence: known artists and distinctive words.
 *
 * This layer exists because the overwhelming majority of regional results arrive
 * in Latin script with romanized titles ("Malare", "Pavizha Malli", "Rowdy
 * Baby"). Measured across the live Malayalam and Tamil shelves, *none* of the
 * 48 tracks carried native script, so script detection alone contributes almost
 * nothing and the language cards stay empty without this.
 *
 * Two kinds of evidence, deliberately separated because their reliability
 * differs by an order of magnitude:
 *
 *   ARTISTS — high precision. A composer credits a handful of films per year,
 *   almost always in one language, so "Gopi Sundar" is strong evidence for
 *   Malayalam and near-certain for a track he composed.
 *
 *   WORDS   — weak. Malayalam, Tamil and Telugu romanization overlap heavily
 *   ("vaa", "naal", "kadal", "thambi" all appear in more than one), and romanized
 *   song titles are usually borrowed film or English words that carry no
 *   language signal at all. Only markers that are genuinely distinctive are
 *   listed, and they are weighted low enough that they can corroborate but never
 *   decide. A romanized title with no artist match should end up `unknown`,
 *   which is the honest answer.
 *
 * Weights are expressed as "how much this layer is allowed to contribute" and
 * are combined by the scorer in `detect.js`.
 */

/**
 * Fold a name to a comparable key: lowercase, punctuation and separators gone.
 *
 * Credits arrive as `"S. P. Balasubrahmanyam, A. R. Rahman & Someone"` and must
 * match entries written without punctuation.
 */
export function foldName(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Split a credit string into individual artist names.
 *
 * Handles the comma / ampersand / "and" separated credits YouTube returns, and
 * the "MainArtist & Others" convention.
 */
export function splitArtists(value) {
  if (!value) return [];

  return String(value)
    .split(/\s*(?:,|;|&|\bx\b|\band\b|\bfeat\.?\b|\+)\s*/i)
    .map((part) => part.replace(/\s*\((?:feat\.|ft\.).*?\)\s*$/i, '').trim())
    .filter((part) => part.length > 1 && !/^others?$/i.test(part));
}

/**
 * Artists whose output is essentially single-language.
 *
 * Composers and primary singers dominate: a Malayalam composer will occasionally
 * score a Telugu or Tamil film, but the prior is strongly one language, and a
 * single counter-example is not a reason to distrust the rest of the catalogue.
 */
const PRIMARY_ARTISTS = {
  // --- Malayalam ---
  ml: [
    'jakes bejoy', 'gopi sundar', 'm jayachandran', 'bijibal', 'shaan rahman',
    'vidyasagar', 'deepak dev', 'rahul raj', 'prashant pillai', 'arjun kanungo',
    'kailas menon', 'hridrosh hariharan', 'govind vasantha', 'jassie gift',
    'vijay yesudas', 'sithara krishnakumar', 'neha nair', 'nithya mammen',
    'sachin warrier', 'm g sreekumar', 'suresh gopi', 'biju kumar',
    'sooraj santhosh', 'manoj prabha', 'nirmal john', 'raja sharma',
    'faris moideen', 'stevin stanley', 'anoop seasom', 'berny ignatius',
    'johnpaul george', 'vineeth sreenivasan', 'mohan sithara', 'sarath kumar',
    'kailas nair', 'sreehari k nair', 'midhun mukundan', 'k raghavan',
    'm b sreenivasan', 'raveendran', 'jerry amaldev', 's p venkatesh',
    'kishore kumar', 'salil chowdhury', 'biju s kumar', 'samson kottoor',
  ],
  // --- Tamil ---
  ta: [
    'anirudh ravichander', 'a r rahman', 'yuvan shankar raja', 'harris jayaraj',
    'd mani', 'santhosh narayanan', 'g v prakash', 'v s narasimhan',
    'vijay antony', 'hiphop tamizha', 'vivek', 'sai abhyankkar', 'sundar c nadh',
    'ajesh', 'vishal chandrashekhar', 'sam c s', 'dhibu ninan thomas',
    'nivas k prasanna', 'shanul huq', 'siva raghavan', 'shruti haasan',
    'ashwin suresh', 'karthik raja', 'ghibran', 'mohana sreeram', 'vidu shankar',
    'stebb ben', 'leon james', 'shweta mohan', 'unni menon', 'nivas k',
    'premgi amaren', 'venkat prabhu', 'sabesh', 'karthik siva',
    'm j radhakrishnan', 'sean roque', 'jerry john', 'sathya c',
    'ilaiyaraaja', 'm s viswanathan', 'salil chowdhury', 'rajesh ramanath',
    's abraham', 'balamuralikrishna', 'vishal chandrasekhar',
  ],
// --- Hindi ---
  // Grown substantially after discovery scope=`hi` was measured returning only
  // 4 usable tracks: 57 of 90 candidates classified as `unknown`, almost all of
  // them unambiguously Hindi by artist. The previous list had ~22 entries and
  // omitted most of the artists currently dominating Hindi charts.
  hi: [
    // Playback / film
    'pritam', 'amit trivedi', 'vishal dadlani', 'mithoon', 'sachin jigar',
    'ajay atul', 'badshah', 'tanishk bagchi', 'divya kumar', 'bappi lahiri',
    'abhijeet bhattacharya', 'himesh reshammiya', 'bobby sunder', 'vishal bhardwaj',
    'neeraj soni', 'jatin lalwani', 'vishal khurana',
    'vishal shekhar', 'vishal mishra', 'sanjeev duhar', 'dr zeus', 'harshdeep kaur',
    'mustafa zahid', 'achaary manan', 'amaal mallik', 'sachet tandon',
    'parampara thakur', 'ayushmann khurrana', 'varun grover',
    // Vocals
    'arijit singh', 'sonu nigam', 'atif aslam', 'pritam singh', 'palak muchhal',
    'sunidhi chauhan', 'neha kakkar', 'yasser desai',
    'anuv jain', 'darshan raval', 'asees kaur',
    'jyotica tangri', 'balbir benipal',
    'arman malik', 'tanishq bhattacharya', 'sanam reet',
    'vaibhav patel',
    // Emerging / regional crossover
    'yo yo honey singh', 'paradox', 'gajendra verma', 'faheem abdullah',
    'duha shah', 'carrie hope caldon', 'lijo george', 'hamsika iyer',
  ],
  // --- Kannada ---
  // Added after discovery scope=`kn` measured 59 of 90 candidates as `unknown`,
  // almost all of them Kannada by artist.
  kn: [
    'v harikrishna', 'b ajaneesh loknath', 'arjun janya', 'ravi basrur',
    'hamsalekha', 'v manohar', 'charan raj', 'poornachandra tejaswi',
    'ananya bhat', 'sangeetha ravindranath', 'judah sandhy', 'dheerendra doss',
    'prasanna', 'manju kannadiga', 'sachin achar', 'rajan nagendra',
    'v manju', 'nanda kishore', 'sridhar hltk', 'anoop seelin',
    'vasuki vaibhav', 'jaskaran singh', 'prithwi bhat', 'malavalli m mahadeva swamy',
    'pasha bhai', 'boddu dilip kumar', 'kalyan keys', 'sunaad gowtham',
    'madhupriya', 'nagavva chunchu',
    'lari mahesh',
  ],
  // --- Telugu ---
  // Added after discovery scope=`te` measured 52 of 90 candidates as `unknown`.
  // Note that Telugu and Tamil share nearly all their composers — Anirudh,
  // A.R. Rahman and G.V. Prakash all record in both — so a Telugu query returns
  // a large genuinely-Tamil set. Those are correctly classified `ta` and
  // excluded from a Telugu shelf; the entries here are Telugu-specific artists.
  te: [
    'm m keeravani', 'devi sri prasad', 's thaman', 'mani sharma', 'g k reddy',
    'b v s ravi', 'kalyan raman', 'radhan', 'dhruva saraswat',
    'sagar mahati', 'mm srivatsa', 'vijay bhaskar', 'goreti venkanna',
    's rajeswara rao', 'koti', 'raja michal', 'vijay prakash',
    's p balasubrahmanyam', 'k j yesudas', 'shreya ghoshal',
    'thaman s', 'srikrishna', 'bhaskara batla', 'shilpa rao',
    'bheems cecciroleo', 'chinmayi', 'vijai bulganin', 'anurag kulakarni',
    'swamy naresh', 'srinidhi nerella', 's b nayak',
    'suman badanakal', 'naveen polasa', 'abhishek s ravi', 'venkat malleli',
  ],
  // --- Bengali ---
  bn: [
    'anirudh banerjee', 'anirudh bandyopadhyay', 'jeet gannguli', 'nachiketa',
    'anupam roy', 'indraadip das gupta', 'debojyoti mishra', 'santosh das',
    'koushik saha', 'diptakesh das', 'arijit seth', 'srikanta acharya',
  ],
};

/**
 * Artists who work across several languages.
 *
 * Present in every regional catalogue, so matching one must move the needle much
 * less than matching a single-language composer. They are kept separate from
 * `PRIMARY_ARTISTS` precisely so their weight can be a fraction of it — a
 * Shreya Ghoshal credit is evidence of a Hindi *or* Tamil *or* Malayalam song,
 * which is very weak evidence for any one of them.
 */
const CROSS_LANGUAGE_ARTISTS = {
  shared: [
    'shreya ghoshal', 'k s chithra', 's p balasubrahmanyam', 'k j yesudas',
    'armaan malik', 'sunidhi chauhan', 'neha kakkar', 'shankar mahadevan',
    'shaan', 'alka yagnik', 'kavita krishnamurti', 'hariharan', 'anoop rubens',
    'salim merchant', 'richard',
  ],
  hi: ['arijit singh', 'sonu nigam', 'atif aslam', 'pritam singh', 'palak muchhal'],
  ta: ['vijay yesudas', 'sithara krishnakumar', 'dhanush', 'silambarasan tr', 'vivek',
       'a r rahman', 'kailas menon', 'shruti haasan'],
  ml: ['vijay yesudas', 'neha nair', 'kailas menon'],
  te: ['vijay yesudas', 'k s chithra', 's p balasubrahmanyam', 'shruti haasan'],
};

/**
 * Distinctive romanized markers.
 *
 * Only words that are strongly bound to one language. Words shared with another
 * language are deliberately absent: "vaa", "naal", "kadal", "thambi", "chilla"
 * and "patti" all occur in more than one, and including them would systematically
 * cross-contaminate the languages this layer is supposed to separate.
 */
const ROMANIZED_WORDS = {
  ml: [
    'malare', 'malarin', 'kadale', 'pularikk', 'thanmatha', 'theeram',
    'theerame', 'sindooram', 'poonthennal', 'rathri', 'churam', 'kaavu',
    'mookuthi', 'pazham', 'vayyam', 'chettan', 'ayyanar', 'ganapathi',
    'orungi', 'ettan', 'aatti', 'aavare', 'njandukal', 'poyath', 'kettukettu',
    'varshangal', 'padmini', 'kannamarayathu',
  ],
  ta: [
    'chennai', 'madurai', 'coimbatore', 'tiruchirappalli', 'annam', 'sandhippu',
    'arasan', 'naattu', 'naadu', 'pudhu', 'vilai', 'sindhu', 'mayakkathile',
    'vaadi', 'kannukkullava', 'vathikuchi', 'sorgaam', 'ennakku', 'naasi',
    'kannumae', 'nellai', 'azhagiya', 'sillunu', 'thottiya', 'payana', 'uyirin',
  ],
  kn: [
    'bengaluru', 'banglore', 'mysore', 'mysuru', 'huttidare', 'belakina',
    'naanu', 'yavudare', 'chandan', 'rudra', 'naadu kannada',
  ],
  te: [
    'hyderabad', 'telangana', 'nakkana', 'manchi', 'kondapalli', 'sirsha',
    'raasa', 'gundelo', 'evvaru', 'kathalani', 'pellante',
  ],
  bn: [
    'kolkata', 'bangla', 'bangladesh', 'bengali', 'bongiya', 'dhaka',
    'tomake', 'amake', 'prithibi',
  ],
  hi: [
    'hindi', 'bharat', 'delhi', 'mumbai', 'humsafar', 'zindagi', 'pyar',
    'maine', 'tune', 'kaisa', 'bholi', 'sajna', 'chura',
  ],
};

/** Flattened lookup: folded name -> [{code, strong}] */
function buildArtistIndex() {
  const index = new Map();

  const add = (name, code, strong) => {
    const key = foldName(name);
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ code, strong });
  };

  for (const [code, names] of Object.entries(PRIMARY_ARTISTS)) {
    for (const name of names) add(name, code, true);
  }

  for (const [code, names] of Object.entries(CROSS_LANGUAGE_ARTISTS)) {
    for (const name of names) {
      if (code === 'shared') {
        for (const known of ['ml', 'ta', 'hi', 'kn', 'te', 'bn']) add(name, known, false);
      } else {
        add(name, code, false);
      }
    }
  }

  return index;
}

const ARTIST_INDEX = buildArtistIndex();

/**
 * Shortest key allowed to match as a prefix.
 *
 * "G. V. Prakash Kumar" must find "g v prakash", and "A. R. Rahman & Someone"
 * must not. Two characters is far too permissive — short keys collide with
 * unrelated names constantly — so the floor is set where prefix matching starts
 * being meaningful for real artist names.
 */
const MIN_PREFIX_KEY = 5;

/**
 * Longest lexicon key that plausibly refers to this credit, or null.
 *
 * Exact match first, then token-prefix: a credit matches a key when the key is a
 * run of whole words at the start of the credit ("g v prakash" in
 * "g v prakash kumar"), or the credit is a run of whole words at the start of the
 * key. Whole-word anchoring is what keeps "vivek" from matching "vivek ramesh"
 * while still rejecting "vivid".
 */
function bestKeyFor(folded) {
  if (ARTIST_INDEX.has(folded)) return folded;

  let best = null;

  for (const key of ARTIST_INDEX.keys()) {
    if (key.length < MIN_PREFIX_KEY) continue;

    const isPrefixOfCredit = folded.startsWith(`${key} `);
    const isSuffixedByCredit = key.startsWith(`${folded} `) && folded.length >= MIN_PREFIX_KEY;
    if (!isPrefixOfCredit && !isSuffixedByCredit) continue;

    // Longest wins, so "g v prakash kumar" beats "g v prakash".
    if (!best || key.length > best.length) best = key;
  }

  return best;
}

/**
 * Look up every credited artist.
 *
 * @returns {Array<{code: string, name: string, strong: boolean}>}
 *   One entry per (artist, language) pair, so a cross-language artist
 *   legitimately yields several weak votes rather than being forced into one.
 */
export function lookupArtists(artistCredit) {
  const out = [];

  for (const name of splitArtists(artistCredit)) {
    const key = bestKeyFor(foldName(name));
    if (!key) continue;

    for (const entry of ARTIST_INDEX.get(key)) {
      out.push({ code: entry.code, name, strong: entry.strong });
    }
  }

  return out;
}

/**
 * Find distinctive romanized words in a title.
 *
 * @returns {Array<{code: string, word: string}>}
 */
export function lookupWords(value) {
  const text = ` ${String(value ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')} `;
  if (text.trim().length < 3) return [];

  const out = [];
  const seen = new Set();

  for (const [code, words] of Object.entries(ROMANIZED_WORDS)) {
    for (const word of words) {
      if (seen.has(word)) continue;
      if (text.includes(` ${word} `) || text.includes(` ${word}s `)) {
        out.push({ code, word });
        seen.add(word);
      }
    }
  }

  return out;
}

/** Exposed for tests and for the debug endpoint. */
export const LEXICON = { PRIMARY_ARTISTS, CROSS_LANGUAGE_ARTISTS, ROMANIZED_WORDS, ARTIST_INDEX };
