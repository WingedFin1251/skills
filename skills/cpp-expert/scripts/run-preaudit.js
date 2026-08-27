const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// Node.js version check — degradation fallback if < 18
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 18) {
    console.error(`[preaudit] ERROR: Node.js >= 18 required (found v${process.versions.node}). Please upgrade or run manual review.`);
    process.exit(1);
}

const args = process.argv.slice(2);
const includeDirs = [];
const defaultExcludes = ['drivers', 'middlewares', '.git', 'node_modules', 'build', 'debug', 'release', '.vscode'];
const excludeDirs = [...defaultExcludes];

let projectTypeOverride = '';
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--include-dir' && i + 1 < args.length && !args[i + 1].startsWith('--')) includeDirs.push(args[++i]);
    if (args[i] === '--exclude' && i + 1 < args.length && !args[i + 1].startsWith('--')) {
        const val = args[++i];
        if (!excludeDirs.includes(val.toLowerCase())) excludeDirs.push(val.toLowerCase());
    }
    if (args[i] === '--project-type' && i + 1 < args.length && !args[i + 1].startsWith('--')) {
        projectTypeOverride = args[++i].toLowerCase();
    }
}

// Support multiple --include-dir args; pass all as space-separated to sub-scripts
const targetDir = includeDirs.length > 0 ? includeDirs.join(',') : '.';
// searchDirs: the actual project directories (defaults to rootDir when none specified)
const rootDir = process.cwd();
const searchDirs = includeDirs.length > 0 ? [rootDir, ...includeDirs] : [rootDir];
const scriptsDir = __dirname;

// Check if a relative path exists in any search directory
function existsInProject(relPath) {
    return searchDirs.some(dir => fs.existsSync(path.join(dir, relPath)));
}
// List files in all search dirs (merged)
function readProjectDir() {
    return searchDirs.flatMap(dir => {
        try { return fs.readdirSync(dir); } catch (_) { return []; }
    });
}
const projectFiles = readProjectDir();

function runScript(name) {
    return new Promise((resolve) => {
        const scriptPath = path.join(scriptsDir, name);
        if (!fs.existsSync(scriptPath)) {
            console.error(`[preaudit] WARNING: ${name} not found, skipping`);
            return resolve({ findings: [], status: 'skipped' });
        }
        execFile(process.execPath, [scriptPath, targetDir], {
            cwd: rootDir, maxBuffer: 10 * 1024 * 1024,
            env: { ...process.env, PREAUDIT_EXCLUDE_DIRS: [...new Set(excludeDirs)].join(',') }
        }, (err, stdout, stderr) => {
            if (err) {
                console.error(`[preaudit] ERROR running ${name}: ${err.message}`);
                return resolve({ findings: [], status: 'error' });
            }
            if (stderr) console.error(stderr);
            try { resolve({ findings: JSON.parse(stdout), status: 'ok' }); }
            catch { console.error(`[preaudit] ${name} returned invalid JSON`); resolve({ findings: [], status: 'parse_error' }); }
        });
    });
}

