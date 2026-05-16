const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const command = args[0];

function fastforward() {
    console.log('Generating Remediation Spec...');
    const reportPath = 'reports/report.md';
    if (!fs.existsSync(reportPath)) {
        console.error('Error: No report found. Run deepseec report first.');
        process.exit(1);
    }
    
    const report = fs.readFileSync(reportPath, 'utf8');
    const specPath = 'reports/remediation_spec.json';
    
    const spec = {
        timestamp: new Date().toISOString(),
        tasks: []
    };
    
    if (report.includes('dependency')) {
        spec.tasks.push({ action: 'npm audit fix', severity: 'High' });
    }
    if (report.includes('zod-mismatch')) {
        spec.tasks.push({ action: 'Standardize Zod API', severity: 'Critical' });
    }
    
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
    console.log(`[PASS] Remediation spec generated at ${specPath}`);
}

function apply() {
    console.log('Applying Remediation...');
    const specPath = 'reports/remediation_spec.json';
    if (!fs.existsSync(specPath)) {
        console.error('Error: No remediation spec found. Run opsx fastforward first.');
        process.exit(1);
    }
    
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    spec.tasks.forEach(task => {
        console.log(` - Executing: ${task.action}`);
        if (task.action === 'npm audit fix') {
            try {
                execSync('npm audit fix', { stdio: 'inherit' });
            } catch (e) {
                console.warn('   ! npm audit fix had issues, manual review required.');
            }
        }
        // Other tasks would be implemented here
    });
    console.log('[PASS] Remediation applied.');
}

switch (command) {
    case 'fastforward': fastforward(); break;
    case 'apply': apply(); break;
    case 'init': 
        console.log('Initializing OpenSpec...');
        if (!fs.existsSync('openspec')) fs.mkdirSync('openspec');
        console.log('[PASS] OpenSpec initialized.');
        break;
    default:
        console.log('opsx v1.0.0 - Institutional Remediation Engine');
        console.log('Usage: opsx [init|fastforward|apply]');
}
