// TutorQuest lesson content — static data for all subjects and difficulty tiers

export type Difficulty = 'starter' | 'explorer' | 'champion'

export interface ReadingQuestion {
  id: string
  type: 'letter' | 'word' | 'sentence'
  prompt: string
  options: string[]
  answer: string
  hint: string
  emoji: string
}

export interface WritingQuestion {
  id: string
  type: 'fill_blank' | 'word_order' | 'missing_letter'
  prompt: string
  sentence?: string
  words?: string[]
  answer: string
  hint: string
  emoji: string
}

export interface ArithmeticQuestion {
  id: string
  type: 'count' | 'add' | 'subtract' | 'compare'
  prompt: string
  visual?: string // emoji objects to count
  a: number
  b?: number
  answer: number
  hint: string
  emoji: string
}

// ─────────────────────────────────────────────────────────────────────────────
// READING LESSONS
// ─────────────────────────────────────────────────────────────────────────────

export const readingLessons: Record<Difficulty, ReadingQuestion[]> = {
  starter: [
    { id: 'r-s-1', type: 'letter', prompt: 'Which letter is this? 🔤 A', options: ['A', 'B', 'C', 'D'], answer: 'A', hint: 'It looks like a mountain!', emoji: '🍎' },
    { id: 'r-s-2', type: 'letter', prompt: 'Which letter makes the "buh" sound?', options: ['A', 'B', 'C', 'D'], answer: 'B', hint: 'It looks like a ball!', emoji: '🎈' },
    { id: 'r-s-3', type: 'letter', prompt: 'Find the letter C', options: ['E', 'C', 'G', 'O'], answer: 'C', hint: 'It looks like a moon crescent!', emoji: '🐱' },
    { id: 'r-s-4', type: 'word', prompt: 'Which picture matches the word: CAT', options: ['Dog', 'Cat', 'Bird', 'Fish'], answer: 'Cat', hint: 'It says meow!', emoji: '🐱' },
    { id: 'r-s-5', type: 'word', prompt: 'Which picture matches the word: SUN', options: ['Moon', 'Star', 'Sun', 'Cloud'], answer: 'Sun', hint: 'It gives us light during the day!', emoji: '☀️' },
    { id: 'r-s-6', type: 'letter', prompt: 'Which letter makes the "sss" sound?', options: ['S', 'T', 'Z', 'X'], answer: 'S', hint: 'Like a snake!', emoji: '🐍' },
    { id: 'r-s-7', type: 'word', prompt: 'Which word rhymes with HOP?', options: ['Hat', 'Top', 'Hip', 'Hop'], answer: 'Top', hint: 'They both end in "op"!', emoji: '🐸' },
    { id: 'r-s-8', type: 'letter', prompt: 'Find the vowel (a, e, i, o, u)', options: ['B', 'C', 'E', 'G'], answer: 'E', hint: 'Vowels are special letters!', emoji: '🥚' },
  ],
  explorer: [
    { id: 'r-e-1', type: 'word', prompt: 'What word do these letters spell? F-R-O-G', options: ['From', 'Frog', 'Fog', 'Grog'], answer: 'Frog', hint: 'It jumps and lives near ponds!', emoji: '🐸' },
    { id: 'r-e-2', type: 'sentence', prompt: 'Which word is missing? "The ___ is hot."', options: ['sun', 'run', 'fun', 'bun'], answer: 'sun', hint: 'It shines in the sky!', emoji: '☀️' },
    { id: 'r-e-3', type: 'word', prompt: 'Find the word that means the opposite of BIG', options: ['Huge', 'Small', 'Tall', 'Wide'], answer: 'Small', hint: 'Think about an ant!', emoji: '🐜' },
    { id: 'r-e-4', type: 'sentence', prompt: 'Which word is missing? "I ___ a book."', options: ['read', 'red', 'reed', 'rid'], answer: 'read', hint: 'You are doing this right now!', emoji: '📚' },
    { id: 'r-e-5', type: 'word', prompt: 'What is the FIRST sound in SHIP?', options: ['S', 'SH', 'H', 'P'], answer: 'SH', hint: 'It is a blend of two letters!', emoji: '🚢' },
    { id: 'r-e-6', type: 'word', prompt: 'Which word has a LONG "a" sound?', options: ['Cat', 'Cake', 'Can', 'Cap'], answer: 'Cake', hint: 'Say each word out loud!', emoji: '🎂' },
    { id: 'r-e-7', type: 'sentence', prompt: 'What does this sentence say? "The dog runs fast."', options: ['The dog is slow.', 'The dog runs fast.', 'A cat runs fast.', 'The dog sleeps.'], answer: 'The dog runs fast.', hint: 'Read carefully!', emoji: '🐕' },
    { id: 'r-e-8', type: 'word', prompt: 'How many syllables in BUTTER-FLY?', options: ['1', '2', '3', '4'], answer: '3', hint: 'Clap once for each syllable!', emoji: '🦋' },
  ],
  champion: [
    { id: 'r-c-1', type: 'sentence', prompt: 'What is the MAIN IDEA of: "Bees make honey. They live in hives. Bees are busy insects."', options: ['Bees are yellow.', 'Bees are busy insects that make honey.', 'Honey is sweet.', 'Insects fly.'], answer: 'Bees are busy insects that make honey.', hint: 'What is the whole paragraph about?', emoji: '🐝' },
    { id: 'r-c-2', type: 'word', prompt: 'Which word means HAPPY?', options: ['Sad', 'Joyful', 'Angry', 'Tired'], answer: 'Joyful', hint: 'A synonym for happy!', emoji: '😊' },
    { id: 'r-c-3', type: 'sentence', prompt: 'Choose the sentence with correct punctuation.', options: ['the cat sat.', 'The cat sat.', 'The cat sat', 'the Cat sat.'], answer: 'The cat sat.', hint: 'Sentences start with a capital and end with a period!', emoji: '✏️' },
    { id: 'r-c-4', type: 'word', prompt: 'What does the prefix UN- mean in UNHAPPY?', options: ['Very', 'Not', 'Always', 'A little'], answer: 'Not', hint: 'UN-happy means NOT happy!', emoji: '😔' },
    { id: 'r-c-5', type: 'sentence', prompt: '"She ran quickly." What kind of word is QUICKLY?', options: ['Noun', 'Verb', 'Adverb', 'Adjective'], answer: 'Adverb', hint: 'It describes HOW she ran!', emoji: '🏃' },
    { id: 'r-c-6', type: 'sentence', prompt: 'Which sentence uses "their" correctly?', options: ["Their going to the park.", "They're house is big.", "Their house is big.", "There house is big."], answer: 'Their house is big.', hint: '"Their" shows possession!', emoji: '🏡' },
    { id: 'r-c-7', type: 'word', prompt: 'What is the PLURAL of CHILD?', options: ['Childs', 'Childen', 'Children', 'Childrens'], answer: 'Children', hint: 'This is an irregular plural!', emoji: '👧' },
    { id: 'r-c-8', type: 'sentence', prompt: 'Read and answer: "Mia planted seeds. She watered them daily. Soon flowers bloomed." What did Mia do first?', options: ['Watered them', 'Saw flowers bloom', 'Planted seeds', 'Went to a garden'], answer: 'Planted seeds', hint: 'Look for the sequence of events!', emoji: '🌻' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITING LESSONS
// ─────────────────────────────────────────────────────────────────────────────

export const writingLessons: Record<Difficulty, WritingQuestion[]> = {
  starter: [
    { id: 'w-s-1', type: 'missing_letter', prompt: 'Complete the word: C_T (a furry pet)', answer: 'A', hint: 'CAT! The missing letter is A.', emoji: '🐱' },
    { id: 'w-s-2', type: 'missing_letter', prompt: 'Complete the word: _OG (a pet that barks)', answer: 'D', hint: 'DOG! The missing letter is D.', emoji: '🐶' },
    { id: 'w-s-3', type: 'missing_letter', prompt: 'Complete the word: H_T (the opposite of cold)', answer: 'O', hint: 'HOT! The missing letter is O.', emoji: '🌞' },
    { id: 'w-s-4', type: 'fill_blank', prompt: 'Fill in the blank: "The ___ is big." (an animal with a trunk)', sentence: 'The ___ is big.', answer: 'elephant', hint: 'It is grey and has a long nose!', emoji: '🐘' },
    { id: 'w-s-5', type: 'missing_letter', prompt: 'Complete the word: _UN (it shines in the sky)', answer: 'S', hint: 'SUN! The missing letter is S.', emoji: '☀️' },
    { id: 'w-s-6', type: 'fill_blank', prompt: 'Fill in the blank: "I see a ___." (a round fruit that is red)', sentence: 'I see a ___.', answer: 'apple', hint: 'An apple a day keeps the doctor away!', emoji: '🍎' },
    { id: 'w-s-7', type: 'missing_letter', prompt: 'Complete the word: B_LL (you play with it)', answer: 'A', hint: 'BALL! The missing letter is A.', emoji: '⚽' },
    { id: 'w-s-8', type: 'fill_blank', prompt: 'Fill in the blank: "The ___ can fly." (it has wings and feathers)', sentence: 'The ___ can fly.', answer: 'bird', hint: 'It chirps and builds nests!', emoji: '🐦' },
  ],
  explorer: [
    { id: 'w-e-1', type: 'word_order', prompt: 'Put the words in order: jumps / frog / The / high', words: ['jumps', 'frog', 'The', 'high'], answer: 'The frog jumps high', hint: 'Start with The, then who, then what they do!', emoji: '🐸' },
    { id: 'w-e-2', type: 'fill_blank', prompt: 'Fill in the blank: "She ___ to school every day." (present tense of walk)', sentence: 'She ___ to school every day.', answer: 'walks', hint: 'Add -s to walk for he/she/it!', emoji: '🚶' },
    { id: 'w-e-3', type: 'word_order', prompt: 'Put the words in order: plays / park / in / Ben / the', words: ['plays', 'park', 'in', 'Ben', 'the'], answer: 'Ben plays in the park', hint: 'Who does the action? Where?', emoji: '🏞️' },
    { id: 'w-e-4', type: 'fill_blank', prompt: 'Fill in the blank: "The sky is ___." (describe its colour)', sentence: 'The sky is ___.', answer: 'blue', hint: 'Look up on a clear day!', emoji: '🌤️' },
    { id: 'w-e-5', type: 'missing_letter', prompt: 'Complete the word: FR_END (someone you like a lot)', answer: 'I', hint: 'FRIEND! The missing letter is I.', emoji: '🤝' },
    { id: 'w-e-6', type: 'word_order', prompt: 'Put the words in order: likes / She / flowers / pretty', words: ['likes', 'She', 'flowers', 'pretty'], answer: 'She likes pretty flowers', hint: 'Adjectives usually come before the noun!', emoji: '🌸' },
    { id: 'w-e-7', type: 'fill_blank', prompt: 'Add a describing word: "The ___ cat sat on the mat."', sentence: 'The ___ cat sat on the mat.', answer: 'big', hint: 'Use an adjective — any size word works!', emoji: '🐱' },
    { id: 'w-e-8', type: 'fill_blank', prompt: 'Fill in the blank: "Yesterday I ___ to the store." (past tense of go)', sentence: 'Yesterday I ___ to the store.', answer: 'went', hint: 'The past tense of "go" is irregular!', emoji: '🛒' },
  ],
  champion: [
    { id: 'w-c-1', type: 'word_order', prompt: 'Make a question: the / Did / eat / cat / fish', words: ['the', 'Did', 'eat', 'cat', 'fish'], answer: 'Did the cat eat fish', hint: 'Questions start with a helping verb!', emoji: '🐟' },
    { id: 'w-c-2', type: 'fill_blank', prompt: 'Choose the correct word: "I have ___ apples." (more than one)', sentence: 'I have ___ apples.', answer: 'three', hint: 'Write a number word!', emoji: '🍎' },
    { id: 'w-c-3', type: 'word_order', prompt: 'Build a sentence: slowly / turtle / The / walked', words: ['slowly', 'turtle', 'The', 'walked'], answer: 'The turtle walked slowly', hint: 'Adverbs can come at the end!', emoji: '🐢' },
    { id: 'w-c-4', type: 'fill_blank', prompt: 'Complete with a conjunction: "I was tired ___ I could not sleep."', sentence: 'I was tired ___ I could not sleep.', answer: 'but', hint: 'Use a word that shows contrast!', emoji: '😴' },
    { id: 'w-c-5', type: 'fill_blank', prompt: 'Choose the correct verb tense: "She ___ (run) a race yesterday."', sentence: 'She ___ a race yesterday.', answer: 'ran', hint: 'Yesterday is in the past!', emoji: '🏃' },
    { id: 'w-c-6', type: 'word_order', prompt: 'Write a question: reading / library / Is / she / the / in', words: ['reading', 'library', 'Is', 'she', 'the', 'in'], answer: 'Is she reading in the library', hint: 'Yes/No questions start with Is/Are/Do!', emoji: '📚' },
    { id: 'w-c-7', type: 'fill_blank', prompt: 'Add the correct article: "___ elephant is very large."', sentence: '___ elephant is very large.', answer: 'An', hint: 'Use "An" before words starting with a vowel sound!', emoji: '🐘' },
    { id: 'w-c-8', type: 'fill_blank', prompt: 'Complete the sentence with a simile: "He is as fast as a ___."', sentence: 'He is as fast as a ___.', answer: 'cheetah', hint: 'What animal is famous for its speed?', emoji: '🐆' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// ARITHMETIC LESSONS
// ─────────────────────────────────────────────────────────────────────────────

export const arithmeticLessons: Record<Difficulty, ArithmeticQuestion[]> = {
  starter: [
    { id: 'a-s-1', type: 'count', prompt: 'Count the apples: 🍎🍎🍎', visual: '🍎🍎🍎', a: 3, answer: 3, hint: 'Point to each one and count!', emoji: '🍎' },
    { id: 'a-s-2', type: 'count', prompt: 'How many stars? ⭐⭐⭐⭐⭐', visual: '⭐⭐⭐⭐⭐', a: 5, answer: 5, hint: 'Count them one by one!', emoji: '⭐' },
    { id: 'a-s-3', type: 'add', prompt: '2 + 1 = ?', a: 2, b: 1, answer: 3, hint: 'Start at 2, then count 1 more!', emoji: '✌️' },
    { id: 'a-s-4', type: 'add', prompt: '1 + 1 = ?', a: 1, b: 1, answer: 2, hint: 'One cookie plus one more cookie!', emoji: '🍪' },
    { id: 'a-s-5', type: 'count', prompt: 'How many butterflies? 🦋🦋🦋🦋', visual: '🦋🦋🦋🦋', a: 4, answer: 4, hint: 'Count carefully!', emoji: '🦋' },
    { id: 'a-s-6', type: 'add', prompt: '3 + 2 = ?', a: 3, b: 2, answer: 5, hint: 'Start at 3, count 2 more fingers!', emoji: '🖐️' },
    { id: 'a-s-7', type: 'compare', prompt: 'Which is MORE? 4 or 2?', a: 4, b: 2, answer: 4, hint: 'Think about which group is bigger!', emoji: '🔢' },
    { id: 'a-s-8', type: 'subtract', prompt: '5 - 2 = ?', a: 5, b: 2, answer: 3, hint: 'Start at 5, take away 2!', emoji: '✋' },
  ],
  explorer: [
    { id: 'a-e-1', type: 'add', prompt: '7 + 5 = ?', a: 7, b: 5, answer: 12, hint: 'Count on from 7!', emoji: '🎯' },
    { id: 'a-e-2', type: 'subtract', prompt: '10 - 4 = ?', a: 10, b: 4, answer: 6, hint: 'Start at 10, count back 4 steps!', emoji: '🔟' },
    { id: 'a-e-3', type: 'add', prompt: 'Tom has 6 toy cars. He gets 4 more. How many now?', a: 6, b: 4, answer: 10, hint: 'Add them together!', emoji: '🚗' },
    { id: 'a-e-4', type: 'subtract', prompt: 'There are 9 cookies. 3 are eaten. How many left?', a: 9, b: 3, answer: 6, hint: 'Take away 3!', emoji: '🍪' },
    { id: 'a-e-5', type: 'add', prompt: '8 + 8 = ?', a: 8, b: 8, answer: 16, hint: 'Double 8!', emoji: '🎱' },
    { id: 'a-e-6', type: 'compare', prompt: 'Which number is BETWEEN 5 and 9?', a: 7, answer: 7, hint: 'Think: 6, 7, or 8!', emoji: '🔢' },
    { id: 'a-e-7', type: 'subtract', prompt: '15 - 7 = ?', a: 15, b: 7, answer: 8, hint: 'Count back from 15!', emoji: '⬇️' },
    { id: 'a-e-8', type: 'add', prompt: 'What number comes next? 2, 4, 6, ___', a: 6, b: 2, answer: 8, hint: 'Count by 2s!', emoji: '📈' },
  ],
  champion: [
    { id: 'a-c-1', type: 'add', prompt: '24 + 35 = ?', a: 24, b: 35, answer: 59, hint: 'Add tens first: 20+30=50, then ones: 4+5=9!', emoji: '🔢' },
    { id: 'a-c-2', type: 'subtract', prompt: '50 - 18 = ?', a: 50, b: 18, answer: 32, hint: 'Think of it as 50 - 20 + 2!', emoji: '➖' },
    { id: 'a-c-3', type: 'add', prompt: 'Sara has 13 stickers. Leo has 14 stickers. How many altogether?', a: 13, b: 14, answer: 27, hint: 'Add them together!', emoji: '⭐' },
    { id: 'a-c-4', type: 'subtract', prompt: 'There are 30 children. 12 go home. How many stay?', a: 30, b: 12, answer: 18, hint: '30 minus 12!', emoji: '👦' },
    { id: 'a-c-5', type: 'add', prompt: 'What is 9 × 3?', a: 9, b: 3, answer: 27, hint: 'Count by 9s three times: 9, 18, 27!', emoji: '✖️' },
    { id: 'a-c-6', type: 'add', prompt: 'A book costs $7. A pencil costs $2. Total?', a: 7, b: 2, answer: 9, hint: 'Add the two amounts!', emoji: '📝' },
    { id: 'a-c-7', type: 'subtract', prompt: 'Half of 20 is ___', a: 20, answer: 10, hint: 'Share 20 equally between 2!', emoji: '✂️' },
    { id: 'a-c-8', type: 'add', prompt: 'What is the missing number? 6 + ___ = 14', a: 14, b: 6, answer: 8, hint: '14 - 6 = ?', emoji: '❓' },
  ],
}

export const DIFFICULTY_LABELS: Record<Difficulty, { label: string; color: string; emoji: string }> = {
  starter: { label: 'Starter', color: 'bg-mint text-white', emoji: '🌱' },
  explorer: { label: 'Explorer', color: 'bg-sunshine text-white', emoji: '🔍' },
  champion: { label: 'Champion', color: 'bg-coral text-white', emoji: '🏆' },
}
