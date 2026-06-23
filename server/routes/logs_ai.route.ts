import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import nim from '@api/nim';

export const logsAiRouter = Router();

logsAiRouter.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // 1. Get configurations from settings
    const [[aiModelSetting]]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = ?", ['ai_llm_model'])
      .catch(() => [[{ key_value: 'meta/llama-3.3-70b-instruct' }]]);
    const llmModel = aiModelSetting?.key_value || 'meta/llama-3.3-70b-instruct';

    const [[nvKeySetting]]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = ?", ['nvidia_api_key'])
      .catch(() => [[{ key_value: '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' }]]);
    const nvidiaKey = nvKeySetting?.key_value || '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';

    // Get current date time for parser context
    const currentDateTimeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 2. Stage 1: Parse natural language into structured filters
    const parserPrompt = `
      You are an assistant that parses natural language questions from network administrators into structured SQL query filters for network logs.
      Current system time is: ${currentDateTimeStr}
      
      Analyze the user's question and determine the query filters.
      User Question: "${message}"
      
      Respond STRICTLY in JSON format with these exact keys:
      - startDate: string (format YYYY-MM-DD HH:mm:ss, default to last 7 days starting YYYY-MM-DD 00:00:00 if not specified)
      - endDate: string (format YYYY-MM-DD HH:mm:ss, default to today's end YYYY-MM-DD 23:59:59 if not specified)
      - search: string or null (search keyword/phrase to match log message, or null)
      - topics: string or null (topics to filter, or null. Example: "error", "warning", "system", "wireless")
      - deviceName: string or null (name of the router/device, or null)
      - isUnrelated: boolean (set to true ONLY if the question is completely unrelated to computer networking, WiFi, servers, IT administration, or this monitoring system)
    `;

    let filters: {
      startDate: string;
      endDate: string;
      search: string | null;
      topics: string | null;
      deviceName: string | null;
      isUnrelated: boolean;
    };

    try {
      nim.auth(nvidiaKey);
      const parserResponse = await nim.create_chat_completion_v1_chat_completions_post({
        model: llmModel,
        messages: [{ role: "user", content: parserPrompt }],
        temperature: 0.1, // Low temperature for consistent JSON extraction
        max_tokens: 1000,
        stream: false
      });

      const parserText = parserResponse.data.choices?.[0]?.message?.content || '{}';
      const cleanJsonText = parserText.replace(/^```json\n?/, '').replace(/```$/, '').trim();
      filters = JSON.parse(cleanJsonText);
    } catch (parserErr: any) {
      console.error("[Logs-AI] Parser Stage Error:", parserErr.message || parserErr);
      // Fallback default filters
      filters = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
        endDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
        search: null,
        topics: null,
        deviceName: null,
        isUnrelated: false
      };
    }

    // 3. Handle unrelated topics
    if (filters.isUnrelated) {
      return res.json({
        response: "Maaf, saya hanya diprogram untuk menjawab pertanyaan seputar jaringan komputer, router, Access Point, dan sistem monitoring Nexus ini. Silakan ajukan pertanyaan yang relevan dengan log sistem.",
        queryRun: null,
        logsFoundCount: 0
      });
    }

    // 4. Resolve Device ID if deviceName is specified
    let deviceId: number | null = null;
    if (filters.deviceName) {
      const [devices]: any = await db.query(
        "SELECT id FROM mikrotik_devices WHERE name LIKE ? LIMIT 1",
        [`%${filters.deviceName}%`]
      );
      if (devices.length > 0) {
        deviceId = devices[0].id;
      }
    }

    // 5. Query Logs from Database
    let logsQuery = `
      SELECT l.id, l.time, l.topics, l.message, l.created_at, d.name as device_name 
      FROM mikrotik_logs l 
      LEFT JOIN mikrotik_devices d ON l.device_id = d.id
      WHERE l.created_at BETWEEN ? AND ?
    `;
    const queryParams: any[] = [filters.startDate, filters.endDate];

    if (deviceId !== null) {
      logsQuery += " AND l.device_id = ?";
      queryParams.push(deviceId);
    }

    if (filters.search) {
      logsQuery += " AND l.message LIKE ?";
      queryParams.push(`%${filters.search}%`);
    }

    if (filters.topics) {
      logsQuery += " AND l.topics LIKE ?";
      queryParams.push(`%${filters.topics}%`);
    }

    // Limit to latest 100 records to prevent prompt token bloat
    logsQuery += " ORDER BY l.id DESC LIMIT 100";

    const [logsRows]: any = await db.query(logsQuery, queryParams);

    // 6. Stage 2: Analyze Logs with LLM
    const logsDataForPrompt = logsRows.map((r: any) => {
      const date = new Date(r.created_at || r.time);
      const localTimeStr = date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-').replace(',', '');
      return {
        time: localTimeStr,
        device: r.device_name || 'System',
        topics: r.topics,
        message: r.message
      };
    });

    const analystPrompt = `
      You are Nexus AI, an intelligent network log assistant.
      Your goal is to answer the network administrator's question by analyzing the retrieved log records from the database.
      
      User Question: "${message}"
      
      Query Filters Executed:
      - Rentang Waktu: ${filters.startDate} s/d ${filters.endDate}
      - Router: ${filters.deviceName || 'Semua Router'}
      - Topik: ${filters.topics || 'Semua Topik'}
      - Kata Kunci: ${filters.search || 'Tidak ada'}
      
      Log Data Found (${logsRows.length} logs):
      ${JSON.stringify(logsDataForPrompt, null, 2)}
      
      Guidelines:
      1. Explain the logs clearly in Indonesian.
      2. If logs are found: identify errors, explain the root cause, list affected devices, and provide concrete technical troubleshooting steps.
      3. If NO logs are found: state clearly that no logs matched the criteria. Provide general, helpful troubleshooting recommendations related to their question.
      4. Strictly keep your answer related to network administration, router configs (MikroTik), wireless networks, or this Nexus monitoring tool. Refuse politely if they try to steer the conversation elsewhere.
      5. Use professional network administrator tone. Format response in clean Markdown.
    `;

    let analystAnswer = '';
    try {
      const analystResponse = await nim.create_chat_completion_v1_chat_completions_post({
        model: llmModel,
        messages: [{ role: "user", content: analystPrompt }],
        temperature: 0.7,
        max_tokens: 4000,
        stream: false
      });
      analystAnswer = analystResponse.data.choices?.[0]?.message?.content || 'Gagal menghasilkan analisis log.';

      // Save success to AI logs
      await db.query(
        "INSERT INTO system_ai_logs (mode, model, status, prompt, response) VALUES (?, ?, ?, ?, ?)",
        ['llm-chat', llmModel, 'success', `Log Chat: ${message}`, analystAnswer]
      ).catch(() => {});

    } catch (analystErr: any) {
      console.error("[Logs-AI] Analyst Stage Error:", analystErr.message || analystErr);
      analystAnswer = "Maaf, sistem AI mengalami kendala saat menganalisis log. Silakan coba beberapa saat lagi.";
      
      // Save error to AI logs
      await db.query(
        "INSERT INTO system_ai_logs (mode, model, status, prompt, error_message) VALUES (?, ?, ?, ?, ?)",
        ['llm-chat', llmModel, 'error', `Log Chat: ${message}`, analystErr.message || String(analystErr)]
      ).catch(() => {});
    }

    res.json({
      response: analystAnswer,
      queryRun: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        deviceName: filters.deviceName,
        topics: filters.topics,
        search: filters.search
      },
      logsFoundCount: logsRows.length
    });

  } catch (err: any) {
    console.error("[Logs-AI Router Error]:", err);
    res.status(500).json({ error: "Terjadi kesalahan pada backend server AI." });
  }
});
