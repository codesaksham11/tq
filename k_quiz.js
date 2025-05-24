document.addEventListener('DOMContentLoaded', () => {
    const quizTimeMinutes = parseInt(localStorage.getItem('quizTime'), 10);
    const numQuestionsToAsk = parseInt(localStorage.getItem('quizQuestions'), 10);
    const allQuestionsDataString = localStorage.getItem('structuredSpreadsheetJsData_v2');

    const timerEl = document.getElementById('timer');
    const questionNumberEl = document.getElementById('questionNumber');
    const questionTextEl = document.getElementById('questionText');
    const optionsContainerEl = document.getElementById('optionsContainer');
    const nextButton = document.getElementById('nextButton');
    const feedbackEl = document.getElementById('feedback');
    const quizContentEl = document.getElementById('quizContent');
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');

    let allQuestions = [];
    let selectedQuestions = [];
    let currentQuestionIndex = 0;
    let userAnswers = []; // To store { questionId, questionText, options, correctAnswer, userAnswer, isCorrect }
    let timeLeft = 0;
    let timerInterval;
    const startTime = Date.now();

    if (isNaN(quizTimeMinutes) || isNaN(numQuestionsToAsk) || !allQuestionsDataString) {
        showError("Quiz configuration or data is missing. Please set up the quiz again.");
        return;
    }

    try {
        allQuestions = JSON.parse(allQuestionsDataString);
        if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
            showError("No questions found in the data. Please sync data or check the source.");
            return;
        }
    } catch (e) {
        showError("Error parsing question data. It might be corrupted.");
        console.error("Error parsing JSON data:", e);
        return;
    }

    // --- Helper Functions ---
    function showError(message) {
        loadingMessageEl.style.display = 'none';
        quizContentEl.style.display = 'none';
        errorMessageEl.textContent = message;
        errorMessageEl.style.display = 'block';
        if (timerInterval) clearInterval(timerInterval);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function selectRandomQuestions(questions, count) {
        const shuffled = [...questions];
        shuffleArray(shuffled);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function startTimer() {
        timeLeft = quizTimeMinutes * 60;
        timerEl.textContent = formatTime(timeLeft);
        timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                finalizeQuiz("Time Out");
            }
        }, 1000);
    }

    // --- Quiz Logic ---
    function generateOptions(currentQ) {
        let options = [];
        const correctAnswer = currentQ.Answer;
        options.push(correctAnswer);

        if (currentQ.Type && currentQ.Type.toLowerCase() === 'fixed') {
            if (currentQ.Distraction_1) options.push(currentQ.Distraction_1);
            if (currentQ.Distraction_2) options.push(currentQ.Distraction_2);
            if (currentQ.Distraction_3) options.push(currentQ.Distraction_3);
        } else if (currentQ.Type && currentQ.Type.toLowerCase() === 'class' && currentQ.Class) {
            const sameClassDistractors = allQuestions
                .filter(q => q.Class === currentQ.Class && q.id !== currentQ.id && q.Answer && q.Answer.trim() !== "")
                .map(q => q.Answer);

            shuffleArray(sameClassDistractors);
            for (let i = 0; i < sameClassDistractors.length && options.length < 4; i++) {
                if (!options.includes(sameClassDistractors[i])) {
                    options.push(sameClassDistractors[i]);
                }
            }
        }

        // Ensure we have 4 options, fill with generic placeholders if necessary, or less if not enough unique ones
        // For simplicity, we'll use what we have. If less than 4, it will show less.
        // A more robust way would be to ensure 4 distinct options, potentially pulling from a global distractor pool if needed.

        // Remove duplicates that might have occurred if correctAnswer was also a distractor
        options = [...new Set(options)];
        shuffleArray(options);
        return options.slice(0, 4); // Ensure max 4 options
    }


    function displayQuestion() {
        if (currentQuestionIndex >= selectedQuestions.length) {
            finalizeQuiz("Completed");
            return;
        }

        const question = selectedQuestions[currentQuestionIndex];
        questionNumberEl.textContent = `Question ${currentQuestionIndex + 1} of ${selectedQuestions.length}`;
        questionTextEl.textContent = question.questionText;
        optionsContainerEl.innerHTML = '';
        feedbackEl.textContent = ''; // Clear feedback

        const options = generateOptions(question);

        options.forEach((option, index) => {
            const optionId = `option${index}`;
            const div = document.createElement('div');
            div.classList.add('option');
            div.innerHTML = `
                <input type="radio" id="${optionId}" name="quizOption" value="${escapeHtml(option)}">
                <label for="${optionId}">${option}</label>
            `;
            optionsContainerEl.appendChild(div);
        });

        nextButton.textContent = (currentQuestionIndex === selectedQuestions.length - 1) ? "Submit Quiz" : "Next Question";
        nextButton.disabled = true; // Disabled until an option is selected

        // Enable Next button when an option is selected
        optionsContainerEl.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                nextButton.disabled = false;
            });
        });
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, """)
             .replace(/'/g, "'");
    }

    function handleNextQuestion() {
        const selectedOption = optionsContainerEl.querySelector('input[name="quizOption"]:checked');
        if (!selectedOption) {
            feedbackEl.textContent = "Please select an answer before proceeding.";
            return;
        }
        feedbackEl.textContent = "";

        const currentQ = selectedQuestions[currentQuestionIndex];
        const userAnswer = selectedOption.value;
        const correctAnswer = currentQ.Answer;

        userAnswers.push({
            questionId: currentQ.id,
            questionText: currentQ.questionText,
            options: Array.from(optionsContainerEl.querySelectorAll('label')).map(l => l.textContent),
            correctAnswer: correctAnswer,
            userAnswer: userAnswer,
            isCorrect: userAnswer === correctAnswer
        });

        currentQuestionIndex++;
        displayQuestion();
    }

    function finalizeQuiz(status) { // status can be "Completed" or "Time Out"
        clearInterval(timerInterval);
        const endTime = Date.now();
        const timeTakenMs = endTime - startTime;
        const timeTakenSec = Math.round(timeTakenMs / 1000);

        let quizResults = {
            totalQuestionsAsked: selectedQuestions.length,
            answeredQuestionsDetail: userAnswers,
            status: status, // "Completed" or "Time Out"
            timeTaken: status === "Time Out" ? quizTimeMinutes * 60 : timeTakenSec, // Store total time in seconds
            maxTime: quizTimeMinutes * 60,
            score: userAnswers.filter(ans => ans.isCorrect).length
        };

        localStorage.setItem('quizResults', JSON.stringify(quizResults));
        window.location.href = 'k_result.html';
    }


    // --- Initialization ---
    function initializeQuiz() {
        if (allQuestions.length < numQuestionsToAsk) {
            console.warn(`Requested ${numQuestionsToAsk} questions, but only ${allQuestions.length} are available. Using all available.`);
        }
        selectedQuestions = selectRandomQuestions(allQuestions, numQuestionsToAsk);

        if (selectedQuestions.length === 0) {
            showError("No questions could be selected for the quiz. The dataset might be empty or filtered out.");
            return;
        }
        
        userAnswers = [];
        currentQuestionIndex = 0;
        loadingMessageEl.style.display = 'none';
        quizContentEl.style.display = 'block';
        startTimer();
        displayQuestion();
    }

    nextButton.addEventListener('click', handleNextQuestion);

    // Start the quiz
    initializeQuiz();
});
