const fs = require("fs");

// ============================================================
// HELPER FUNCTIONS (Private, not exported)
// ============================================================

/**
 * Parse time string in "h:mm:ss am/pm" format to seconds since midnight
 */
function parseTimeToSeconds(timeStr) {
    const regex = /^(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)$/i;
    const match = timeStr.trim().match(regex);
    
    if (!match) {
        throw new Error(`Invalid time format: ${timeStr}`);
    }
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const period = match[4].toLowerCase();
    
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
        throw new Error(`Invalid time values in: ${timeStr}`);
    }
    
    // Convert to 24-hour format
    if (period === 'am') {
        if (hours === 12) hours = 0;
    } else {
        if (hours !== 12) hours += 12;
    }
    
    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parse time string in "h:mm:ss" format (can be h:mm:ss, hh:mm:ss, or hhh:mm:ss) to seconds
 */
function parseHMS(hmsStr) {
    const regex = /^(\d{1,3}):(\d{2}):(\d{2})$/;
    const match = hmsStr.trim().match(regex);
    
    if (!match) {
        throw new Error(`Invalid HMS format: ${hmsStr}`);
    }
    
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    
    if (hours < 0 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
        throw new Error(`Invalid time values in: ${hmsStr}`);
    }
    
    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert seconds to "h:mm:ss" format (24-hour)
 */
function formatSecondsToHMS(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Check if a date is an Eid date
 * Eid dates: 2024-04-10, 2025-03-30, 2025-04-15, 2026-03-20 (Fitr)
 *            2024-06-16, 2025-06-07, 2026-05-27 (Adha)
 */
function isEidDate(dateString) {
    const eidDates = [
        '2024-04-10', '2025-03-30', '2025-04-15', '2026-03-20',
        '2024-06-16', '2025-06-07', '2026-05-27'
    ];
    return eidDates.includes(dateString);
}

/**
 * Get daily quota in seconds based on date
 */
function getDailyQuota(dateString) {
    const standardQuota = 9 * 3600;
    const eidQuota = 6 * 3600;
    return isEidDate(dateString) ? eidQuota : standardQuota;
}

/**
 * Read all lines from a file
 */
function readFileLines(path) {
    try {
        const content = fs.readFileSync(path, 'utf-8');
        return content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    } catch (err) {
        return [];
    }
}

/**
 * Write lines to a file
 */
function writeFileLines(path, lines) {
    const content = lines.join('\n') + '\n';
    fs.writeFileSync(path, content, 'utf-8');
}

/**
 * Parse a shift CSV line into an object
 */
function parseShiftLine(line) {
    const parts = line.split(',').map(p => p.trim());
    
    if (parts.length < 10) {
        throw new Error(`Invalid shift line format: ${line}`);
    }
    
    return {
        driverID: parts[0],
        driverName: parts[1],
        date: parts[2],
        startTime: parts[3],
        endTime: parts[4],
        shiftDuration: parts[5],
        idleTime: parts[6],
        activeTime: parts[7],
        metQuota: parts[8] === 'true',
        hasBonus: parts[9] === 'true'
    };
}

/**
 * Build a CSV line from a shift object
 */
function buildShiftLine(obj) {
    return `${obj.driverID},${obj.driverName},${obj.date},${obj.startTime},${obj.endTime},${obj.shiftDuration},${obj.idleTime},${obj.activeTime},${obj.metQuota},${obj.hasBonus}`;
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    const startSeconds = parseTimeToSeconds(startTime);
    const endSeconds = parseTimeToSeconds(endTime);
    
    let durationSeconds;
    if (endSeconds >= startSeconds) {
        durationSeconds = endSeconds - startSeconds;
    } else {
        // End time is next day
        durationSeconds = (24 * 3600) - startSeconds + endSeconds;
    }
    
    return formatSecondsToHMS(durationSeconds);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    const shiftDurationStr = getShiftDuration(startTime, endTime);
    const durationSeconds = parseHMS(shiftDurationStr);
    const idleSeconds = Math.floor(durationSeconds * 0.1);
    
    return formatSecondsToHMS(idleSeconds);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    const shiftSeconds = parseHMS(shiftDuration);
    const idleSeconds = parseHMS(idleTime);
    const activeSeconds = Math.max(0, shiftSeconds - idleSeconds);
    
    return formatSecondsToHMS(activeSeconds);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    const quotaSeconds = getDailyQuota(date);
    const activeSeconds = parseHMS(activeTime);
    
    return activeSeconds >= quotaSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    const lines = readFileLines(textFile);
    
    // Check for duplicate (same driverID and date)
    for (const line of lines) {
        if (line.length > 0) {
            try {
                const existing = parseShiftLine(line);
                if (existing.driverID === shiftObj.driverID && existing.date === shiftObj.date) {
                    return {};
                }
            } catch (err) {
                // Skip invalid lines
            }
        }
    }
    
    // Calculate derived fields
    const shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const metQuotaBool = metQuota(shiftObj.date, activeTime);
    
    const newRecord = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: metQuotaBool,
        hasBonus: false
    };
    
    // Find insertion point: after last record of this driver
    let insertIndex = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].length > 0) {
            try {
                const existing = parseShiftLine(lines[i]);
                if (existing.driverID === shiftObj.driverID) {
                    insertIndex = i + 1;
                    break;
                }
            } catch (err) {
                // Skip invalid lines
            }
        }
    }
    
    lines.splice(insertIndex, 0, buildShiftLine(newRecord));
    writeFileLines(textFile, lines);
    
    return newRecord;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    const lines = readFileLines(textFile);
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 0) {
            try {
                const record = parseShiftLine(lines[i]);
                if (record.driverID === driverID && record.date === date) {
                    record.hasBonus = newValue;
                    lines[i] = buildShiftLine(record);
                    writeFileLines(textFile, lines);
                    return;
                }
            } catch (err) {
                // Skip invalid lines
            }
        }
    }
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    const lines = readFileLines(textFile);
    let count = 0;
    let found = false;
    
    // Normalize month to always be 2 digits (e.g., "3" becomes "03")
    const normalizedMonth = String(month).padStart(2, '0');
    
    for (const line of lines) {
        if (line.length > 0) {
            try {
                const record = parseShiftLine(line);
                if (record.driverID === driverID) {
                    found = true;
                    // Check if date contains the month (yyyy-mm-dd format)
                    if (record.date.includes(`-${normalizedMonth}-`) || record.date.endsWith(`-${normalizedMonth}`)) {
                        if (record.hasBonus) {
                            count++;
                        }
                    }
                }
            } catch (err) {
                // Skip invalid lines
            }
        }
    }
    
    return found ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    const lines = readFileLines(textFile);
    let totalSeconds = 0;
    
    // Normalize month to 2 digits
    const normalizedMonth = String(month).padStart(2, '0');
    
    for (const line of lines) {
        if (line.length > 0) {
            try {
                const record = parseShiftLine(line);
                if (record.driverID === driverID) {
                    // Check if date contains the month (yyyy-mm-dd format)
                    if (record.date.includes(`-${normalizedMonth}-`) || record.date.endsWith(`-${normalizedMonth}`)) {
                        totalSeconds += parseHMS(record.activeTime);
                    }
                }
            } catch (err) {
                // Skip invalid lines
            }
        }
    }
    
    return formatSecondsToHMS(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    const rateLines = readFileLines(rateFile);
    let tierLevel = 1; // Default
    
    // Parse rate file to find driver's tier level (field[3])
    for (const line of rateLines) {
        if (line.length > 0) {
            const parts = line.split(',').map(p => p.trim());
            if (parts[0] === driverID) {
                tierLevel = parseInt(parts[3]) || 1;
                break;
            }
        }
    }
    
    // Calculate base required hours from tier: baseRequired = 60480 + (tier - 1) * 39600 seconds
    const baseRequiredSeconds = 60480 + (tierLevel - 1) * 39600;
    const requiredSeconds = Math.max(0, baseRequiredSeconds - bonusCount * 3600);
    
    return formatSecondsToHMS(requiredSeconds);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    const rateLines = readFileLines(rateFile);
    let basePay = 0;
    let tierLevel = 1;
    
    // Parse rate file to find driver's base pay and tier level
    for (const line of rateLines) {
        if (line.length > 0) {
            const parts = line.split(',').map(p => p.trim());
            if (parts[0] === driverID) {
                basePay = parseFloat(parts[2]) || 0;
                tierLevel = parseInt(parts[3]) || 1;
                break;
            }
        }
    }
    
    // Convert time strings to hours
    const actualHoursNum = parseHMS(actualHours) / 3600;
    const requiredHoursNum = parseHMS(requiredHours) / 3600;
    
    // Calculate missing hours (negative if exceeded)
    const missingHours = Math.max(0, requiredHoursNum - actualHoursNum);
    
    // Determine allowed missing hours based on tier level
    let allowedMissingHours = 0;
    if (tierLevel === 1) {
        allowedMissingHours = 0;
    } else if (tierLevel === 2) {
        allowedMissingHours = 20;
    } else if (tierLevel === 3) {
        allowedMissingHours = 20;
    } else if (tierLevel === 4) {
        allowedMissingHours = 20;
    }
    
    // Calculate missing full hours (after allowed missing)
    const missingFullHours = Math.max(0, missingHours - allowedMissingHours);
    
    // Calculate deduction
    const deductionRate = Math.floor(basePay / 185);
    const salaryDeduction = missingFullHours * deductionRate;
    const netPay = basePay - salaryDeduction;
    
    return Math.max(0, Math.floor(netPay));
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
