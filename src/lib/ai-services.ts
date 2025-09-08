import { pipeline } from '@huggingface/transformers';

// AI Service Types
export interface IntentResult {
  intent: string;
  confidence: number;
}

export interface SentimentResult {
  label: string;
  score: number;
}

export interface EntityResult {
  entity: string;
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface AIAnalysis {
  intent: IntentResult;
  sentiment: SentimentResult;
  entities: EntityResult[];
}

class AIService {
  private intentClassifier: any | null = null;
  private sentimentAnalyzer: any | null = null;
  private nerExtractor: any | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Intent Classification - using a proper classification model
      this.intentClassifier = await pipeline(
        'text-classification',
        'facebook/bart-large-mnli',
        { device: 'webgpu' }
      );

      // Sentiment Analysis
      this.sentimentAnalyzer = await pipeline(
        'sentiment-analysis',
        'cardiffnlp/twitter-roberta-base-sentiment-latest',
        { device: 'webgpu' }
      );

      // Named Entity Recognition
      this.nerExtractor = await pipeline(
        'token-classification',
        'dbmdz/bert-large-cased-finetuned-conll03-english',
        { device: 'webgpu' }
      );

      this.isInitialized = true;
      console.log('AI Services initialized successfully');
    } catch (error) {
      console.warn('WebGPU not available, falling back to CPU');
      // Fallback to CPU
      await this.initializeCPU();
    }
  }

  private async initializeCPU() {
    try {
      this.sentimentAnalyzer = await pipeline(
        'sentiment-analysis',
        'cardiffnlp/twitter-roberta-base-sentiment-latest'
      );

      this.nerExtractor = await pipeline(
        'token-classification',
        'dbmdz/bert-large-cased-finetuned-conll03-english'
      );

      this.isInitialized = true;
      console.log('AI Services initialized on CPU');
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
    }
  }

  async analyzeText(text: string): Promise<AIAnalysis> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const results: AIAnalysis = {
      intent: { intent: 'general_inquiry', confidence: 0.5 },
      sentiment: { label: 'neutral', score: 0.5 },
      entities: []
    };

    try {
      // Intent Detection (basic classification)
      const intent = await this.detectIntent(text);
      results.intent = intent;

      // Sentiment Analysis
      if (this.sentimentAnalyzer) {
        const sentiment = await this.sentimentAnalyzer(text);
        results.sentiment = {
          label: sentiment[0].label.toLowerCase(),
          score: sentiment[0].score
        };
      }

      // Named Entity Recognition
      if (this.nerExtractor) {
        const entities = await this.nerExtractor(text);
        results.entities = entities.map((entity: any) => ({
          entity: entity.entity,
          word: entity.word,
          start: entity.start,
          end: entity.end,
          confidence: entity.score
        }));
      }
    } catch (error) {
      console.error('Error analyzing text:', error);
    }

    return results;
  }

  private async detectIntent(text: string): Promise<IntentResult> {
    // Simple rule-based intent detection for demo
    const lowerText = text.toLowerCase();
    
    const intents = [
      { keywords: ['order', 'tracking', 'track', 'delivery', 'shipped'], intent: 'order_tracking' },
      { keywords: ['refund', 'return', 'money back', 'cancel'], intent: 'refund_request' },
      { keywords: ['complaint', 'problem', 'issue', 'wrong', 'broken'], intent: 'complaint' },
      { keywords: ['help', 'support', 'question', 'how'], intent: 'support_request' },
      { keywords: ['price', 'cost', 'payment', 'billing'], intent: 'billing_inquiry' }
    ];

    for (const intentGroup of intents) {
      const matches = intentGroup.keywords.filter(keyword => lowerText.includes(keyword));
      if (matches.length > 0) {
        return {
          intent: intentGroup.intent,
          confidence: Math.min(0.9, 0.5 + (matches.length * 0.2))
        };
      }
    }

    return { intent: 'general_inquiry', confidence: 0.5 };
  }

  generateResponse(analysis: AIAnalysis, userMessage: string): string {
    const { intent, sentiment } = analysis;
    
    // Context-aware responses based on intent and sentiment
    const responses: Record<string, string[]> = {
      order_tracking: [
        "I can help you track your order! Could you please provide your order number?",
        "Let me assist you with order tracking. What's your order ID?",
        "I'll help you check your order status. Please share your order number."
      ],
      refund_request: [
        "I understand you'd like to request a refund. Let me help you with that process.",
        "I can assist with your refund request. Could you tell me more about the issue?",
        "I'll help you process a refund. What seems to be the problem with your order?"
      ],
      complaint: [
        "I'm sorry to hear you're experiencing an issue. Let me help resolve this for you.",
        "I apologize for any inconvenience. Can you tell me more about what happened?",
        "I understand your concern and I'm here to help. What specific issue are you facing?"
      ],
      support_request: [
        "I'm here to help! What can I assist you with today?",
        "How can I support you today? I'm ready to help with any questions.",
        "I'm happy to help! What do you need assistance with?"
      ],
      billing_inquiry: [
        "I can help with billing questions. What would you like to know?",
        "Let me assist you with your billing inquiry. What specific information do you need?",
        "I'm here to help with billing matters. How can I assist you?"
      ],
      general_inquiry: [
        "Thank you for contacting us! How can I help you today?",
        "Hello! I'm here to assist you. What can I help you with?",
        "Hi there! What can I help you with today?"
      ]
    };

    const intentResponses = responses[intent.intent] || responses.general_inquiry;
    
    // Adjust response based on sentiment
    if (sentiment.label === 'negative' || sentiment.label === 'anger') {
      return `I understand you're frustrated, and I sincerely apologize for any inconvenience. ${intentResponses[0]}`;
    }
    
    // Random response selection for variety
    return intentResponses[Math.floor(Math.random() * intentResponses.length)];
  }
}

export const aiService = new AIService();