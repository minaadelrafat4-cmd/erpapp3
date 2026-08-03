/**
 * AI Service Stub — Future Shared AI Integration
 *
 * This module defines the interfaces and stub functions for a future
 * centralized AI service that will be shared by BOTH the web ERP
 * and this mobile app. No implementation exists yet — these are
 * the typed contracts the mobile app is designed around so that
 * when the AI service is built, it can be wired in without
 * architectural changes.
 *
 * Future AI capabilities:
 *  - AI Chat Assistant
 *  - Natural language ERP search
 *  - Sales analysis
 *  - Inventory recommendations
 *  - Purchase recommendations
 *  - Stock forecasting
 *  - Customer insights
 *  - Business summaries
 *  - Report explanations
 *  - Smart notifications
 */

// ============================================================
// Types
// ============================================================

export type AIRole = 'user' | 'assistant' | 'system';

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AIChatSession {
  id: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AIChatRequest {
  message: string;
  sessionId?: string;
  context?: {
    module?: string;
    entityId?: string;
    userRole?: string;
  };
}

export interface AIChatResponse {
  message: AIMessage;
  sessionId: string;
}

export interface AISearchRequest {
  query: string;
  filters?: {
    module?: string;
    dateRange?: { start: string; end: string };
  };
}

export interface AISearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  data: Record<string, unknown>;
}

export interface AISearchResponse {
  results: AISearchResult[];
  summary: string;
}

export interface AISalesAnalysis {
  period: string;
  totalRevenue: number;
  revenueChange: number;
  topProducts: Array<{ name: string; revenue: number; qtySold: number }>;
  topBranches: Array<{ name: string; revenue: number }>;
  insights: string[];
}

export interface AIInventoryRecommendation {
  productId: string;
  productName: string;
  currentStock: number;
  recommendedAction: 'reorder' | 'reduce' | 'discontinue' | 'promote';
  suggestedQuantity: number;
  reasoning: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export interface AIPurchaseRecommendation {
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  suggestedQuantity: number;
  estimatedCost: number;
  reasoning: string;
}

export interface AIStockForecast {
  productId: string;
  productName: string;
  forecastDays: number;
  projectedDemand: number;
  currentStock: number;
  daysUntilStockout: number;
  recommendedReorderDate: string;
  confidence: number;
}

export interface AICustomerInsight {
  customerId: string;
  customerName: string;
  segment: string;
  lifetimeValue: number;
  orderFrequency: string;
  riskLevel: 'low' | 'medium' | 'high';
  insights: string[];
  recommendedActions: string[];
}

export interface AIBusinessSummary {
  period: string;
  headline: string;
  keyMetrics: Array<{ label: string; value: string; trend: 'up' | 'down' | 'flat' }>;
  highlights: string[];
  concerns: string[];
  narrative: string;
}

export interface AIReportExplanation {
  reportType: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
}

export interface AISmartNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
  actionUrl?: string;
  entityId?: string;
}

// ============================================================
// AI Service Interface
// ============================================================

export interface AIService {
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  search(request: AISearchRequest): Promise<AISearchResponse>;
  getSalesAnalysis(period?: string): Promise<AISalesAnalysis>;
  getInventoryRecommendations(): Promise<AIInventoryRecommendation[]>;
  getPurchaseRecommendations(): Promise<AIPurchaseRecommendation[]>;
  getStockForecasts(forecastDays?: number): Promise<AIStockForecast[]>;
  getCustomerInsights(customerId?: string): Promise<AICustomerInsight[]>;
  getBusinessSummary(period?: string): Promise<AIBusinessSummary>;
  getReportExplanation(reportType: string, params?: Record<string, unknown>): Promise<AIReportExplanation>;
  getSmartNotifications(): Promise<AISmartNotification[]>;
}

// ============================================================
// Stub Implementation — returns placeholder data so the UI can be
// built against these contracts before the AI service exists.
// When the real service is ready, replace this object with a
// live implementation that calls the shared AI endpoint.
// ============================================================

const STUB_ERROR = 'AI service is not yet available. This is a placeholder.';

export const aiService: AIService = {
  async chat() {
    throw new Error(STUB_ERROR);
  },
  async search() {
    throw new Error(STUB_ERROR);
  },
  async getSalesAnalysis() {
    throw new Error(STUB_ERROR);
  },
  async getInventoryRecommendations() {
    throw new Error(STUB_ERROR);
  },
  async getPurchaseRecommendations() {
    throw new Error(STUB_ERROR);
  },
  async getStockForecasts() {
    throw new Error(STUB_ERROR);
  },
  async getCustomerInsights() {
    throw new Error(STUB_ERROR);
  },
  async getBusinessSummary() {
    throw new Error(STUB_ERROR);
  },
  async getReportExplanation() {
    throw new Error(STUB_ERROR);
  },
  async getSmartNotifications() {
    throw new Error(STUB_ERROR);
  },
};

export const isAIAvailable = (): boolean => false;
