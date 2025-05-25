document.addEventListener('DOMContentLoaded', () => {
    console.log("k_quiz.js: DOMContentLoaded fired.");

    // Get DOM elements
    const timerEl = document.getElementById('timer');
    const allQuestionsContainerEl = document.getElementById('allQuestionsContainer'); // New
    const submitQuizButton = document.getElementById('submitQuizButton'); // Changed
    const feedbackEl = document.getElementById('feedback');
    const quizContentEl = document.getElementById('quizContent');
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');

    // Ensure critical DOM elements
    if (!loadingMessageEl) console.error("k_quiz.js CRITICAL: loadingMessageEl not found!");
    if (!quizContentEl) console.error("k_quiz.js CRITICAL: quizContentEl not found!");
    if (!errorMessageEl) console.error("k_quiz.js CRITICAL: errorMessageEl not found!");
    if (!allQuestionsContainerEl) console.error("k_quiz.js CRITICAL: allQuestionsContainerEl not found!");
    if (!submitQuizButton) console.error("k_quiz.js CRITICAL: submitQuizButton not found!");


    let allQuestions = [];
    let selectedQuestions = [];
    // currentQuestionIndex is no longer needed for navigation
    let userAnswers = [];
    let timeLeft = 0;
    let timerInterval;
    let startTime = 0;
    let quizTimeMinutes = 0; // Will be set from localStorage
    let numQuestionsToAsk = 0; // Will be set from localStorage

    // --- showError Function (defined early) ---
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
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, """)
             .replace(/'/g, "'");
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function selectRandomQuestions(questions, count) {
        console.log(`k_quiz.js: selectRandomQuestions called with ${questions.length} available questions, asking for ${count}`);
        if (!questions || questions.length === 0 || count === 0) {
            console.log("k_quiz.js: selectRandomQuestions returning empty array (no questions available or count is 0).");
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
        // This function remains largely the same, but we'll store the generated options
        // on the question object for easier retrieval during submission.
        console.log(`k_quiz.js: generateOptions for Q ID: ${currentQ.id}, Text: "${currentQ.questionText}", Type: ${currentQ.Type}, Class: ${currentQ.Class}, Answer: "${currentQ.Answer}"`);
        let options = [];
        const correctAnswer = currentQ.Answer;

        if (typeof correctAnswer === 'undefined' || correctAnswer === null || correctAnswer.toString().trim() === '') {
            console.warn(`k_quiz.js: Question ID ${currentQ.id} has an invalid Answer. This is problematic.`);
            options.push("Error: Correct answer missing");
        } else {
            options.push(correctAnswer);
        }

        if (currentQ.Type && currentQ.Type.toLowerCase() === 'fixed') {
            if (currentQ.Distraction_1 && String(currentQ.Distraction_1).trim() !== "") options.push(currentQ.Distraction_1);
            if (currentQ.Distraction_2 && String(currentQ.Distraction_2).trim() !== "") options.push(currentQ.Distraction_2);
            if (currentQ.Distraction_3 && String(currentQ.Distraction_3).trim() !== "") options.push(currentQ.Distraction_3);
        } else if (currentQ.Type && currentQ.Type.toLowerCase() === 'class' && currentQ.Class) {
            const currentQuestionClass = String(currentQ.Class).trim();
            const sameClassDistractors = allQuestions
                .filter(q => q.id !== currentQ.id && String(q.Class).trim() === currentQuestionClass && typeof q.Answer !== 'undefined' && String(q.Answer).trim() !== "")
                .map(q => q.Answer);
            
            shuffleArray(sameClassDistractors);
            for (let i = 0; i < sameClassDistractors.length && options.length < 4; i++) {
                if (!options.map(String).includes(String(sameClassDistractors[i]))) {
                    options.push(sameClassDistractors[i]);
                }
            }
        }

        options = [...new Set(options.map(opt => (typeof opt === 'undefined' || opt === null) ? "N/A" : String(opt)))];
        shuffleArray(options);
        let finalOptions = options.slice(0, 4);
        
        const genericPlaceholders = ["Option A", "Option B", "Option C", "Option D"];
        let placeholderIdx = 0;
        while(finalOptions.length < 2 && placeholderIdx < genericPlaceholders.length ) { // Ensure at least 2 options if possible
            const placeholder = genericPlaceholders[placeholderIdx++];
            if (!finalOptions.includes(placeholder)) {
                finalOptions.push(placeholder);
            }
        }
        // Pad to 4 if still less and placeholders available
        while(finalOptions.length < 4 && placeholderIdx < genericPlaceholders.length){
             const placeholder = genericPlaceholders[placeholderIdx++];
            if (!finalOptions.includes(placeholder)) {
                finalOptions.push(placeholder);
            }
        }


        console.log(`k_quiz.js: Q ID ${currentQ.id}: Final options generated:`, finalOptions);
        currentQ.displayedOptions = finalOptions; // Store them for later
        return finalOptions;
    }

    function displayAllQuestions() {
        console.log(`k_quiz.js: displayAllQuestions called. Total selected: ${selectedQuestions.length}`);
        allQuestionsContainerEl.innerHTML = ''; // Clear previous content

        if (selectedQuestions.length === 0) {
            const p = document.createElement('p');
            p.textContent = "No questions are available for this quiz configuration.";
            p.style.textAlign = "center";
            allQuestionsContainerEl.appendChild(p);
            submitQuizButton.style.display = 'none'; // Hide submit button if no questions
            return;
        }
        submitQuizButton.style.display = 'block'; // Ensure submit button is visible

        selectedQuestions.forEach((question, qIndex) => {
            if (!question) {
                console.error(`Critical Error: Question object at index ${qIndex} is undefined.`);
                const errorP = document.createElement('p');
                errorP.textContent = `Error: Could not load question ${qIndex + 1}.`;
                errorP.style.color = "red";
                allQuestionsContainerEl.appendChild(errorP);
                return; // Skip this question
            }

            console.log(`k_quiz.js: Displaying Q ID: ${question.id}, Text: "${question.questionText}"`);

            const questionBlock = document.createElement('div');
            questionBlock.classList.add('question-block');
            questionBlock.dataset.questionId = question.id; // Store ID for easier linking later

            const questionHeader = document.createElement('h3');
            questionHeader.textContent = `Question ${qIndex + 1}: ${escapeHtml(question.questionText || "(Error: Question text missing)")}`;
            questionBlock.appendChild(questionHeader);

            const optionsContainer = document.createElement('div');
            optionsContainer.classList.add('options-container'); // Use existing class if styles apply

            const options = generateOptions(question); // This also stores options in question.displayedOptions

            if (!options || options.length === 0) {
                 console.warn(`k_quiz.js: No options generated for Q ID: ${question.id}.`);
                 const p = document.createElement('p');
                 p.textContent = "Error: Could not load options for this question.";
                 p.style.color = "red";
                 optionsContainer.appendChild(p);
            } else {
                options.forEach((optionText, optIndex) => {
                    const optionId = `q${qIndex}_option${optIndex}`;
                    const div = document.createElement('div');
                    div.classList.add('option');
                    
                    const displayOptionText = escapeHtml(optionText);
                    const valueOptionText = escapeHtml(optionText); // Value should be the actual answer string

                    // IMPORTANT: Unique name for each question's radio group
                    div.innerHTML = `
                        <input type="radio" id="${optionId}" name="quizOption_q${qIndex}" value="${valueOptionText}">
                        <label for="${optionId}">${displayOptionText}</label>
                    `;
                    optionsContainer.appendChild(div);
                });
            }
            questionBlock.appendChild(optionsContainer);
            allQuestionsContainerEl.appendChild(questionBlock);
        });
        console.log(`k_quiz.js: All questions display setup complete.`);
    }

    function startTimer() {
        console.log("k_quiz.js: startTimer called.");
        if (!timerEl) {
            console.error("k_quiz.js: Timer element not found. Timer will not start.");
            return;
        }
        startTime = Date.now(); // Set start time when timer actually begins
        timeLeft = quizTimeMinutes * 60;
        timerEl.textContent = formatTime(timeLeft);
        
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                console.log("k_quiz.js: Time is up!");
                clearInterval(timerInterval);
                // Collect answers before finalizing if time runs out
                collectAndFinalizeQuiz("Time Out");
            }
        }, 1000);
        console.log("k_quiz.js: Timer started. Time left:", timeLeft);
    }
    
    function collectAndFinalizeQuiz(status) {
        console.log(`k_quiz.js: collectAndFinalizeQuiz called with status: ${status}`);
        if (timerInterval) clearInterval(timerInterval);

        userAnswers = []; // Reset before collecting

        selectedQuestions.forEach((question, qIndex) => {
            const questionBlock = allQuestionsContainerEl.querySelector(`.question-block:nth-child(${qIndex + 1})`); // More robust selector
            if (!questionBlock) {
                 console.warn(`Could not find question block for question index ${qIndex}`);
                 return; // Skip if block not found (should not happen)
            }
            
            const selectedOptionInput = questionBlock.querySelector(`input[name="quizOption_q${qIndex}"]:checked`);
            const userAnswer = selectedOptionInput ? selectedOptionInput.value : null; // Store null if not answered
            const correctAnswer = question.Answer;

            console.log(`k_quiz.js: Q ID ${question.id} - User answer: "${userAnswer}", Correct answer: "${correctAnswer}"`);

            userAnswers.push({
                questionId: question.id,
                questionText: question.questionText,
                options: question.displayedOptions || [], // Use stored displayed options
                correctAnswer: String(correctAnswer),
                userAnswer: userAnswer !== null ? String(userAnswer) : null,
                isCorrect: userAnswer !== null ? (String(userAnswer) === String(correctAnswer)) : false
            });
        });
        
        finalizeQuiz(status);
    }


    function finalizeQuiz(status) {
        // This function is mostly the same, but ensure startTime is correctly used.
        // `userAnswers` is now populated by `collectAndFinalizeQuiz`.
        console.log(`k_quiz.js: finalizeQuiz called with status: ${status}. startTime: ${startTime}`);
        // No need to clear timerInterval here, collectAndFinalizeQuiz does it

        const endTime = Date.now();
        const timeTakenMs = startTime > 0 ? endTime - startTime : (quizTimeMinutes * 60 * 1000); // if startTime wasn't set, assume full time
        const timeTakenSec = Math.round(timeTakenMs / 1000);

        let quizResults = {
            totalQuestionsAsked: selectedQuestions.length,
            answeredQuestionsDetail: userAnswers, // This is now populated for all questions
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
        startTime = 0; // Reset startTime, will be set when timer starts

        if (allQuestions.length < numQuestionsToAsk && numQuestionsToAsk > 0 && allQuestions.length > 0) {
            console.warn(`k_quiz.js: Requested ${numQuestionsToAsk} questions, but only ${allQuestions.length} are available. Using all ${allQuestions.length}.`);
            // numQuestionsToAsk = allQuestions.length; // Implicitly handled by selectRandomQuestions
        }
        
        selectedQuestions = selectRandomQuestions(allQuestions, numQuestionsToAsk);

        if (selectedQuestions.length === 0 && numQuestionsToAsk > 0) {
            showError(`No questions could be selected for the quiz. Source has ${allQuestions.length} questions, ${numQuestionsToAsk} were requested. Check data or parameters.`);
            return; 
        }
        console.log(`k_quiz.js: ${selectedQuestions.length} questions selected for this quiz session.`);
        
        userAnswers = []; // Reset user answers
        
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (quizContentEl) quizContentEl.style.display = 'block';
        console.log("k_quiz.js: UI update to show quiz content complete.");

        if (selectedQuestions.length > 0) {
            startTimer();
            displayAllQuestions(); // New function call
        } else {
            console.log("k_quiz.js: No questions to display. Quiz will not start.");
            displayAllQuestions(); // This will show the "No questions available" message
            if(timerEl) timerEl.textContent = "00:00";
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
    
    quizTimeMinutes = parseInt(quizTimeStr, 10); // Assign to global scope var
    numQuestionsToAsk = parseInt(numQuestionsStr, 10); // Assign to global scope var

    if (isNaN(quizTimeMinutes) || quizTimeMinutes <= 0 || isNaN(numQuestionsToAsk)) { // numQuestionsToAsk can be 0
        showError(`Invalid time (${quizTimeStr}) or number of questions (${numQuestionsStr}). Time must be positive. Number of questions must be a non-negative number set in k.html.`);
        return;
    }
     if (numQuestionsToAsk < 0) { // Specifically check for negative
        showError(`Number of questions (${numQuestionsStr}) cannot be negative. Set a non-negative number in k.html.`);
        return;
    }
    console.log(`k_quiz.js: Quiz params: Time=${quizTimeMinutes}m, Questions=${numQuestionsToAsk}`);

    try {
        allQuestions = JSON.parse(allQuestionsDataString);
        if (!Array.isArray(allQuestions)) {
            throw new Error("Parsed question data is not an array.");
        }
        console.log(`k_quiz.js: JSON.parse successful. ${allQuestions.length} total questions loaded.`);
        if (allQuestions.length === 0 && numQuestionsToAsk > 0) {
             showError("Question data from storage is an empty array, but questions were requested. Please check synced data.");
             return;
        }
    } catch (e) {
        showError(`Error parsing question data: ${e.message}. The data might be corrupted.`);
        console.error("Data string that failed parsing (first 500 chars):", allQuestionsDataString ? allQuestionsDataString.substring(0,500) : "null");
        return;
    }

    if (submitQuizButton) {
        submitQuizButton.addEventListener('click', () => {
            if (feedbackEl) feedbackEl.textContent = ''; // Clear any previous feedback
            collectAndFinalizeQuiz("Submitted");
        });
    } else {
        console.error("k_quiz.js CRITICAL: Submit button not found. Quiz submission will not work.");
    }

    console.log("k_quiz.js: All initial setup and function definitions complete. Calling initializeQuiz().");
    initializeQuiz();
});
