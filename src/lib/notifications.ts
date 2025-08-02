// import { z } from 'zod';

// Notification Types
export const NOTIFICATION_TYPES = {
  CAMPAIGN_PERFORMANCE: 'campaign_performance',
  BUDGET_ALERT: 'budget_alert',
  INTEGRATION_ERROR: 'integration_error',
  AI_INSIGHT: 'ai_insight',
  SYSTEM_UPDATE: 'system_update',
  USER_ACTIVITY: 'user_activity',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Notification Priority
export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type NotificationPriority = typeof NOTIFICATION_PRIORITY[keyof typeof NOTIFICATION_PRIORITY];

// Notification Status
export const NOTIFICATION_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  READ: 'read',
  FAILED: 'failed',
} as const;

export type NotificationStatus = typeof NOTIFICATION_STATUS[keyof typeof NOTIFICATION_STATUS];

// Notification Interface
export interface Notification {
  id: string;
  organizationId: string;
  userId?: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  metadata: {
    source: string;
    timestamp: Date;
    readAt?: Date;
    actionUrl?: string;
    expiresAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// WebSocket Message Types
export const WEBSOCKET_MESSAGE_TYPES = {
  NOTIFICATION: 'notification',
  HEARTBEAT: 'heartbeat',
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  ERROR: 'error',
} as const;

export type WebSocketMessageType = typeof WEBSOCKET_MESSAGE_TYPES[keyof typeof WEBSOCKET_MESSAGE_TYPES];

// WebSocket Message Interface
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: unknown;
  timestamp: number;
  id?: string;
}

// Notification Template Interface
export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  variables: string[];
  conditions?: Record<string, unknown>;
}

