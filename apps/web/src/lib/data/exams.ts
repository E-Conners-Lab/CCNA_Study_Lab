/**
 * Data Access Layer — Practice Exams
 *
 * Exams are always loaded from JSON files because the database schema
 * stores individual practice questions rather than grouped exams.
 * This module centralises the file-loading and grading logic that was
 * previously duplicated across three API route files.
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExamQuestion {
  id: string;
  objectiveCode: string;
  type:
    | "multiple_choice"
    | "multiple_select"
    | "fill_in_the_blank"
    | "drag_drop";
  question: string;
  options: string[];
  correctAnswer: string | string[] | Record<string, string>;
  explanation: string;
  sourceUrl: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export interface ExamFile {
  examId: string;
  title: string;
  description: string;
  totalQuestions: number;
  timeLimit: number;
  questions: ExamQuestion[];
}

export interface ExamSummary {
  examId: string;
  title: string;
  description: string;
  totalQuestions: number;
  timeLimit: number;
}

export interface QuestionResult {
  questionId: string;
  text: string;
  correct: boolean;
  userAnswer: string | string[] | Record<string, string> | null;
  correctAnswer: string | string[] | Record<string, string>;
  explanation: string;
}

export interface DomainScore {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface GradeResult {
  score: number;
  totalQuestions: number;
  totalCorrect: number;
  passed: boolean;
  timeTaken: number;
  questionResults: QuestionResult[];
  domainBreakdown: DomainScore[];
}

// ---------------------------------------------------------------------------
// Domain mappings
// ---------------------------------------------------------------------------

const DOMAIN_PREFIX_MAP: Record<string, string> = {
  "network-fundamentals": "1.",
  "network-access": "2.",
  "ip-connectivity": "3.",
  "ip-services": "4.",
  "security-fundamentals": "5.",
  "automation-programmability": "6.",
};

const DOMAIN_LABELS: Record<string, string> = {
  "1": "Network Fundamentals",
  "2": "Network Access",
  "3": "IP Connectivity",
  "4": "IP Services",
  "5": "Security Fundamentals",
  "6": "Automation and Programmability",
};

// ---------------------------------------------------------------------------
// File loading helpers
// ---------------------------------------------------------------------------

function getExamsDir(): string {
  return path.join(process.cwd(), "..", "..", "content", "practice-exams");
}

function loadExamFile(examId: string): ExamFile | null {
  const dir = getExamsDir();
  const filePath = path.join(dir, `${examId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ExamFile;
}

function loadAllExamFiles(): ExamFile[] {
  const dir = getExamsDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map(
      (f) =>
        JSON.parse(
          fs.readFileSync(path.join(dir, f), "utf-8"),
        ) as ExamFile,
    );
}

/**
 * Special ID used by domain quizzes. When this is the examId, questions
 * are combined from ALL exam files to give 12-15 per domain.
 */
const DOMAIN_QUIZ_ID = "domain-quiz";

/**
 * Loads and merges questions from every exam file into a single virtual
 * exam. Used for domain quizzes so each domain has a full 12-15 question pool.
 */
function loadCombinedExam(): ExamFile {
  const allExams = loadAllExamFiles();
  const combined: ExamQuestion[] = [];
  const seenIds = new Set<string>();

  for (const exam of allExams) {
    for (const q of exam.questions) {
      if (!seenIds.has(q.id)) {
        seenIds.add(q.id);
        combined.push(q);
      }
    }
  }

  return {
    examId: DOMAIN_QUIZ_ID,
    title: "Domain Quiz",
    description: "Focused quiz combining questions from all practice exams for the selected domain.",
    totalQuestions: combined.length,
    timeLimit: 25, // 25 minutes for domain quizzes
    questions: combined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns summary metadata for every available exam.
 * If `domain` is specified, the question count reflects only that domain.
 */
export function listExams(domain?: string): ExamSummary[] {
  const allExams = loadAllExamFiles();

  return allExams.map((exam) => {
    let questionCount = exam.totalQuestions;
    if (domain) {
      const prefix = DOMAIN_PREFIX_MAP[domain];
      if (prefix) {
        questionCount = exam.questions.filter((q) =>
          q.objectiveCode.startsWith(prefix),
        ).length;
      }
    }
    return {
      examId: exam.examId,
      title: exam.title,
      description: exam.description,
      totalQuestions: questionCount,
      timeLimit: exam.timeLimit,
    };
  });
}

/**
 * Returns a single exam, optionally filtered by domain.
 * By default, correctAnswer and explanation are stripped (client-safe).
 */
export function getExam(
  examId: string,
  options?: { domain?: string; stripAnswers?: boolean },
) {
  const exam =
    examId === DOMAIN_QUIZ_ID ? loadCombinedExam() : loadExamFile(examId);
  if (!exam) return null;

  let questions = exam.questions;

  // Filter by domain
  let domainPrefix: string | undefined;
  if (options?.domain) {
    domainPrefix = DOMAIN_PREFIX_MAP[options.domain];
    if (domainPrefix) {
      questions = questions.filter((q) =>
        q.objectiveCode.startsWith(domainPrefix!),
      );
    }
  }

  // Use a domain-specific title for domain quizzes
  const title =
    examId === DOMAIN_QUIZ_ID && domainPrefix
      ? `${DOMAIN_LABELS[domainPrefix.replace(".", "")] ?? "Domain"} Quiz`
      : exam.title;

  // Strip answers (default: true) and rename fields for client consumption
  if (options?.stripAnswers !== false) {
    const sanitized = questions.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ correctAnswer, explanation, objectiveCode, question, ...rest }) => {
        const base = { ...rest, text: question, objective: objectiveCode };

        // For drag_drop matching questions, include shuffled descriptions
        // so the client can render the matching UI
        if (
          rest.type === "drag_drop" &&
          correctAnswer &&
          typeof correctAnswer === "object" &&
          !Array.isArray(correctAnswer)
        ) {
          const descriptions = Object.values(
            correctAnswer as Record<string, string>,
          );
          // Shuffle descriptions so they don't match options order
          const shuffled = [...descriptions].sort(() => Math.random() - 0.5);
          return { ...base, descriptions: shuffled };
        }

        return base;
      },
    );
    return {
      id: exam.examId,
      title,
      description: exam.description,
      totalQuestions: sanitized.length,
      timeLimit: exam.timeLimit,
      questions: sanitized,
    };
  }

  return {
    id: exam.examId,
    title,
    description: exam.description,
    totalQuestions: questions.length,
    timeLimit: exam.timeLimit,
    questions,
  };
}

