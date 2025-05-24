document.addEventListener('DOMContentLoaded', () => {
    console.log("k_quiz.js: DOMContentLoaded fired.");

    // Get DOM elements
    const timerEl = document.getElementById('timer');
    const questionNumberEl = document.getElementById('questionNumber');
    const questionTextEl = document.getElementById('questionText');
    const optionsContainerEl = document.getElementById('optionsContainer');
    const nextButton = document.getElementById('nextButton');
    const feedbackEl = document.getElementById('feedback');
    const quizContentEl = document.getElementById('quizContent');
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');

    // Ensure critical DOM elements for error display are found
    if (!loadingMessageEl) console.error("k_quiz.js CRITICAL: loadingMessageEl not found!");
    if (!quizContentEl) console.error("k_quiz.js CRITICAL: quizContentEl not found!");
    if (!errorMessageEl) console.error("k_quiz.js CRITICAL: errorMessageEl not found!");

    let allQuestions = [];
    let selectedQuestions = [];
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let timeLeft = 0;
    let timerInterval;
    let startTime = 0; // Will be set in initializeQuiz or startTimer

    // --- showError Function (defined early) ---
    function showError(message) {
        console.error("k_quiz.js - SHOW_ERROR CALLED:", message);
        if (timerInterval) clearInterval(timerInterval);
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (quizContentEl) quizContentEl.style.display = 'none';
        if (errorMessageEl) {
            errorMessageEl.innerHTML = message + ' Please <a href="k.html">go back</a>, check console, and try again.'; // Added link
            errorMessageEl.style.display = 'block';
        } else {
            alert("Quiz Error: " + message + ". Check console.");
        }
    }

    console.log("k_quiz.js: Attempting to load data from localStorage.");
    const quizTimeStr = localStorage.getItem('quizTime');
    const numQuestionsStr = localStorage.getItem('quizQuestions');
    const allQuestionsDataString = localStorage.getItem('structuredSpreadsheetJsData_v2');

    if (!quizTimeStr || !numQuestionsStr || !allQuestionsDataString) {
        let missing = [];
        if (!quizTimeStr) missing.push("quizTime");
        if (!numQuestionsStr) missing.push("numQuestions");
        if (!allQuestionsDataString) missing.push("question data (structuredSpreadsheetJsData_v2)");
        showError(`Critical data missing from localStorage: ${missing.join(', ')}.`);
        return;
    }
    console.log("k_quiz.js: All required localStorage items found.");
    console.log("  quizTimeStr:", quizTimeStr);
    console.log("  numQuestionsStr:", numQuestionsStr);
    console.log("  allQuestionsDataString (first 100 chars):", allQuestionsDataString ? allQuestionsDataString.substring(0, 100) + "..." : "null or empty");


    const quizTimeMinutes = parseInt(quizTimeStr, 10);
    const numQuestionsToAsk = parseInt(numQuestionsStr, 10);

    if (isNaN(quizTimeMinutes) || quizTimeMinutes <= 0 || isNaN(numQuestionsToAsk) || numQuestionsToAsk <= 0) {
        showError(`Invalid time (${quizTimeStr}) or number of questions (${numQuestionsStr}). Must be positive numbers set in k.html.`);
        return;
    }
    console.log(`k_quiz.js: Quiz params: Time=${quizTimeMinutes}m, Questions=${numQuestionsToAsk}`);

    try {
        console.log("k_quiz.js: Attempting JSON.parse on question data...");
        allQuestions = JSON.parse(allQuestionsDataString);
        if (!Array.isArray(allQuestions)) {
            throw new Error("Parsed question data is not an array.");
        }
        console.log(`k_quiz.js: JSON.parse successful. ${allQuestions.length} total questions loaded from storage.`);
        if (allQuestions.length === 0 && numQuestionsToAsk > 0) {
             showError("Question data from storage is an empty array, but questions were requested. Please check synced data.");
             return;
        }
    } catch (e) {
        showError(`Error parsing question data from storage: ${e.message}. The data might be corrupted.`);
        console.error("Data string that failed parsing (first 500 chars):", allQuestionsDataString ? allQuestionsDataString.substring(0,500) : "null");
        return;
    }

    // --- Helper Functions ---
    function shuffleArray(array) {
        // console.log("k_quiz.js: shuffleArray called for array of length:", array.length);
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') {
            if (unsafe === null || typeof unsafe === 'undefined') return '';
            return String(unsafe); // Convert numbers, booleans, etc., to string
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
        console.log(`k_quiz.js: generateOptions for Q ID: ${currentQ.id}, Text: "${currentQ.questionText}", Type: ${currentQ.Type}, Class: ${currentQ.Class}, Answer: "${currentQ.Answer}"`);
        let options = [];
        const correctAnswer = currentQ.Answer;

        if (typeof correctAnswer === 'undefined') {
            console.warn(`k_quiz.js: Question ID ${currentQ.id} has an UNDEFINED Answer. This is problematic.`);
            options.push("Error: Correct answer missing"); // Placeholder for undefined answer
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
                if (!options.map(String).includes(String(sameClassDistractors[i]))) { // Ensure string comparison for includes
                    options.push(sameClassDistractors[i]);
                    addedDistractorsCount++;
                }
            }
            console.log(`k_quiz.js: Q ID ${currentQ.id}: Found ${sameClassDistractors.length} potential class distractors, added ${addedDistractorsCount} unique ones.`);
        } else {
            console.warn(`k_quiz.js: Q ID ${currentQ.id} has an unknown Type "${currentQ.Type}" or missing Class for "class" type. Only correct answer will be an option initially.`);
        }

        // Ensure enough options, even if it means fewer than 4
        options = [...new Set(options.map(opt => (typeof opt === 'undefined' || opt === null) ? "N/A" : String(opt)))]; // Deduplicate and convert to string, handle undefined
        shuffleArray(options);
        const finalOptions = options.slice(0, 4); // Take up to 4 options
        
        // If not enough unique options were found, pad with generic distractors (example)
        // This is a basic way, might need more sophisticated placeholders
        const genericPlaceholders = ["Option A", "Option B", "Option C", "Option D"];
        let placeholderIdx = 0;
        while(finalOptions.length < 2 && finalOptions.length < numQuestionsToAsk && finalOptions.length < 4) { // Ensure at least 2 options if possible
            const placeholder = genericPlaceholders[placeholderIdx++];
            if (!finalOptions.includes(placeholder)) {
                finalOptions.push(placeholder);
            }
            if (placeholderIdx >= genericPlaceholders.length) break; // Avoid infinite loop
        }


        console.log(`k_quiz.js: Q ID ${currentQ.id}: Final options generated:`, finalOptions);
        return finalOptions;
    }

    function displayQuestion() {
        console.log(`k_quiz.js: displayQuestion called for question index ${currentQuestionIndex}. Total selected: ${selectedQuestions.length}`);
        if (currentQuestionIndex >= selectedQuestions.length) {
            console.log("k_quiz.js: All questions answered or no questions were selected. Finalizing quiz.");
            finalizeQuiz("Completed");
            return;
        }

        const question = selectedQuestions[currentQuestionIndex];
        if (!question) {
            showError(`Critical Error: Question object at index ${currentQuestionIndex} is undefined. This should not happen.`);
            return;
        }
        console.log(`k_quiz.js: Displaying Q ID: ${question.id}, Text: "${question.questionText}"`);

        if (!questionNumberEl || !questionTextEl || !optionsContainerEl || !nextButton || !feedbackEl) {
            showError("Critical Error: One or more HTML elements for quiz display are missing. Check IDs.");
            return;
        }

        questionNumberEl.textContent = `Question ${currentQuestionIndex + 1} of ${selectedQuestions.length}`;
        questionTextEl.textContent = question.questionText || "(Error: Question text missing)";
        optionsContainerEl.innerHTML = '';
        feedbackEl.textContent = '';

        const options = generateOptions(question);

        if (!options || options.length === 0) {
             console.warn(`k_quiz.js: No options generated for Q ID: ${question.id}. Displaying error message in options container.`);
             const p = document.createElement('p');
             p.textContent = "Error: Could not load options for this question. Please try advancing or check console.";
             p.style.color = "red";
             optionsContainerEl.appendChild(p);
             // nextButton.disabled = false; // Allow user to skip if options fail? Or keep disabled?
        } else {
            options.forEach((optionText, index) => {
                const optionId = `option${index}`;
                const div = document.createElement('div');
                div.classList.add('option');
                
                const displayOptionText = escapeHtml(optionText); // Already stringified and handled N/A in generateOptions
                const valueOptionText = escapeHtml(optionText);

                div.innerHTML = `
                    <input type="radio" id="${optionId}" name="quizOption" value="${valueOptionText}">
                    <label for="${optionId}">${displayOptionText}</label>
                `;
                optionsContainerEl.appendChild(div);
            });
        }

        nextButton.textContent = (currentQuestionIndex === selectedQuestions.length - 1) ? "Submit Quiz" : "Next Question";
        nextButton.disabled = true; // Disabled until an option is selected

        optionsContainerEl.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                nextButton.disabled = false;
                feedbackEl.textContent = '';
            });
        });
        console.log(`k_quiz.js: Q ID ${question.id} display setup complete.`);
    }

    function startTimer() {
        console.log("k_quiz.js: startTimer called.");
        if (!timerEl) {
            console.error("k_quiz.js: Timer element not found. Timer will not start.");
            return;
        }
        startTime = Date.now(); // Set actual start time
        timeLeft = quizTimeMinutes * 60;
        timerEl.textContent = formatTime(timeLeft);
        
        if (timerInterval) clearInterval(timerInterval); // Clear any existing interval

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

    function handleNextQuestion() {
        console.log("k_quiz.js: handleNextQuestion called.");
        const selectedOptionInput = optionsContainerEl.querySelector('input[name="quizOption"]:checked');
        if (!selectedOptionInput) {
            if (feedbackEl) feedbackEl.textContent = "Please select an answer before proceeding.";
            console.log("k_quiz.js: No option selected.");
            return;
        }
        if (feedbackEl) feedbackEl.textContent = "";

        const currentQ = selectedQuestions[currentQuestionIndex];
        const userAnswer = selectedOptionInput.value;
        const correctAnswer = currentQ.Answer; // Assuming Answer is always a string or handled by escapeHtml

        console.log(`k_quiz.js: Q ID ${currentQ.id} - User answer: "${userAnswer}", Correct answer: "${correctAnswer}"`);

        userAnswers.push({
            questionId: currentQ.id,
            questionText: currentQ.questionText,
            options: Array.from(optionsContainerEl.querySelectorAll('label')).map(l => l.textContent),
            correctAnswer: String(correctAnswer), // Ensure string
            userAnswer: String(userAnswer),       // Ensure string
            isCorrect: String(userAnswer) === String(correctAnswer) // String comparison
        });

        currentQuestionIndex++;
        displayQuestion(); // This will handle finalization if it's the last question
    }

    function finalizeQuiz(status) {
        console.log(`k_quiz.js: finalizeQuiz called with status: ${status}`);
        if (timerInterval) clearInterval(timerInterval);
        const endTime = Date.now();
        const timeTakenMs = endTime - startTime; // startTime should be set when timer starts
        const timeTakenSec = startTime === 0 ? quizTimeMinutes * 60 : Math.round(timeTakenMs / 1000); // Handle if timer never started


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
            // Don't redirect if saving failed, or inform user
            return; 
        }
        
        console.log("k_quiz.js: Redirecting to k_result.html");
        window.location.href = 'k_result.html';
    }

    function initializeQuiz() {
        console.log("k_quiz.js: initializeQuiz() called.");
        startTime = 0; // Reset start time, will be set by startTimer

        if (allQuestions.length < numQuestionsToAsk && numQuestionsToAsk > 0 && allQuestions.length > 0) {
            console.warn(`k_quiz.js: Requested ${numQuestionsToAsk} questions, but only ${allQuestions.length} are available in total. Using all ${allQuestions.length} available.`);
        }
        
        selectedQuestions = selectRandomQuestions(allQuestions, numQuestionsToAsk);

        if (selectedQuestions.length === 0 && numQuestionsToAsk > 0) {
            showError(`No questions could be selected for the quiz. Source has ${allQuestions.length} questions, ${numQuestionsToAsk} were requested. Check data or parameters.`);
            return; 
        }
        console.log(`k_quiz.js: ${selectedQuestions.length} questions selected for this quiz session.`);
        
        userAnswers = [];
        currentQuestionIndex = 0;
        
        console.log("k_quiz.js: Attempting to update UI (hide loading, show quiz)...");
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (quizContentEl) quizContentEl.style.display = 'block';
        console.log("k_quiz.js: UI update to show quiz content complete.");

        if (selectedQuestions.length > 0) {
            startTimer(); // This will set startTime
            displayQuestion();
        } else {
            console.log("k_quiz.js: No questions to display (0 selected or 0 requested). Quiz will not start.");
            if(questionTextEl) questionTextEl.textContent = "No questions are available for this quiz configuration.";
            if(optionsContainerEl) optionsContainerEl.innerHTML = "";
            if(nextButton) nextButton.style.display = 'none';
            if(timerEl) timerEl.textContent = "00:00";
            if(questionNumberEl) questionNumberEl.textContent = "Question 0 of 0";
            // Optionally call finalizeQuiz here if 0 questions means immediate end
            // finalizeQuiz("Completed - No Questions"); 
        }
    }

    
    if (nextButton) {
        nextButton.addEventListener('click', handleNextQuestion);
    } else {
        console.error("k_quiz.js CRITICAL: Next button not found. Quiz navigation will not work.");
    }

    
    console.log("k_quiz.js: All initial setup and function definitions complete. Calling initializeQuiz().");
    initializeQuiz();
});
