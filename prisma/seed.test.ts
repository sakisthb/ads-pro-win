import { PrismaClient } from '@prisma/client';

// Initialize Prisma with SQLite for testing
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db'
    }
  }
});

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
  
  return JSON.stringify({
    impressions,
    clicks,
    conversions,
    spend,
    ctr: clicks / impressions,
    cpc: spend / clicks,
    conversion_rate: conversions / clicks,
    cost_per_conversion: conversions > 0 ? spend / conversions : 0,
    roas: conversions * randomFloat(20, 150) / spend
  });
}

// Generate realistic audience targeting
function generateTargetAudience() {
  return JSON.stringify({
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
  });
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
  
  return JSON.stringify(creatives);
}

async function main() {
  console.log('🚀 Starting LOCAL database seeding for END-TO-END TESTING...');
  
  // Clear existing data
  console.log('🧹 Clearing existing test data...');
  try {
    await prisma.notification.deleteMany();
  } catch (e) { console.log('notification table not found, skipping...'); }
  try {
    await prisma.optimization.deleteMany();
  } catch (e) { console.log('optimization table not found, skipping...'); }
  try {
    await prisma.prediction.deleteMany();
  } catch (e) { console.log('prediction table not found, skipping...'); }
  try {
    await prisma.analysis.deleteMany();
  } catch (e) { console.log('analysis table not found, skipping...'); }
  try {
    await prisma.workflow.deleteMany();
  } catch (e) { console.log('workflow table not found, skipping...'); }
  try {
    await prisma.aIAgent.deleteMany();
  } catch (e) { console.log('AIAgent table not found, skipping...'); }
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  
  // Create Organizations (8 realistic companies)
  console.log('🏢 Creating test organizations...');
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
  
  // Create Users (40 users across all organizations)
  console.log('👥 Creating test users...');
  const users = [];
  for (const org of organizations) {
    const numUsers = randomInt(4, 7);
    for (let i = 0; i < numUsers; i++) {
      const firstName = randomChoice(FIRST_NAMES);
      const lastName = randomChoice(LAST_NAMES);
      const user = await prisma.user.create({
        data: {
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i + 1}@${org.slug}.com`,
          fullName: `${firstName} ${lastName}`,
          avatar: `https://i.pravatar.cc/150?u=${firstName}${lastName}${i}`,
          role: randomChoice(['user', 'manager', 'admin']),
          isActive: Math.random() > 0.1, // 90% active users
          lastLoginAt: randomDate(new Date(2024, 0, 1), new Date()),
          organizationId: org.id
        }
      });
      users.push(user);
    }
  }
  
  // Create LOTS of Campaigns (15,000+ for stress testing)
  console.log('🎯 Creating 15,000+ test campaigns (this will take a few minutes)...');
  const campaigns = [];
  const totalCampaigns = 15000;
  const batchSize = 1000;
  const numBatches = Math.ceil(totalCampaigns / batchSize);
  
  for (let batch = 0; batch < numBatches; batch++) {
    const currentBatchSize = Math.min(batchSize, totalCampaigns - (batch * batchSize));
    console.log(`📊 Creating batch ${batch + 1}/${numBatches} (${currentBatchSize} campaigns)...`);
    
    const batchCampaigns = [];
    
    for (let i = 0; i < currentBatchSize; i++) {
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
        targetAudience: generateTargetAudience(),
        adCreatives: generateAdCreatives(),
        performance: generateCampaignPerformance(),
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
    
    // Get created campaigns for this batch
    const createdCampaigns = await prisma.campaign.findMany({
      skip: batch * batchSize,
      take: currentBatchSize,
      orderBy: { createdAt: 'desc' }
    });
    campaigns.push(...createdCampaigns);
  }
  
  console.log(`✅ Created ${campaigns.length} test campaigns!`);
  
  // Create AI Agents (120+ agents)
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
  
  // Create sample data for other models (smaller amounts for testing)
  console.log('⚙️ Creating workflows...');
  for (const org of organizations) {
    const numWorkflows = randomInt(5, 10);
    for (let i = 0; i < numWorkflows; i++) {
      const workflowType = randomChoice(WORKFLOW_TYPES);
      await prisma.workflow.create({
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
    }
  }
  
  console.log('🎉 Local database seeding completed successfully!');
  console.log('📊 TESTING DATA SUMMARY:');
  console.log(`   🏢 Organizations: ${organizations.length}`);
  console.log(`   👥 Users: ${users.length}`);
  console.log(`   🎯 Campaigns: ${campaigns.length}`);
  console.log(`   🤖 AI Agents: ${aiAgents.length}`);
  console.log('');
  console.log('🚀 LOCAL END-TO-END TESTING DATABASE READY!');
  console.log('📝 You can now test with realistic data volumes and scenarios.');
}

main()
  .catch((e) => {
    console.error('❌ Error during local seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });