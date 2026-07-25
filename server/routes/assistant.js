// @ts-check
/**
 * Knowledge assistant route.
 * POST /api/assistant/ask — accepts a question, returns a cited answer.
 * All routes require internal-staff access (enforced by middleware).
 * Part of Phase 8 — Internal knowledge assistant.
 *
 * Security (8.4, 8.5):
 * - Auth enforced via populateAuth + requireAuth + requireStaff middleware
 * - Tool calls logged with truncated user ID only (no tokens, no PII)
 * - Question content is NOT logged (could contain sensitive context)
 */

import { Router } from "express";
import { askAssistant } from "../services/assistant.js";
import { reportServerError } from "../middleware/error-handler.js";

const router = Router();

/** Simple in-memory conversation store (per-user, last 5 conversations). */
const conversationStore = new Map();

/** Max conversation turns to keep in memory. */
const MAX_HISTORY = 20;

/**
 * POST /api/assistant/ask
 * Body: { question: string, thread_id?: string }
 * Returns: { answer: string, sources: string[], thread_id: string }
 */
router.post("/ask", async (req, res) => {
  try {
    const { question, thread_id } = req.body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ error: "question is required." });
    }

    if (question.length > 2000) {
      return res.status(400).json({ error: "Question too long (max 2000 chars)." });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    // Retrieve or create conversation thread
    const threadKey = thread_id || crypto.randomUUID();
    const userConversations = conversationStore.get(userId) || new Map();
    const history = userConversations.get(threadKey) || [];

    // Log safely (8.5): only the action + truncated user ID, never the question content
    console.log(`[assistant] Ask request (user: ${userId.slice(0, 8)}..., thread: ${threadKey.slice(0, 8)}..., history: ${history.length} msgs)`);

    const result = await askAssistant({
      question: question.trim(),
      history,
      userId,
    });

    // Update conversation history
    history.push(
      { role: "user", content: question.trim() },
      { role: "assistant", content: result.answer },
    );

    // Trim history to prevent unbounded growth
    while (history.length > MAX_HISTORY) {
      history.shift();
    }

    userConversations.set(threadKey, history);
    conversationStore.set(userId, userConversations);

    // Prune old threads (keep max 5 per user)
    if (userConversations.size > 5) {
      const keys = [...userConversations.keys()];
      for (let i = 0; i < keys.length - 5; i++) {
        userConversations.delete(keys[i]);
      }
    }

    res.json({
      answer: result.answer,
      sources: result.sources,
      tools_used: result.toolCalls,
      thread_id: threadKey,
    });
  } catch (error) {
    // Log error safely — do not log the question content
    reportServerError(error, { route: { path: "/api/assistant/ask", method: "POST" } });
    res.status(500).json({ error: "Assistant encountered an error. Please try again." });
  }
});

/**
 * DELETE /api/assistant/threads/:threadId — clear a conversation thread.
 */
router.delete("/threads/:threadId", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized." });

  const userConversations = conversationStore.get(userId);
  if (userConversations) {
    userConversations.delete(req.params.threadId);
  }

  res.json({ deleted: true });
});

export default router;
