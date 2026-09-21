// TutorQuest AI Tutor — grades children's answers and returns encouraging feedback

export interface TutorMessage {
  role: 'tutor' | 'child'
  content: string
  timestamp: number
}

export interface GradeResult {
  correct: boolean
  feedback: string
  encouragement: string
}

// Simple local grading heuristic when no AI is available
function localGrade(childAnswer: string, correctAnswer: string, subject: string): GradeResult {
  const normalise = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, '').trim()

  const correct = normalise(childAnswer) === normalise(correctAnswer)

  const correctFeedback = [
    "Amazing work! You got it right!",
    "Wow, that's correct! You're so smart!",
    "Fantastic! You nailed it!",
    "Super! That's exactly right!",
    "Brilliant! You're a star learner!",
  ]

  const incorrectFeedback: Record<string, string[]> = {
    reading: [
      `Good try! The answer is "${correctAnswer}". Let's say it together!`,
      `Almost there! The right answer is "${correctAnswer}". You'll get it next time!`,
      `Don't worry! The answer is "${correctAnswer}". Reading takes practice!`,
    ],
    writing: [
      `Nice effort! The answer is "${correctAnswer}". Let's practice together!`,
      `Good thinking! The correct answer is "${correctAnswer}". Keep trying!`,
      `Great attempt! The answer is "${correctAnswer}". You're learning every day!`,
    ],
    arithmetic: [
      `Good try! The answer is ${correctAnswer}. Let's count again together!`,
      `Almost! The answer is ${correctAnswer}. Math takes practice — you've got this!`,
      `Nice work thinking about it! The answer is ${correctAnswer}. Let's try again!`,
    ],
  }

  const encouragements = [
    "You can do it!",
    "Keep going — you're doing great!",
    "Every mistake helps you learn!",
    "I believe in you!",
    "Practice makes perfect!",
  ]

  const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

  return {
    correct,
    feedback: correct
      ? rand(correctFeedback)
      : rand(incorrectFeedback[subject] ?? incorrectFeedback.reading),
    encouragement: rand(encouragements),
  }
}

export function gradeAnswer(
  childAnswer: string,
  correctAnswer: string,
  _questionPrompt: string,
  subject: string
): GradeResult {
  // Local grading for reliability and privacy
  // (A real LLM could be wired via import.meta.env.VITE_AI_KEY)
  return localGrade(childAnswer, correctAnswer, subject)
}

// Generate a tutor response for a chat session
export function askTutor(
  question: string,
  subject: string,
  _difficulty: string
): Promise<string> {
  const responses: Record<string, string[]> = {
    reading: [
      "Great question! In reading, we look at the letters and sounds very carefully. Try saying the word slowly!",
      "Let's sound it out together! Break the word into small pieces.",
      "Reading is like a treasure hunt — every letter gives you a clue!",
      "Try the alphabet trick: what sound does that letter make?",
    ],
    writing: [
      "When we write, we think about what we want to say, then put the words in order!",
      "Good question! Remember — every sentence starts with a capital letter.",
      "Let's build the sentence piece by piece. Who is doing something? What are they doing?",
      "Writing is telling a story with words. What do you want to say?",
    ],
    arithmetic: [
      "Let's use our fingers to count! Hold up your hands and we'll count together.",
      "Great thinking! In maths, we can draw dots to help us count.",
      "Numbers are like building blocks — let's stack them up!",
      "Try counting on from the bigger number — it's the secret trick!",
    ],
  }

  const defaultResponses = [
    "That's a wonderful question! Let me help you think it through.",
    "Hmm, good thinking! Let's figure it out step by step.",
    "You're asking great questions — that means you're learning!",
  ]

  const pool = responses[subject] ?? defaultResponses
  return Promise.resolve(pool[Math.floor(Math.random() * pool.length)])
}
