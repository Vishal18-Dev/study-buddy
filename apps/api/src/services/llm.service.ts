import { GoogleGenAI } from '@google/genai';
import { LLMPlan, LLMQuiz, CreatePlanBody } from '@studybuddy/shared';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function generateTextWithFallback(
  prompt: string,
  options?: { json?: boolean }
): Promise<string> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';

  // 1. Try Gemini
  if (geminiApiKey && geminiApiKey !== 'your-gemini-api-key-here') {
    const modelsToTry = [
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-pro-latest'
    ];
    for (const modelName of modelsToTry) {
      try {
        console.log(`⚡ [LLM] Attempting text generation with Gemini (${modelName})...`);
        const result = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
        const text = result.text;
        if (text) return text;
      } catch (err) {
        console.warn(`⚠️ [LLM] Gemini (${modelName}) generation failed:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  // 2. Try OpenAI (gpt-4o-mini)
  if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
    try {
      console.log('⚡ [LLM] Attempting text generation with OpenAI (gpt-4o-mini)...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: options?.json ? { type: 'json_object' } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
      }

      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (err) {
      console.warn('⚠️ [LLM] OpenAI generation failed:', err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error('All LLM providers failed or are unconfigured');
}

function extractJson(raw: string): string {
  // Strip markdown code blocks if present
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return match[1].trim();
  // Return raw trimmed (may already be pure JSON)
  return raw.trim();
}

// Generate local mock study plan
function generateLocalMockPlan(params: CreatePlanBody & { syllabusContext?: string }): LLMPlan {
  const days: any[] = [];
  const startDate = new Date();
  const endDate = new Date(params.examDate);
  const timeDiff = endDate.getTime() - startDate.getTime();
  const dayCount = Math.max(1, Math.min(60, Math.ceil(timeDiff / (1000 * 3600 * 24))));
  
  for (let i = 1; i <= dayCount; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i - 1);
    const isRevision = i > dayCount - 2;
    
    days.push({
      dayNumber: i,
      date: currentDate.toISOString().split('T')[0],
      topics: isRevision ? [
        { title: `${params.subject} Revision & Practice`, estimatedMins: Math.round(params.dailyHours * 60) }
      ] : [
        { title: `${params.subject} Chapter ${Math.ceil(i / 2)} Concepts`, estimatedMins: Math.round(params.dailyHours * 30) },
        { title: `${params.subject} Chapter ${Math.ceil(i / 2)} Exercises`, estimatedMins: Math.round(params.dailyHours * 30) }
      ]
    });
  }
  
  return {
    summary: `A personalized ${dayCount}-day plan to score ${params.goalScore}% in ${params.subject} studying ${params.dailyHours}h/day (Mock System).`,
    days
  };
}

export async function generateStudyPlan(
  params: CreatePlanBody & { syllabusContext?: string }
): Promise<LLMPlan> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';

  // If no API keys are provided at all, failover directly to mock
  if (
    (!geminiApiKey || geminiApiKey === 'your-gemini-api-key-here') &&
    (!openaiApiKey || openaiApiKey === 'your-openai-api-key-here')
  ) {
    return generateLocalMockPlan(params);
  }

  const prompt = `You are StudyBuddy, an expert study planner. You create realistic, day-by-day study plans.
You MUST respond with valid JSON only. No markdown, no explanation, no code blocks — just the raw JSON object.

Create a study plan with this EXACT structure:
{
  "summary": "one sentence plan overview",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "topics": [
        { "title": "Topic name", "estimatedMins": 45 }
      ]
    }
  ]
}

Student details:
- Subject: ${params.subject}
- Exam date: ${params.examDate}
- Daily availability: ${params.dailyHours} hours
- Current level: ${params.knowledgeLevel}
- Score goal: ${params.goalScore}%
- Syllabus context: ${params.syllabusContext || 'Not provided — use standard topics for this subject'}

Rules:
- Be realistic. Do not overload days.
- Front-load harder topics.
- Leave the final 2 days for revision only.
- Each topic should be 30–90 mins max.
- If no syllabus is provided, use standard topics for the subject.
- Calculate the number of days from today until the exam date and create exactly that many day entries.
- Respond with ONLY the JSON object. No other text.`;

  try {
    const raw = await generateTextWithFallback(prompt, { json: true });
    const jsonStr = extractJson(raw);
    return JSON.parse(jsonStr) as LLMPlan;
  } catch (err) {
    console.error('❌ [LLM] Study plan generation failed. Falling back to local mock plan.', err);
    return generateLocalMockPlan(params);
  }
}

export async function generateQuiz(
  topicTitle: string,
  subject: string,
  count: number = 7
): Promise<LLMQuiz> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';

  const getMockQuiz = () => ({
    questions: Array.from({ length: count }, (_, idx) => ({
      question: `Sample question ${idx + 1} about ${topicTitle} in ${subject}?`,
      options: ["Option A (Correct)", "Option B", "Option C", "Option D"],
      correctIndex: 0,
      explanation: "This is a mock explanation for testing."
    }))
  });

  if (
    (!geminiApiKey || geminiApiKey === 'your-gemini-api-key-here') &&
    (!openaiApiKey || openaiApiKey === 'your-openai-api-key-here')
  ) {
    return getMockQuiz();
  }

  const prompt = `You are an exam question generator. Respond with valid JSON only. No markdown, no code blocks.

Generate ${count} multiple choice questions for the topic: "${topicTitle}"
Subject context: ${subject}

Respond with this EXACT structure:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["A text", "B text", "C text", "D text"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}

Rules:
- Each question must have exactly 4 options.
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D).
- Questions should test genuine understanding, not trivia.
- Respond with ONLY the JSON object.`;

  try {
    const raw = await generateTextWithFallback(prompt, { json: true });
    const jsonStr = extractJson(raw);
    return JSON.parse(jsonStr) as LLMQuiz;
  } catch (err) {
    console.error('❌ [LLM] Quiz generation failed. Falling back to mock quiz.', err);
    return getMockQuiz();
  }
}

export async function generateCheckInMessage(params: {
  name: string;
  streak: number;
  daysLeft: number;
  completionFlag: string;
  topicsToday: number;
  contextNote?: string;
}): Promise<string> {
  const prompt = `You are StudyBuddy, a warm and non-judgmental study companion. Keep messages under 3 sentences.
Never shame the student. Always end with a concrete next step or question.
Use "we" language ("Let's figure out today's plan") not "you failed".
Do NOT use more than one exclamation mark per message.

Generate a check-in message for:
- Student name: ${params.name}
- Streak: ${params.streak} days
- Days until exam: ${params.daysLeft}
- Yesterday's completion: ${params.completionFlag}
- Topics remaining today: ${params.topicsToday}
- Context: ${params.contextNote || 'Regular check-in'}

Respond with ONLY the message text — no quotes, no JSON, just the message.`;

  const fallbackMsg = `Let's keep the momentum going, ${params.name}. We have ${params.topicsToday} topic${params.topicsToday !== 1 ? 's' : ''} lined up for today — ready when you are.`;

  try {
    const msg = await generateTextWithFallback(prompt);
    return msg.trim();
  } catch (err) {
    console.warn('⚠️ [LLM] Check-in message generation failed. Falling back to default message.', err);
    return fallbackMsg;
  }
}

