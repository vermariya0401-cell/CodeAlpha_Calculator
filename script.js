/**
 * ============================================================================
 * Modern Glassmorphism Calculator
 * Pure HTML5, CSS3 & Vanilla JavaScript (Zero Frameworks)
 * ============================================================================
 * 
 * This file contains the complete calculation logic, state management,
 * keyboard handling, formatting, and history persistence using localStorage.
 * Written with clean, modular, and beginner-friendly functions suitable for viva.
 */

// ============================================================================
// 1. STATE MANAGEMENT
// ============================================================================

/**
 * Calculator state object:
 * - currentOperand: The value currently being typed or the computed result (string)
 * - previousOperand: The previous operand awaiting the second operand (string)
 * - operation: The active arithmetic operator ('+', '-', '×', '÷', or null)
 * - shouldResetScreen: Flag set to true after pressing '=', so typing a new number starts fresh
 * - hasError: Flag set when an invalid calculation occurs (e.g. division by zero)
 * - history: Array storing previous calculation records persisted in localStorage
 */
let currentOperand = '0';
let previousOperand = '';
let operation = null;
let shouldResetScreen = false;
let hasError = false;
let history = [];

// LocalStorage key for storing history
const STORAGE_KEY = 'calculator_history';

// ============================================================================
// 2. DOM ELEMENT REFERENCES
// ============================================================================