async function main() {
    const start = Date.now();

    // Detect project type (embedded vs app)
    // ── STM32 (CubeMX / HAL / StdPeriph / Keil) ──
    const hasDrivers = existsInProject('Drivers');
    const hasPlatformIO = existsInProject('platformio.ini');
    const hasFWLIB = existsInProject('FWLIB') || existsInProject('fwlib');
    const hasCORE = existsInProject('CORE') || existsInProject('core');
    const hasStdPeriph = hasFWLIB && hasCORE;
    const hasCMSIS = existsInProject('CORE/core_cm4.h') || existsInProject('CORE/core_cm3.h') ||
                     existsInProject('core/core_cm4.h') || existsInProject('core/core_cm3.h');
    const hasSTM32Conf = existsInProject('USER/main.c') &&
                         (existsInProject('USER/stm32f4xx_conf.h') ||
                          existsInProject('User/stm32f4xx_conf.h'));

    // ── TI (MSPM0 / CCS) ──
    const hasTI = existsInProject('ti_msp_dl_config.h') ||
                  projectFiles.some(f => /\.cproject$/i.test(f));

    // ── NXP (MCUXpresso / S32K) ──
    const hasNXP = existsInProject('board.h') || existsInProject('pin_mux.c') ||
                   existsInProject('fsl_common.h');

    // ── Infineon (ModusToolbox PSoC / XMC) ──
    const hasInfineon = existsInProject('cybsp.h') || existsInProject('cycfg_pins.h') ||
                        existsInProject('mtb_shared');

    // ── Renesas (e² studio RA / RX) ──
    const hasRenesas = existsInProject('hal_data.c') || existsInProject('bsp.c');

    // ── Microchip (MPLAB PIC / SAM / AVR) ──
    const hasMicrochip = existsInProject('mcc.h') || existsInProject('xc.h');

    // ── Espressif (ESP-IDF) ──
    const hasEspressif = existsInProject('sdkconfig') && existsInProject('components');

    // ── Arduino ──
    const hasArduino = existsInProject('Arduino.h') ||
                       projectFiles.some(f => f.endsWith('.ino'));

    // ── Zephyr RTOS ──
    const hasZephyr = existsInProject('west.yml') || existsInProject('prj.conf');

    // ── libopencm3 / ChibiOS ──
    const hasLibOpenCM3 = existsInProject('libopencm3') ||
                          existsInProject('include/libopencm3');
    const hasChibiOS = existsInProject('ch.h') && existsInProject('hal.h');

    // ── Generic embedded signals ──
    const hasLinkerScript = projectFiles.some(f => /\.ld$/i.test(f));
    const hasStartupFile = projectFiles.some(f => /^startup_.*\.(s|c)$/i.test(f));
    const hasFreeRTOS = existsInProject('FreeRTOSConfig.h');
    const hasFreeRTOSEmbedded = hasFreeRTOS && (hasLinkerScript || hasStartupFile);

    const autoEmbedded = hasDrivers || hasPlatformIO || hasStdPeriph || hasCMSIS ||
        hasSTM32Conf || hasTI || hasNXP || hasInfineon || hasRenesas ||
        hasMicrochip || hasEspressif || hasArduino || hasZephyr ||
        hasLibOpenCM3 || hasChibiOS || hasFreeRTOSEmbedded ||
        hasLinkerScript || hasStartupFile;

    // ── Anti-detection: force APP for Linux/Qt/ROS ──
    const hasLinuxKernel = existsInProject('Kconfig') && existsInProject('arch/x86');
    const hasQtProFile = projectFiles.some(f => f.endsWith('.pro'));
    let hasROS = false;
    const pkgXmlPath = searchDirs.map(d => path.join(d, 'package.xml')).find(fs.existsSync);
    if (pkgXmlPath) {
        try { hasROS = fs.readFileSync(pkgXmlPath, 'utf-8').includes('ros'); }
        catch (_) {}
    }
    const forceApp = hasLinuxKernel || hasQtProFile || hasROS;
    const isEmbedded = projectTypeOverride === 'embedded' ? true :
                       projectTypeOverride === 'app' ? false :
                       (autoEmbedded && !forceApp);
    const isApp = !isEmbedded;

    // Detect build system
    const hasCMake = existsInProject('CMakeLists.txt');
    const hasMakefile = existsInProject('Makefile') || existsInProject('makefile');
    let buildSystem = 'unknown';
    if (hasCMake) buildSystem = 'CMake';
    else if (hasMakefile) buildSystem = 'Makefile';
    else if (projectFiles.length > 0) {
        if (projectFiles.some(f => /\.uvprojx?$/i.test(f))) buildSystem = 'Keil';
        else if (projectFiles.some(f => /\.ewp$/i.test(f))) buildSystem = 'IAR';
    }

    console.error(`[preaudit] Project type: ${isEmbedded ? 'embedded' : 'app'}, build: ${buildSystem}`);
    const skippedModules = [];

    if (!isEmbedded) {
        skippedModules.push('pin_audit', 'ctrl_chain_check', 'stack_depth_audit');
        console.error(`[preaudit] Skipped: pin_audit, ctrl_chain_check, stack_depth_audit (embedded only)`);
    }

    // Project-specific scripts
    let pinConflicts = [], pinStatus = 'skipped';
    let chainBreaks = [], chainStatus = 'skipped';
    let stackRisks = [], stackStatus = 'skipped';
    let buildOrphans = [], buildStatus = 'skipped';
    let syscallIssues = [], syscallStatus = 'skipped';

    if (isEmbedded) {
        ({ findings: pinConflicts, status: pinStatus } = await runScript('pin_audit.js'));
        ({ findings: chainBreaks, status: chainStatus } = await runScript('ctrl_chain_check.js'));
        ({ findings: stackRisks, status: stackStatus } = await runScript('stack_depth_audit.js'));
    }

    if (isApp) {
        const canRunBuildAudit = hasCMake || hasMakefile;
        if (canRunBuildAudit) {
            ({ findings: buildOrphans, status: buildStatus } = await runScript('build_audit.js'));
        } else {
            buildStatus = 'skipped_no_build_system';
            skippedModules.push('build_audit');
            console.error(`[preaudit] build_audit skipped: no CMake/Makefile found`);
        }
        ({ findings: syscallIssues, status: syscallStatus } = await runScript('syscall_audit.js'));
    }

    // Always run: common scripts
    const { findings: styleIssues, status: styleStatus } = await runScript('style_audit.js');
    const { findings: apiIssues, status: apiStatus } = await runScript('api_style_audit.js');

    const report = {
        meta: {
            tool_version: '1.6.1', scan_time_ms: Date.now() - start,
            project_type: isEmbedded ? 'embedded' : 'app',
            build_system: buildSystem,
            build_info: { cmake: hasCMake, makefile: hasMakefile, detected: buildSystem },
            skipped_modules: skippedModules,
            excluded_dirs: [...new Set(excludeDirs)], target_dir: targetDir,
            modules: {
                pin_audit: { status: pinStatus, findings: pinConflicts.length },
                ctrl_chain: { status: chainStatus, findings: chainBreaks.length },
                stack_depth: { status: stackStatus, findings: stackRisks.length },
                build_audit: { status: buildStatus, findings: buildOrphans.length },
                syscall_audit: { status: syscallStatus, findings: syscallIssues.length },
                style_audit: { status: styleStatus, findings: styleIssues.length },
                api_style_audit: { status: apiStatus, findings: apiIssues.length }
            }
        },
        pin_conflicts: pinConflicts, control_chain_breaks: chainBreaks,
        stack_overflow_risks: stackRisks, style_issues: styleIssues,
        build_orphans: buildOrphans, syscall_issues: syscallIssues,
        api_mismatches: apiIssues
    };
    const outputPath = path.join(rootDir, 'unified-audit-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[PREAUDIT] ${pinConflicts.length} conf, ${chainBreaks.length} chain, ${stackRisks.length} stack, ${styleIssues.length} style, ${buildOrphans.length} orphan, ${syscallIssues.length} sys, ${apiIssues.length} api — ${report.meta.scan_time_ms}ms`);
    console.log(`[PREAUDIT] Report written to ${outputPath}`);
}
main().catch(err => { console.error('[preaudit] Fatal:', err); process.exit(1); });
