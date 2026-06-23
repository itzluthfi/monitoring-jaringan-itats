let currentApiKey = '';

const nim = {
  auth: (key: string) => {
    currentApiKey = key;
    return nim;
  },
  create_chat_completion_v1_chat_completions_post: async (body: any) => {
    // Falls back to seeded key if not explicitly set
    const key = currentApiKey || process.env.NVIDIA_API_KEY || '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';

    // Standard OpenAI chat completion format
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA NIM API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return { data };
  }
};

export default nim;
