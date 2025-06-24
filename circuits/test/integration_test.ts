import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Auto-discover and run all circuit tests
async function runIntegrationTests() {
    console.log("🚀 Starting integration tests...\n");
    
    const scriptsDir = path.resolve(__dirname, '../scripts');
    const startTime = Date.now();
    
    // Auto-discover test directories (those starting with "test_")
    const testDirs = fs.readdirSync(scriptsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('test_'))
        .map(dirent => dirent.name);
    
    let totalSuites = 0;
    let successfulSuites = 0;
    let totalTestCases = 0;
    
    for (const testDir of testDirs) {
        const suiteName = testDir.replace('test_', '');
        const testPath = path.join(scriptsDir, testDir, `${testDir}.ts`);
        
        if (!fs.existsSync(testPath)) {
            console.log(`⚠️  Skipping ${suiteName} - test file not found`);
            continue;
        }
        
        totalSuites++;
        console.log(`🏃 Running test suite: ${suiteName}`);
        console.log('='.repeat(60));
        
        try {
            // Execute the test file as a child process
            const output = execSync(`npx ts-node ${testPath}`, { 
                cwd: path.dirname(testPath),
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            console.log(output);
            
            // Parse output to count test cases
            const testCaseMatches = output.match(/Test case .* passed!/g);
            const testCaseCount = testCaseMatches ? testCaseMatches.length : 0;
            totalTestCases += testCaseCount;
            
            successfulSuites++;
            console.log(`✅ ${suiteName} suite completed successfully\n`);
            
        } catch (error: any) {
            console.log(`❌ ${suiteName} suite failed`);
            if (error.stdout) {
                console.log(error.stdout.toString());
            }
            if (error.stderr) {
                console.error(error.stderr.toString());
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