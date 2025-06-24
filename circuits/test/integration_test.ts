import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Auto-discover and run all circuit tests
async function runIntegrationTests() {
    console.log("🚀 Starting integration tests...\n");
    
    const scriptsDir = path.resolve(__dirname, '../scripts');
    const startTime = Date.now();
    
    // Auto-discover test directories (those starting with "test_")
    const testDirs = fs.readdirSync(scriptsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('test_'))
        .map(dirent => dirent.name);
    
    // Run all test suites in parallel
    const suitePromises = testDirs.map(async (testDir) => {
        const suiteName = testDir.replace('test_', '');
        const testPath = path.join(scriptsDir, testDir, `${testDir}.ts`);
        
        if (!fs.existsSync(testPath)) {
            return {
                suiteName,
                success: false,
                testCaseCount: 0,
                output: `⚠️  Skipping ${suiteName} - test file not found`,
                error: null
            };
        }
        
        try {
            // Show that test is starting (for parallel visualization)
            console.log(`⚡ Started ${suiteName} test suite...`);
            
            // Execute the test file as a child process (truly async)
            const { stdout, stderr } = await execAsync(`npx ts-node ${testPath}`, { 
                cwd: path.dirname(testPath),
                encoding: 'utf8'
            });
            
            // Parse output to count test cases
            const testCaseMatches = stdout.match(/Test case .* passed!/g);
            const testCaseCount = testCaseMatches ? testCaseMatches.length : 0;
            
            return {
                suiteName,
                success: true,
                testCaseCount,
                output: stdout,
                error: null
            };
            
        } catch (error: any) {
            return {
                suiteName,
                success: false,
                testCaseCount: 0,
                output: error.stdout?.toString() || '',
                error: error.stderr?.toString() || error.message
            };
        }
    });
    
    console.log(`🏃 Running ${testDirs.length} test suites in parallel...\n`);
    
    // Wait for all suites to complete
    const results = await Promise.all(suitePromises);
    
    // Display results in order
    let totalSuites = 0;
    let successfulSuites = 0;
    let totalTestCases = 0;
    
    for (const result of results) {
        if (result.output.includes('Skipping')) {
            console.log(result.output);
            continue;
        }
        
        totalSuites++;
        console.log(`🏃 Running test suite: ${result.suiteName}`);
        console.log('='.repeat(60));
        console.log(result.output);
        
        if (result.success) {
            successfulSuites++;
            totalTestCases += result.testCaseCount;
            console.log(`✅ ${result.suiteName} suite completed successfully\n`);
        } else {
            console.log(`❌ ${result.suiteName} suite failed`);
            if (result.error) {
                console.error(result.error);
            }
            console.log(''); // Add spacing
        }
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Print summary
    console.log("\n📊 Integration Test Results");
    console.log("=".repeat(60));
    console.log("📈 Summary:");
    console.log(`   Test Suites Run: ${totalSuites}`);
    console.log(`   Test Suites Passed: ${successfulSuites}`);
    console.log(`   Test Suites Failed: ${totalSuites - successfulSuites}`);
    console.log(`   Total Test Cases: ${totalTestCases}`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log("=".repeat(60));
    
    if (successfulSuites < totalSuites) {
        console.log("\n❌ Some test suites failed!");
        process.exit(1);
    } else {
        console.log("\n✅ All test suites passed!");
    }
}

// Run integration tests
runIntegrationTests().catch(e => {
    console.error("Integration test runner failed:", e);
    process.exit(1);
});