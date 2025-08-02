// E2E Tests for AI Workflow
// Testing complete user journeys with AI features

import { test, expect } from '@playwright/test'

test.describe('AI Workflow End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/')
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')
    
    // Check if auth is required and mock login if needed
    const hasLoginButton = await page.locator('text=Sign In').isVisible()
    if (hasLoginButton) {
      // Mock authentication for testing
      await page.goto('/dashboard?mock_auth=true')
    }
  })

  test('should complete full AI analysis workflow', async ({ page }) => {
    // Navigate to AI demo page
    await page.goto('/ai-demo')
    
    // Wait for AI workspace to load
    await expect(page.locator('[data-testid="ai-workspace"]')).toBeVisible()
    
    // Click on AI Analysis tab
    await page.click('[data-testid="tab-analysis"]')
    
    // Wait for analysis panel to load
    await expect(page.locator('[data-testid="ai-analysis-panel"]')).toBeVisible()
    
    // Check if campaign selector is available
    const campaignSelect = page.locator('[data-testid="campaign-select"]')
    if (await campaignSelect.isVisible()) {
      await campaignSelect.click()
      await page.click('text=Demo Campaign')
    }
    
    // Select analysis type
    await page.click('[data-testid="analysis-type-select"]')
    await page.click('text=Comprehensive Analysis')
    
    // Select AI provider
    await page.click('[data-testid="ai-provider-select"]')
    await page.click('text=OpenAI GPT-4')
    
    // Start analysis
    await page.click('[data-testid="start-analysis-button"]')
    
    // Wait for analysis to start
    await expect(page.locator('text=Analyzing...')).toBeVisible()
    
    // Wait for WebSocket connection
    await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Connected')
    
    // Wait for progress updates (with generous timeout for AI operations)
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible({ timeout: 30000 })
    
    // Wait for analysis completion
    await expect(page.locator('text=Analysis Results')).toBeVisible({ timeout: 60000 })
    
    // Verify results are displayed
    await expect(page.locator('[data-testid="performance-score"]')).toBeVisible()
    await expect(page.locator('[data-testid="confidence-score"]')).toBeVisible()
    await expect(page.locator('[data-testid="recommendations-list"]')).toBeVisible()
    
    // Test export functionality
    await page.click('[data-testid="export-results-button"]')
    
    // Verify download was triggered (check for download event)
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="confirm-export-button"]')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('analysis-results')
  })

  test('should handle real-time WebSocket updates during AI operations', async ({ page }) => {
    await page.goto('/ai-demo')
    
    // Monitor WebSocket messages
    const wsMessages: any[] = []
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        try {
          const message = JSON.parse(event.payload as string)
          wsMessages.push(message)
        } catch (e) {
          // Ignore non-JSON messages
        }
      })
    })
    
    // Start an AI operation
    await page.click('[data-testid="tab-analysis"]')
    await page.click('[data-testid="start-analysis-button"]')
    
    // Wait for WebSocket messages
    await page.waitForFunction(() => 
      document.querySelector('[data-testid="progress-percentage"]')?.textContent !== '0%',
      {},
      { timeout: 30000 }
    )
    
    // Verify progress updates
    const progressText = await page.locator('[data-testid="progress-percentage"]').textContent()
    expect(progressText).toMatch(/\d+%/)
    
    // Check WebSocket messages were received
    await page.waitForTimeout(2000) // Allow time for messages
    expect(wsMessages.length).toBeGreaterThan(0)
    
    // Verify message structure
    const progressMessage = wsMessages.find(msg => msg.type === 'aiProgress')
    if (progressMessage) {
      expect(progressMessage.data).toHaveProperty('progress')
      expect(progressMessage.data).toHaveProperty('stage')
      expect(progressMessage.data).toHaveProperty('sessionId')
    }
  })

  test('should generate creative content successfully', async ({ page }) => {
    await page.goto('/ai-demo')
    
    // Navigate to creative generation
    await page.click('[data-testid="tab-creative"]')
    await expect(page.locator('[data-testid="creative-generation-panel"]')).toBeVisible()
    
    // Configure creative generation
    await page.click('[data-testid="content-type-select"]')
    await page.click('text=Text Content')
    
    await page.click('[data-testid="tone-select"]')
    await page.click('text=Professional')
    
    // Set variant count
    await page.fill('[data-testid="variant-count-input"]', '3')
    
    // Add custom instructions
    await page.fill('[data-testid="custom-instructions"]', 'Focus on highlighting cost-effectiveness and ROI')
    
    // Generate content
    await page.click('[data-testid="generate-creative-button"]')
    
    // Wait for generation to complete
    await expect(page.locator('text=Content Generated')).toBeVisible({ timeout: 60000 })
    
    // Verify generated content
    await expect(page.locator('[data-testid="generated-headlines"]')).toBeVisible()
    await expect(page.locator('[data-testid="generated-descriptions"]')).toBeVisible()
    
    // Check that multiple variants were generated
    const headlines = await page.locator('[data-testid="headline-item"]').count()
    expect(headlines).toBeGreaterThanOrEqual(3)
    
    // Test content approval/rejection
    await page.click('[data-testid="approve-headline-0"]')
    await expect(page.locator('[data-testid="approved-content"]')).toBeVisible()
    
    // Test regeneration for specific items
    await page.click('[data-testid="regenerate-headline-1"]')
    await expect(page.locator('text=Regenerating...')).toBeVisible()
  })

  test('should optimize campaign performance', async ({ page }) => {
    await page.goto('/ai-demo')
    
    // Navigate to optimization
    await page.click('[data-testid="tab-optimization"]')
    await expect(page.locator('[data-testid="optimization-dashboard"]')).toBeVisible()
    
    // Select optimization type
    await page.click('[data-testid="optimization-type-select"]')
    await page.click('text=Performance Optimization')
    
    // Set optimization parameters
    await page.check('[data-testid="optimize-budget"]')
    await page.check('[data-testid="optimize-targeting"]')
    await page.check('[data-testid="optimize-bidding"]')
    
    // Start optimization
    await page.click('[data-testid="start-optimization-button"]')
    
    // Wait for optimization results
    await expect(page.locator('text=Optimization Complete')).toBeVisible({ timeout: 60000 })
    
    // Verify recommendations
    await expect(page.locator('[data-testid="recommendations-list"]')).toBeVisible()
    
    // Check recommendation categories
    const recommendations = await page.locator('[data-testid="recommendation-item"]').count()
    expect(recommendations).toBeGreaterThan(0)
    
    // Test projected impact display
    await expect(page.locator('[data-testid="projected-impact"]')).toBeVisible()
    await expect(page.locator('[data-testid="ctr-improvement"]')).toBeVisible()
    await expect(page.locator('[data-testid="cpc-reduction"]')).toBeVisible()
    
    // Test recommendation application
    await page.click('[data-testid="apply-recommendation-0"]')
    await expect(page.locator('text=Recommendation Applied')).toBeVisible()
  })

  test('should handle error scenarios gracefully', async ({ page }) => {
    await page.goto('/ai-demo')
    
    // Test network error handling
    await page.route('**/api/trpc/ai.analyzeCampaign', route => {
      route.abort('failed')
    })
    
    await page.click('[data-testid="tab-analysis"]')
    await page.click('[data-testid="start-analysis-button"]')
    
    // Should show error message
    await expect(page.locator('text=Analysis Error')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    
    // Test retry functionality
    await page.unroute('**/api/trpc/ai.analyzeCampaign')
    await page.click('[data-testid="retry-button"]')
    
    // Should retry successfully
    await expect(page.locator('text=Analyzing...')).toBeVisible()
  })

  test('should work across different screen sizes', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1366, height: 768 },  // Laptop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 },   // Mobile
    ]
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/ai-demo')
      
      // Check responsive layout
      await expect(page.locator('[data-testid="ai-workspace"]')).toBeVisible()
      
      if (viewport.width < 768) {
        // Mobile: Check if tabs are stacked or in mobile layout
        await expect(page.locator('[data-testid="mobile-tab-menu"]')).toBeVisible()
      } else {
        // Desktop/Tablet: Normal tab layout
        await expect(page.locator('[data-testid="desktop-tabs"]')).toBeVisible()
      }
      
      // Test key functionality works on all screen sizes
      await page.click('[data-testid="tab-analysis"]')
      await expect(page.locator('[data-testid="ai-analysis-panel"]')).toBeVisible()
    }
  })

  test('should maintain session across page refreshes', async ({ page }) => {
    await page.goto('/ai-demo')
    
    // Start an analysis
    await page.click('[data-testid="tab-analysis"]')
    await page.click('[data-testid="start-analysis-button"]')
    
    // Wait for some progress
    await page.waitForFunction(() => 
      document.querySelector('[data-testid="progress-percentage"]')?.textContent !== '0%'
    )
    
    // Refresh the page
    await page.reload()
    
    // Check if session was restored
    await expect(page.locator('[data-testid="ai-workspace"]')).toBeVisible()
    
    // Check if previous operation state is recovered
    const hasActiveOperation = await page.locator('[data-testid="active-operation"]').isVisible()
    if (hasActiveOperation) {
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible()
    }
  })

  test('should handle concurrent AI operations', async ({ page }) => {
    await page.goto('/ai-demo')
    
    // Open multiple tabs for different operations
    const analysisTab = await page.locator('[data-testid="tab-analysis"]')
    const creativeTab = await page.locator('[data-testid="tab-creative"]')
    const optimizationTab = await page.locator('[data-testid="tab-optimization"]')
    
    // Start analysis
    await analysisTab.click()
    await page.click('[data-testid="start-analysis-button"]')
    
    // Switch to creative generation and start
    await creativeTab.click()
    await page.click('[data-testid="generate-creative-button"]')
    
    // Switch to optimization and start
    await optimizationTab.click()
    await page.click('[data-testid="start-optimization-button"]')
    
    // Check that all operations can run concurrently
    await analysisTab.click()
    await expect(page.locator('text=Analyzing...')).toBeVisible()
    
    await creativeTab.click()
    await expect(page.locator('text=Generating...')).toBeVisible()
    
    await optimizationTab.click()
    await expect(page.locator('text=Optimizing...')).toBeVisible()
    
    // Wait for operations to complete
    await expect(page.locator('[data-testid="operation-complete"]')).toBeVisible({ timeout: 120000 })
  })

  test('should export and import AI configurations', async ({ page }) => {
    await page.goto('/ai-demo')
    
    // Configure analysis settings
    await page.click('[data-testid="tab-analysis"]')
    await page.click('[data-testid="analysis-type-select"]')
    await page.click('text=Performance Analysis')
    
    // Export configuration
    await page.click('[data-testid="export-config-button"]')
    
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="confirm-export-config"]')
    const download = await downloadPromise
    
    expect(download.suggestedFilename()).toContain('ai-config')
    
    // Reset configuration
    await page.click('[data-testid="reset-config-button"]')
    await page.click('[data-testid="confirm-reset"]')
    
    // Import configuration
    await page.click('[data-testid="import-config-button"]')
    
    // Create a test config file
    const configData = {
      analysisType: 'performance',
      provider: 'openai',
      settings: { advanced: true }
    }
    
    // Simulate file upload
    await page.setInputFiles('[data-testid="config-file-input"]', {
      name: 'test-config.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(configData))
    })
    
    await page.click('[data-testid="confirm-import"]')
    
    // Verify configuration was imported
    await expect(page.locator('[data-testid="analysis-type-select"]')).toContainText('Performance')
  })
})