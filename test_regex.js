
// Simulate the normalizeResponse function
function normalizeResponse(text) {
    if (!text) return text;

    let normalized = text;
    const DOT_PLACEHOLDER = '___DOT_PLACEHOLDER___';

    normalized = normalized.replace(/(^|\n)\s*\.\s*(\n|$)/g, `$1${DOT_PLACEHOLDER}$2`);

    // Use loop to collapse multiple layers if necessary, but regex global should handle sequential non-overlapping
    // Actually dealing with \n\nDOT\n\n is tricky with regex.
    // Let's iterate until stable or just use a robust regex.
    // Replace Any Newlines + Placeholder + Any Newlines -> \nPlaceholder\n
    normalized = normalized.replace(new RegExp(`\\n\\s*${DOT_PLACEHOLDER}\\s*\\n`, 'g'), `\n${DOT_PLACEHOLDER}\n`);
    // Run it twice to be safe for overlapping cases like \n\nDOT\n\nDOT\n\n
    normalized = normalized.replace(new RegExp(`\\n\\s*${DOT_PLACEHOLDER}\\s*\\n`, 'g'), `\n${DOT_PLACEHOLDER}\n`);

    normalized = normalized.replace(/\n\s*\n/g, `\n${DOT_PLACEHOLDER}\n`);
    normalized = normalized.replace(new RegExp(DOT_PLACEHOLDER, 'g'), '.');
    normalized = normalized.trim();

    return normalized;
}

const testCases = [
    {
        input: "Line 1\n\n\n.\n\nLine 2",
        expected: "Line 1\n.\nLine 2"
    },
    {
        input: "Line 1\n.\nLine 2",
        expected: "Line 1\n.\nLine 2"
    },
    {
        input: "Line 1\n\nLine 2",  // The missing dot case!
        expected: "Line 1\n.\nLine 2"
    },
    {
        input: "Line 1\nLine 2",    // Single newline preserved
        expected: "Line 1\nLine 2"
    },
    {
        input: "   Line 1   \n\n   .   \n\n   Line 2   ",
        expected: "Line 1   \n.\n   Line 2"
    }
];

let allPassed = true;
testCases.forEach((tc, index) => {
    const output = normalizeResponse(tc.input);
    if (output === tc.expected) {
        console.log(`Test Case ${index + 1}: PASS`);
    } else {
        console.log(`Test Case ${index + 1}: FAIL`);
        console.log(`Expected: ${JSON.stringify(tc.expected)}`);
        console.log(`Actual:   ${JSON.stringify(output)}`);
        allPassed = false;
    }
});

if (!allPassed) process.exit(1);