export async function adjustStudyPlan(
  params: {
    subject: string;
    examDate: string;
    dailyHours: number;
    goalScore: number;
  },
  currentPlan: {
    summary: string;
    days: {
      dayNumber: number;
      date: string;
      topics: { title: string; estimatedMins: number; status: string }[];
    }[];
  },
  completedTopics: string[],
  chatHistory: { role: 'user' | 'assistant'; text: string }[]
): Promise<LLMPlan> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';

  if (
    (!geminiApiKey || geminiApiKey === 'your-gemini-api-key-here') &&
    (!openaiApiKey || openaiApiKey === 'your-openai-api-key-here')
  ) {
    throw new Error('API key is unconfigured');
  }

  // Format the conversation log
  const formattedChat = chatHistory
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join('\n');

  const prompt = `You are StudyBuddy, an expert study planner. You modify existing study plans based on student requests.
You MUST respond with valid JSON only. No markdown, no explanation, no code blocks — just raw JSON.

Return the modified study plan with this EXACT structure:
{
  "summary": "new plan summary statement",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "topics": [
        { "title": "Topic name", "estimatedMins": 45 }
      ]
    }
  ]
}

Original Parameters:
- Subject: ${params.subject}
- Exam Date: ${params.examDate}
- Daily Availability: ${params.dailyHours} hours
- Goal Score: ${params.goalScore}%

Current Plan Structure:
${JSON.stringify(currentPlan, null, 2)}

Completed Topics (MUST be preserved in the plan unless user explicitly requests deleting them):
${JSON.stringify(completedTopics)}

Conversation Logs:
${formattedChat}

Instructions:
1. Apply the user's latest request to the study plan.
2. If the user wants to add topics, integrate them logically.
3. If they want to extend/shorten the time or hours, redistribute topics across the new timeline.
4. Keep completed topics in the plan (though you can move them to other days if the timeline changes).
5. Maintain a realistic daily study load.
6. Respond with ONLY the JSON object.`;

  const raw = await generateTextWithFallback(prompt, { json: true });
  const jsonStr = extractJson(raw);
  return JSON.parse(jsonStr) as LLMPlan;
}

