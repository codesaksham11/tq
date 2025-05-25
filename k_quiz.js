document.addEventListener('DOMContentLoaded', () => {
    console.log("k_quiz.js: DOMContentLoaded fired.");

    // Get DOM elements
    const timerEl = document.getElementById('timer');
    const questionsContainerEl = document.getElementById('questionsContainer');
    const submitButton = document.getElementById('submitButton');
    const quizContentEl = document.getElementById('quizContent');
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');
    const progressFillEl = document.getElementById('progressFill');
    const progressTextEl = document.getElementById('progressText');
    const quizDescriptionEl = document.getElementById('quizDescription');

    // Ensure critical DOM elements for error display are found
    if (!loadingMessageEl) console.error("k_quiz.js CRITICAL: loadingMessageEl not found!");
    if (!quizContentEl) console.error("k_quiz.js CRITICAL: quizContentEl not found!");
    if (!errorMessageEl) console.error("k_quiz.js CRITICAL: errorMessageEl not found!");

    let allQuestions = [];
    let selectedQuestions = [];
    let userAnswers = [];
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

    function displayAllQuestions() {
        console.log(`k_quiz.js: displayAllQuestions called for ${selectedQuestions.length} questions`);
        
        if (selectedQuestions.length === 0) {
            console.log("k_quiz.js: No questions to display.");
            questionsContainerEl.innerHTML = '<p>No questions available for this quiz configuration.</p>';
            return;
        }

        questionsContainerEl.innerHTML = '';

        selectedQuestions.forEach((question, index) => {
            const questionCard = document.createElement('div');
            questionCard.classList.add('question-card');
            questionCard.dataset.questionIndex = index;

            const options = generateOptions(question);
            
            let optionsHtml = '';
            if (!options || options.length === 0) {
                optionsHtml = '<p style="color: red;">Error: Could not load options for this question.</p>';
            } else {
                options.forEach((optionText, optionIndex) => {
                    const optionId = `q${index}_option${optionIndex}`;
                    const displayOptionText = escapeHtml(optionText);
                    const valueOptionText = escapeHtml(optionText);

                    optionsHtml += `
                        <div class="option">
                            <input type="radio" id="${optionId}" name="question_${index}" value="${valueOptionText}">
                            <label for="${optionId}">${displayOptionText}</label>
                        </div>
                    `;
                });
            }

            questionCard.innerHTML = `
                <div class="question-header">
                    <div class="question-number">${index + 1}</div>
                    <div class="question-text">${escapeHtml(question.questionText || "(Error: Question text missing)")}</div>
                </div>
                <div class="options-container">
                    ${optionsHtml}
                </div>
            `;

            questionsContainerEl.appendChild(questionCard);
        });

        // Add event listeners for progress tracking
        addProgressTrackingListeners();
        updateProgress();
        
        console.log(`k_quiz.js: All ${selectedQuestions.length} questions displayed.`);
    }

    function addProgressTrackingListeners() {
        const allRadios = questionsContainerEl.querySelectorAll('input[type="radio"]');
        allRadios.forEach(radio => {
            radio.addEventListener('change', updateProgress);
        });
    }

    function updateProgress() {
        const totalQuestions = selectedQuestions.length;
        let answeredQuestions = 0;

        for (let i = 0; i < totalQuestions; i++) {
            const questionRadios = questionsContainerEl.querySelectorAll(`input[name="question_${i}"]`);
            const isAnswered = Array.from(questionRadios).some(radio => radio.checked);
            if (isAnswered) answeredQuestions++;
        }

        const progressPercentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
        
        if (progressFillEl) {
            progressFillEl.style.width = `${progressPercentage}%`;
        }
        
        if (progressTextEl) {
            progressTextEl.textContent = `${answeredQuestions} of ${totalQuestions} questions answered`;
        }

        console.log(`Progress: ${answeredQuestions}/${totalQuestions} (${progressPercentage.toFixed(1)}%)`);
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
                handleSubmitQuiz("Time Out");
            }
        }, 1000);
        console.log("k_quiz.js: Timer started. Time left:", timeLeft);
    }

    function collectUserAnswers() {
        userAnswers = [];
        
        selectedQuestions.forEach((question, index) => {
            const questionRadios = questionsContainerEl.querySelectorAll(`input[name="question_${index}"]`);
            const selectedRadio = Array.from(questionRadios).find(radio => radio.checked);
            
            const allOptions = Array.from(questionsContainerEl.querySelectorAll(`input[name="question_${index}"]`))
                .map(radio => radio.nextElementSibling.textContent);
            
            const userAnswer = selectedRadio ? selectedRadio.value : null;
            const correctAnswer = String(question.Answer);
            
            userAnswers.push({
                questionId: question.id,
                questionText: question.questionText,
                options: allOptions,
                correctAnswer: correctAnswer,
                userAnswer: userAnswer,
                isCorrect: userAnswer !== null && String(userAnswer) === correctAnswer
            });
        });
        
        console.log("k_quiz.js: User answers collected:", userAnswers);
    }

    function handleSubmitQuiz(status = "Completed") {
        console.log(`k_quiz.js: handleSubmitQuiz called with status: ${status}`);
        
        if (timerInterval) clearInterval(timerInterval);
        
        collectUserAnswers();
        
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
            console.warn(`k_quiz.js: Requested ${numQuestionsToAsk} questions, but only ${allQuestions.length} are available in total. Using all ${allQuestions.length} available.`);
        }
        
        selectedQuestions = selectRandomQuestions(allQuestions, numQuestionsToAsk);

        if (selectedQuestions.length === 0 && numQuestionsToAsk > 0) {
            showError(`No questions could be selected for the quiz. Source has ${allQuestions.length} questions, ${numQuestionsToAsk} were requested. Check data or parameters.`);
            return; 
        }
        
        console.log(`k_quiz.js: ${selectedQuestions.length} questions selected for this quiz session.`);
        
        // Update quiz description
        if (quizDescriptionEl) {
            quizDescriptionEl.textContent = `Answer all ${selectedQuestions.length} questions below. Time limit: ${quizTimeMinutes} minutes.`;
        }
        
        userAnswers = [];
        
        console.log("k_quiz.js: Attempting to update UI (hide loading, show quiz)...");
        if (loadingMessageEl) loadingMessageEl.style.display = 'none';
        if (quizContentEl) quizContentEl.style.display = 'block';
        console.log("k_quiz.js: UI update to show quiz content complete.");

        if (selectedQuestions.length > 0) {
            displayAllQuestions();
            startTimer();
        } else {
            console.log("k_quiz.js: No questions to display (0 selected or 0 requested). Quiz will not start.");
            if (questionsContainerEl) questionsContainerEl.innerHTML = '<p>No questions are available for this quiz configuration.</p>';
            if (submitButton) submitButton.style.display = 'none';
            if (timerEl) timerEl.textContent = "00:00";
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
        if (allQuestions.length ===
