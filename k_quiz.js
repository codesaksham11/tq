document.addEventListener('DOMContentLoaded', () => {
    console.log("k_quiz.js: DOMContentLoaded fired.");

    // Get DOM elements
    const timerEl = document.getElementById('timer');
    const allQuestionsContainerEl = document.getElementById('allQuestionsContainer');
    const submitQuizButton = document.getElementById('submitQuizButton');
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');

    // Ensure critical DOM elements for error display are found
    if (!loadingMessageEl) console.error("k_quiz.js CRITICAL: loadingMessageEl not found!");
    if (!allQuestionsContainerEl) console.error("k_quiz.js CRITICAL: allQuestionsContainerEl not found!");
    if (!errorMessageEl) console.error("k_quiz.js CRITICAL: errorMessageEl not found!");

    let allQuestions = [];
    let selectedQuestions = [];
    let timeLeft = 0;
    let timerInterval;
    let startTime = 0; // Will be set in initializeQuiz or startTimer
    let quizTimeMinutes = 0;
    let numQuestionsToAsk = 0;


    // --- showError Function (defined early) ---
    function showError(message) {
        console.error("k_quiz.js - SHOW_ERROR CALLED:", message);
        if (timerInterval) clearInterval(timerInterval);
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (allQuestionsContainerEl) allQuestionsContainerEl.style.display = 'none';
        if (submitQuizButton) submitQuizButton.style.display = 'none';
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

    function generateOptions(currentQ, allQuestionsPool) { // allQuestionsPool passed for class-based distractors
        console.log(`k_quiz.js: generateOptions for Q ID: ${currentQ.id}, Text: "${currentQ.questionText}", Type: ${currentQ.Type}, Class: ${currentQ.Class}, Answer: "${currentQ.Answer}"`);
        let options = [];
        const correctAnswer = currentQ.Answer;

        if (typeof correctAnswer === 'undefined' || correctAnswer === null || String(correctAnswer).trim() === '') {
            console.warn(`k_quiz.js: Question ID ${currentQ.id} has an invalid Answer. This is problematic.`);
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
            const sameClassDistractors = allQuestionsPool // Use the passed pool
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
            console.warn(`k_quiz.js: Q ID ${currentQ.id} has an unknown Type "${currentQ.Type}" or missing Class for "class" type. Only correct answer will be an option initially.`);
        }

        options = [...new Set(options.map(opt => (typeof opt === 'undefined' || opt === null) ? "N/A" : String(opt)))];
        shuffleArray(options);
        const finalOptions = options.slice(0, 4);
        
        const genericPlaceholders = ["Option A", "Option B", "Option C", "Option D"];
        let placeholderIdx = 0;
        while(finalOptions.length < 2 && finalOptions.length < 4) { // Ensure at least 2 options, ideally 4
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
        if (!allQuestionsContainerEl) {
            showError("Critical Error: Main questions container 'allQuestionsContainerEl' is missing.");
            return;
        }
        allQuestionsContainerEl.innerHTML = ''; // Clear previous content

        if (selectedQuestions.length === 0) {
            console.log("k_quiz.js: No questions to display.");
            allQuestionsContainerEl.innerHTML = "<p>No questions are available for this quiz configuration.</p>";
            if(submitQuizButton) submitQuizButton.style.display = 'none';
            return;
        }

        selectedQuestions.forEach((question, index) => {
            if (!question) {
                console.error(`k_quiz.js: Question object at index ${index} is undefined. Skipping.`);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'question-block';
                errorDiv.innerHTML = `<h3>Error</h3><p>Could not load question ${index + 1}.</p>`;
                allQuestionsContainerEl.appendChild(errorDiv);
                return;
            }
            console.log(`k_quiz.js: Displaying Q ID: ${question.id}, Text: "${question.questionText}"`);

            const questionBlock = document.createElement('div');
            questionBlock.className = 'question-block';
            questionBlock.id = `question-block-${index}`;

            const questionNumberHeader = document.createElement('h3');
            questionNumberHeader.textContent = `Question ${index + 1}`;
            questionBlock.appendChild(questionNumberHeader);

            const questionTextP = document.createElement('p');
            questionTextP.className = 'question-text-item';
            questionTextP.textContent = question.questionText || "(Error: Question text missing)";
            questionBlock.appendChild(questionTextP);

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'options-item-container';
            optionsDiv.id = `options-q-${index}`;

            const options = generateOptions(question, allQuestions); // Pass allQuestions for context

            if (!options || options.length === 0) {
                console.warn(`k_quiz.js: No options generated for Q ID: ${question.id}.`);
                const p = document.createElement('p');
                p.textContent = "Error: Could not load options for this question.";
                p.style.color = "red";
                optionsDiv.appendChild(p);
            } else {
                options.forEach((optionText, optionIndex) => {
                    const optionId = `q${index}_option${optionIndex}`;
                    const div = document.createElement('div');
                    div.classList.add('option');
                    
                    const displayOptionText = escapeHtml(optionText);
                    const valueOptionText = escapeHtml(optionText); // Value should also be escaped if used directly

                    div.innerHTML = `
                        <input type="radio" id="${optionId}" name="q${index}_option" value="${valueOptionText}">
                        <label for="${optionId}">${displayOptionText}</label>
                    `;
                    optionsDiv.appendChild(div);
                });
            }
            questionBlock.appendChild(optionsDiv);
            allQuestionsContainerEl.appendChild(questionBlock);
        });
        if(submitQuizButton) submitQuizButton.style.display = 'block';
        console.log(`k_quiz.js: All questions display setup complete.`);
    }

    function startTimer() {
        console.log("k_quiz.js: startTimer called.");
        if (!timerEl) {
            console.error("k_quiz.js: Timer element not found. Timer will not start.");
            return;
        }
        startTime = Date.now(); // Set startTime when timer actually begins
        timeLeft = quizTimeMinutes * 60;
        timerEl.textContent = formatTime(timeLeft);
        
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                console.log("k_quiz.js: Time is up!");
                clearInterval(timerInterval);
                submitAndFinalize("Time Out"); // Auto-submit when time is up
            }
        }, 1000);
        console.log("k_quiz.js: Timer started. Time left:", timeLeft);
    }

    function collectAllUserAnswers() {
        console.log("k_quiz.js: collectAllUserAnswers called.");
        const answers = [];
        selectedQuestions.forEach((question, index) => {
            const optionsForThisQuestion = Array.from(
                allQuestionsContainerEl.querySelectorAll(`#options-q-${index} label`)
            ).map(l => l.textContent);

            const selectedOptionInput = allQuestionsContainerEl.querySelector(`input[name="q${index}_option"]:checked`);
            const userAnswer = selectedOptionInput ? selectedOptionInput.value : null; // Store null if not answered
            const correctAnswer = question.Answer;

            console.log(`k_quiz.js: Q ID ${question.id} (Index ${index}) - User answer: "${userAnswer}", Correct answer: "${correctAnswer}"`);

            answers.push({
                questionId: question.id,
                questionText: question.questionText,
                options: optionsForThisQuestion,
                correctAnswer: String(correctAnswer),
                userAnswer: userAnswer !== null ? String(userAnswer) : null, // Ensure string or null
                isCorrect: userAnswer !== null && String(userAnswer) === String(correctAnswer)
            });
        });
        console.log("k_quiz.js: All user answers collected:", answers);
        return answers;
    }


    function submitAndFinalize(status) {
        console.log(`k_quiz.js: submitAndFinalize called with status: ${status}`);
        if (timerInterval) clearInterval(timerInterval);
        if (submitQuizButton) submitQuizButton.disabled = true; // Prevent multiple submissions

        const userAnswersCollected = collectAllUserAnswers();
        
        const endTime = Date.now();
        // If startTime wasn't set (e.g., quiz loaded but timer didn't start due to immediate error or 0 questions),
        // timeTakenSec will default to full quiz time if status is Time Out, or 0 otherwise.
        const timeTakenMs = startTime > 0 ? endTime - startTime : (status === "Time Out" ? quizTimeMinutes * 60 * 1000 : 0);
        const timeTakenSec = Math.round(timeTakenMs / 1000);


        let quizResults = {
            totalQuestionsAsked: selectedQuestions.length,
            answeredQuestionsDetail: userAnswersCollected,
            status: status,
            timeTaken: status === "Time Out" ? quizTimeMinutes * 60 : timeTakenSec,
            maxTime: quizTimeMinutes * 60,
            score: userAnswersCollected.filter(ans => ans.isCorrect).length
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
        startTime = 0; // Reset start time, will be set when timer starts

        if (allQuestions.length < numQuestionsToAsk && numQuestionsToAsk > 0 && allQuestions.length > 0) {
            console.warn(`k_quiz.js: Requested ${numQuestionsToAsk} questions, but only ${allQuestions.length} are available in total. Using all ${allQuestions.length} available.`);
        }
        
        selectedQuestions = selectRandomQuestions(allQuestions, numQuestionsToAsk);

        if (selectedQuestions.length === 0 && numQuestionsToAsk > 0) {
            showError(`No questions could be selected for the quiz. Source has ${allQuestions.length} questions, ${numQuestionsToAsk} were requested. Check data or parameters.`);
            return; 
        }
        console.log(`k_quiz.js: ${selectedQuestions.length} questions selected for this quiz session.`);
        
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (allQuestionsContainerEl) allQuestionsContainerEl.style.display = 'block'; // Show main container
        console.log("k_quiz.js: UI update to show quiz content complete.");

        displayAllQuestions(); // Display all selected questions

        if (selectedQuestions.length > 0) {
            startTimer();
            if(submitQuizButton) {
                submitQuizButton.style.display = 'block';
                submitQuizButton.disabled = false;
            }
        } else {
            console.log("k_quiz.js: No questions to display (0 selected or 0 requested). Quiz will not start.");
            if(timerEl) timerEl.textContent = "00:00";
            if(submitQuizButton) submitQuizButton.style.display = 'none';
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

    quizTimeMinutes = parseInt(quizTimeStr, 10); // Assign to global scope for this script
    numQuestionsToAsk = parseInt(numQuestionsStr, 10); // Assign to global scope

    if (isNaN(quizTimeMinutes) || quizTimeMinutes <= 0 || isNaN(numQuestionsToAsk)) { // numQuestionsToAsk can be 0 if user wants all available
        showError(`Invalid time (${quizTimeStr}) or number of questions (${numQuestionsStr}). Time must be positive. Number of questions must be a non-negative integer.`);
        return;
    }
    if (numQuestionsToAsk < 0) { // Specifically check for negative
        showError(`Number of questions (${numQuestionsStr}) cannot be negative.`);
        return;
    }
    console.log(`k_quiz.js: Quiz params: Time=${quizTimeMinutes}m, Questions=${numQuestionsToAsk === 0 ? 'All Available' : numQuestionsToAsk}`);


    try {
        console.log("k_quiz.js: Attempting JSON.parse on question data...");
        allQuestions = JSON.parse(allQuestionsDataString);
        if (!Array.isArray(allQuestions)) {
            throw new Error("Parsed question data is not an array.");
        }
        console.log(`k_quiz.js: JSON.parse successful. ${allQuestions.length} total questions loaded from storage.`);
        if (allQuestions.length === 0 && numQuestionsToAsk > 0) { // Only an error if asking for questions but none exist
             showError("Question data from storage is an empty array, but questions were requested. Please check synced data.");
             return;
        }
        if (numQuestionsToAsk === 0) { // If 0 is specified, it means use all available questions
            numQuestionsToAsk = allQuestions.length;
            console.log(`k_quiz.js: numQuestionsToAsk was 0, now set to all available: ${numQuestionsToAsk}`);
        }

    } catch (e) {
        showError(`Error parsing question data from storage: ${e.message}. The data might be corrupted.`);
        console.error("Data string that failed parsing (first 500 chars):", allQuestionsDataString ? allQuestionsDataString.substring(0,500) : "null");
        return;
    }

    if (submitQuizButton) {
        submitQuizButton.addEventListener('click', () => submitAndFinalize("Completed"));
    } else {
        console.error("k_quiz.js CRITICAL: Submit Quiz button not found. Quiz submission will not work.");
    }

    console.log("k_quiz.js: All initial setup and function definitions complete. Calling initializeQuiz().");
    initializeQuiz();
});