export async function generateChatResponse(params: {
  planContext: string;
  chatHistory: { role: 'user' | 'model'; content: string }[];
  message: string;
  knowledgeSources: { title: string; content: string | null }[];
}): Promise<string> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';

  const fallbackMsg = `I am here to help you study. I see we are preparing for ${params.planContext}. Let's discuss your query: "${params.message}". Can you tell me which concept in particular you'd like to break down?`;

  if (
    (!geminiApiKey || geminiApiKey === 'your-gemini-api-key-here') &&
    (!openaiApiKey || openaiApiKey === 'your-openai-api-key-here')
  ) {
    return `[Mock AI Assistant] I can help you with your query: "${params.message}". Since we are preparing for ${params.planContext}, let's focus on breaking this down. I also see you uploaded some reference notes in your Knowledge Source. What specific questions do you have? (Note: AI keys are currently unconfigured, so I am running in mock mode).`;
  }

  // Format the conversation log
  const formattedChat = params.chatHistory
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const formattedDocs = params.knowledgeSources
    .map((doc) => `Document: "${doc.title}"\nContent:\n${doc.content || 'No content'}`)
    .join('\n\n');

  const prompt = `You are StudyBuddy, a professional, encouraging, and clear AI study tutor.
You help students with their queries, explain complex concepts, and guide them in their syllabus.
IMPORTANT: You must NOT use any emojis in your response. Keep your tone professional, academic, yet supportive and friendly.

Context:
- Study Plan Context: ${params.planContext}
- Student's Uploaded Materials/Notes:
${formattedDocs}

Conversation History:
${formattedChat}

Student's Latest Message:
${params.message}

Please reply directly to the student's message. Explain any concepts clearly. Remember: no emojis.`;

  try {
    const response = await generateTextWithFallback(prompt);
    return response.trim();
  } catch (err) {
    console.error('❌ [LLM] Chat generation failed. Using fallback message.', err);
    return fallbackMsg;
  }
}

