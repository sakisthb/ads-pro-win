import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Realistic test data generators
const PLATFORMS = ['facebook', 'google', 'tiktok', 'instagram', 'linkedin'];
const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'];
const CAMPAIGN_TYPES = ['awareness', 'traffic', 'engagement', 'conversions', 'catalog_sales', 'store_traffic'];
const AI_AGENT_TYPES = ['campaign_optimizer', 'audience_analyzer', 'creative_generator', 'performance_predictor'];
const WORKFLOW_TYPES = ['automation', 'analysis', 'optimization'];
const ANALYSIS_TYPES = ['performance', 'audience', 'competitive', 'trend'];
const PREDICTION_TYPES = ['performance', 'audience', 'trend', 'budget'];

// Company names for organizations
const COMPANY_NAMES = [
  'TechFlow Marketing', 'Digital Growth Solutions', 'AdVantage Pro', 'Marketing Masters',
  'Creative Campaigns Co', 'Performance Plus Agency', 'Smart Ads Network', 'Brand Boost Studios',
  'Conversion Kings', 'Social Media Experts', 'E-commerce Accelerators', 'Local Business Pro'
];

// Generate realistic names
const FIRST_NAMES = ['Alex', 'Maria', 'John', 'Sofia', 'Michael', 'Elena', 'David', 'Christina', 'Nick', 'Anna'];
const LAST_NAMES = ['Papadopoulos', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez'];

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate realistic campaign performance data
function generateCampaignPerformance() {
  const impressions = randomInt(1000, 100000);
  const clicks = randomInt(Math.floor(impressions * 0.005), Math.floor(impressions * 0.15));
  const conversions = randomInt(0, Math.floor(clicks * 0.05));
  const spend = randomFloat(50, 5000);
  
  return {
    impressions,
    clicks,
    conversions,
    spend,
    ctr: clicks / impressions,
    cpc: spend / clicks,
    conversion_rate: conversions / clicks,
    cost_per_conversion: conversions > 0 ? spend / conversions : 0,
    roas: conversions * randomFloat(20, 150) / spend
  };
}

// Generate realistic audience targeting
function generateTargetAudience() {
  return {
    age_min: randomChoice([18, 21, 25, 30, 35]),
    age_max: randomChoice([35, 45, 55, 65]),
    gender: randomChoice(['all', 'male', 'female']),
    locations: randomChoice([
      ['Greece', 'Cyprus'], 
      ['United States'], 
      ['United Kingdom', 'Ireland'],
      ['Germany', 'Austria'],
      ['Global']
    ]),
    interests: randomChoice([
      ['technology', 'business', 'entrepreneurship'],
      ['fashion', 'beauty', 'lifestyle'],
      ['fitness', 'health', 'wellness'],
      ['travel', 'food', 'entertainment'],
      ['education', 'career', 'professional']
    ]),
    behaviors: randomChoice([
      ['online_shoppers', 'frequent_travelers'],
      ['business_decision_makers', 'small_business_owners'],
      ['mobile_device_users', 'engaged_shoppers']
    ])
  };
}

// Generate ad creatives
function generateAdCreatives() {
  const numCreatives = randomInt(1, 5);
  const creatives = [];
  
  for (let i = 0; i < numCreatives; i++) {
    creatives.push({
      id: `creative_${i + 1}`,
      type: randomChoice(['image', 'video', 'carousel', 'collection']),
      headline: `Amazing ${randomChoice(['Product', 'Service', 'Offer', 'Deal'])} ${randomInt(1, 100)}`,
      description: 'Drive results with our innovative solution. Get started today!',
      call_to_action: randomChoice(['Learn More', 'Shop Now', 'Sign Up', 'Get Quote', 'Contact Us']),
      image_url: `https://picsum.photos/800/600?random=${randomInt(1, 1000)}`,
      performance: {
        impressions: randomInt(500, 50000),
        clicks: randomInt(25, 2500),
        ctr: randomFloat(0.5, 8.0),
        relevance_score: randomFloat(6.0, 10.0)
      }
    });
  }
  
  return creatives;
}

// Generate AI analysis insights
function generateAnalysisInsights() {
  return [
    {
      type: 'performance',
      title: 'Campaign Performance Analysis',
      description: 'Comprehensive analysis of campaign metrics and trends',
      recommendation: 'Increase budget by 20% for top-performing ad sets',
      confidence: randomFloat(0.7, 0.95),
      impact: randomChoice(['low', 'medium', 'high'])
    },
    {
      type: 'audience',
      title: 'Audience Optimization',
      description: 'Analysis of audience segments and engagement patterns',
      recommendation: 'Focus on 25-34 age group with higher conversion rates',
      confidence: randomFloat(0.6, 0.9),
      impact: randomChoice(['medium', 'high'])
    },
    {
      type: 'creative',
      title: 'Creative Performance',
      description: 'Analysis of ad creative performance and engagement',
      recommendation: 'Test new video creatives for better engagement',
      confidence: randomFloat(0.65, 0.88),
      impact: randomChoice(['medium', 'high'])
    }
  ];
}

async function main() {
  console.log('🚀 Starting database seeding with realistic data...');
  
  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await prisma.notification.deleteMany();
  await prisma.optimization.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.aIAgent.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  
  // Create Organizations (5-10 realistic companies)
  console.log('🏢 Creating organizations...');
  const organizations = [];
  for (let i = 0; i < 8; i++) {
    const org = await prisma.organization.create({
      data: {
        name: COMPANY_NAMES[i],
        slug: COMPANY_NAMES[i].toLowerCase().replace(/[^a-z0-9]/g, '-'),
        plan: randomChoice(['free', 'basic', 'professional', 'enterprise']),
        settings: JSON.stringify({
          timezone: 'Europe/Athens',
          currency: 'EUR',
          language: 'en',
          notifications: {
            email: true,
            slack: false,
            webhook: false
          },
          ai_settings: {
            auto_optimization: true,
            predictive_analytics: true,
            automated_reporting: true
          }
        })
      }
    });
    organizations.push(org);
  }
  
  // Create Users (30-50 users across all organizations)
  console.log('👥 Creating users...');
  const users = [];
  for (const org of organizations) {
    const numUsers = randomInt(3, 8);
    for (let i = 0; i < numUsers; i++) {
      const firstName = randomChoice(FIRST_NAMES);
      const lastName = randomChoice(LAST_NAMES);
      const user = await prisma.user.create({
        data: {
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${org.slug}.com`,
          fullName: `${firstName} ${lastName}`,
          avatar: `https://i.pravatar.cc/150?u=${firstName}${lastName}`,
          role: randomChoice(['user', 'manager', 'admin']),
          isActive: Math.random() > 0.1, // 90% active users
          lastLoginAt: randomDate(new Date(2024, 0, 1), new Date()),
          organizationId: org.id
        }
      });
      users.push(user);
    }
  }
  
  // Create MASSIVE amount of Campaigns (12,000+ campaigns for stress testing)
  console.log('🎯 Creating 12,000+ campaigns (this may take a few minutes)...');
  const campaigns = [];
  const batchSize = 500; // Create in batches for better performance
  
  for (let batch = 0; batch < 25; batch++) { // 25 batches × 500 = 12,500 campaigns
    console.log(`📊 Creating batch ${batch + 1}/25 (${batchSize} campaigns)...`);
    const batchCampaigns = [];
    
    for (let i = 0; i < batchSize; i++) {
      const org = randomChoice(organizations);
      const user = users.find(u => u.organizationId === org.id) || users[0];
      const platform = randomChoice(PLATFORMS);
      const status = randomChoice(CAMPAIGN_STATUSES);
      const budget = randomFloat(100, 10000);
      const budgetSpent = status === 'completed' ? budget : randomFloat(0, budget * 0.8);
      const startDate = randomDate(new Date(2023, 0, 1), new Date());
      
      batchCampaigns.push({
        name: `${randomChoice(CAMPAIGN_TYPES)} Campaign #${batch * batchSize + i + 1}`,
        description: `${platform} ${randomChoice(CAMPAIGN_TYPES)} campaign targeting ${randomChoice(['B2B', 'B2C', 'E-commerce', 'Local'])} audience`,
        status,
        platform,
        budget,
        budgetSpent,
        startDate,
        endDate: status === 'completed' ? randomDate(startDate, new Date()) : null,
        targetAudience: JSON.stringify(generateTargetAudience()),
        adCreatives: JSON.stringify(generateAdCreatives()),
        performance: JSON.stringify(generateCampaignPerformance()),
        settings: JSON.stringify({
          bidding_strategy: randomChoice(['lowest_cost', 'cost_cap', 'bid_cap', 'target_cost']),
          optimization_goal: randomChoice(['reach', 'impressions', 'clicks', 'conversions']),
          placement: randomChoice(['automatic', 'manual']),
          schedule: randomChoice(['all_time', 'scheduled'])
        }),
        organizationId: org.id,
        userId: user.id
      });
    }
    
    // Bulk insert batch
    await prisma.campaign.createMany({
      data: batchCampaigns
    });
    
    // Get created campaigns for this batch to create related data
    const createdCampaigns = await prisma.campaign.findMany({
      skip: batch * batchSize,
      take: batchSize,
      orderBy: { createdAt: 'desc' }
    });
    campaigns.push(...createdCampaigns);
  }
  
  console.log(`✅ Created ${campaigns.length} campaigns!`);
  
  // Create AI Agents (100+ agents across all organizations)
  console.log('🤖 Creating AI agents...');
  const aiAgents = [];
  for (const org of organizations) {
    const numAgents = randomInt(12, 20);
    for (let i = 0; i < numAgents; i++) {
      const agentType = randomChoice(AI_AGENT_TYPES);
      const agent = await prisma.aIAgent.create({
        data: {
          name: `${agentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} #${i + 1}`,
          type: agentType,
          status: randomChoice(['active', 'inactive', 'training']),
          configuration: JSON.stringify({
            model: randomChoice(['gpt-4', 'claude-3', 'gemini-pro']),
            temperature: randomFloat(0.1, 0.9),
            max_tokens: randomInt(1000, 4000),
            training_data_size: randomInt(10000, 100000),
            accuracy_threshold: randomFloat(0.8, 0.95)
          }),
          performance: JSON.stringify({
            accuracy: randomFloat(0.75, 0.95),
            processing_time: randomFloat(0.5, 3.0),
            success_rate: randomFloat(0.85, 0.98),
            last_accuracy: randomFloat(0.8, 0.95),
            total_processed: randomInt(1000, 50000)
          }),
          lastRunAt: Math.random() > 0.3 ? randomDate(new Date(2024, 0, 1), new Date()) : null,
          organizationId: org.id,
          campaignId: Math.random() > 0.5 ? randomChoice(campaigns.filter(c => c.organizationId === org.id))?.id : null
        }
      });
      aiAgents.push(agent);
    }
  }
  
  // Create Workflows (200+ workflows)
  console.log('⚙️ Creating workflows...');
  const workflows = [];
  for (const org of organizations) {
    const numWorkflows = randomInt(20, 35);
    for (let i = 0; i < numWorkflows; i++) {
      const workflowType = randomChoice(WORKFLOW_TYPES);
      const workflow = await prisma.workflow.create({
        data: {
          name: `${workflowType.charAt(0).toUpperCase() + workflowType.slice(1)} Workflow #${i + 1}`,
          description: `Automated ${workflowType} workflow for enhanced campaign performance`,
          type: workflowType,
          status: randomChoice(['active', 'inactive', 'error']),
          configuration: JSON.stringify({
            triggers: [randomChoice(['schedule', 'performance_threshold', 'budget_spent', 'conversion_rate'])],
            actions: [randomChoice(['pause_campaign', 'increase_budget', 'send_alert', 'optimize_targeting'])],
            conditions: {
              performance_threshold: randomFloat(0.02, 0.1),
              budget_threshold: randomFloat(0.7, 0.9),
              time_window: randomChoice(['1h', '6h', '24h', '7d'])
            }
          }),
          schedule: JSON.stringify({
            frequency: randomChoice(['hourly', 'daily', 'weekly']),
            time: `${randomInt(0, 23).toString().padStart(2, '0')}:${randomChoice(['00', '15', '30', '45'])}`,
            timezone: 'Europe/Athens'
          }),
          lastRunAt: Math.random() > 0.2 ? randomDate(new Date(2024, 0, 1), new Date()) : null,
          nextRunAt: randomDate(new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          organizationId: org.id,
          campaignId: Math.random() > 0.4 ? randomChoice(campaigns.filter(c => c.organizationId === org.id))?.id : null
        }
      });
      workflows.push(workflow);
    }
  }
  
  // Create Analyses (1000+ analyses)
  console.log('📊 Creating analyses...');
  for (let batch = 0; batch < 5; batch++) {
    console.log(`📈 Creating analysis batch ${batch + 1}/5...`);
    const batchAnalyses = [];
    
    for (let i = 0; i < 200; i++) {
      const org = randomChoice(organizations);
      const analysisType = randomChoice(ANALYSIS_TYPES);
      
      batchAnalyses.push({
        type: analysisType,
        title: `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis #${batch * 200 + i + 1}`,
        description: `Comprehensive ${analysisType} analysis with AI-powered insights`,
        data: JSON.stringify({
          metrics: generateCampaignPerformance(),
          trends: {
            week_over_week: randomFloat(-0.2, 0.3),
            month_over_month: randomFloat(-0.15, 0.25),
            seasonal_impact: randomFloat(-0.1, 0.2)
          },
          segments: {
            age_groups: {
              '18-24': randomFloat(0.1, 0.3),
              '25-34': randomFloat(0.2, 0.4),
              '35-44': randomFloat(0.15, 0.35),
              '45+': randomFloat(0.1, 0.25)
            },
            devices: {
              mobile: randomFloat(0.6, 0.8),
              desktop: randomFloat(0.15, 0.3),
              tablet: randomFloat(0.05, 0.15)
            }
          }
        }),
        insights: JSON.stringify(generateAnalysisInsights()),
        recommendations: JSON.stringify([
          {
            action: 'Optimize targeting parameters',
            impact: randomChoice(['low', 'medium', 'high']),
            effort: randomChoice(['low', 'medium', 'high']),
            priority: randomInt(1, 5)
          },
          {
            action: 'Adjust bid strategy',
            impact: randomChoice(['medium', 'high']),
            effort: randomChoice(['low', 'medium']),
            priority: randomInt(1, 5)
          }
        ]),
        status: randomChoice(['running', 'completed', 'failed']),
        organizationId: org.id,
        campaignId: Math.random() > 0.3 ? randomChoice(campaigns.filter(c => c.organizationId === org.id))?.id : null
      });
    }
    
    await prisma.analysis.createMany({
      data: batchAnalyses
    });
  }
  
  // Create Predictions (500+ predictions)
  console.log('🔮 Creating predictions...');
  const batchPredictions = [];
  for (let i = 0; i < 500; i++) {
    const org = randomChoice(organizations);
    const predictionType = randomChoice(PREDICTION_TYPES);
    
    batchPredictions.push({
      type: predictionType,
      title: `${predictionType.charAt(0).toUpperCase() + predictionType.slice(1)} Prediction #${i + 1}`,
      description: `AI-powered ${predictionType} prediction with machine learning insights`,
      data: JSON.stringify({
        forecast: {
          next_7_days: randomFloat(1000, 10000),
          next_30_days: randomFloat(5000, 50000),
          confidence_interval: [randomFloat(0.1, 0.2), randomFloat(0.8, 0.9)]
        },
        factors: [
          { name: 'Historical performance', weight: randomFloat(0.2, 0.4) },
          { name: 'Seasonal trends', weight: randomFloat(0.1, 0.3) },
          { name: 'Market conditions', weight: randomFloat(0.1, 0.3) },
          { name: 'Competitive landscape', weight: randomFloat(0.05, 0.2) }
        ],
        model_info: {
          algorithm: randomChoice(['random_forest', 'neural_network', 'gradient_boosting']),
          training_data_points: randomInt(10000, 100000),
          feature_count: randomInt(50, 200)
        }
      }),
      confidence: randomFloat(0.65, 0.95),
      accuracy: randomFloat(0.7, 0.92),
      organizationId: org.id,
      campaignId: Math.random() > 0.4 ? randomChoice(campaigns.filter(c => c.organizationId === org.id))?.id : null
    });
  }
  
  await prisma.prediction.createMany({
    data: batchPredictions
  });
  
  console.log('🎉 Database seeding completed successfully!');
  console.log('📊 Summary:');
  console.log(`   🏢 Organizations: ${organizations.length}`);
  console.log(`   👥 Users: ${users.length}`);
  console.log(`   🎯 Campaigns: ${campaigns.length}`);
  console.log(`   🤖 AI Agents: ${aiAgents.length}`);
  console.log(`   ⚙️ Workflows: ${workflows.length}`);
  console.log(`   📊 Analyses: 1000+`);
  console.log(`   🔮 Predictions: 500+`);
  console.log('');
  console.log('🚀 Ready for comprehensive testing with realistic data!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });