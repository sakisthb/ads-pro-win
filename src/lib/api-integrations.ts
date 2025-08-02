// import { z } from 'zod';

// API Response Types
interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget_amount?: number;
  daily_budget_currency?: string;
  daily_budget_type?: string;
  targeting?: {
    age_range?: number[];
    genders?: string[];
    geo_locations?: string[];
    interests?: string[];
    behaviors?: string[];
  };
  created_time?: string;
  updated_time?: string;
}

interface GoogleCampaign {
  campaign: {
    id: string;
    name: string;
    status: string;
    advertising_channel_type?: string;
    budget_amount_micros?: number;
    start_date?: string;
  };
}

// Platform Configuration Types
export const PLATFORMS = {
  FACEBOOK: 'facebook',
  GOOGLE: 'google',
  TIKTOK: 'tiktok',
  LINKEDIN: 'linkedin',
  INSTAGRAM: 'instagram',
  TWITTER: 'twitter',
  SNAPCHAT: 'snapchat',
  PINTEREST: 'pinterest',
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

// Integration Status
export const INTEGRATION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  PENDING: 'pending',
  REFRESHING: 'refreshing',
} as const;

export type IntegrationStatus = typeof INTEGRATION_STATUS[keyof typeof INTEGRATION_STATUS];

// API Integration Interface
export interface APIIntegration {
  id: string;
  organizationId: string;
  platform: Platform;
  status: IntegrationStatus;
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    accountId?: string;
    accountName?: string;
  };
  settings: {
    autoSync: boolean;
    syncInterval: number; // minutes
    webhookUrl?: string;
    notifications: boolean;
  };
  metadata: {
    lastSync?: Date;
    lastError?: string;
    syncCount: number;
    dataPoints: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Campaign Data Interface
export interface CampaignData {
  id: string;
  platformId: string;
  platform: Platform;
  name: string;
  status: string;
  objective: string;
  budget: {
    amount: number;
    currency: string;
    type: string;
  };
  targeting: {
    age: string[];
    gender: string[];
    locations: string[];
    interests: string[];
    behaviors: string[];
  };
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Platform-specific API clients
export abstract class PlatformAPIClient {
  protected platform: Platform;
  protected credentials: APIIntegration['credentials'];

  constructor(platform: Platform, credentials: APIIntegration['credentials']) {
    this.platform = platform;
    this.credentials = credentials;
  }

  abstract authenticate(): Promise<boolean>;
  abstract getCampaigns(): Promise<CampaignData[]>;
  abstract getCampaignMetrics(campaignId: string): Promise<CampaignData['metrics']>;
  abstract updateCampaign(campaignId: string, updates: Partial<CampaignData>): Promise<boolean>;
  abstract createCampaign(campaign: Omit<CampaignData, 'id' | 'platformId' | 'createdAt' | 'updatedAt'>): Promise<string>;
  abstract deleteCampaign(campaignId: string): Promise<boolean>;
  abstract getAccountInfo(): Promise<{ accountId: string; accountName: string }>;
  abstract refreshToken(): Promise<boolean>;

  // Public getter for credentials
  public getCredentials(): APIIntegration['credentials'] {
    return this.credentials;
  }
}

// Facebook API Client
export class FacebookAPIClient extends PlatformAPIClient {
  constructor(credentials: APIIntegration['credentials']) {
    super(PLATFORMS.FACEBOOK, credentials);
  }

  async authenticate(): Promise<boolean> {
    try {
      // Facebook API authentication logic
      const response = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${this.credentials.accessToken}`);
      return response.ok;
    } catch (error) {
      console.error('Facebook authentication failed:', error);
      return false;
    }
  }

  async getCampaigns(): Promise<CampaignData[]> {
    try {
      // Facebook API call to get campaigns
      const response = await fetch(
        `https://graph.facebook.com/v18.0/act_${this.credentials.accountId}/campaigns?access_token=${this.credentials.accessToken}`
      );
      const data = await response.json();
      
             return data.data.map((campaign: FacebookCampaign) => ({
        id: campaign.id,
        platformId: campaign.id,
        platform: PLATFORMS.FACEBOOK,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        budget: {
          amount: campaign.daily_budget_amount || 0,
          currency: campaign.daily_budget_currency || 'USD',
          type: campaign.daily_budget_type || 'daily',
        },
        targeting: {
          age: campaign.targeting?.age_range || [],
          gender: campaign.targeting?.genders || [],
          locations: campaign.targeting?.geo_locations || [],
          interests: campaign.targeting?.interests || [],
          behaviors: campaign.targeting?.behaviors || [],
        },
        metrics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          revenue: 0,
          ctr: 0,
          cpc: 0,
          cpa: 0,
          roas: 0,
        },
        createdAt: campaign.created_time ? new Date(campaign.created_time) : new Date(),
        updatedAt: campaign.updated_time ? new Date(campaign.updated_time) : new Date(),
      }));
    } catch (error) {
      console.error('Failed to fetch Facebook campaigns:', error);
      return [];
    }
  }

  async getCampaignMetrics(campaignId: string): Promise<CampaignData['metrics']> {
    try {
      // Facebook API call to get campaign insights
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${campaignId}/insights?access_token=${this.credentials.accessToken}&fields=impressions,clicks,spend,actions`
      );
      const data = await response.json();
      
             const insights = data.data[0] || {};
       const conversions = insights.actions?.find((action: unknown) => (action as { action_type: string }).action_type === 'purchase')?.value || 0;
      
      return {
        impressions: insights.impressions || 0,
        clicks: insights.clicks || 0,
        conversions: parseInt(conversions),
        spend: insights.spend || 0,
        revenue: 0, // Would need to be calculated based on conversion value
        ctr: insights.clicks && insights.impressions ? (insights.clicks / insights.impressions) * 100 : 0,
        cpc: insights.clicks && insights.spend ? insights.spend / insights.clicks : 0,
        cpa: insights.spend && conversions ? insights.spend / conversions : 0,
        roas: 0, // Would need revenue data
      };
    } catch (error) {
      console.error('Failed to fetch Facebook campaign metrics:', error);
      return {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0,
      };
    }
  }

  async updateCampaign(campaignId: string, updates: Partial<CampaignData>): Promise<boolean> {
    try {
      // Facebook API call to update campaign
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${campaignId}?access_token=${this.credentials.accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Failed to update Facebook campaign:', error);
      return false;
    }
  }

  async createCampaign(campaign: Omit<CampaignData, 'id' | 'platformId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Facebook API call to create campaign
      const response = await fetch(
        `https://graph.facebook.com/v18.0/act_${this.credentials.accountId}/campaigns?access_token=${this.credentials.accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            daily_budget_amount: campaign.budget.amount,
            daily_budget_currency: campaign.budget.currency,
          }),
        }
      );
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Failed to create Facebook campaign:', error);
      throw error;
    }
  }

  async deleteCampaign(campaignId: string): Promise<boolean> {
    try {
      // Facebook API call to delete campaign
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${campaignId}?access_token=${this.credentials.accessToken}`,
        { method: 'DELETE' }
      );
      return response.ok;
    } catch (error) {
      console.error('Failed to delete Facebook campaign:', error);
      return false;
    }
  }

  async getAccountInfo(): Promise<{ accountId: string; accountName: string }> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/act_${this.credentials.accountId}?access_token=${this.credentials.accessToken}&fields=name`
      );
      const data = await response.json();
      return {
        accountId: this.credentials.accountId || '',
        accountName: data.name || '',
      };
    } catch (error) {
      console.error('Failed to get Facebook account info:', error);
      return {
        accountId: this.credentials.accountId || '',
        accountName: '',
      };
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      // Facebook token refresh logic
      const response = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${this.credentials.accessToken}`
      );
      const data = await response.json();
      
      if (data.access_token) {
        this.credentials.accessToken = data.access_token;
        this.credentials.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to refresh Facebook token:', error);
      return false;
    }
  }
}

// Google Ads API Client
export class GoogleAdsAPIClient extends PlatformAPIClient {
  constructor(credentials: APIIntegration['credentials']) {
    super(PLATFORMS.GOOGLE, credentials);
  }

  async authenticate(): Promise<boolean> {
    try {
      // Google Ads API authentication logic
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${this.credentials.accountId}/googleAds:searchStream`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Google Ads authentication failed:', error);
      return false;
    }
  }

  async getCampaigns(): Promise<CampaignData[]> {
    try {
      // Google Ads API call to get campaigns
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${this.credentials.accountId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              SELECT 
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                campaign.budget_amount_micros,
                campaign.start_date,
                campaign.end_date
              FROM campaign
              WHERE campaign.status != 'REMOVED'
            `,
          }),
        }
      );
      
      const data = await response.json();
      
             return data.results?.map((campaign: GoogleCampaign) => ({
        id: campaign.campaign.id,
        platformId: campaign.campaign.id,
        platform: PLATFORMS.GOOGLE,
        name: campaign.campaign.name,
        status: campaign.campaign.status,
        objective: campaign.campaign.advertising_channel_type,
        budget: {
          amount: (campaign.campaign.budget_amount_micros || 0) / 1000000,
          currency: 'USD',
          type: 'daily',
        },
        targeting: {
          age: [],
          gender: [],
          locations: [],
          interests: [],
          behaviors: [],
        },
        metrics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          revenue: 0,
          ctr: 0,
          cpc: 0,
          cpa: 0,
          roas: 0,
        },
        createdAt: campaign.campaign.start_date ? new Date(campaign.campaign.start_date) : new Date(),
        updatedAt: new Date(),
      })) || [];
    } catch (error) {
      console.error('Failed to fetch Google Ads campaigns:', error);
      return [];
    }
  }

  async getCampaignMetrics(campaignId: string): Promise<CampaignData['metrics']> {
    try {
      // Google Ads API call to get campaign metrics
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${this.credentials.accountId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              SELECT 
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.cost_micros,
                metrics.conversions_value
              FROM campaign
              WHERE campaign.id = ${campaignId}
            `,
          }),
        }
      );
      
      const data = await response.json();
      const metrics = data.results?.[0]?.metrics || {};
      
      return {
        impressions: metrics.impressions || 0,
        clicks: metrics.clicks || 0,
        conversions: metrics.conversions || 0,
        spend: metrics.cost_micros / 1000000 || 0,
        revenue: metrics.conversions_value || 0,
        ctr: metrics.clicks && metrics.impressions ? (metrics.clicks / metrics.impressions) * 100 : 0,
        cpc: metrics.clicks && metrics.cost_micros ? (metrics.cost_micros / 1000000) / metrics.clicks : 0,
        cpa: metrics.conversions && metrics.cost_micros ? (metrics.cost_micros / 1000000) / metrics.conversions : 0,
        roas: metrics.conversions_value && metrics.cost_micros ? metrics.conversions_value / (metrics.cost_micros / 1000000) : 0,
      };
    } catch (error) {
      console.error('Failed to fetch Google Ads campaign metrics:', error);
      return {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0,
      };
    }
  }

  async updateCampaign(campaignId: string, updates: Partial<CampaignData>): Promise<boolean> {
    try {
      // Google Ads API call to update campaign
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${this.credentials.accountId}/campaigns:mutate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operations: [{
              update: {
                resource_name: `customers/${this.credentials.accountId}/campaigns/${campaignId}`,
                ...updates,
              },
            }],
          }),
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Failed to update Google Ads campaign:', error);
      return false;
    }
  }

  async createCampaign(campaign: Omit<CampaignData, 'id' | 'platformId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Google Ads API call to create campaign
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${this.credentials.accountId}/campaigns:mutate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operations: [{
              create: {
                campaign: {
                  name: campaign.name,
                  status: campaign.status,
                  advertising_channel_type: campaign.objective,
                  budget_amount_micros: campaign.budget.amount * 1000000,
                },
              },
            }],
          }),
        }
      );
      
      const data = await response.json();
      return data.results?.[0]?.resource_name?.split('/').pop() || '';
    } catch (error) {
      console.error('Failed to create Google Ads campaign:', error);
      throw error;
    }
  }

  async deleteCampaign(campaignId: string): Promise<boolean> {
    try {
      // Google Ads API call to delete campaign
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${this.credentials.accountId}/campaigns:mutate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operations: [{
              remove: `customers/${this.credentials.accountId}/campaigns/${campaignId}`,
            }],
          }),
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Failed to delete Google Ads campaign:', error);
      return false;
    }
  }

  async getAccountInfo(): Promise<{ accountId: string; accountName: string }> {
    try {
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${this.credentials.accountId}?access_token=${this.credentials.accessToken}`,
        {
          headers: {
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
        }
      );
      const data = await response.json();
      return {
        accountId: this.credentials.accountId || '',
        accountName: data.descriptive_name || '',
      };
    } catch (error) {
      console.error('Failed to get Google Ads account info:', error);
      return {
        accountId: this.credentials.accountId || '',
        accountName: '',
      };
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      // Google OAuth token refresh logic
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: this.credentials.refreshToken || '',
        }),
      });
      
      const data = await response.json();
      
      if (data.access_token) {
        this.credentials.accessToken = data.access_token;
        this.credentials.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to refresh Google token:', error);
      return false;
    }
  }
}

// API Integration Manager
export class APIIntegrationManager {
  private integrations: Map<string, APIIntegration> = new Map();
  private clients: Map<string, PlatformAPIClient> = new Map();

  constructor() {
    this.loadIntegrations();
  }

  private loadIntegrations() {
    // In a real app, this would load from database
    const mockIntegrations: APIIntegration[] = [
      {
        id: 'integration_1',
        organizationId: 'org_1',
        platform: PLATFORMS.FACEBOOK,
        status: INTEGRATION_STATUS.CONNECTED,
        credentials: {
          accessToken: 'mock_facebook_token',
          accountId: '123456789',
          accountName: 'Test Facebook Account',
        },
        settings: {
          autoSync: true,
          syncInterval: 30,
          notifications: true,
        },
        metadata: {
          lastSync: new Date(),
          syncCount: 150,
          dataPoints: 5000,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'integration_2',
        organizationId: 'org_1',
        platform: PLATFORMS.GOOGLE,
        status: INTEGRATION_STATUS.CONNECTED,
        credentials: {
          accessToken: 'mock_google_token',
          accountId: '987654321',
          accountName: 'Test Google Ads Account',
        },
        settings: {
          autoSync: true,
          syncInterval: 30,
          notifications: true,
        },
        metadata: {
          lastSync: new Date(),
          syncCount: 120,
          dataPoints: 3500,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockIntegrations.forEach(integration => {
      this.integrations.set(integration.id, integration);
      this.createClient(integration);
    });
  }

  private createClient(integration: APIIntegration): PlatformAPIClient | null {
    try {
      let client: PlatformAPIClient;

      switch (integration.platform) {
        case PLATFORMS.FACEBOOK:
          client = new FacebookAPIClient(integration.credentials);
          break;
        case PLATFORMS.GOOGLE:
          client = new GoogleAdsAPIClient(integration.credentials);
          break;
        default:
          console.error(`Unsupported platform: ${integration.platform}`);
          return null;
      }

      this.clients.set(integration.id, client);
      return client;
    } catch (error) {
      console.error(`Failed to create client for ${integration.platform}:`, error);
      return null;
    }
  }

  async getIntegrations(organizationId: string): Promise<APIIntegration[]> {
    return Array.from(this.integrations.values()).filter(
      integration => integration.organizationId === organizationId
    );
  }

  async getIntegration(integrationId: string): Promise<APIIntegration | null> {
    return this.integrations.get(integrationId) || null;
  }

  async createIntegration(integration: Omit<APIIntegration, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const newIntegration: APIIntegration = {
      ...integration,
      id: `integration_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.integrations.set(newIntegration.id, newIntegration);
    this.createClient(newIntegration);

    return newIntegration.id;
  }

  async updateIntegration(integrationId: string, updates: Partial<APIIntegration>): Promise<boolean> {
    const integration = this.integrations.get(integrationId);
    if (!integration) return false;

    const updatedIntegration = {
      ...integration,
      ...updates,
      updatedAt: new Date(),
    };

    this.integrations.set(integrationId, updatedIntegration);
    this.createClient(updatedIntegration);

    return true;
  }

  async deleteIntegration(integrationId: string): Promise<boolean> {
    const deleted = this.integrations.delete(integrationId);
    this.clients.delete(integrationId);
    return deleted;
  }

  async syncCampaigns(integrationId: string): Promise<CampaignData[]> {
    const integration = this.integrations.get(integrationId);
    const client = this.clients.get(integrationId);

    if (!integration || !client) {
      throw new Error('Integration or client not found');
    }

    try {
      // Update integration status
      await this.updateIntegration(integrationId, { status: INTEGRATION_STATUS.REFRESHING });

      // Authenticate and get campaigns
      const isAuthenticated = await client.authenticate();
      if (!isAuthenticated) {
        await this.updateIntegration(integrationId, { status: INTEGRATION_STATUS.ERROR });
        throw new Error('Authentication failed');
      }

      const campaigns = await client.getCampaigns();

      // Update integration metadata
      await this.updateIntegration(integrationId, {
        status: INTEGRATION_STATUS.CONNECTED,
        metadata: {
          ...integration.metadata,
          lastSync: new Date(),
          syncCount: integration.metadata.syncCount + 1,
          dataPoints: integration.metadata.dataPoints + campaigns.length,
        },
      });

      return campaigns;
    } catch (error) {
      await this.updateIntegration(integrationId, {
        status: INTEGRATION_STATUS.ERROR,
        metadata: {
          ...integration.metadata,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async getCampaignMetrics(integrationId: string, campaignId: string): Promise<CampaignData['metrics']> {
    const client = this.clients.get(integrationId);
    if (!client) {
      throw new Error('Client not found');
    }

    return await client.getCampaignMetrics(campaignId);
  }

  async updateCampaign(integrationId: string, campaignId: string, updates: Partial<CampaignData>): Promise<boolean> {
    const client = this.clients.get(integrationId);
    if (!client) {
      throw new Error('Client not found');
    }

    return await client.updateCampaign(campaignId, updates);
  }

  async createCampaign(integrationId: string, campaign: Omit<CampaignData, 'id' | 'platformId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const client = this.clients.get(integrationId);
    if (!client) {
      throw new Error('Client not found');
    }

    return await client.createCampaign(campaign);
  }

  async deleteCampaign(integrationId: string, campaignId: string): Promise<boolean> {
    const client = this.clients.get(integrationId);
    if (!client) {
      throw new Error('Client not found');
    }

    return await client.deleteCampaign(campaignId);
  }

  async refreshToken(integrationId: string): Promise<boolean> {
    const client = this.clients.get(integrationId);
    if (!client) {
      throw new Error('Client not found');
    }

    const success = await client.refreshToken();
    
    if (success) {
      const integration = this.integrations.get(integrationId);
      if (integration) {
        await this.updateIntegration(integrationId, {
          credentials: {
            ...integration.credentials,
            accessToken: client.getCredentials().accessToken,
            expiresAt: client.getCredentials().expiresAt,
          },
        });
      }
    }

    return success;
  }

  getIntegrationStatus(integrationId: string): IntegrationStatus | null {
    const integration = this.integrations.get(integrationId);
    return integration?.status || null;
  }

  getIntegrationsByPlatform(organizationId: string, platform: Platform): APIIntegration[] {
    return Array.from(this.integrations.values()).filter(
      integration => integration.organizationId === organizationId && integration.platform === platform
    );
  }
}

// Export singleton instance
export const apiIntegrationManager = new APIIntegrationManager();

// Utility functions
export const integrationUtils = {
  getPlatformDisplayName(platform: Platform): string {
    const names = {
      [PLATFORMS.FACEBOOK]: 'Facebook Ads',
      [PLATFORMS.GOOGLE]: 'Google Ads',
      [PLATFORMS.TIKTOK]: 'TikTok Ads',
      [PLATFORMS.LINKEDIN]: 'LinkedIn Ads',
      [PLATFORMS.INSTAGRAM]: 'Instagram Ads',
      [PLATFORMS.TWITTER]: 'Twitter Ads',
      [PLATFORMS.SNAPCHAT]: 'Snapchat Ads',
      [PLATFORMS.PINTEREST]: 'Pinterest Ads',
    };
    return names[platform] || platform;
  },

  getStatusColor(status: IntegrationStatus): string {
    const colors = {
      [INTEGRATION_STATUS.CONNECTED]: 'text-green-500',
      [INTEGRATION_STATUS.DISCONNECTED]: 'text-gray-500',
      [INTEGRATION_STATUS.ERROR]: 'text-red-500',
      [INTEGRATION_STATUS.PENDING]: 'text-yellow-500',
      [INTEGRATION_STATUS.REFRESHING]: 'text-blue-500',
    };
    return colors[status] || 'text-gray-500';
  },

  validateCredentials(platform: Platform, credentials: APIIntegration['credentials']): boolean {
    const requiredFields = {
      [PLATFORMS.FACEBOOK]: ['accessToken', 'accountId'],
      [PLATFORMS.GOOGLE]: ['accessToken', 'accountId'],
      [PLATFORMS.TIKTOK]: ['accessToken', 'accountId'],
      [PLATFORMS.LINKEDIN]: ['accessToken', 'accountId'],
      [PLATFORMS.INSTAGRAM]: ['accessToken', 'accountId'],
      [PLATFORMS.TWITTER]: ['accessToken', 'accountId'],
      [PLATFORMS.SNAPCHAT]: ['accessToken', 'accountId'],
      [PLATFORMS.PINTEREST]: ['accessToken', 'accountId'],
    };

    const fields = requiredFields[platform] || [];
    return fields.every(field => credentials && credentials[field as keyof typeof credentials]);
  },
}; 