const currentOperandDisplay = document.getElementById('current-operand');
const previousOperandDisplay = document.getElementById('previous-operand');
const historyList = document.getElementById('history-list');
const historyBadge = document.getElementById('history-badge');
const historyPanel = document.getElementById('history-panel');
const historyToggleBtn = document.getElementById('history-toggle-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const closeHistoryBtn = document.getElementById('close-history-btn');

// Keyboard shortcuts modal elements
const shortcutsToggleBtn = document.getElementById('shortcuts-toggle-btn');
const shortcutsModal = document.getElementById('shortcuts-modal');
const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');

// ============================================================================
// 3. CORE CALCULATOR FUNCTIONS
// ============================================================================

/**
 * Appends a digit (0-9) to the current operand.
 * Handles leading zeroes and resets screen after a completed calculation.
 * 
 * @param {string} number - The digit string to append
 */
function appendNumber(number) {
  // If an error is on screen or we just evaluated a calculation, reset first
  if (hasError || shouldResetScreen) {
    currentOperand = number;
    hasError = false;
    shouldResetScreen = false;
    updateDisplay();
    return;
  }

  // Prevent multiple leading zeros (e.g., '00')
  if (currentOperand === '0' && number === '0') return;

  // Replace lone '0' with the first non-zero digit
  if (currentOperand === '0' && number !== '0') {
    currentOperand = number;
  } else {
    // Limit input length to 15 digits to avoid display overflow
    if (currentOperand.replace(/[^0-9]/g, '').length >= 15) return;
    currentOperand += number;
  }

  updateDisplay();
}

/**
 * Appends a decimal point (.) to the current operand.
 * Prevents multiple decimals in a single number.
 */
function appendDecimal() {
  if (hasError || shouldResetScreen) {
    currentOperand = '0.';
    hasError = false;
    shouldResetScreen = false;
    updateDisplay();
    return;
  }

  // Guard: prevent multiple decimal points
  if (currentOperand.includes('.')) return;

  if (currentOperand === '') {
    currentOperand = '0.';
  } else {
    currentOperand += '.';
  }

  updateDisplay();
}

/**
 * Selects an arithmetic operator (+, -, ×, ÷).
 * If a previous operation is pending and a new operand was entered,
 * it chains calculations automatically.
 * 
 * @param {string} selectedOperator - The operator symbol
 */
function chooseOperator(selectedOperator) {
  if (hasError) return;

  // If user just got a result and chooses an operator, use that result as previousOperand
  if (shouldResetScreen) {
    shouldResetScreen = false;
  }

  // If current is empty but previous exists, user is switching operator
  if (currentOperand === '' && previousOperand !== '') {
    operation = selectedOperator;
    updateDisplay();
    return;
  }

  // If both operands exist, calculate the intermediate step first (chaining)
  if (previousOperand !== '' && operation !== null) {
    calculate(false); // calculate without finalizing for screen reset
    if (hasError) return;
  }

  operation = selectedOperator;
  previousOperand = currentOperand;
  currentOperand = '';
  updateDisplay();
}

/**
 * Executes the arithmetic calculation between previousOperand and currentOperand.
 * 
 * @param {boolean} isFinal - True if triggered by '=' button, false if chained by operator
 */
function calculate(isFinal = true) {
  // Can't calculate if no operator is selected or previous operand is missing
  if (operation === null || previousOperand === '' || hasError) return;

  // If user presses '=' without typing a second number, reuse the previous number
  const secondValue = currentOperand === '' ? previousOperand : currentOperand;
  const prev = parseFloat(previousOperand);
  const current = parseFloat(secondValue);

  if (isNaN(prev) || isNaN(current)) return;

  let computation = 0;

  switch (operation) {
    case '+':
      computation = prev + current;
      break;
    case '-':
      computation = prev - current;
      break;
    case '×':
    case '*':
      computation = prev * current;
      break;
    case '÷':
    case '/':
      // Division by zero guard
      if (current === 0) {
        currentOperand = 'Cannot divide by zero';
        hasError = true;
        previousOperand = '';
        operation = null;
        updateDisplay();
        return;
      }
      computation = prev / current;
      break;
    default:
      return;
  }

  // Handle floating point inaccuracies (e.g., 0.1 + 0.2 = 0.30000000000000004)
  const formattedResult = formatPrecision(computation);

  // If triggered by '=' button, save to history
  if (isFinal) {
    const rawExpression = `${previousOperand} ${operation} ${secondValue}`;
    addToHistory(rawExpression, formattedResult);
    previousOperand = `${rawExpression} =`;
    currentOperand = formattedResult;
    operation = null;
    shouldResetScreen = true;
  } else {
    // Intermediate step when chaining operators (e.g. 5 + 3 + ...)
    currentOperand = formattedResult;
    previousOperand = '';
  }

  updateDisplay();
}

/**
 * Computes percentage.
 * If part of an expression like '200 + 10%', 10% represents 10% of 200 = 20.
 * If standalone like '50%', it divides by 100 = 0.5.
 */
function computePercentage() {
  if (hasError || currentOperand === '') return;

  const currentVal = parseFloat(currentOperand);
  if (isNaN(currentVal)) return;

  if (previousOperand !== '' && operation !== null) {
    const prevVal = parseFloat(previousOperand);
    if (!isNaN(prevVal) && (operation === '+' || operation === '-')) {
      // Percentage relative to the base value
      currentOperand = formatPrecision((prevVal * currentVal) / 100);
      updateDisplay();
      return;
    }
  }

  // Simple percentage (division by 100)
  currentOperand = formatPrecision(currentVal / 100);
  updateDisplay();
}

/**
 * Toggles the sign (+/-) of the current operand.
 */
function toggleSign() {
  if (hasError || currentOperand === '' || currentOperand === '0') return;

  if (currentOperand.startsWith('-')) {
    currentOperand = currentOperand.substring(1);
  } else {
    currentOperand = '-' + currentOperand;
  }

  updateDisplay();
}

/**
 * Deletes the last entered character (Backspace / DEL).
 */
function deleteNumber() {
  // If an error is active or screen is waiting for reset, clear all
  if (hasError || shouldResetScreen) {
    clearCalculator();
    return;
  }

  if (currentOperand.length > 1) {
    currentOperand = currentOperand.slice(0, -1);
    // If only '-' remains, revert to '0'
    if (currentOperand === '-') currentOperand = '0';
  } else {
    currentOperand = '0';
  }

  updateDisplay();
}

/**
 * Completely resets the calculator state (AC - All Clear).
 */
function clearCalculator() {
  currentOperand = '0';
  previousOperand = '';
  operation = null;
  shouldResetScreen = false;
  hasError = false;
  updateDisplay();
}

// ============================================================================
// 4. NUMBER FORMATTING & DISPLAY
// ============================================================================

/**
 * Safely fixes floating point rounding errors and scientific notation.
 * 
 * @param {number} num - The raw floating-point number
 * @returns {string} - Clean string representation
 */
function formatPrecision(num) {
  if (isNaN(num) || !isFinite(num)) return 'Error';

  // Fix precision to 12 significant digits to eliminate 0.0000000000000004 anomalies
  const rounded = parseFloat(Number(num).toPrecision(12));

  // If number is astronomical or microscopic, use scientific notation
  if (Math.abs(rounded) >= 1e14 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-6)) {
    return rounded.toExponential(6).replace(/\.?0+e/, 'e');
  }

  return String(rounded);
}

/**
 * Formats a number string with commas for thousands (e.g. 1,234,567.89),
 * while preserving decimals in progress.
 * 
 * @param {string} numberStr - The raw number string
 * @returns {string} - Formatted number string
 */
