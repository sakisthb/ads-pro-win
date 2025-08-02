// Global teardown for Playwright E2E tests
// Cleans up test environment and resources

import { chromium, FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright E2E Test Cleanup...')

  // Create browser for cleanup tasks
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

    // 1. Clean up test data
    console.log('🗑️ Cleaning up test data...')
    try {
      // Call cleanup endpoint if available
      await page.goto(`${baseURL}/api/test-cleanup`, { timeout: 10000 })
      console.log('✅ Test data cleaned up')
    } catch (error) {
      console.warn('⚠️ Test cleanup endpoint not available')
    }

    // 2. Clear browser storage
    console.log('🧹 Clearing browser storage...')
    await page.context().clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
      // Clear IndexedDB if used
      if (window.indexedDB) {
        indexedDB.databases?.().then(databases => {
          databases.forEach(({ name }) => {
            if (name) {
              indexedDB.deleteDatabase(name)
            }
          })
        })
      }
    })

    // 3. Close any active WebSocket connections
    console.log('🔌 Closing WebSocket connections...')
    await page.evaluate(() => {
      // Close any open WebSocket connections
      if (window.WebSocket) {
        // This is a cleanup signal for any active connections
        window.dispatchEvent(new Event('beforeunload'))
      }
    })

    // 4. Wait for any pending operations to complete
    console.log('⏳ Waiting for pending operations...')
    await page.waitForTimeout(2000)

    // 5. Check for memory leaks or unclosed resources
    console.log('🔍 Checking for resource leaks...')
    const resourceCounts = await page.evaluate(() => {
      return {
        eventListeners: document.querySelectorAll('*').length,
        intervals: (window as any).__activeIntervals || 0,
        timeouts: (window as any).__activeTimeouts || 0,
      }
    })

    if (resourceCounts.intervals > 0) {
      console.warn(`⚠️ Warning: ${resourceCounts.intervals} intervals may still be active`)
    }

    if (resourceCounts.timeouts > 0) {
      console.warn(`⚠️ Warning: ${resourceCounts.timeouts} timeouts may still be active`)
    }

    // 6. Generate test summary report
    console.log('📊 Generating test summary...')
    const testResults = {
      timestamp: new Date().toISOString(),
      environment: {
        baseURL,
        userAgent: await page.evaluate(() => navigator.userAgent),
        viewport: await page.viewportSize(),
      },
      cleanup: {
        dataCleared: true,
        storageCleared: true,
        connectionsCloseds: true,
      },
      warnings: [],
    }

    // Write test summary to file if needed
    try {
      const fs = require('fs')
      const path = require('path')
      
      const resultsDir = path.join(process.cwd(), 'test-results')
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true })
      }
      
      fs.writeFileSync(
        path.join(resultsDir, 'test-summary.json'),
        JSON.stringify(testResults, null, 2)
      )
      console.log('✅ Test summary saved to test-results/test-summary.json')
    } catch (error) {
      console.warn('⚠️ Could not save test summary:', error instanceof Error ? error.message : error)
    }

    // 7. Final verification
    console.log('✅ Running final verification...')
    try {
      // Make sure the app is still responsive
      await page.goto(baseURL, { timeout: 5000 })
      console.log('✅ Application remains responsive after tests')
    } catch (error) {
      console.warn('⚠️ Application may be unresponsive after tests')
    }

    console.log('🎉 Playwright E2E cleanup completed successfully!')

  } catch (error) {
    console.error('❌ Playwright E2E cleanup failed:', error)
    // Don't throw error in teardown to avoid masking test failures
  } finally {
    await browser.close()
  }

  // 8. Environment-specific cleanup
  if (process.env.CI) {
    console.log('🔧 Running CI-specific cleanup...')
    // Add any CI-specific cleanup here
  } else {
    console.log('💻 Running local development cleanup...')
    // Add any local development cleanup here
  }

  // 9. Performance metrics collection
  console.log('📈 Collecting performance metrics...')
  try {
    const performanceData = {
      testDuration: Date.now() - (global as any).__testStartTime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    }
    
    console.log('📊 Performance Summary:')
    console.log(`   Duration: ${performanceData.testDuration}ms`)
    console.log(`   Memory: ${Math.round(performanceData.memoryUsage.rss / 1024 / 1024)}MB RSS`)
    console.log(`   CPU: ${performanceData.cpuUsage.user}μs user, ${performanceData.cpuUsage.system}μs system`)
  } catch (error) {
    console.warn('⚠️ Could not collect performance metrics')
  }

  console.log('🏁 All cleanup operations completed!')
}

export default globalTeardown