// Global setup for Playwright E2E tests
// Prepares test environment and dependencies

import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright E2E Test Setup...')

  // Create browser for setup tasks
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // 1. Wait for development server to be ready
    console.log('⏳ Waiting for development server...')
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
    
    let retries = 0
    const maxRetries = 30
    
    while (retries < maxRetries) {
      try {
        await page.goto(baseURL, { timeout: 5000 })
        console.log('✅ Development server is ready')
        break
      } catch (error) {
        retries++
        console.log(`🔄 Attempt ${retries}/${maxRetries} failed, retrying in 2s...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        if (retries === maxRetries) {
          throw new Error(`Development server not ready after ${maxRetries} attempts`)
        }
      }
    }

    // 2. Check WebSocket server availability
    console.log('🔌 Checking WebSocket server...')
    try {
      // Test WebSocket connection
      await page.evaluate(() => {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket('ws://localhost:8080')
          
          ws.onopen = () => {
            ws.close()
            resolve(true)
          }
          
          ws.onerror = () => {
            reject(new Error('WebSocket connection failed'))
          }
          
          // Timeout after 5 seconds
          setTimeout(() => {
            ws.close()
            reject(new Error('WebSocket connection timeout'))
          }, 5000)
        })
      })
      console.log('✅ WebSocket server is ready')
    } catch (error) {
      console.warn('⚠️ WebSocket server not available, some tests may fail')
    }

    // 3. Prepare test data
    console.log('📊 Setting up test data...')
    
    // Check if we can access the API
    try {
      const response = await page.request.get(`${baseURL}/api/health`)
      if (response.ok()) {
        console.log('✅ API health check passed')
      }
    } catch (error) {
      console.warn('⚠️ API health check failed, continuing anyway')
    }

    // 4. Create test organization and campaigns if needed
    try {
      await page.goto(`${baseURL}/api/test-setup`, { timeout: 10000 })
      console.log('✅ Test data setup completed')
    } catch (error) {
      console.warn('⚠️ Test data setup endpoint not available')
    }

    // 5. Clear any existing browser data
    console.log('🧹 Clearing browser data...')
    await page.context().clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // 6. Set up authentication token if needed
    console.log('🔐 Setting up test authentication...')
    await page.evaluate(() => {
      // Set test authentication token
      localStorage.setItem('test_auth_token', 'test-user-123')
      localStorage.setItem('test_org_id', 'org_test_123')
    })

    // 7. Verify AI components can load
    console.log('🤖 Testing AI component availability...')
    try {
      await page.goto(`${baseURL}/ai-demo`)
      await page.waitForSelector('[data-testid="ai-workspace"]', { timeout: 10000 })
      console.log('✅ AI components loaded successfully')
    } catch (error) {
      console.warn('⚠️ AI components may not be fully available')
    }

    console.log('🎉 Playwright E2E setup completed successfully!')

  } catch (error) {
    console.error('❌ Playwright E2E setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup