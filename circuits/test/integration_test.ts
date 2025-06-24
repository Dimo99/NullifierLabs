import { CircuitTestRunner, CircuitTestConfig } from '../scripts/circuit-test-runner';
import * as path from 'path';
import * as fs from 'fs';

interface TestSuiteResult {
    suiteName: string;
    testCases: number;
    passed: number;
    failed: number;
    duration: number;
    errors: { caseName: string; error: string }[];
}

class IntegrationTestRunner {
    private results: TestSuiteResult[] = [];
    private startTime: number = 0;

    async runTestSuite(suiteName: string, scriptPath: string): Promise<void> {
        console.log(`\n🏃 Running test suite: ${suiteName}`);
        console.log('='.repeat(60));
        
        const suiteStart = Date.now();
        const errors: { caseName: string; error: string }[] = [];
        let passed = 0;
        let failed = 0;
        
        try {
            // Import the test module dynamically
            const testModule = require(scriptPath);
            
            // Get the config from the module (if exported) or run the test
            let configPromise: Promise<CircuitTestConfig>;
            
            if (testModule.getConfig) {
                // If the module exports a getConfig function
                configPromise = testModule.getConfig();
            } else {
                // Otherwise, capture the config by mocking CircuitTestRunner
                configPromise = new Promise((resolve, reject) => {
                    const originalRunTests = CircuitTestRunner.prototype.runTests;
                    CircuitTestRunner.prototype.runTests = async function(config: CircuitTestConfig) {
                        resolve(config);
                        // Restore original method
                        CircuitTestRunner.prototype.runTests = originalRunTests;
                        // Actually run the tests
                        return originalRunTests.call(this, config);
                    };
                    
                    // Run the module's main function if it exists
                    if (testModule.main) {
                        testModule.main().catch(reject);
                    } else {
                        // The module should run automatically when imported
                        setTimeout(() => reject(new Error('No config captured')), 100);
                    }
                });
            }
            
            const config = await configPromise;
            
            // Run the actual tests using CircuitTestRunner
            const runner = new CircuitTestRunner(path.dirname(scriptPath));
            
            // Track results for each test case
            for (let i = 0; i < config.testCases.length; i++) {
                const testCase = config.testCases[i];
                try {
                    // Create a temporary runner to test individual cases
                    const singleCaseConfig: CircuitTestConfig = {
                        circuitName: config.circuitName,
                        outputDir: config.outputDir,
                        testCases: [testCase]
                    };
                    
                    await runner.runTests(singleCaseConfig);
                    passed++;
                } catch (error) {
                    failed++;
                    errors.push({
                        caseName: testCase.name,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
            
            this.results.push({
                suiteName,
                testCases: config.testCases.length,
                passed,
                failed,
                duration: Date.now() - suiteStart,
                errors
            });
            
        } catch (error) {
            // If we couldn't even load the test suite
            this.results.push({
                suiteName,
                testCases: 0,
                passed: 0,
                failed: 1,
                duration: Date.now() - suiteStart,
                errors: [{
                    caseName: 'Suite Loading',
                    error: error instanceof Error ? error.message : String(error)
                }]
            });
        }
    }

    async runAllTests(): Promise<void> {
        this.startTime = Date.now();
        console.log("🚀 Starting integration tests...\n");

        // Define test suites
        const testSuites = [
            {
                name: 'Nullifier Circuit',
                path: path.resolve(__dirname, '../scripts/test_nullifier/test_nullifier.ts')
            },
            {
                name: 'Note Commitment Circuit',
                path: path.resolve(__dirname, '../scripts/test_note_commitment/test_note_commitment.ts')
            },
            {
                name: 'Withdraw Circuit',
                path: path.resolve(__dirname, '../scripts/test_withdraw/test_withdraw.ts')
            },
            {
                name: 'Merkle Proof Circuit',
                path: path.resolve(__dirname, '../scripts/test_merkle_proof/test_merkle_proof.ts')
            }
        ];

        // Run each test suite
        for (const suite of testSuites) {
            if (fs.existsSync(suite.path)) {
                await this.runTestSuite(suite.name, suite.path);
            } else {
                console.log(`⚠️  Skipping ${suite.name} - test file not found at ${suite.path}`);
            }
        }

        this.printResults();
    }

    private printResults(): void {
        const totalDuration = Date.now() - this.startTime;
        
        console.log("\n\n📊 Integration Test Results");
        console.log("=".repeat(60));
        
        let totalSuites = 0;
        let totalTestCases = 0;
        let totalPassed = 0;
        let totalFailed = 0;

        // Print details for each suite
        for (const result of this.results) {
            totalSuites++;
            totalTestCases += result.testCases;
            totalPassed += result.passed;
            totalFailed += result.failed;
            
            const status = result.failed === 0 ? "✅" : "❌";
            console.log(`\n${status} ${result.suiteName}`);
            console.log(`   Test cases: ${result.testCases}`);
            console.log(`   Passed: ${result.passed}`);
            console.log(`   Failed: ${result.failed}`);
            console.log(`   Duration: ${result.duration}ms`);
            
            // Print errors if any
            if (result.errors.length > 0) {
                console.log(`   Errors:`);
                for (const error of result.errors) {
                    console.log(`     - ${error.caseName}: ${error.error}`);
                }
            }
        }

        // Print summary
        console.log("\n" + "=".repeat(60));
        console.log("📈 Summary:");
        console.log(`   Test Suites: ${totalSuites}`);
        console.log(`   Test Cases: ${totalTestCases}`);
        console.log(`   Passed: ${totalPassed}`);
        console.log(`   Failed: ${totalFailed}`);
        console.log(`   Total Duration: ${totalDuration}ms`);
        console.log("=".repeat(60));

        // Exit with error code if any tests failed
        if (totalFailed > 0) {
            console.log("\n❌ Some tests failed!");
            process.exit(1);
        } else {
            console.log("\n✅ All tests passed!");
        }
    }
}

// Simple approach: directly run the test files
async function runIntegrationTests() {
    console.log("🚀 Starting integration tests...\n");
    
    const testFiles = [
        '../scripts/test_nullifier/test_nullifier.ts',
        '../scripts/test_note_commitment/test_note_commitment.ts', 
        '../scripts/test_withdraw/test_withdraw.ts',
        '../scripts/test_merkle_proof/test_merkle_proof.ts'
    ];
    
    let totalSuites = 0;
    let totalTestCases = 0;
    let successfulSuites = 0;
    const startTime = Date.now();
    
    for (const testFile of testFiles) {
        const testPath = path.resolve(__dirname, testFile);
        const suiteName = path.basename(path.dirname(testFile));
        
        if (!fs.existsSync(testPath)) {
            console.log(`⚠️  Skipping ${suiteName} - test file not found`);
            continue;
        }
        
        totalSuites++;
        console.log(`\n🏃 Running test suite: ${suiteName}`);
        console.log('='.repeat(60));
        
        try {
            // Execute the test file as a child process to avoid module caching issues
            const { execSync } = require('child_process');
            const output = execSync(`npx ts-node ${testPath}`, { 
                cwd: path.dirname(testPath),
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            console.log(output);
            
            // Parse output to count test cases
            const testCaseMatches = output.match(/Test Case \d+:/g);
            const testCaseCount = testCaseMatches ? testCaseMatches.length : 0;
            totalTestCases += testCaseCount;
            
            successfulSuites++;
            console.log(`✅ ${suiteName} suite completed successfully`);
            
        } catch (error: any) {
            console.log(`❌ ${suiteName} suite failed`);
            if (error.stdout) {
                console.log(error.stdout.toString());
            }
            if (error.stderr) {
                console.error(error.stderr.toString());
            }
        }
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Print summary
    console.log("\n\n📊 Integration Test Results");
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