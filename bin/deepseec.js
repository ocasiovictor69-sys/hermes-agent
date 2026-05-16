const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const command = args[0];

const CONFIG_DIR = '.deepseec';
const REPORT_DIR = 'reports';

function init() {
    console.log('Initializing DeepSeec...');
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR);
    }
    fs.writeFileSync(path.join(CONFIG_DIR, 'config.json'), JSON.stringify({
        version: '1.0.0',
        engine: 'Hermes-Deterministic-Scanner',
        rules: ['audit', 'secrets', 'zod-validation', 'silo-purity']
    }, null, 2));
    if (!fs.existsSync(REPORT_DIR)) {
        fs.mkdirSync(REPORT_DIR);
    }
    console.log('[PASS] .deepseec initialized.');
    console.log('[PASS] report directory ready.');
}

function scan() {
    console.log('Running DeepSeec Scan...');
    const findings = [];

    // 1. Dependency Audit
    try {
        console.log(' - Auditing dependencies...');
        const audit = execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const auditData = JSON.parse(audit);
        findings.push({ type: 'dependency', data: auditData.vulnerabilities });
    } catch (e) {
        // npm audit exits with non-zero if vulnerabilities found
        try {
            const auditData = JSON.parse(e.stdout);
            findings.push({ type: 'dependency', data: auditData.vulnerabilities });
        } catch (parseError) {
            findings.push({ type: 'dependency', error: 'Failed to parse audit output' });
        }
    }

    // 2. Secret Scan (Grepping for keys)
    console.log(' - Scanning for secrets...');
    try {
        const secrets = execSync('grep -rnE "(api_key|secret|password|token)" src/ --exclude-dir=node_modules', { encoding: 'utf8' });
        if (secrets) {
            findings.push({ type: 'secrets', data: secrets.split('\n').filter(l => l.trim()) });
        }
    } catch (e) {
        // No secrets found (grep returns non-zero)
    }

    // 3. Zod API Check (Specific to this portfolio)
    console.log(' - Verifying Zod API standardization...');
    try {
        const zodIssues = execSync('grep -rn ".error.errors" src/', { encoding: 'utf8' });
        if (zodIssues) {
            findings.push({ type: 'zod-mismatch', data: zodIssues.split('\n').filter(l => l.trim()) });
        }
    } catch (e) {}

    fs.writeFileSync(path.join(CONFIG_DIR, 'findings.json'), JSON.stringify(findings, null, 2));
    console.log(`[PASS] Scan complete. ${findings.length} findings logged.`);
}

function processFindings() {
    console.log('Processing Findings...');
    const findingsFile = path.join(CONFIG_DIR, 'findings.json');
    if (!fs.existsSync(findingsFile)) {
        console.error('Error: No findings found. Run scan first.');
        process.exit(1);
    }
    const findings = JSON.parse(fs.readFileSync(findingsFile, 'utf8'));
    const summary = findings.map(f => {
        if (f.type === 'dependency') {
            return `Dependency Vulnerabilities: ${Object.keys(f.data || {}).length}`;
        }
        return `${f.type}: ${f.data ? f.data.length : 0} items`;
    });
    fs.writeFileSync(path.join(CONFIG_DIR, 'processed.json'), JSON.stringify({ summary, findings }, null, 2));
    console.log('[PASS] Processing complete.');
}

function report() {
    console.log('Generating Report...');
    const processedFile = path.join(CONFIG_DIR, 'processed.json');
    if (!fs.existsSync(processedFile)) {
        console.error('Error: No processed findings found. Run process first.');
        process.exit(1);
    }
    const { summary, findings } = JSON.parse(fs.readFileSync(processedFile, 'utf8'));
    
    let md = `# DeepSeec Security Audit Report\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Status:** ${findings.length > 0 ? 'FINDINGS DETECTED' : 'PASS'}\n\n`;
    
    md += `## Summary\n`;
    summary.forEach(s => md += `- ${s}\n`);
    
    md += `\n## Detailed Findings\n`;
    findings.forEach(f => {
        md += `### ${f.type}\n`;
        if (f.type === 'dependency') {
            md += 'Vulnerabilities found in dependencies. Run `npm audit` for details.\n';
        } else if (f.data && Array.isArray(f.data)) {
            f.data.forEach(d => md += `- \`${d}\`\n`);
        } else {
            md += 'No critical issues found.\n';
        }
    });

    const reportPath = path.join(REPORT_DIR, 'report.md');
    fs.writeFileSync(reportPath, md);
    console.log(`[PASS] Report generated at ${reportPath}`);
}

switch (command) {
    case 'init': init(); break;
    case 'scan': scan(); break;
    case 'process': processFindings(); break;
    case 'report': report(); break;
    default:
        console.log('DeepSeec v1.0.0 - Institutional Security Scanner');
        console.log('Usage: deepseec [init|scan|process|report]');
}