export async function generateRecommendationsForTopic(
  topicTitle: string,
  subject: string
): Promise<{ title: string; url: string; isPaid: boolean; platform: string }[]> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';

  const mockRecommendations = [
    {
      title: `${topicTitle} - Core Concepts Explained`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topicTitle + ' tutorial')}`,
      isPaid: false,
      platform: 'YouTube'
    },
    {
      title: `${subject} Foundations`,
      url: `https://www.coursera.org/search?query=${encodeURIComponent(subject)}`,
      isPaid: true,
      platform: 'Coursera'
    },
    {
      title: `Complete ${topicTitle} Masterclass`,
      url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(topicTitle)}`,
      isPaid: true,
      platform: 'Udemy'
    },
    {
      title: `${topicTitle} Lecture Notes & Guide`,
      url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(topicTitle)}`,
      isPaid: false,
      platform: 'OpenSource'
    }
  ];

  if (
    (!geminiApiKey || geminiApiKey === 'your-gemini-api-key-here') &&
    (!openaiApiKey || openaiApiKey === 'your-openai-api-key-here')
  ) {
    return mockRecommendations;
  }

  const prompt = `You are a learning resource curator. Suggest exactly 4 high-quality resources (articles, courses, or videos) for the topic: "${topicTitle}" in the subject: "${subject}".
Include a mix of free open-source resources (like YouTube or open tutorials) and paid platforms (like Coursera, Udemy, or Simplilearn).
Respond with valid JSON only. No markdown, no code blocks, no explanation.

Respond with this EXACT structure:
[
  {
    "title": "Resource title",
    "url": "https://example.com/course",
    "isPaid": true,
    "platform": "Coursera"
  }
]

Allowed platforms: "YouTube", "Coursera", "Udemy", "Simplilearn", "OpenSource".
Make sure the URLs are realistic search or course URLs for the topic.`;

  try {
    const raw = await generateTextWithFallback(prompt, { json: true });
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        title: item.title || `${topicTitle} Resource`,
        url: item.url || `https://www.google.com/search?q=${encodeURIComponent(topicTitle)}`,
        isPaid: !!item.isPaid,
        platform: item.platform || 'OpenSource'
      }));
    }
    return mockRecommendations;
  } catch (err) {
    console.warn('⚠️ [LLM] Recommendation generation failed. Using mock recommendations.', err);
    return mockRecommendations;
  }
}

export async function mapResourcesToTopics(
  topics: { id: string; title: string }[],
  resources: { title: string; type: string }[]
): Promise<Record<string, string>> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';

  const fallback: Record<string, string> = {};

  if (
    (!geminiApiKey || geminiApiKey === 'your-gemini-api-key-here') &&
    (!openaiApiKey || openaiApiKey === 'your-openai-api-key-here')
  ) {
    // Programmatic mock fallback: just map the first resource to the first topic
    if (topics.length > 0 && resources.length > 0) {
      fallback[topics[0].id] = `${topics[0].title.split(' (Ref:')[0]} (Ref: ${resources[resources.length - 1].title})`;
    }
    return fallback;
  }

  const prompt = `You are a study planner. Map these study resources to these topics.
For each topic, decide if any of the resources are highly relevant. If so, return an updated title for the topic that appends the resource reference (e.g., "Topic Title (Ref: Resource Title)").
Only include topics in the output if they have a matching resource. Keep the original topic title prefix but strip any old "(Ref: ...)" if present.
Respond with valid JSON only. No markdown, no code blocks, no explanation.

Topics:
${JSON.stringify(topics)}

Resources:
${JSON.stringify(resources)}

Response structure:
{
  "topic_id_here": "Updated Topic Title (Ref: Resource Title)"
}`;

  try {
    const raw = await generateTextWithFallback(prompt, { json: true });
    const jsonStr = extractJson(raw);
    return JSON.parse(jsonStr) as Record<string, string>;
  } catch (err) {
    console.warn('⚠️ [LLM] Mapping resources to topics failed. Using mock mapping.', err);
    if (topics.length > 0 && resources.length > 0) {
      fallback[topics[0].id] = `${topics[0].title.split(' (Ref:')[0]} (Ref: ${resources[resources.length - 1].title})`;
    }
    return fallback;
  }
}

