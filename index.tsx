/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai';

interface Flashcard {
  term: string;
  definition: string;
}

// DOM Elements
const topicInput = document.getElementById('topicInput') as HTMLTextAreaElement;
const generateButton = document.getElementById(
  'generateButton',
) as HTMLButtonElement;
const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
const loadButton = document.getElementById('loadButton') as HTMLButtonElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const flashcardsContainer = document.getElementById(
  'flashcardsContainer',
) as HTMLDivElement;
const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;

// App state
let currentFlashcards: Flashcard[] = [];

// Initialize GenAI
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

/**
 * Renders a list of flashcards to the DOM.
 * @param {Flashcard[]} flashcards - The array of flashcards to render.
 */
function renderFlashcards(flashcards: Flashcard[]) {
  // Clear previous flashcards
  flashcardsContainer.textContent = '';

  if (flashcards.length === 0) {
    saveButton.classList.add('hidden');
    return;
  }

  flashcards.forEach((flashcard, index) => {
    // Create card structure for flipping
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('flashcard');
    cardDiv.dataset['index'] = index.toString();
    cardDiv.setAttribute('aria-label', `Flashcard for ${flashcard.term}. Click to flip.`);
    cardDiv.setAttribute('role', 'button');
    cardDiv.tabIndex = 0; // Make it focusable

    const cardInner = document.createElement('div');
    cardInner.classList.add('flashcard-inner');

    const cardFront = document.createElement('div');
    cardFront.classList.add('flashcard-front');
    const termDiv = document.createElement('div');
    termDiv.classList.add('term');
    termDiv.textContent = flashcard.term;

    const cardBack = document.createElement('div');
    cardBack.classList.add('flashcard-back');
    const definitionDiv = document.createElement('div');
    definitionDiv.classList.add('definition');
    definitionDiv.textContent = flashcard.definition;

    cardFront.appendChild(termDiv);
    cardBack.appendChild(definitionDiv);
    cardInner.appendChild(cardFront);
    cardInner.appendChild(cardBack);
    cardDiv.appendChild(cardInner);
    flashcardsContainer.appendChild(cardDiv);

    const flipCard = () => cardDiv.classList.toggle('flipped');

    // Add click listener to toggle the 'flipped' class
    cardDiv.addEventListener('click', flipCard);
    // Add keyboard accessibility
    cardDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            flipCard();
        }
    });
  });

  // Show the save button
  saveButton.classList.remove('hidden');
}


// Event Listeners

generateButton.addEventListener('click', async () => {
  const topic = topicInput.value.trim();
  if (!topic) {
    errorMessage.textContent =
      'Please enter a topic or some terms and definitions.';
    currentFlashcards = [];
    renderFlashcards(currentFlashcards);
    return;
  }

  errorMessage.textContent = 'Generating flashcards...';
  flashcardsContainer.textContent = '';
  generateButton.disabled = true;
  loadButton.disabled = true;
  saveButton.classList.add('hidden');

  try {
    const prompt = `Generate a list of flashcards for the topic of "${topic}". Each flashcard should have a term and a concise definition. Format the output as a list of "Term: Definition" pairs, with each pair on a new line. Ensure terms and definitions are distinct and clearly separated by a single colon. Here's an example output:
    Hello: Hola
    Goodbye: Adiós`;
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const responseText = result?.text ?? '';

    if (responseText) {
      const flashcards: Flashcard[] = responseText
        .split('\n')
        .map((line) => {
          const parts = line.split(':');
          if (parts.length >= 2 && parts[0].trim()) {
            const term = parts[0].trim();
            const definition = parts.slice(1).join(':').trim();
            if (definition) {
              return {term, definition};
            }
          }
          return null;
        })
        .filter((card): card is Flashcard => card !== null); 

      if (flashcards.length > 0) {
        currentFlashcards = flashcards;
        renderFlashcards(currentFlashcards);
        errorMessage.textContent = '';
      } else {
        errorMessage.textContent =
          'No valid flashcards could be generated. Please try a different topic or check the format.';
        currentFlashcards = [];
        renderFlashcards(currentFlashcards);
      }
    } else {
      errorMessage.textContent =
        'Failed to generate flashcards or received an empty response. Please try again.';
    }
  } catch (error: unknown) {
    console.error('Error generating content:', error);
    const detailedError =
      (error as Error)?.message || 'An unknown error occurred';
    errorMessage.textContent = `An error occurred: ${detailedError}`;
    currentFlashcards = [];
    renderFlashcards(currentFlashcards);
  } finally {
    generateButton.disabled = false;
    loadButton.disabled = false;
  }
});


saveButton.addEventListener('click', () => {
  if (currentFlashcards.length === 0) {
    errorMessage.textContent = 'No flashcards to save.';
    return;
  }
  
  const jsonString = JSON.stringify(currentFlashcards, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flashcards.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});


loadButton.addEventListener('click', () => {
    fileInput.click();
});


fileInput.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const data = JSON.parse(text);

            // Validate the loaded data structure
            if (Array.isArray(data) && data.every(item => typeof item === 'object' && 'term' in item && 'definition' in item)) {
                currentFlashcards = data;
                renderFlashcards(currentFlashcards);
                errorMessage.textContent = '';
            } else {
                throw new Error('Error en la carga de los objetos json {term, definition} .');
            }
        } catch (error) {
            console.error('Error reading or parsing file:', error);
            const detailedError = (error as Error)?.message || 'An unknown error occurred';
            errorMessage.textContent = `Failed to load file: ${detailedError}`;
            currentFlashcards = [];
            renderFlashcards(currentFlashcards);
        }
    };
    reader.onerror = () => {
        errorMessage.textContent = 'Error reading the selected file.';
    };
    reader.readAsText(file);

    // Reset file input to allow loading the same file again
    fileInput.value = '';
});

/**
 * Checks for a 'file' URL parameter on page load and fetches the flashcards.
 */
async function loadFlashcardsFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const fileUrl = urlParams.get('file');

  if (fileUrl) {
    const controls = document.getElementById('controls');
    if (controls) {
      (controls as HTMLElement).style.display = 'none';
    }

    errorMessage.textContent = `Loading flashcards...`;

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Network response was not ok, status: ${response.status}`);
      }
      const data = await response.json();

      // Validate the loaded data structure
      if (Array.isArray(data) && data.every(item => typeof item === 'object' && 'term' in item && 'definition' in item)) {
          currentFlashcards = data;
          renderFlashcards(currentFlashcards);
          errorMessage.textContent = '';
      } else {
          throw new Error('Invalid file content. Expected an array of {term, definition} objects.');
      }
    } catch (error) {
      console.error('Error loading file from URL:', error);
      const detailedError = (error as Error)?.message || 'An unknown error occurred';
      errorMessage.textContent = `Failed to load file from URL: ${detailedError}`;
      currentFlashcards = [];
      renderFlashcards(currentFlashcards);
    }
  }
}

// Run on page load to check for URL parameter
document.addEventListener('DOMContentLoaded', loadFlashcardsFromUrl);