function formatDisplayNumber(numberStr) {
  if (numberStr === '' || numberStr === '0') return numberStr;
  if (hasError) return numberStr;

  // Split integer and decimal parts
  const parts = numberStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  let formattedInteger;
  const numValue = parseFloat(integerPart);

  if (isNaN(numValue)) {
    formattedInteger = integerPart;
  } else {
    formattedInteger = numValue.toLocaleString('en-US');
    // If negative zero '-0'
    if (integerPart.startsWith('-') && !formattedInteger.startsWith('-')) {
      formattedInteger = '-' + formattedInteger;
    }
  }

  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
}

/**
 * Updates the calculator display and active button highlights.
 */
function updateDisplay() {
  if (hasError) {
    currentOperandDisplay.innerText = currentOperand;
    currentOperandDisplay.classList.add('error-text');
    previousOperandDisplay.innerText = '';
    adjustFontSize();
    return;
  }

  currentOperandDisplay.classList.remove('error-text');
  currentOperandDisplay.innerText = formatDisplayNumber(currentOperand);

  // Format previous operand row
  if (operation !== null) {
    previousOperandDisplay.innerText = `${formatDisplayNumber(previousOperand)} ${operation}`;
  } else {
    previousOperandDisplay.innerText = previousOperand;
  }

  adjustFontSize();
  updateOperatorHighlight();
}

/**
 * Dynamically adjusts font size to prevent numbers from overflowing the display container.
 */
function adjustFontSize() {
  const length = currentOperandDisplay.innerText.length;
  if (hasError) return;

  if (length > 13) {
    currentOperandDisplay.style.fontSize = '1.6rem';
  } else if (length > 9) {
    currentOperandDisplay.style.fontSize = '2.1rem';
  } else {
    currentOperandDisplay.style.fontSize = ''; // revert to CSS default
  }
}

/**
 * Highlights the currently active operator button on screen.
 */
function updateOperatorHighlight() {
  const operatorButtons = document.querySelectorAll('.btn-operator');
  operatorButtons.forEach(btn => {
    if (operation && btn.getAttribute('data-operator') === operation && currentOperand === '') {
      btn.classList.add('op-active');
    } else {
      btn.classList.remove('op-active');
    }
  });
}

// ============================================================================
// 5. CALCULATION HISTORY (LOCALSTORAGE)
// ============================================================================

/**
 * Adds a completed calculation to the history array and persists to localStorage.
 * 
 * @param {string} expression - Calculation expression (e.g. "12 + 5")
 * @param {string} result - Calculation result (e.g. "17")
 */
function addToHistory(expression, result) {
  const record = {
    id: Date.now(),
    expression: expression,
    result: result,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  // Add to beginning of array
  history.unshift(record);

  // Cap at 30 items
  if (history.length > 30) {
    history = history.slice(0, 30);
  }

  saveHistory();
  renderHistory();
}

/**
 * Saves current history array into localStorage.
 */
function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('localStorage could not be accessed:', e);
  }
}

/**
 * Loads history records from localStorage on initial page load.
 */
function loadHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      history = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Could not parse history from localStorage:', e);
    history = [];
  }
  renderHistory();
}

/**
 * Completely clears calculation history from memory and localStorage.
 */
function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
}

/**
 * Renders history records into the DOM history panel.
 */
function renderHistory() {
  // Update badge count
  if (history.length > 0) {
    historyBadge.style.display = 'block';
    historyBadge.innerText = history.length;
  } else {
    historyBadge.style.display = 'none';
  }

  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p>No calculation history yet</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = history.map((item, index) => `
    <div class="history-item" data-index="${index}" role="listitem" title="Click to use result" tabindex="0">
      <span class="history-item-expr">${escapeHTML(item.expression)}</span>
      <span class="history-item-res">= ${escapeHTML(item.result)}</span>
    </div>
  `).join('');

  // Attach click events to load a past calculation result back into the display
  const items = historyList.querySelectorAll('.history-item');
  items.forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      selectHistoryItem(idx);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = parseInt(el.getAttribute('data-index'), 10);
        selectHistoryItem(idx);
      }
    });
  });
}

/**
 * Loads a selected historical calculation's result into the calculator.
 * 
 * @param {number} index - Index of history item
 */
function selectHistoryItem(index) {
  const item = history[index];
  if (!item) return;

  currentOperand = item.result;
  previousOperand = item.expression + ' =';
  operation = null;
  shouldResetScreen = true;
  hasError = false;
  updateDisplay();

  // If on mobile screen, auto-collapse history panel after selection
  if (window.innerWidth <= 768) {
    historyPanel.classList.add('panel-hidden');
    historyToggleBtn.classList.remove('active');
  }
}

