import { api } from './api';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  action?: string;
  data?: any;
  intent?: string;
}

export interface ChatSuggestion {
  id: number;
  text: string;
  icon: string;
  category: string;
}

export interface AIResponse {
  text: string;
  action: string;
  data: any;
  intent: string;
}

class AIAssistantService {
  /**
   * Send a message to the AI assistant
   */
  async sendMessage(message: string, conversationHistory?: ChatMessage[]): Promise<AIResponse> {
    try {
      const response = await api.post('/ai-assistant/chat', {
        message,
        conversationHistory: conversationHistory?.slice(-5) // Send last 5 messages for context
      });

      return response.data.data;
    } catch (error: any) {
      console.error('AI Assistant error:', error);
      throw new Error(error.response?.data?.message || 'Failed to get response from assistant');
    }
  }

  /**
   * Get suggested prompts
   */
  async getSuggestions(): Promise<ChatSuggestion[]> {
    try {
      const response = await api.get('/ai-assistant/suggestions');
      return response.data.data;
    } catch (error: any) {
      console.error('Failed to fetch suggestions:', error);
      return [];
    }
  }

  /**
   * Convert AI response to chat message
   */
  responseToMessage(response: AIResponse, messageId: string): ChatMessage {
    return {
      id: messageId,
      text: response.text,
      sender: 'assistant',
      timestamp: new Date(),
      action: response.action,
      data: response.data,
      intent: response.intent
    };
  }

  /**
   * Create user message
   */
  createUserMessage(text: string, messageId: string): ChatMessage {
    return {
      id: messageId,
      text,
      sender: 'user',
      timestamp: new Date()
    };
  }
}

export default new AIAssistantService();
