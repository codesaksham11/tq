document.addEventListener('DOMContentLoaded', () => {
    // Retrieve quiz results from localStorage
    const quizResults = JSON.parse(localStorage.getItem('quizResults'));
    if (!quizResults) {
        alert('No quiz results found.');
        window.location.href = 'k.html';
        return;
    }

    // Get DOM elements
    const scoreEl = document.getElementById('score');
    const timeTakenEl = document.getElementById('timeTaken');
    const toggleDetailsButton = document.getElementById('toggleDetails');
    const detailsEl = document.getElementById('details');
    const backButton = document.getElementById('backButton');

    // Calculate and display score and time taken
    const correctCount = quizResults.answeredQuestionsDetail.filter(q => q.isCorrect).length;
    const totalQuestions = quizResults.totalQuestionsAsked;
    const timeTaken = quizResults.timeTaken;

    scoreEl.textContent = `Correct Answers: ${correctCount} / ${totalQuestions}`;
    timeTakenEl.textContent = `Time Taken: ${timeTaken} seconds`;

    // Toggle details functionality
    toggleDetailsButton.addEventListener('click', () => {
        if (detailsEl.style.display === 'none') {
            detailsEl.style.display = 'block';
            toggleDetailsButton.textContent = 'Hide Details';
        } else {
            detailsEl.style.display = 'none';
            toggleDetailsButton.textContent = 'Show Details';
        }
    });

    // Back button functionality
    backButton.addEventListener('click', () => {
        window.location.href = 'k.html';
    });

    // Generate detailed view
    quizResults.answeredQuestionsDetail.forEach((question, index) => {
        const questionBox = document.createElement('div');
        questionBox.classList.add('question-box');

        // Apply background color based on answer status
        if (question.userAnswer === 'Not answered') {
            questionBox.classList.add('skipped');
        } else if (question.isCorrect) {
            questionBox.classList.add('correct');
        } else {
            questionBox.classList.add('wrong');
        }

        // Add question text
        const questionText = document.createElement('p');
        questionText.textContent = `Q${index + 1}: ${question.questionText}`;
        questionBox.appendChild(questionText);

        // Add options with emojis
        question.options.forEach(option => {
            const optionEl = document.createElement('div');
            optionEl.classList.add('option');
            let emoji = '';
            if (option === question.correctAnswer) {
                emoji = ' ✅'; // Correct answer
            } else if (option === question.userAnswer && !question.isCorrect) {
                emoji = ' ❌'; // Wrong answer chosen
            }
            optionEl.textContent = option + emoji;
            questionBox.appendChild(optionEl);
        });

        detailsEl.appendChild(questionBox);
    });
});