/**
 * Helper to prevent XSS injection in history expressions.
 */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// 6. KEYBOARD EVENT HANDLING
// ============================================================================

/**
 * Handles all keyboard shortcuts and physical key presses.
 * 
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyboardInput(event) {
  // If modal or dialog is open and key is Escape, close modal first
  if (shortcutsModal.classList.contains('open')) {
    if (event.key === 'Escape') {
      shortcutsModal.classList.remove('open');
      shortcutsModal.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  const key = event.key;

  // Numbers 0 to 9
  if (key >= '0' && key <= '9') {
    appendNumber(key);
    triggerButtonAnimation(`[data-number="${key}"]`);
    return;
  }

  // Decimal point
  if (key === '.') {
    appendDecimal();
    triggerButtonAnimation('#btn-decimal');
    return;
  }

  // Basic arithmetic operators
  if (key === '+') {
    chooseOperator('+');
    triggerButtonAnimation('#btn-add');
    return;
  }
  if (key === '-') {
    chooseOperator('-');
    triggerButtonAnimation('#btn-subtract');
    return;
  }
  if (key === '*') {
    chooseOperator('×');
    triggerButtonAnimation('#btn-multiply');
    return;
  }
  if (key === '/') {
    event.preventDefault(); // Prevents "Quick Find" in Firefox
    chooseOperator('÷');
    triggerButtonAnimation('#btn-divide');
    return;
  }

  // Percentage
  if (key === '%') {
    computePercentage();
    triggerButtonAnimation('#btn-percent');
    return;
  }

  // Calculate (= or Enter)
  if (key === '=' || key === 'Enter') {
    event.preventDefault(); // Prevents triggering focused buttons
    calculate(true);
    triggerButtonAnimation('#btn-equals');
    return;
  }

  // Backspace / Delete
  if (key === 'Backspace') {
    deleteNumber();
    triggerButtonAnimation('#btn-delete');
    return;
  }

  // Clear (Escape or 'c' / 'C')
  if (key === 'Escape' || key === 'c' || key === 'C') {
    clearCalculator();
    triggerButtonAnimation('#btn-clear');
    return;
  }
}

/**
 * Provides smooth visual feedback on the calculator button when a physical key is pressed.
 * 
 * @param {string} selector - CSS selector of button
 */
function triggerButtonAnimation(selector) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  btn.classList.add('key-active');
  setTimeout(() => {
    btn.classList.remove('key-active');
  }, 140);
}

// ============================================================================
// 7. EVENT LISTENERS INITIALIZATION
// ============================================================================

function initEventListeners() {
  // Keypad click handler using event delegation
  const keypad = document.querySelector('.calculator-keypad');
  keypad.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    // Number buttons
    if (target.hasAttribute('data-number')) {
      const num = target.getAttribute('data-number');
      appendNumber(num);
      return;
    }

    // Operator buttons
    if (target.hasAttribute('data-operator')) {
      const op = target.getAttribute('data-operator');
      chooseOperator(op);
      return;
    }

    // Action buttons
    const action = target.getAttribute('data-action');
    switch (action) {
      case 'clear':
        clearCalculator();
        break;
      case 'delete':
        deleteNumber();
        break;
      case 'percent':
        computePercentage();
        break;
      case 'decimal':
        appendDecimal();
        break;
      case 'negate':
        toggleSign();
        break;
      case 'calculate':
        calculate(true);
        break;
    }
  });

  // Global physical keyboard listener
  window.addEventListener('keydown', handleKeyboardInput);

  // History panel toggle
  historyToggleBtn.addEventListener('click', () => {
    const isHidden = historyPanel.classList.toggle('panel-hidden');
    historyToggleBtn.classList.toggle('active', !isHidden);
  });

  // Clear history button
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Mobile close history button
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', () => {
      historyPanel.classList.add('panel-hidden');
      historyToggleBtn.classList.remove('active');
    });
  }

  // Keyboard shortcuts modal toggle
  shortcutsToggleBtn.addEventListener('click', () => {
    shortcutsModal.classList.add('open');
    shortcutsModal.setAttribute('aria-hidden', 'false');
  });

  closeShortcutsBtn.addEventListener('click', () => {
    shortcutsModal.classList.remove('open');
    shortcutsModal.setAttribute('aria-hidden', 'true');
  });

  // Click outside shortcuts modal to close
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) {
      shortcutsModal.classList.remove('open');
      shortcutsModal.setAttribute('aria-hidden', 'true');
    }
  });
}

// ============================================================================
// 8. APP INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadHistory();
  updateDisplay();
});