// Notification Manager Class
export class NotificationManager {
  private notifications: Map<string, Notification> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private subscribers: Map<string, Set<string>> = new Map(); // organizationId -> Set<userId>
  private webSocketConnections: Map<string, WebSocket> = new Map(); // userId -> WebSocket

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates() {
    const templates: NotificationTemplate[] = [
      {
        id: 'campaign_performance_alert',
        type: NOTIFICATION_TYPES.CAMPAIGN_PERFORMANCE,
        title: 'Campaign Performance Alert',
        message: 'Campaign "{campaignName}" has {changeType} performance. CTR: {ctr}%, ROAS: {roas}',
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        variables: ['campaignName', 'changeType', 'ctr', 'roas'],
      },
      {
        id: 'budget_alert',
        type: NOTIFICATION_TYPES.BUDGET_ALERT,
        title: 'Budget Alert',
        message: 'Campaign "{campaignName}" has reached {percentage}% of daily budget. Current spend: ${spend}',
        priority: NOTIFICATION_PRIORITY.HIGH,
        variables: ['campaignName', 'percentage', 'spend'],
      },
      {
        id: 'integration_error',
        type: NOTIFICATION_TYPES.INTEGRATION_ERROR,
        title: 'Integration Error',
        message: '{platform} integration failed: {error}. Please check your credentials.',
        priority: NOTIFICATION_PRIORITY.URGENT,
        variables: ['platform', 'error'],
      },
      {
        id: 'ai_insight',
        type: NOTIFICATION_TYPES.AI_INSIGHT,
        title: 'AI Insight Available',
        message: 'New AI insight for campaign "{campaignName}": {insight}',
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        variables: ['campaignName', 'insight'],
      },
      {
        id: 'system_update',
        type: NOTIFICATION_TYPES.SYSTEM_UPDATE,
        title: 'System Update',
        message: 'System update completed. New features available: {features}',
        priority: NOTIFICATION_PRIORITY.LOW,
        variables: ['features'],
      },
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  // Create notification from template
  async createNotificationFromTemplate(
    templateId: string,
    organizationId: string,
    variables: Record<string, unknown>,
    options?: {
      userId?: string;
      priority?: NotificationPriority;
      data?: Record<string, unknown>;
      actionUrl?: string;
      expiresAt?: Date;
    }
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let title = template.title;
    let message = template.message;

    // Replace variables in title and message
    template.variables.forEach(variable => {
      const value = variables[variable];
      if (value !== undefined && value !== null) {
        title = title.replace(`{${variable}}`, value.toString());
        message = message.replace(`{${variable}}`, value.toString());
      }
    });

    const notification: Notification = {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      userId: options?.userId,
      type: template.type,
      priority: options?.priority || template.priority,
      status: NOTIFICATION_STATUS.PENDING,
      title,
      message,
      data: options?.data,
      metadata: {
        source: templateId,
        timestamp: new Date(),
        actionUrl: options?.actionUrl,
        expiresAt: options?.expiresAt,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.notifications.set(notification.id, notification);

    // Send real-time notification
    await this.sendRealTimeNotification(notification);

    return notification.id;
  }

  // Create custom notification
  async createNotification(
    organizationId: string,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      userId?: string;
      priority?: NotificationPriority;
      data?: Record<string, unknown>;
      actionUrl?: string;
      expiresAt?: Date;
    }
  ): Promise<string> {
    const notification: Notification = {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      userId: options?.userId,
      type,
      priority: options?.priority || NOTIFICATION_PRIORITY.MEDIUM,
      status: NOTIFICATION_STATUS.PENDING,
      title,
      message,
      data: options?.data,
      metadata: {
        source: 'custom',
        timestamp: new Date(),
        actionUrl: options?.actionUrl,
        expiresAt: options?.expiresAt,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.notifications.set(notification.id, notification);

    // Send real-time notification
    await this.sendRealTimeNotification(notification);

    return notification.id;
  }

  // Get notifications for user/organization
  async getNotifications(
    organizationId: string,
    options?: {
      userId?: string;
      status?: NotificationStatus;
      type?: NotificationType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Notification[]> {
    let notifications = Array.from(this.notifications.values()).filter(
      notification => notification.organizationId === organizationId
    );

    if (options?.userId) {
      notifications = notifications.filter(
        notification => !notification.userId || notification.userId === options.userId
      );
    }

    if (options?.status) {
      notifications = notifications.filter(notification => notification.status === options.status);
    }

    if (options?.type) {
      notifications = notifications.filter(notification => notification.type === options.type);
    }

    // Sort by priority and creation date
    notifications.sort((a, b) => {
      const priorityOrder = {
        [NOTIFICATION_PRIORITY.URGENT]: 4,
        [NOTIFICATION_PRIORITY.HIGH]: 3,
        [NOTIFICATION_PRIORITY.MEDIUM]: 2,
        [NOTIFICATION_PRIORITY.LOW]: 1,
      };

      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    return notifications.slice(offset, offset + limit);
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return false;

    // Verify user has access to this notification
    if (notification.userId !== userId) return false;

    notification.status = NOTIFICATION_STATUS.READ;
    notification.metadata.readAt = new Date();
    notification.updatedAt = new Date();

    return true;
  }

  // Mark all notifications as read
  async markAllAsRead(organizationId: string, userId?: string): Promise<number> {
    const notifications = await this.getNotifications(organizationId, { userId });
    let count = 0;

    notifications.forEach(notification => {
      if (notification.status !== NOTIFICATION_STATUS.READ) {
        notification.status = NOTIFICATION_STATUS.READ;
        notification.metadata.readAt = new Date();
        notification.updatedAt = new Date();
        count++;
      }
    });

    return count;
  }

  // Delete notification
  async deleteNotification(notificationId: string): Promise<boolean> {
    return this.notifications.delete(notificationId);
  }

  // Get notification count
  async getNotificationCount(
    organizationId: string,
    options?: {
      userId?: string;
      status?: NotificationStatus;
      type?: NotificationType;
    }
  ): Promise<number> {
    const notifications = await this.getNotifications(organizationId, options);
    return notifications.length;
  }

  // WebSocket connection management
  connectWebSocket(userId: string, ws: WebSocket): void {
    this.webSocketConnections.set(userId, ws);

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleWebSocketMessage(userId, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      this.webSocketConnections.delete(userId);
    };

    // Send initial connection confirmation
    this.sendWebSocketMessage(userId, {
      type: WEBSOCKET_MESSAGE_TYPES.NOTIFICATION,
      data: { message: 'Connected to notification service' },
      timestamp: Date.now(),
    });
  }

  private handleWebSocketMessage(userId: string, message: WebSocketMessage): void {
    switch (message.type) {
      case WEBSOCKET_MESSAGE_TYPES.SUBSCRIBE:
        if (message.data && typeof message.data === 'object' && 'organizationId' in message.data) {
          this.subscribeToNotifications(userId, (message.data as { organizationId: string }).organizationId);
        }
        break;
      case WEBSOCKET_MESSAGE_TYPES.UNSUBSCRIBE:
        if (message.data && typeof message.data === 'object' && 'organizationId' in message.data) {
          this.unsubscribeFromNotifications(userId, (message.data as { organizationId: string }).organizationId);
        }
        break;
      case WEBSOCKET_MESSAGE_TYPES.HEARTBEAT:
        this.sendWebSocketMessage(userId, {
          type: WEBSOCKET_MESSAGE_TYPES.HEARTBEAT,
          timestamp: Date.now(),
        });
        break;
    }
  }

  private subscribeToNotifications(userId: string, organizationId: string): void {
    if (!this.subscribers.has(organizationId)) {
      this.subscribers.set(organizationId, new Set());
    }
    this.subscribers.get(organizationId)!.add(userId);
  }

  private unsubscribeFromNotifications(userId: string, organizationId: string): void {
    const subscribers = this.subscribers.get(organizationId);
    if (subscribers) {
      subscribers.delete(userId);
      if (subscribers.size === 0) {
        this.subscribers.delete(organizationId);
      }
    }
  }

  private async sendRealTimeNotification(notification: Notification): Promise<void> {
    const subscribers = this.subscribers.get(notification.organizationId);
    if (!subscribers) return;

    const message: WebSocketMessage = {
      type: WEBSOCKET_MESSAGE_TYPES.NOTIFICATION,
      data: notification,
      timestamp: Date.now(),
      id: notification.id,
    };

    subscribers.forEach(userId => {
      this.sendWebSocketMessage(userId, message);
    });
  }

  private sendWebSocketMessage(userId: string, message: WebSocketMessage): void {
    const ws = this.webSocketConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Campaign performance alerts
  async createCampaignPerformanceAlert(
    organizationId: string,
    campaignId: string,
    campaignName: string,
    metrics: {
      ctr: number;
      roas: number;
      previousCtr?: number;
      previousRoas?: number;
    }
  ): Promise<string> {
    const ctrChange = metrics.previousCtr ? metrics.ctr - metrics.previousCtr : 0;
    const roasChange = metrics.previousRoas ? metrics.roas - metrics.previousRoas : 0;

    let changeType = 'stable';
    if (ctrChange > 0.5 || roasChange > 0.5) {
      changeType = 'improved';
    } else if (ctrChange < -0.5 || roasChange < -0.5) {
      changeType = 'declined';
    }

    return await this.createNotificationFromTemplate(
      'campaign_performance_alert',
      organizationId,
      {
        campaignName,
        changeType,
        ctr: metrics.ctr.toFixed(2),
        roas: metrics.roas.toFixed(2),
      },
      {
        data: { campaignId, metrics },
        actionUrl: `/campaigns/${campaignId}`,
      }
    );
  }

  // Budget alerts
  async createBudgetAlert(
    organizationId: string,
    campaignId: string,
    campaignName: string,
    spend: number,
    budget: number
  ): Promise<string> {
    const percentage = Math.round((spend / budget) * 100);

    return await this.createNotificationFromTemplate(
      'budget_alert',
      organizationId,
      {
        campaignName,
        percentage,
        spend: spend.toFixed(2),
      },
      {
        priority: NOTIFICATION_PRIORITY.HIGH,
        data: { campaignId, spend, budget },
        actionUrl: `/campaigns/${campaignId}`,
      }
    );
  }

  // Integration error alerts
  async createIntegrationErrorAlert(
    organizationId: string,
    platform: string,
    error: string
  ): Promise<string> {
    return await this.createNotificationFromTemplate(
      'integration_error',
      organizationId,
      {
        platform,
        error,
      },
      {
        priority: NOTIFICATION_PRIORITY.URGENT,
        data: { platform, error },
        actionUrl: '/integrations',
      }
    );
  }

  // AI insight notifications
  async createAIInsightNotification(
    organizationId: string,
    campaignId: string,
    campaignName: string,
    insight: string
  ): Promise<string> {
    return await this.createNotificationFromTemplate(
      'ai_insight',
      organizationId,
      {
        campaignName,
        insight,
      },
      {
        data: { campaignId, insight },
        actionUrl: `/campaigns/${campaignId}/insights`,
      }
    );
  }

  // System update notifications
  async createSystemUpdateNotification(
    organizationId: string,
    features: string[]
  ): Promise<string> {
    return await this.createNotificationFromTemplate(
      'system_update',
      organizationId,
      {
        features: features.join(', '),
      },
      {
        priority: NOTIFICATION_PRIORITY.LOW,
        data: { features },
        actionUrl: '/changelog',
      }
    );
  }

  // Get notification statistics
  async getNotificationStats(organizationId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
    byPriority: Record<NotificationPriority, number>;
  }> {
    const notifications = await this.getNotifications(organizationId);
    const unread = notifications.filter(n => n.status !== NOTIFICATION_STATUS.READ).length;

    const byType: Record<NotificationType, number> = {} as Record<NotificationType, number>;
    const byPriority: Record<NotificationPriority, number> = {} as Record<NotificationPriority, number>;

    notifications.forEach(notification => {
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      byPriority[notification.priority] = (byPriority[notification.priority] || 0) + 1;
    });

    return {
      total: notifications.length,
      unread,
      byType,
      byPriority,
    };
  }

  // Clean up expired notifications
  async cleanupExpiredNotifications(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;

    for (const [id, notification] of this.notifications) {
      if (notification.metadata.expiresAt && notification.metadata.expiresAt < now) {
        this.notifications.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();

// Utility functions
export const notificationUtils = {
  getPriorityColor(priority: NotificationPriority): string {
    const colors = {
      [NOTIFICATION_PRIORITY.LOW]: 'text-gray-500',
      [NOTIFICATION_PRIORITY.MEDIUM]: 'text-blue-500',
      [NOTIFICATION_PRIORITY.HIGH]: 'text-orange-500',
      [NOTIFICATION_PRIORITY.URGENT]: 'text-red-500',
    };
    return colors[priority] || 'text-gray-500';
  },

  getTypeIcon(type: NotificationType): string {
    const icons = {
      [NOTIFICATION_TYPES.CAMPAIGN_PERFORMANCE]: '📊',
      [NOTIFICATION_TYPES.BUDGET_ALERT]: '💰',
      [NOTIFICATION_TYPES.INTEGRATION_ERROR]: '⚠️',
      [NOTIFICATION_TYPES.AI_INSIGHT]: '🤖',
      [NOTIFICATION_TYPES.SYSTEM_UPDATE]: '🔄',
      [NOTIFICATION_TYPES.USER_ACTIVITY]: '👤',
    };
    return icons[type] || '📢';
  },

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  },
}; 