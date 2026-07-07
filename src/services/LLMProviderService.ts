import { GoogleGenAI } from '@google/genai';
import { LLMProviderType, LLMProviderConfig } from '../types/index.js';

export class LLMProviderService {
  /**
   * Calls the specified provider to get a structured bot action.
   */
  public static async getBotDecision(
    provider: LLMProviderConfig,
    systemInstruction: string,
    prompt: string,
    responseSchema?: any
  ): Promise<{ rationale: string; action: string; parameters: any; message?: string }> {
    
    // Select correct provider execution path
    switch (provider.type) {
      case LLMProviderType.GEMINI:
        return await this.callGemini(provider, systemInstruction, prompt, responseSchema);
      case LLMProviderType.OPENAI:
        return await this.callOpenAI(provider, systemInstruction, prompt, responseSchema);
      case LLMProviderType.ANTHROPIC:
        return await this.callAnthropic(provider, systemInstruction, prompt, responseSchema);
      case LLMProviderType.OPENROUTER:
        return await this.callOpenRouter(provider, systemInstruction, prompt, responseSchema);
      case LLMProviderType.OLLAMA:
        return await this.callOllama(provider, systemInstruction, prompt);
      case LLMProviderType.LMSTUDIO:
        return await this.callLMStudio(provider, systemInstruction, prompt);
      default:
        throw new Error(`Unsupported LLM provider: ${provider.type}`);
    }
  }

  /**
   * Official @google/genai SDK Integration for Gemini API.
   */
  private static async callGemini(
    provider: LLMProviderConfig,
    systemInstruction: string,
    prompt: string,
    responseSchema?: any
  ): Promise<any> {
    const apiKey = provider.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable or configured provider API key is required.');
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const modelName = provider.defaultModel || 'gemini-3.5-flash';

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response received from Gemini API');
      }

      return JSON.parse(text.trim());
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      throw new Error(`Gemini API Error: ${err.message || err}`);
    }
  }

  /**
   * OpenAI API Integration.
   */
  private static async callOpenAI(
    provider: LLMProviderConfig,
    systemInstruction: string,
    prompt: string,
    responseSchema?: any
  ): Promise<any> {
    const apiKey = provider.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API Key is required but not configured.');
    }

    const url = provider.customUrl || 'https://api.openai.com/v1/chat/completions';
    const model = provider.defaultModel || 'gpt-4o-mini';

    const payload: any = {
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
    };

    if (responseSchema) {
      payload.response_format = { type: 'json_object' };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('Empty content in OpenAI completion.');
      }

      return JSON.parse(text.trim());
    } catch (err: any) {
      console.error('OpenAI Call Error:', err);
      throw new Error(`OpenAI Error: ${err.message || err}`);
    }
  }

  /**
   * Anthropic API Integration.
   */
  private static async callAnthropic(
    provider: LLMProviderConfig,
    systemInstruction: string,
    prompt: string,
    responseSchema?: any
  ): Promise<any> {
    const apiKey = provider.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API Key is required but not configured.');
    }

    const url = provider.customUrl || 'https://api.anthropic.com/v1/messages';
    const model = provider.defaultModel || 'claude-3-5-haiku-latest';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemInstruction,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (!text) {
        throw new Error('Empty response content from Anthropic.');
      }

      // Parse JSON out of markdown block if any, or direct parse
      return this.extractJson(text);
    } catch (err: any) {
      console.error('Anthropic Call Error:', err);
      throw new Error(`Anthropic Error: ${err.message || err}`);
    }
  }

  /**
   * OpenRouter API Integration.
   */
  private static async callOpenRouter(
    provider: LLMProviderConfig,
    systemInstruction: string,
    prompt: string,
    responseSchema?: any
  ): Promise<any> {
    const apiKey = provider.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API Key is required but not configured.');
    }

    const url = provider.customUrl || 'https://openrouter.ai/api/v1/chat/completions';
    const model = provider.defaultModel || 'google/gemini-2.5-flash';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://ai.studio/build',
          'X-Title': 'MISSI - Minecraft Scenario Simulator'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          response_format: responseSchema ? { type: 'json_object' } : undefined,
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('Empty response content from OpenRouter.');
      }

      return this.extractJson(text);
    } catch (err: any) {
      console.error('OpenRouter Call Error:', err);
      throw new Error(`OpenRouter Error: ${err.message || err}`);
    }
  }

  /**
   * Ollama Local Integration.
   */
  private static async callOllama(
    provider: LLMProviderConfig,
    systemInstruction: string,
    prompt: string
  ): Promise<any> {
    const baseUrl = provider.customUrl || 'http://localhost:11434';
    const model = provider.defaultModel || 'llama3';

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          stream: false,
          format: 'json'
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.message?.content;
      if (!text) {
        throw new Error('Empty response from Ollama.');
      }

      return JSON.parse(text.trim());
    } catch (err: any) {
      console.error('Ollama Call Error:', err);
      throw new Error(`Ollama Local Provider is offline or unreachable at ${baseUrl}. Details: ${err.message || err}`);
    }
  }

  /**
   * LM Studio Local Integration.
   */
  private static async callLMStudio(
    provider: LLMProviderConfig,
    systemInstruction: string,
    prompt: string
  ): Promise<any> {
    const baseUrl = provider.customUrl || 'http://localhost:1234';
    const model = provider.defaultModel || 'meta-llama-3-8b-instruct';

    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LM Studio error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('Empty response from LM Studio.');
      }

      return this.extractJson(text);
    } catch (err: any) {
      console.error('LM Studio Call Error:', err);
      throw new Error(`LM Studio Local Provider is offline or unreachable at ${baseUrl}. Details: ${err.message || err}`);
    }
  }

  /**
   * Utility helper to extract JSON from a markdown code block if model wrapped it.
   */
  private static extractJson(text: string): any {
    try {
      // Direct parse check
      return JSON.parse(text.trim());
    } catch {
      // Find markdown JSON block ```json ... ```
      const match = text.match(/```(?:json)?([\s\S]*?)```/);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1].trim());
        } catch (innerErr) {
          throw new Error(`Failed to parse extracted JSON block: ${text}`);
        }
      }
      throw new Error(`Failed to parse JSON response: ${text}`);
    }
  }
}
