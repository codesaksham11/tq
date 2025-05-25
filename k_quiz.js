document.addEventListener('DOMContentLoaded', () => {
    console.log("k_quiz.js: DOMContentLoaded fired.");

    // Get DOM elements
    const timerEl = document.getElementById('timer');
    const quizContentEl = document.getElementById('quizContent');
    const submitButton = document.getElementById('submitButton');
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');

    // Ensure critical DOM elements for error display are found
    if (!loadingMessageEl) console.error("k_quiz.js CRITICAL: loadingMessageEl not found!");
    if (!quizContentEl) console.error("k_quiz.js CRITICAL: quizContentEl not found!");
    if (!errorMessageEl) console.error("k_quiz.js CRITICAL: errorMessageEl not found!");
    if (!submitButton) console.error("k_quiz.js CRITICAL: submitButton not found!");

    let allQuestions = [];
    let selectedQuestions = [];
    let userAnswers = [];
    let timeLeft = 0;
    let timerInterval;
    let startTime = 0;

    // --- showError Function ---
    function showError(message) {
        console.error("k_quiz.js - SHOW_ERROR CALLED:", message);
        if (timerInterval) clearInterval(timerInterval);
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (quizContentEl) quizContentEl.style.display = 'none';
        if (errorMessageEl) {
            errorMessageEl.innerHTML = message + ' Please <a href="k.html">go back</a>, check console, and try again.';
            errorMessageEl.style.display = 'block';
        } else {
            alert("Quiz Error: " + message + ". Check console.");
        }
    }

    // --- Helper Functions ---
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') {
            if (unsafe === null || typeof unsafe === 'undefined') return '';
            return String(unsafe);
        }
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function selectRandomQuestions(questions, count) {
        console.log(`k_quiz.js: selectRandomQuestions called with ${questions.length} available questions, asking for ${count}`);
        if (!questions || questions.length === 0 || count === 0) {
            console.log("k_quiz.js: selectRandomQuestions returning empty array.");
            return [];
        }
        const actualCount = Math.min(count, questions.length);
        const shuffled = [...questions];
        shuffleArray(shuffled);
        const result = shuffled.slice(0, actualCount);
        console.log(`k_quiz.js: selectRandomQuestions selected ${result.length} questions.`);
        return result;
    }

    function generateOptions(currentQ) {
        console.log(`k_quiz.js: generateOptions for Q ID: ${currentQ.id}, Text: "${currentQ.questionText}", Type: ${currentQ.Type}, Class: ${currentQ.Class}, Answer: "${currentQ.Answer}"`);
        let options = [];
        const correctAnswer = currentQ.Answer;

        if (typeof correctAnswer === 'undefined' || correctAnswer === null || correctAnswer.toString().trim() === '') {
            console.warn(`k_quiz.js: Question ID ${currentQ.id} has an invalid Answer.`);
            options.push("Error: Correct answer missing");
        } else {
            options.push(correctAnswer);
        }

        if (currentQ.Type && currentQ.Type.toLowerCase() === 'fixed') {
            console.log(`k_quiz.js: Q ID ${currentQ.id} is "fixed" type. Adding distractions: D1="${currentQ.Distraction_1}", D2="${currentQ.Distraction_2}", D3="${currentQ.Distraction_3}"`);
            if (currentQ.Distraction_1 && String(currentQ.Distraction_1).trim() !== "") options.push(currentQ.Distraction_1);
            if (currentQ.Distraction_2 && String(currentQ.Distraction_2).trim() !== "") options.push(currentQ.Distraction_2);
            if (currentQ.Distraction_3 && String(currentQ.Distraction_3).trim() !== "") options.push(currentQ.Distraction_3);
        } else if (currentQ.Type && currentQ.Type.toLowerCase() === 'class' && currentQ.Class) {
            const currentQuestionClass = String(currentQ.Class).trim();
            console.log(`k_quiz.js: Q ID ${currentQ.id} is "class" type (${currentQuestionClass}). Finding distractors from same class.`);
            const sameClassDistractors = allQuestions
                .filter(q => q.id !== currentQ.id && String(q.Class).trim() === currentQuestionClass && typeof q.Answer !== 'undefined' && String(q.Answer).trim() !== "")
                .map(q => q.Answer);
            
            shuffleArray(sameClassDistractors);
            let addedDistractorsCount = 0;
            for (let i = 0; i < sameClassDistractors.length && options.length < 4; i++) {
                if (!options.map(String).includes(String(sameClassDistractors[i]))) {
                    options.push(sameClassDistractors[i]);
                    addedDistractorsCount++;
                }
            }
            console.log(`k_quiz.js: Q ID ${currentQ.id}: Found ${sameClassDistractors.length} potential class distractors, added ${addedDistractorsCount} unique ones.`);
        } else {
            console.warn(`k_quiz.js: Q ID ${currentQ.id} has an unknown Type "${currentQ.Type}" or missing Class for "class" type.`);
        }

        options = [...new Set(options.map(opt => (typeof opt === 'undefined' || opt === null) ? "N/A" : String(opt)))];
        shuffleArray(options);
        const finalOptions = options.slice(0, 4);
        
        const genericPlaceholders = ["Option A", "Option B", "Option C", "Option D"];
        let placeholderIdx = 0;
        while (finalOptions.length < 2 && finalOptions.length < 4) {
            const placeholder = genericPlaceholders[placeholderIdx++];
            if (!finalOptions.includes(placeholder)) {
                finalOptions.push(placeholder);
            }
            if (placeholderIdx >= genericPlaceholders.length) break;
        }

        console.log(`k_quiz.js: Q ID ${currentQ.id}: Final options generated:`, finalOptions);
        return finalOptions;
    }

    function displayAllQuestions() {
        console.log(`k_quiz.js: displayAllQuestions called. Total selected: ${selectedQuestions.length}`);
        if (selectedQuestions.length === 0) {
            console.log("k_quiz.js: No questions to display.");
            quizContentEl.innerHTML = '<p>No questions are available for this quiz configuration.</p>';
            if (timerEl) timerEl.textContent = "00:00";
            if (submitButton) submitButton.style.display = 'none';
            return;
        }

        quizContentEl.innerHTML = '';
        selectedQuestions.forEach((question, index) => {
            if (!question) {
                console.error(`k_quiz.js: Question at index ${index} is undefined.`);
                return;
            }
            console.log(`k_quiz.js: Displaying Q ID: ${question.id}, Text: "${question.questionText}"`);

            const questionBlock = document.createElement('div');
            questionBlock.classList.add('question-block');
            questionBlock.innerHTML = `
                <h3>Question ${index + 1} of ${selectedQuestions.length}</h3>
                <p class="question-text">${escapeHtml(question.questionText || "(Error: Question text missing)")}</p>
                <div class="options-container" data-question-id="${question.id}"></div>
            `;

            const optionsContainer = questionBlock.querySelector('.options-container');
            const options = generateOptions(question);

            if (!options || options.length === 0) {
                console.warn(`k_quiz.js: No options generated for Q ID: ${question.id}.`);
                const p = document.createElement('p');
                p.textContent = "Error: Could not load options for this question.";
                p.style.color = "red";
                optionsContainer.appendChild(p);
            } else {
                options.forEach((optionText, optIndex) => {
                    const optionId = `option-${index}-${optIndex}`;
                    const div = document.createElement('div');
                    div.classList.add('option');
                    const displayOptionText = escapeHtml(optionText);
                    const valueOptionText = escapeHtml(optionText);
                    div.innerHTML = `
                        <input type="radio" id="${optionId}" name="quizOption-${index}" value="${valueOptionText}">
                        <label for="${optionId}">${displayOptionText}</label>
                    `;
                    optionsContainer.appendChild(div);
                });
            }

            quizContentEl.appendChild(questionBlock);
        });

        // Enable submit button when at least one option is selected
        quizContentEl.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const allQuestionsAnswered = selectedQuestions.every((_, idx) => {
                    return quizContentEl.querySelector(`input[name="quizOption-${idx}"]:checked`);
                });
                submitButton.disabled = !allQuestionsAnswered;
            });
        });
    }

    function startTimer() {
        console.log("k_quiz.js: startTimer called.");
        if (!timerEl) {
            console.error("k_quiz.js: Timer element not found.");
            return;
        }
        startTime = Date.now();
        timeLeft = quizTimeMinutes * 60;
        timerEl.textContent = formatTime(timeLeft);

        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                console.log("k_quiz.js: Time is up!");
                clearInterval(timerInterval);
                finalizeQuiz("Time Out");
            }
        }, 1000);
        console.log("k_quiz.js: Timer started. Time left:", timeLeft);
    }

    function handleSubmit() {
        console.log("k_quiz.js: handleSubmit called.");
        userAnswers = [];

        selectedQuestions.forEach((question, index) => {
            const optionsContainer = quizContentEl.querySelector(`.options-container[data-question-id="${question.id}"]`);
            const selectedOptionInput = optionsContainer.querySelector(`input[name="quizOption-${index}"]:checked`);
            const userAnswer = selectedOptionInput ? selectedOptionInput.value : null;
            const correctAnswer = question.Answer;

            console.log(`k_quiz.js: Q ID ${question.id} - User answer: "${userAnswer}", Correct answer: "${correctAnswer}"`);

            userAnswers.push({
                questionId: question.id,
                questionText: question.questionText,
                options: Array.from(optionsContainer.querySelectorAll('label')).map(l => l.textContent),
                correctAnswer: String(correctAnswer),
                userAnswer: userAnswer ? String(userAnswer) : "Not answered",
                isCorrect: userAnswer && String(userAnswer) === String(correctAnswer)
            });
        });

        finalizeQuiz("Completed");
    }

    function finalizeQuiz(status) {
        console.log(`k_quiz.js: finalizeQuiz called with status: ${status}`);
        if (timerInterval) clearInterval(timerInterval);
        const endTime = Date.now();
        const timeTakenMs = endTime - startTime;
        const timeTakenSec = startTime === 0 ? quizTimeMinutes * 60 : Math.round(timeTakenMs / 1000);

        let quizResults = {
            totalQuestionsAsked: selectedQuestions.length,
            answeredQuestionsDetail: userAnswers,
            status: status,
            timeTaken: status === "Time Out" ? quizTimeMinutes * 60 : timeTakenSec,
            maxTime: quizTimeMinutes * 60,
            score: userAnswers.filter(ans => ans.isCorrect).length
        };

        console.log("k_quiz.js: Quiz results prepared:", quizResults);
        try {
            localStorage.setItem('quizResults', JSON.stringify(quizResults));
            console.log("k_quiz.js: Quiz results saved to localStorage.");
        } catch (e) {
            console.error("k_quiz.js: Error saving quiz results to localStorage:", e);
            showError("Error saving quiz results. Your results might not be available on the next page.");
            return;
        }

        console.log("k_quiz.js: Redirecting to k_result.html");
        window.location.href = 'k_result.html';
    }

    function initializeQuiz() {
        console.log("k_quiz.js: initializeQuiz() called.");
        startTime = 0;

        if (allQuestions.length < numQuestionsToAsk && numQuestionsToAsk > 0 && allQuestions.length > 0) {
            console.warn(`k_quiz.js: Requested ${numQuestionsToAsk} questions, but only ${allQuestions.length} are available.`);
        }

        selectedQuestions = selectRandomQuestions(allQuestions, numQuestionsToAsk);

        if (selectedQuestions.length === 0 && numQuestionsToAsk > 0) {
            showError(`No questions could be selected for the quiz. Source has ${allQuestions.length} questions, ${numQuestionsToAsk} were requested.`);
            return;
        }
        console.log(`k_quiz.js: ${selectedQuestions.length} questions selected for this quiz session.`);

        userAnswers = [];

        console.log("k_quiz.js: Updating UI...");
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (quizContentEl) quizContentEl.style.display = 'block';
        console.log("k_quiz.js: UI update complete.");

        if (selectedQuestions.length > 0) {
            startTimer();
            displayAllQuestions();
        } else {
            quizContentEl.innerHTML = '<p>No questions are available for this quiz configuration.</p>';
            if (timerEl) timerEl.textContent = "00:00";
            if (submitButton) submitButton.style.display = 'none';
        }
    }

    // MAIN INITIALIZATION
    console.log("k_quiz.js: Attempting to load data from localStorage.");

    let quizTimeStr, numQuestionsStr, allQuestionsDataString;
    try {
        quizTimeStr = localStorage.getItem('quizTime');
        numQuestionsStr = localStorage.getItem('quizQuestions');
        allQuestionsDataString = localStorage.getItem('structuredSpreadsheetJsData_v2');
    } catch (e) {
        console.error("k_quiz.js: Error accessing localStorage:", e);
        showError("Error accessing browser storage. Please check if localStorage is enabled.");
        return;
    }

    if (!quizTimeStr || !numQuestionsStr || !allQuestionsDataString) {
        let missing = [];
        if (!quizTimeStr) missing.push("quizTime");
        if (!numQuestionsStr) missing.push("numQuestions");
        if (!allQuestionsDataString) missing.push("question data (structuredSpreadsheetJsData_v2)");
        showError(`Critical data missing from localStorage: ${missing.join(', ')}.`);
        return;
    }

    console.log("k_quiz.js: All required localStorage items found.");
    const quizTimeMinutes = parseInt(quizTimeStr, 10);
    const numQuestionsToAsk = parseInt(numQuestionsStr, 10);

    if (isNaN(quizTimeMinutes) || quizTimeMinutes <= 0 || isNaN(numQuestionsToAsk) || numQuestionsToAsk <= 0) {
        showError(`Invalid time (${quizTimeStr}) or number of questions (${numQuestionsStr}). Must be positive numbers.`);
        return;
    }
    console.log(`k_quiz.js: Quiz params: Time=${quizTimeMinutes}m, Questions=${numQuestionsToAsk}`);

    try {
        allQuestions = JSON.parse(allQuestionsDataString);
        if (!Array.isArray(allQuestions)) {
            throw new Error("Parsed question data is not an array.");
        }
        console.log(`k_quiz.js: ${allQuestions.length} total questions loaded from storage.`);
        if (allQuestions.length === 0 && numQuestionsToAsk > 0) {
            showError("Question data from storage is an empty array, but questions were requested.");
            return;
        }
    } catch (e) {
        showError(`Error parsing question data from storage: ${e.message}.`);
        return;
    }

    // Add event listener for submit button
    if (submitButton) {
        submitButton.addEventListener('click', handleSubmit);
    }

    console.log("k_quiz.js: Calling initializeQuiz().");
    initializeQuiz();
});
