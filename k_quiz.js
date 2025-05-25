document.addEventListener('DOMContentLoaded', () => {
    console.log("k_quiz.js: DOMContentLoaded fired.");

    // Get DOM elements
    const timerEl = document.getElementById('timer');
    const questionNumberEl = document.getElementById('questionNumber');
    const questionTextEl = document.getElementById('questionText');
    const optionsContainerEl = document.getElementById('optionsContainer');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const submitButton = document.getElementById('submitButton');
    const feedbackEl = document.getElementById('feedback');
    const quizContentEl = document.getElementById('quizContent');
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');
    const progressBarEl = document.getElementById('progressBar');
    const progressFillEl = document.getElementById('progressFill');

    // Ensure critical DOM elements for error display are found
    if (!loadingMessageEl) console.error("k_quiz.js CRITICAL: loadingMessageEl not found!");
    if (!quizContentEl) console.error("k_quiz.js CRITICAL: quizContentEl not found!");
    if (!errorMessageEl) console.error("k_quiz.js CRITICAL: errorMessageEl not found!");

    let allQuestions = [];
    let selectedQuestions = [];
    let currentQuestionIndex = 0;
    let userAnswers = {}; // Changed to object to store answers by question index
    let timeLeft = 0;
    let timerInterval;
    let startTime = 0;
    let quizTimeMinutes = 0;
    let numQuestionsToAsk = 0;

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
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#x27;");
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

        if (typeof correctAnswer === 'undefined' || correctAnswer === null || correctAnswer.toString().trim() === '') {
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
            console.warn(`k_quiz.js: Q ID ${currentQ.id} has an unknown Type "${currentQ.Type}" or missing Class for "class" type. Only correct answer will be an option initially.`);
        }

        // Ensure enough options, even if it means fewer than 4
        options = [...new Set(options.map(opt => (typeof opt === 'undefined' || opt === null) ? "N/A" : String(opt)))];
        shuffleArray(options);
        const finalOptions = options.slice(0, 4);
        
        // If not enough unique options were found, pad with generic distractors
        const genericPlaceholders = ["Option A", "Option B", "Option C", "Option D"];
        let placeholderIdx = 0;
        while(finalOptions.length < 2 && finalOptions.length < 4) {
            const placeholder = genericPlaceholders[placeholderIdx++];
            if (!finalOptions.includes(placeholder)) {
                finalOptions.push(placeholder);
            }
            if (placeholderIdx >= genericPlaceholders.length) break;
        }

        console.log(`k_quiz.js: Q ID ${currentQ.id}: Final options generated:`, finalOptions);
        return finalOptions;
    }

    function updateProgress() {
        if (progressFillEl) {
            const answeredCount = Object.keys(userAnswers).length;
            const progressPercentage = selectedQuestions.length > 0 ? (answeredCount / selectedQuestions.length) * 100 : 0;
            progressFillEl.style.width = `${progressPercentage}%`;
        }
    }

    function displayQuestion() {
        console.log(`k_quiz.js: displayQuestion called for question index ${currentQuestionIndex}. Total selected: ${selectedQuestions.length}`);
        if (currentQuestionIndex >= selectedQuestions.length || currentQuestionIndex < 0) {
            console.log("k_quiz.js: Invalid question index.");
            return;
        }

        const question = selectedQuestions[currentQuestionIndex];
        if (!question) {
            showError(`Critical Error: Question object at index ${currentQuestionIndex} is undefined. This should not happen.`);
            return;
        }
        console.log(`k_quiz.js: Displaying Q ID: ${question.id}, Text: "${question.questionText}"`);

        if (!questionNumberEl || !questionTextEl || !optionsContainerEl || !feedbackEl) {
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
        } else {
            options.forEach((optionText, index) => {
                const optionId = `option${index}`;
                const div = document.createElement('div');
                div.classList.add('option');
                
                const displayOptionText = escapeHtml(optionText);
                const valueOptionText = escapeHtml(optionText);

                div.innerHTML = `
                    <input type="radio" id="${optionId}" name="quizOption" value="${valueOptionText}">
                    <label for="${optionId}">${displayOptionText}</label>
                `;
                optionsContainerEl.appendChild(div);
            });
        }

        // Restore previously selected answer if exists
        if (userAnswers[currentQuestionIndex]) {
            const savedAnswer = userAnswers[currentQuestionIndex].userAnswer;
            const radioToCheck = optionsContainerEl.querySelector(`input[name="quizOption"][value="${savedAnswer}"]`);
            if (radioToCheck) {
                radioToCheck.checked = true;
            }
        }

        // Update navigation buttons
        updateNavigationButtons();
        updateProgress();

        // Add event listeners for radio buttons
        optionsContainerEl.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                saveCurrentAnswer();
                updateNavigationButtons();
                updateProgress();
            });
        });

        console.log(`k_quiz.js: Q ID ${question.id} display setup complete.`);
    }

    function saveCurrentAnswer() {
        const selectedOptionInput = optionsContainerEl.querySelector('input[name="quizOption"]:checked');
        if (!selectedOptionInput) return;

        const currentQ = selectedQuestions[currentQuestionIndex];
        const userAnswer = selectedOptionInput.value;
        const correctAnswer = currentQ.Answer;

        userAnswers[currentQuestionIndex] = {
            questionId: currentQ.id,
            questionText: currentQ.questionText,
            options: Array.from(optionsContainerEl.querySelectorAll('label')).map(l => l.textContent),
            correctAnswer: String(correctAnswer),
            userAnswer: String(userAnswer),
            isCorrect: String(userAnswer) === String(correctAnswer)
        };

        console.log(`k_quiz.js: Saved answer for Q${currentQuestionIndex + 1}: "${userAnswer}"`);
    }

    function updateNavigationButtons() {
        if (prevButton) {
            prevButton.disabled = currentQuestionIndex === 0;
        }
        
        if (nextButton) {
            nextButton.disabled = currentQuestionIndex >= selectedQuestions.length - 1;
        }

        if (submitButton) {
            // Enable submit if at least one question is answered
            const hasAnswers = Object.keys(userAnswers).length > 0;
            submitButton.disabled = !hasAnswers;
            
            // Show different text based on completion
            const answeredCount = Object.keys(userAnswers).length;
            const totalCount = selectedQuestions.length;
            
            if (answeredCount === totalCount) {
                submitButton.textContent = `Submit Quiz (All ${totalCount} answered)`;
            } else {
                submitButton.textContent = `Submit Quiz (${answeredCount}/${totalCount} answered)`;
            }
        }
    }

    function startTimer() {
        console.log("k_quiz.js: startTimer called.");
        if (!timerEl) {
            console.error("k_quiz.js: Timer element not found. Timer will not start.");
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

    function handlePrevQuestion() {
        console.log("k_quiz.js: handlePrevQuestion called.");
        saveCurrentAnswer();
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion();
        }
    }

    function handleNextQuestion() {
        console.log("k_quiz.js: handleNextQuestion called.");
        saveCurrentAnswer();
        if (currentQuestionIndex < selectedQuestions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        }
    }

    function handleSubmitQuiz() {
        console.log("k_quiz.js: handleSubmitQuiz called.");
        saveCurrentAnswer();
        
        const answeredCount = Object.keys(userAnswers).length;
        const totalCount = selectedQuestions.length;
        const unansweredCount = totalCount - answeredCount;
        
        if (unansweredCount > 0) {
            const confirmMessage = `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. Submit anyway?`;
            if (!confirm(confirmMessage)) {
                return;
            }
        }
        
        finalizeQuiz("Completed");
    }

    function finalizeQuiz(status) {
        console.log(`k_quiz.js: finalizeQuiz called with status: ${status}`);
        if (timerInterval) clearInterval(timerInterval);
        const endTime = Date.now();
        const timeTakenMs = endTime - startTime;
        const timeTakenSec = startTime === 0 ? quizTimeMinutes * 60 : Math.round(timeTakenMs / 1000);

        // Convert userAnswers object to array for results
        const answeredQuestionsDetail = [];
        for (let i = 0; i < selectedQuestions.length; i++) {
            if (userAnswers[i]) {
                answeredQuestionsDetail.push(userAnswers[i]);
            } else {
                // Add unanswered question
                const question = selectedQuestions[i];
                answeredQuestionsDetail.push({
                    questionId: question.id,
                    questionText: question.questionText,
                    options: generateOptions(question),
                    correctAnswer: String(question.Answer),
                    userAnswer: null,
                    isCorrect: false
                });
            }
        }

        let quizResults = {
            totalQuestionsAsked: selectedQuestions.length,
            answeredQuestionsDetail: answeredQuestionsDetail,
            status: status,
            timeTaken: status === "Time Out" ? quizTimeMinutes * 60 : timeTakenSec,
            maxTime: quizTimeMinutes * 60,
            score: answeredQuestionsDetail.filter(ans => ans.isCorrect).length,
            answeredCount: Object.keys(userAnswers).length,
            skippedCount: selectedQuestions.length - Object.keys(userAnswers).length
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
            console.warn(`k_quiz.js: Requested ${numQuestionsToAsk} questions, but only ${allQuestions.length} are available in total. Using all ${allQuestions.length} available.`);
        }
        
        selectedQuestions = selectRandomQuestions(allQuestions, numQuestionsToAsk);

        if (selectedQuestions.length === 0 && numQuestionsToAsk > 0) {
            showError(`No questions could be selected for the quiz. Source has ${allQuestions.length} questions, ${numQuestionsToAsk} were requested. Check data or parameters.`);
            return; 
        }
        console.log(`k_quiz.js: ${selectedQuestions.length} questions selected for this quiz session.`);
        
        userAnswers = {};
        currentQuestionIndex = 0;
        
        console.log("k_quiz.js: Attempting to update UI (hide loading, show quiz)...");
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (quizContentEl) quizContentEl.style.display = 'block';
        console.log("k_quiz.js: UI update to show quiz content complete.");

        if (selectedQuestions.length > 0) {
            startTimer();
            displayQuestion();
        } else {
            console.log("k_quiz.js: No questions to display (0 selected or 0 requested). Quiz will not start.");
            if(questionTextEl) questionTextEl.textContent = "No questions are available for this quiz configuration.";
            if(optionsContainerEl) optionsContainerEl.innerHTML = "";
            if(nextButton) nextButton.style.display = 'none';
            if(prevButton) prevButton.style.display = 'none';
            if(submitButton) submitButton.style.display = 'none';
            if(timerEl) timerEl.textContent = "00:00";
            if(questionNumberEl) questionNumberEl.textContent = "Question 0 of 0";
        }
    }

    // MAIN INITIALIZATION - NOW INSIDE DOMContentLoaded
    console.log("k_quiz.js: Attempting to load data from localStorage.");
    
    // Try to get data from localStorage with error handling
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
    console.log("  quizTimeStr:", quizTimeStr);
    console.log("  numQuestionsStr:", numQuestionsStr);
    console.log("  allQuestionsDataString (first 100 chars):", allQuestionsDataString ? allQuestionsDataString.substring(0, 100) + "..." : "null or empty");

    quizTimeMinutes = parseInt(quizTimeStr, 10);
    numQuestionsToAsk = parseInt(numQuestionsStr, 10);

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

    // Add event listeners for navigation buttons
    if (prevButton) {
        prevButton.addEventListener('click', handlePrevQuestion);
    } else {
        console.error("k_quiz.js: Previous button not found.");
    }

    if (nextButton) {
        nextButton.addEventListener('click', handleNextQuestion);
    } else {
        console.error("k_quiz.js: Next button not found.");
    }

    if (submitButton) {
        submitButton.addEventListener('click', handleSubmitQuiz);
    } else {
        console.error("k_quiz.js CRITICAL: Submit button not found. Quiz submission will not work.");
    }

    console.log("k_quiz.js: All initial setup and function definitions complete. Calling initializeQuiz().");
    initializeQuiz();
});