/**
 * Grades user answers against the exam key.
 * If `domain` is specified, only questions matching that domain are graded.
 * Returns null if the exam doesn't exist.
 */
export function gradeExam(
  examId: string,
  answers: Record<string, string | string[] | Record<string, string>>,
  timeTaken: number,
  domain?: string,
): GradeResult | null {
  const exam =
    examId === DOMAIN_QUIZ_ID ? loadCombinedExam() : loadExamFile(examId);
  if (!exam) return null;

  // Filter to domain-specific questions when a domain filter is active
  let questionsToGrade = exam.questions;
  if (domain) {
    const prefix = DOMAIN_PREFIX_MAP[domain];
    if (prefix) {
      questionsToGrade = questionsToGrade.filter((q) =>
        q.objectiveCode.startsWith(prefix),
      );
    }
  }

  const questionResults: QuestionResult[] = [];
  let correctCount = 0;
  const domainTotals: Record<string, { correct: number; total: number }> = {};

  for (const question of questionsToGrade) {
    const userAnswer = answers[question.id] ?? null;
    const isCorrect = gradeQuestion(question, userAnswer);
    if (isCorrect) correctCount++;

    questionResults.push({
      questionId: question.id,
      text: question.question,
      correct: isCorrect,
      userAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    });

    const domainNum = question.objectiveCode.split(".")[0];
    if (!domainTotals[domainNum]) {
      domainTotals[domainNum] = { correct: 0, total: 0 };
    }
    domainTotals[domainNum].total++;
    if (isCorrect) domainTotals[domainNum].correct++;
  }

  const totalQuestions = questionsToGrade.length;
  const score =
    totalQuestions > 0
      ? Math.round((correctCount / totalQuestions) * 100)
      : 0;

  // Build per-domain scores as an array with human-readable labels
  const domainBreakdown: DomainScore[] = Object.entries(domainTotals).map(
    ([domainNum, data]) => ({
      domain: DOMAIN_LABELS[domainNum] ?? `Domain ${domainNum}`,
      correct: data.correct,
      total: data.total,
      percentage:
        data.total > 0
          ? Math.round((data.correct / data.total) * 100)
          : 0,
    }),
  );

  return {
    score,
    totalQuestions,
    totalCorrect: correctCount,
    passed: score >= 70,
    timeTaken,
    questionResults,
    domainBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Internal grading logic
// ---------------------------------------------------------------------------

function gradeQuestion(
  question: ExamQuestion,
  userAnswer: string | string[] | Record<string, string> | null,
): boolean {
  if (userAnswer === null) return false;

  switch (question.type) {
    case "multiple_choice":
      return (
        typeof userAnswer === "string" &&
        userAnswer.toUpperCase().trim() ===
          (question.correctAnswer as string).toUpperCase().trim()
      );

    case "multiple_select": {
      if (
        !Array.isArray(userAnswer) ||
        !Array.isArray(question.correctAnswer)
      ) {
        return false;
      }
      const sortedUser = [...userAnswer]
        .map((a) => a.toUpperCase().trim())
        .sort();
      const sortedCorrect = [...(question.correctAnswer as string[])]
        .map((a) => a.toUpperCase().trim())
        .sort();
      return (
        sortedUser.length === sortedCorrect.length &&
        sortedUser.every((val, idx) => val === sortedCorrect[idx])
      );
    }

    case "fill_in_the_blank":
      return (
        typeof userAnswer === "string" &&
        userAnswer.trim().toLowerCase() ===
          (question.correctAnswer as string).trim().toLowerCase()
      );

    case "drag_drop": {
      // Matching questions: correctAnswer is a dict {term: description}
      // userAnswer is also a dict {term: description} from the matching UI
      if (
        typeof question.correctAnswer === "object" &&
        !Array.isArray(question.correctAnswer) &&
        typeof userAnswer === "object" &&
        !Array.isArray(userAnswer)
      ) {
        const correct = question.correctAnswer as Record<string, string>;
        const user = userAnswer as Record<string, string>;
        return Object.keys(correct).every(
          (key) =>
            user[key]?.trim().toUpperCase() ===
            correct[key]?.trim().toUpperCase(),
        );
      }
      // Reorder questions: correctAnswer is an array
      if (
        !Array.isArray(userAnswer) ||
        !Array.isArray(question.correctAnswer)
      ) {
        return false;
      }
      const correct = question.correctAnswer as string[];
      return (
        userAnswer.length === correct.length &&
        userAnswer.every(
          (val, idx) =>
            val.toUpperCase().trim() === correct[idx].toUpperCase().trim(),
        )
      );
    }

    default:
      return false;
  }
}