async function scrapeYoutubeFallback(
  topicTitle: string,
  subject: string
): Promise<{ videoId: string; title: string; duration: string; relevanceExplanation: string }[]> {
  const query = `${topicTitle} ${subject} tutorial`;
  const fallbackVideos = [
    {
      videoId: 'EcCTIExsqmI',
      title: `${topicTitle} - Core Concepts Explained`,
      duration: '12:00',
      relevanceExplanation: 'Highly rated and relevant explanation for this subject (Fallback resource).'
    }
  ];

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const startToken = 'var ytInitialData = ';
    const endToken = ';</script>';
    const startIndex = html.indexOf(startToken);
    if (startIndex === -1) {
      throw new Error('Could not find ytInitialData in HTML');
    }
    
    const jsonStart = startIndex + startToken.length;
    const endIndex = html.indexOf(endToken, jsonStart);
    const jsonStr = html.substring(jsonStart, endIndex);
    const data = JSON.parse(jsonStr);
    
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    if (!contents) {
      throw new Error('No contents found in ytInitialData');
    }
    
    const videos: { videoId: string; title: string; duration: string; relevanceExplanation: string }[] = [];
    for (const section of contents) {
      const itemSection = section.itemSectionRenderer;
      if (itemSection?.contents) {
        for (const item of itemSection.contents) {
          if (item.videoRenderer) {
            const v = item.videoRenderer;
            const videoId = v.videoId;
            if (!videoId) continue;
            const title = v.title?.runs?.[0]?.text || `${topicTitle} Tutorial`;
            const lengthText = v.lengthText?.simpleText || '12:00';
            const viewsText = v.viewCountText?.simpleText || 'Highly viewed';
            const channelName = v.ownerText?.runs?.[0]?.text || 'Educational Creator';
            
            videos.push({
              videoId,
              title,
              duration: lengthText,
              relevanceExplanation: `Curated video with high community approval (${viewsText}) by channel "${channelName}". Programmatically matched fallback.`
            });
            
            if (videos.length >= 5) break;
          }
        }
      }
      if (videos.length >= 5) break;
    }
    
    if (videos.length > 0) return videos;
    return fallbackVideos;
  } catch (err) {
    console.error('⚠️ [YouTube Fallback Scraper] failed:', err);
    return fallbackVideos;
  }
}

export async function searchYoutubeVideosWithGemini(
  topicTitle: string,
  subject: string,
  syllabusContext?: string
): Promise<{ videoId: string; title: string; duration: string; relevanceExplanation: string }[]> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';

  if (
    (!geminiApiKey || geminiApiKey === 'your-gemini-api-key-here') &&
    (!openaiApiKey || openaiApiKey === 'your-openai-api-key-here')
  ) {
    console.log('⚡ [LLM] No API key configured. Calling YouTube fallback scraper...');
    return scrapeYoutubeFallback(topicTitle, subject);
  }

  const prompt = `You are a learning content recommendation engine.
Find the 5 best YouTube video tutorials for studying the topic "${topicTitle}" in the subject "${subject}".
Syllabus / Context details: ${syllabusContext || 'None provided'}

Your goals:
1. Target videos that have high view counts (implying popularity and community approval).
2. Choose videos that have highly positive comments (users finding it clear and helpful).
3. Select videos with excellent transcript quality matching what the student needs to learn.
4. Ensure relevance to the target curriculum (e.g. if the subject indicates an Indian Entrance Exam like JEE, NEET, UPSC, etc., prioritize Indian educators/context).

For each of the 5 videos, find or generate:
- The actual YouTube videoId (a valid 11-character ID, e.g. "dQw4w9WgXcQ", "EcCTIExsqmI" or any real tutorial ID you can query via search).
- The video title.
- The video duration (e.g. "12:30").
- A brief relevanceExplanation explaining why this video is recommended (mentioning view range, comments, and direct curriculum relevance).

Respond with valid JSON only. No markdown, no code blocks, no explanation.

Respond with this EXACT structure:
[
  {
    "videoId": "11-char-id",
    "title": "Video Title",
    "duration": "10:15",
    "relevanceExplanation": "Why this video is relevant..."
  }
]`;

  try {
    const raw = await generateTextWithFallback(prompt, { json: true });
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        videoId: item.videoId || 'EcCTIExsqmI',
        title: item.title || `${topicTitle} Tutorial`,
        duration: item.duration || '12:00',
        relevanceExplanation: item.relevanceExplanation || 'Directly relevant to your syllabus.'
      }));
    }
    console.warn('⚡ [LLM] Returned invalid video search response structure. Calling fallback scraper...');
    return scrapeYoutubeFallback(topicTitle, subject);
  } catch (err) {
    console.error('❌ [LLM] YouTube video search with Gemini failed. Calling fallback scraper...', err);
    return scrapeYoutubeFallback(topicTitle, subject);
  }
}


