#!/usr/bin/env node

/**
 * Bundle analysis script for performance optimization
 * Provides detailed bundle size analysis and optimization recommendations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const srcDir = path.join(projectRoot, 'src');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function analyzeFile(filePath) {
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  return {
    path: filePath,
    size: stats.size,
    lines: content.split('\n').length,
    characters: content.length,
    // Estimate gzipped size (rough approximation)
    estimatedGzipped: Math.floor(stats.size * 0.3) // Typical compression ratio
  };
}

function analyzeSourceFiles() {
  const results = [];

  function walkDirectory(dir) {
    const entries = fs.readdirSync(dir);

    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        walkDirectory(fullPath);
      } else if (entry.endsWith('.jsx') || entry.endsWith('.js')) {
        results.push(analyzeFile(fullPath));
      }
    });
  }

  if (fs.existsSync(srcDir)) {
    walkDirectory(srcDir);
  }

  return results.sort((a, b) => b.size - a.size);
}

function analyzeBuildFiles() {
  if (!fs.existsSync(distDir)) {
    console.log(
      `${colors.yellow}⚠️  Build directory not found. Run 'npm run build' first.${colors.reset}`
    );
    return [];
  }

  const results = [];

  function walkDistDirectory(dir) {
    const entries = fs.readdirSync(dir);

    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        walkDistDirectory(fullPath);
      } else if (entry.endsWith('.js') || entry.endsWith('.css')) {
        results.push({
          ...analyzeFile(fullPath),
          type: entry.endsWith('.js') ? 'JavaScript' : 'CSS',
          isChunk: entry.includes('-'),
          isVendor: entry.includes('vendor') || entry.includes('node_modules')
        });
      }
    });
  }

  walkDistDirectory(distDir);
  return results.sort((a, b) => b.size - a.size);
}

function generateRecommendations(sourceFiles, buildFiles) {
  const recommendations = [];

  // Check for large source files
  const largeFiles = sourceFiles.filter((file) => file.size > 50000); // 50KB+
  largeFiles.forEach((file) => {
    const relativePath = path.relative(projectRoot, file.path);
    recommendations.push({
      type: 'large-component',
      severity: file.size > 100000 ? 'high' : 'medium',
      message: `Large component: ${relativePath} (${formatBytes(file.size)}, ${file.lines} lines)`,
      suggestions: [
        'Consider breaking into smaller components',
        'Use React.memo() for expensive computations',
        'Implement lazy loading if not critical',
        'Extract utilities to separate files'
      ]
    });
  });

  // Check build output
  const totalBuildSize = buildFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalBuildSize > 1024 * 1024) {
    // 1MB+
    recommendations.push({
      type: 'bundle-size',
      severity: 'high',
      message: `Large total bundle size: ${formatBytes(totalBuildSize)}`,
      suggestions: [
        'Implement more aggressive code splitting',
        'Consider using dynamic imports',
        'Remove unused dependencies',
        'Enable tree shaking optimization'
      ]
    });
  }

  // Check for missing code splitting
  const jsFiles = buildFiles.filter((file) => file.type === 'JavaScript');
  if (jsFiles.length < 3) {
    recommendations.push({
      type: 'code-splitting',
      severity: 'medium',
      message: 'Limited code splitting detected',
      suggestions: [
        'Add route-based code splitting',
        'Split vendor dependencies into separate chunks',
        'Use dynamic imports for heavy features'
      ]
    });
  }

  return recommendations;
}

function printAnalysis() {
  console.log(`${colors.bright}${colors.cyan}🔍 Bundle Analysis Report${colors.reset}\n`);

  // Analyze source files
  console.log(`${colors.bright}📁 Source Files Analysis${colors.reset}`);
  console.log('=' * 50);

  const sourceFiles = analyzeSourceFiles();
  const topLargeFiles = sourceFiles.slice(0, 10);

  topLargeFiles.forEach((file, index) => {
    const relativePath = path.relative(projectRoot, file.path);
    const sizeColor =
      file.size > 100000 ? colors.red : file.size > 50000 ? colors.yellow : colors.green;

    console.log(`${index + 1}. ${relativePath}`);
    console.log(
      `   ${sizeColor}Size: ${formatBytes(file.size)}${colors.reset} | Lines: ${file.lines}`
    );
  });

  const totalSourceSize = sourceFiles.reduce((sum, file) => sum + file.size, 0);
  console.log(
    `\n${colors.bright}Total Source Size: ${formatBytes(totalSourceSize)}${colors.reset}\n`
  );

  // Analyze build files
  console.log(`${colors.bright}🏗️  Build Output Analysis${colors.reset}`);
  console.log('=' * 50);

  const buildFiles = analyzeBuildFiles();

  if (buildFiles.length > 0) {
    const jsFiles = buildFiles.filter((file) => file.type === 'JavaScript');
    const cssFiles = buildFiles.filter((file) => file.type === 'CSS');

    console.log(`${colors.blue}JavaScript Files:${colors.reset}`);
    jsFiles.forEach((file) => {
      const filename = path.basename(file.path);
      const sizeColor =
        file.size > 500000 ? colors.red : file.size > 200000 ? colors.yellow : colors.green;
      console.log(
        `  ${filename}: ${sizeColor}${formatBytes(file.size)}${colors.reset} (estimated gzipped: ${formatBytes(file.estimatedGzipped)})`
      );
    });

    if (cssFiles.length > 0) {
      console.log(`\n${colors.magenta}CSS Files:${colors.reset}`);
      cssFiles.forEach((file) => {
        const filename = path.basename(file.path);
        console.log(`  ${filename}: ${colors.green}${formatBytes(file.size)}${colors.reset}`);
      });
    }

    const totalBuildSize = buildFiles.reduce((sum, file) => sum + file.size, 0);
    console.log(
      `\n${colors.bright}Total Build Size: ${formatBytes(totalBuildSize)}${colors.reset}`
    );
    console.log(
      `${colors.bright}Estimated Gzipped: ${formatBytes(Math.floor(totalBuildSize * 0.3))}${colors.reset}\n`
    );
  }

  // Generate and display recommendations
  const recommendations = generateRecommendations(sourceFiles, buildFiles);

  if (recommendations.length > 0) {
    console.log(`${colors.bright}💡 Optimization Recommendations${colors.reset}`);
    console.log('=' * 50);

    recommendations.forEach((rec, index) => {
      const severityColor =
        rec.severity === 'high'
          ? colors.red
          : rec.severity === 'medium'
            ? colors.yellow
            : colors.green;

      console.log(`${index + 1}. ${severityColor}${rec.message}${colors.reset}`);
      rec.suggestions.forEach((suggestion) => {
        console.log(`   • ${suggestion}`);
      });
      console.log();
    });
  }

  // Performance metrics
  console.log(`${colors.bright}📊 Performance Metrics${colors.reset}`);
  console.log('=' * 50);

  const metrics = {
    'Large Components (>50KB)': sourceFiles.filter((f) => f.size > 50000).length,
    'Total Components': sourceFiles.length,
    'Average Component Size': formatBytes(Math.floor(totalSourceSize / sourceFiles.length)),
    'Lines of Code': sourceFiles.reduce((sum, file) => sum + file.lines, 0)
  };

  Object.entries(metrics).forEach(([key, value]) => {
    console.log(`${key}: ${colors.cyan}${value}${colors.reset}`);
  });

  console.log(`\n${colors.green}✅ Analysis complete!${colors.reset}`);

  // Quick performance check
  const performanceScore = calculatePerformanceScore(sourceFiles, buildFiles);
  const scoreColor =
    performanceScore > 80 ? colors.green : performanceScore > 60 ? colors.yellow : colors.red;

  console.log(
    `${colors.bright}Performance Score: ${scoreColor}${performanceScore}/100${colors.reset}`
  );
}

function calculatePerformanceScore(sourceFiles, buildFiles) {
  let score = 100;

  // Penalize large components
  const largeComponents = sourceFiles.filter((f) => f.size > 100000);
  score -= largeComponents.length * 10;

  // Penalize large bundle
  const totalBuildSize = buildFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalBuildSize > 2 * 1024 * 1024)
    score -= 20; // -20 for >2MB
  else if (totalBuildSize > 1024 * 1024) score -= 10; // -10 for >1MB

  // Bonus for code splitting
  const jsChunks = buildFiles.filter((f) => f.type === 'JavaScript' && f.isChunk).length;
  if (jsChunks > 3) score += 10;

  return Math.max(0, Math.min(100, score));
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  printAnalysis();
}

export { analyzeSourceFiles, analyzeBuildFiles, generateRecommendations };
